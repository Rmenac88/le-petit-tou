import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { visibleSpots } from '../visibleSpots.ts';

const region = { latitude: 43.6047, longitude: 1.4442, latitudeDelta: 0.02, longitudeDelta: 0.02 };
const spot = (id: string, dLat: number, dLng: number) => ({ id, lat: 43.6047 + dLat, lng: 1.4442 + dLng });

test('ne garde que les adresses de la zone visible (marge comprise)', () => {
  const list = [spot('proche', 0.001, 0.001), spot('bord', 0.014, 0), spot('loin', 0.2, 0.2)];
  assert.deepEqual(visibleSpots(list, region, null).map((s) => s.id).sort(), ['bord', 'proche']);
});

test('plafonne le nombre de marqueurs en gardant les plus proches du centre', () => {
  const list = Array.from({ length: 300 }, (_, i) => spot(`s${i}`, (i % 15) * 0.0005, Math.floor(i / 15) * 0.0005));
  const shown = visibleSpots(list, region, null, 50);
  assert.equal(shown.length, 50);
  assert.ok(shown.some((s) => s.id === 's0'), 'le plus proche du centre est conservé');
});

test('l’adresse sélectionnée reste affichée même hors zone ; coordonnées invalides ignorées', () => {
  const list = [spot('a', 0, 0), spot('hors', 0.5, 0.5), { id: 'nan', lat: NaN, lng: 1 }];
  assert.deepEqual(visibleSpots(list, region, 'hors').map((s) => s.id).sort(), ['a', 'hors']);
  assert.deepEqual(visibleSpots(list, region, 'inconnue').map((s) => s.id), ['a']);
});

test('à l’ouverture de la carte sur Toulouse, le vrai jeu de données reste sous le plafond d’affichage', () => {
  const d = JSON.parse(readFileSync(new URL('../../constants/dataset.json', import.meta.url), 'utf8'));
  const shown = visibleSpots(d.addresses, region, null);
  assert.ok(shown.length > 0 && shown.length <= 120, `${shown.length} marqueurs`);
});
