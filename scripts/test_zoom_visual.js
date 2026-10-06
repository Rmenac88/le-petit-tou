const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9228;

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function httpGet(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--window-size=1200,900',
    '--user-data-dir=/tmp/chrome_zoom_' + Date.now(),
    'http://localhost:8081'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const list = await httpGet(`http://localhost:${PORT}/json/list`);
      const target = list.find(t => t.url.includes('localhost:8081'));
      if (target) { wsUrl = target.webSocketDebuggerUrl; break; }
    } catch(e) {}
  }
  if (!wsUrl) {
    console.error('No WS URL found');
    chrome.kill();
    return;
  }

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = {};
  ws.on('message', d => {
    const m = JSON.parse(d);
    if (m.id && callbacks[m.id]) { callbacks[m.id](m.result); delete callbacks[m.id]; }
  });
  function send(method, params = {}) {
    return new Promise(r => {
      const cid = id++;
      callbacks[cid] = r;
      ws.send(JSON.stringify({ id: cid, method, params }));
    });
  }

  await new Promise(r => ws.on('open', r));
  await send('Page.enable');
  await send('Runtime.enable');
  await sleep(4000);

  // Take screenshot at initial zoom (13.8)
  const snap = async (name) => {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(shot.data, 'base64');
    fs.writeFileSync(`/Users/ryadhabdelmalek/.gemini/antigravity/brain/140271e8-32c0-496d-b57b-b149f386152b/scratch/${name}.png`, buffer);
    console.log('Saved', name);
  };

  await snap('zoom_step_0_init');

  // Let's inspect what happens during zoom steps: 13.8, 14.0, 14.2, 14.5, 15.0, 15.5, 16.0
  const zoomSteps = [13.8, 13.95, 14.0, 14.05, 14.2, 14.5, 15.0, 15.5, 16.0];
  for (let idx = 0; idx < zoomSteps.length; idx++) {
    const z = zoomSteps[idx];
    const info = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const iframe = document.querySelector('iframe');
          const win = iframe.contentWindow;
          win.map.setZoom(${z});
          const clusters = iframe.contentDocument.querySelectorAll('.lpt-cluster').length;
          const markers = iframe.contentDocument.querySelectorAll('.custom-marker-wrapper').length;
          return { zoom: win.map.getZoom(), clusters, markers };
        })()
      `,
      returnByValue: true
    });
    console.log(`Step ${idx} (target z=${z}):`, info.result ? info.result.value : info);
    await sleep(200);
    await snap(`zoom_step_${idx}_z${z}`);
  }

  chrome.kill();
}

main().catch(console.error);
