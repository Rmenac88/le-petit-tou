import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchSpots } from '../spotSearch.ts';

const spots = [
  { id: '1', title: 'Le Bibent', location: 'Capitole' },
  { id: '2', title: 'Café Bibent Terrasse', location: 'Carmes' },
  { id: '3', title: 'Crêperie des Halles', location: 'Saint-Cyprien', tags: ['Crêpes', 'Brunch'] },
  { id: '4', name: 'Épicerie du Marché', address: '12 rue des Halles' },
];

test('sans accents ni majuscules ; les titres qui commencent par la saisie passent en premier', () => {
  assert.deepEqual(searchSpots(spots, 'bibent').map((s) => s.id), ['1', '2']); // « Le Bibent » avant « Café Bibent »… (égalité de score : ordre du guide)
  assert.deepEqual(searchSpots(spots, 'CREPERIE').map((s) => s.id), ['3']);
  assert.deepEqual(searchSpots(spots, 'epicerie').map((s) => s.id), ['4']);
});

test('tous les mots doivent être trouvés, dans le titre, le quartier, l’adresse ou les étiquettes', () => {
  assert.deepEqual(searchSpots(spots, 'halles brunch').map((s) => s.id), ['3']);
  assert.deepEqual(searchSpots(spots, 'halles rue').map((s) => s.id), ['4']);
  assert.deepEqual(searchSpots(spots, 'bibent introuvable'), []);
});

test('moins de 2 caractères ou vide : aucun résultat ; la limite est respectée', () => {
  assert.deepEqual(searchSpots(spots, ''), []);
  assert.deepEqual(searchSpots(spots, 'b'), []);
  assert.equal(searchSpots(spots, 'e', 2).length, 0);
  assert.equal(searchSpots(spots, 'ha', 1).length, 1);
});

test('sur les 790 adresses du guide : une recherche courante répond et reste bornée', () => {
  const d = JSON.parse(readFileSync(new URL('../../constants/dataset.json', import.meta.url), 'utf8'));
  const t0 = performance.now();
  const r = searchSpots(d.addresses, 'bistrot');
  assert.ok(r.length <= 8);
  assert.ok(performance.now() - t0 < 200, 'recherche trop lente');
  assert.ok(searchSpots(d.addresses, d.addresses[0].title).some((s: any) => s.id === d.addresses[0].id));
});
