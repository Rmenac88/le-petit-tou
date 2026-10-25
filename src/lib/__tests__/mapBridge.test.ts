import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMapMessageScript, slimMapMessage, slimSpot, slimSpots, spotsKey, BRIDGE_BEFORE_LOAD } from '../mapBridge.ts';

test('slimMapMessage ne garde que les champs utiles à la carte et reprend title comme name', () => {
  const big = JSON.stringify({
    type: 'UPDATE_SPOTS',
    spots: [{ id: 'a', lat: 43.6, lng: 1.44, title: 'Chez Test', cat: 'food', rating: 4.5, description: 'x'.repeat(5000), image_url: 'u' }],
  });
  const slim = JSON.parse(slimMapMessage(big));
  assert.deepEqual(Object.keys(slim.spots[0]).sort(), ['cat', 'id', 'image_url', 'lat', 'lng', 'name', 'rating']);
  assert.equal(slim.spots[0].name, 'Chez Test');
  assert.ok(slimMapMessage(big).length < 300);
});

test('les messages sans liste, ou invalides, passent tels quels', () => {
  assert.equal(slimMapMessage('{"type":"RESET_TOULOUSE"}'), '{"type":"RESET_TOULOUSE"}');
  assert.equal(slimMapMessage('pas du json'), 'pas du json');
});

test('buildMapMessageScript produit un script valide qui rejoue le message, y compris guillemets et sauts de ligne', () => {
  const payload = JSON.stringify({ type: 'X', note: 'L\'été "chaud"\n' + String.fromCharCode(0x2028) + 'fin' });
  const script = buildMapMessageScript(payload);
  let received: any = null;
  const fakeWindow = { dispatchEvent: (e: any) => { received = e; return true; } };
  new Function('window', 'MessageEvent', script)(fakeWindow, class { data: string; constructor(_t: string, init: { data: string }) { this.data = init.data; } });
  assert.equal(received.data, payload);
});

test('le script d’amorçage redirige window.parent.postMessage vers React Native', () => {
  const sent: string[] = [];
  const win: any = { ReactNativeWebView: { postMessage: (m: string) => sent.push(m) } };
  new Function('window', BRIDGE_BEFORE_LOAD)(win);
  win.parent.postMessage('{"type":"MAP_READY"}', '*');
  win.parent.postMessage({ type: 'MAP_CLICKED' }, '*');
  assert.deepEqual(sent, ['{"type":"MAP_READY"}', '{"type":"MAP_CLICKED"}']);
});

test('une adresse n\'est allégée qu\'une fois (mémorisé par objet) et seuls les champs de la carte sont gardés', () => {
  const spot = { id: 'a', lat: 43.6, lng: 1.44, title: 'Chez Test', cat: 'food', rating: 4.5, description: 'x'.repeat(5000), gallery_urls: ['u'] };
  const first = slimSpot(spot);
  assert.equal(slimSpot(spot), first);
  assert.deepEqual(Object.keys(first).sort(), ['cat', 'id', 'lat', 'lng', 'name', 'rating']);
  assert.equal(slimSpots([spot, spot]).length, 2);
});

test('un message déjà allégé (slim: true) n\'est ni relu ni réécrit', () => {
  const msg = JSON.stringify({ type: 'UPDATE_SPOTS', slim: true, spots: [{ id: 'a', description: 'garde-moi' }] });
  assert.equal(slimMapMessage(msg), msg);
});

test('l\'empreinte d\'une liste change quand une adresse visible change, pas pour un champ invisible', () => {
  const a = [{ id: '1', lat: 43.6, lng: 1.44, cat: 'food', name: 'A', rating: 4 }];
  const same = [{ id: '1', lat: 43.6, lng: 1.44, cat: 'food', name: 'A', rating: 4, description: 'invisible sur la carte' }];
  assert.equal(spotsKey(a), spotsKey(same));
  assert.notEqual(spotsKey(a), spotsKey([{ ...a[0], lng: 1.45 }]));
  assert.notEqual(spotsKey(a), spotsKey([]));
  assert.equal(spotsKey([{ id: '1', title: 'A', lat: 1, lng: 2 }]), spotsKey([{ id: '1', name: 'A', lat: 1, lng: 2 }]));
});
