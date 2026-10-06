const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9224;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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
  console.log('Launching Chrome on port ' + PORT);
  const chrome = spawn(CHROME_PATH, [
    `--remote-debugging-port=${PORT}`,
    '--headless=new',
    '--window-size=1200,900',
    '--user-data-dir=/tmp/chrome_zoom_profile_' + Date.now(),
    'http://localhost:8081'
  ]);

  let wsUrl = null;
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const list = await httpGet(`http://localhost:${PORT}/json/list`);
      const target = list.find(t => t.url.includes('localhost:8081'));
      if (target) {
        wsUrl = target.webSocketDebuggerUrl;
        break;
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error('No target found');
    chrome.kill();
    return;
  }

  const ws = new WebSocket(wsUrl);
  let id = 1;
  const callbacks = {};

  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.id && callbacks[msg.id]) {
      callbacks[msg.id](msg.result);
      delete callbacks[msg.id];
    }
  });

  function send(method, params = {}) {
    return new Promise(resolve => {
      const currentId = id++;
      callbacks[currentId] = resolve;
      ws.send(JSON.stringify({ id: currentId, method, params }));
    });
  }

  await new Promise(r => ws.on('open', r));
  console.log('Connected to CDP');

  await send('Page.enable');
  await send('Runtime.enable');

  console.log('Waiting 5s for app load...');
  await sleep(5000);

  async function takeScreenshot(name) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    const path = `/Users/ryadhabdelmalek/.gemini/antigravity/brain/140271e8-32c0-496d-b57b-b149f386152b/scratch/${name}.png`;
    fs.writeFileSync(path, buf);
    console.log(`Saved screenshot: ${path}`);
    return path;
  }

  // Click on the Map tab in the dock (the dock is centered horizontally at bottom ~915px)
  // Window size is 1200x900. Center is x=500 (3rd icon of 5: ~500)
  // Let's use CDP Input.dispatchMouseEvent to click the 3rd icon
  console.log('Clicking Map tab...');
  // Find dock location by querySelector
  await send('Runtime.evaluate', {
    expression: `
      (function() {
        // Find the svg that looks like a map or 3rd svg in bottom container
        const svgs = document.querySelectorAll('svg');
        // Let's inspect svgs at bottom
        for (const s of svgs) {
          const rect = s.getBoundingClientRect();
          if (rect.top > 800) {
            console.log('Found bottom SVG at x=' + rect.x + ', y=' + rect.y);
          }
        }
      })()
    `
  });

  // Dispatch click at x=500, y=915
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 500, y: 915, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 500, y: 915, button: 'left' });

  await sleep(4000);
  await takeScreenshot('shot_map_initial');

  // Check if map is loaded in iframe
  const mapCheck = await send('Runtime.evaluate', {
    expression: `
      (function() {
        const iframe = document.querySelector('iframe');
        if (!iframe) return { error: 'No iframe' };
        try {
          const m = iframe.contentWindow.map;
          if (!m) return { error: 'No map on iframe window' };
          return {
            zoom: m.getZoom(),
            center: m.getCenter(),
            clusters: Object.keys(iframe.contentWindow.activeMarkers || {}).length
          };
        } catch(e) {
          return { error: e.message };
        }
      })()
    `,
    returnByValue: true
  });
  console.log('Map check:', JSON.stringify(mapCheck));

  // If map exists, test zooming to 13.8, 14.2, 15.0, 16.0
  async function testZoom(targetZoom, label) {
    console.log(`Setting zoom to ${targetZoom}...`);
    await send('Runtime.evaluate', {
      expression: `
        (function() {
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.contentWindow && iframe.contentWindow.map) {
            iframe.contentWindow.map.setZoom(${targetZoom});
          }
        })()
      `
    });
    await sleep(2000);
    const info = await send('Runtime.evaluate', {
      expression: `
        (function() {
          const iframe = document.querySelector('iframe');
          if (iframe && iframe.contentWindow) {
            const win = iframe.contentWindow;
            const markers = Object.keys(win.activeMarkers || {});
            const clusters = markers.filter(k => k.startsWith('cluster_'));
            const spots = markers.filter(k => k.startsWith('spot_'));
            const doc = iframe.contentDocument;
            const domElements = Array.from(doc.querySelectorAll('.custom-marker-wrapper'));
            const rects = domElements.map(el => {
              const r = el.getBoundingClientRect();
              return { x: Math.round(r.x), y: Math.round(r.y), transform: el.style.transform, display: el.style.display, opacity: win.getComputedStyle(el).opacity };
            });
            const inside = rects.filter(r => r.x >= 0 && r.x <= 1200 && r.y >= 0 && r.y <= 900);
            return {
              zoom: win.map.getZoom(),
              totalActiveMarkers: markers.length,
              domElementsCount: domElements.length,
              insideScreenCount: inside.length,
              sampleInside: inside.slice(0, 5),
              sampleOutside: rects.filter(r => !(r.x >= 0 && r.x <= 1200 && r.y >= 0 && r.y <= 900)).slice(0, 5),
              spotsCount: spots.length
            };
          }
          return null;
        })()
      `,
      returnByValue: true
    });
    console.log(`Zoom ${targetZoom} status:`, JSON.stringify(info));
    await takeScreenshot(`shot_zoom_${label}`);
  }

  if (mapCheck.result && mapCheck.result.value && !mapCheck.result.value.error) {
    await testZoom(13.5, '13_5');
    await testZoom(14.2, '14_2');
    await testZoom(15.5, '15_5');
    console.log('Testing dezoom to 10.0, 5.0, 2.0...');
    await testZoom(10.0, '10_0');
    await testZoom(5.0, '5_0');
    await testZoom(2.0, '2_0_globe');
  }

  chrome.kill();
  console.log('Done.');
}

main().catch(console.error);
