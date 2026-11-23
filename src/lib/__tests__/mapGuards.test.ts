import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTrustedMapMessage, mapNavigationDecision } from '../../components/views/map/mapGuards.ts';

test('web : seuls les messages de l’iframe de la carte sont acceptés', () => {
  const iframe = {};
  assert.equal(isTrustedMapMessage(iframe, iframe), true);
  assert.equal(isTrustedMapMessage({}, iframe), false, 'autre fenêtre');
  assert.equal(isTrustedMapMessage(null, iframe), false);
  assert.equal(isTrustedMapMessage(iframe, null), false, 'iframe pas encore montée');
});

test('téléphone : la page de carte embarquée se charge', () => {
  for (const u of ['https://localhost', 'https://localhost/', 'https://localhost/index.html', 'about:blank', 'data:text/html,x', 'blob:https://localhost/abc', '']) {
    assert.equal(mapNavigationDecision(u), 'allow', u);
  }
});

test('téléphone : un lien https externe part dans le navigateur, jamais dans la WebView', () => {
  assert.equal(mapNavigationDecision('https://www.mapbox.com/about/maps/'), 'external');
  assert.equal(mapNavigationDecision('https://www.openstreetmap.org/copyright'), 'external');
});

test('téléphone : tout le reste est bloqué', () => {
  for (const u of ['javascript:alert(1)', 'http://exemple.fr', 'file:///etc/passwd', 'intent://x#Intent;end', 'https://localhost:8081/', 'https://user:pw@exemple.fr', 'lepetittou://admin', 'n importe quoi']) {
    assert.equal(mapNavigationDecision(u), 'block', u);
  }
});

test('la page de carte n’écoute que la page de l’appli (web) ou l’appli elle-même (téléphone)', () => {
  const src = readFileSync(new URL('../../components/views/map/mapboxHtmlTemplate.ts', import.meta.url), 'utf8');
  assert.match(src, /event\.source !== null && event\.source !== window\.parent\) return;/);
  // le pont du téléphone envoie bien des messages sans expéditeur, qui restent acceptés
  const bridge = readFileSync(new URL('../mapBridge.ts', import.meta.url), 'utf8');
  assert.match(bridge, /new MessageEvent\('message', \{ data:/);
});

test('MapView branche les deux garde-fous', () => {
  const src = readFileSync(new URL('../../components/views/MapView.tsx', import.meta.url), 'utf8');
  assert.match(src, /isTrustedMapMessage\(/);
  assert.match(src, /onShouldStartLoadWithRequest=/);
  assert.match(src, /mapNavigationDecision\(/);
});
