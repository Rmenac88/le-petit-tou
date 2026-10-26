import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SPOT_LIST_COLUMNS,
  categoryLabelFor,
  filterSpotsByQuery,
  removeSpot,
  upsertSpot,
  type AdminSpot,
} from '../adminSpotsLogic.ts';

const spots: AdminSpot[] = [
  { id: '1', title: 'Café des Arts', address: '12 rue de Metz', location: 'Capitole' },
  { id: '2', title: 'Le Bar à Thym', address: '3 place Saint-Pierre', location: 'Saint-Cyprien' },
  { id: '3', name: 'Bar Tapas', address: '8 rue Pargaminières', location: 'Carmes' },
];

test('la liste ne télécharge pas les champs lourds mais garde ce que les panneaux utilisent', () => {
  const cols = SPOT_LIST_COLUMNS.split(',').map((c) => c.trim());
  for (const heavy of ['description', 'full_description', 'gallery_urls', '*']) {
    assert.ok(!cols.includes(heavy), `${heavy} ne doit pas faire partie de la liste`);
  }
  for (const needed of ['id', 'title', 'category_id', 'address', 'location', 'image_url', 'tags']) {
    assert.ok(cols.includes(needed), `${needed} manque`);
  }
});

test('recherche : vide = même tableau, sans accents ni majuscules, tous les mots', () => {
  assert.equal(filterSpotsByQuery(spots, ''), spots);
  assert.equal(filterSpotsByQuery(spots, '   '), spots);
  assert.deepEqual(filterSpotsByQuery(spots, 'CAFE').map((s) => s.id), ['1']);
  assert.deepEqual(filterSpotsByQuery(spots, 'bar').map((s) => s.id), ['2', '3']);
  assert.deepEqual(filterSpotsByQuery(spots, 'bar thym').map((s) => s.id), ['2']);
  assert.deepEqual(filterSpotsByQuery(spots, 'pargaminieres').map((s) => s.id), ['3']);
  assert.deepEqual(filterSpotsByQuery(spots, 'carmes').map((s) => s.id), ['3']);
  assert.deepEqual(filterSpotsByQuery(spots, 'introuvable'), []);
});

test('recherche : le texte de chaque ligne est calculé une seule fois', () => {
  const row: AdminSpot = { id: 'x', title: 'Chez Gaston' };
  assert.equal(filterSpotsByQuery([row], 'gaston').length, 1);
  row.title = 'Changé'; // le cache par ligne n'est pas recalculé : une ligne modifiée est remplacée par une nouvelle
  assert.equal(filterSpotsByQuery([row], 'gaston').length, 1);
  assert.equal(filterSpotsByQuery([{ ...row }], 'gaston').length, 0);
});

test('étiquette de catégorie : identifiant, puis classement automatique, puis « Adresse »', () => {
  const names = new Map([['c1', 'Restaurants'], ['c2', 'Bars']]);
  const never = () => undefined;
  assert.equal(categoryLabelFor({ id: '1', category_id: 'c1' }, names, never), 'Restaurants');
  assert.equal(categoryLabelFor({ id: '1', category_id: 'ancien-parent' }, names, () => 'c2'), 'Bars');
  assert.equal(categoryLabelFor({ id: '1' }, names, () => 'c2'), 'Bars');
  assert.equal(categoryLabelFor({ id: '1' }, names, never), 'Adresse');
  assert.equal(categoryLabelFor({ id: '1' }, names, () => 'inconnue'), 'Adresse');
});

test('mise à jour locale après enregistrement : remplace ou ajoute en tête, sans muter', () => {
  const before = spots.slice();
  const created = upsertSpot(spots, { id: '9', title: 'Nouveau' });
  assert.deepEqual(created.map((s) => s.id), ['9', '1', '2', '3']);
  const updated = upsertSpot(spots, { id: '2', title: 'Le Bar à Thym (rénové)' });
  assert.deepEqual(updated.map((s) => s.id), ['1', '2', '3']);
  assert.equal(updated[1].title, 'Le Bar à Thym (rénové)');
  assert.equal(updated[1].address, '3 place Saint-Pierre', 'les champs non renvoyés sont conservés');
  assert.deepEqual(spots, before, 'la liste d\'origine n\'est pas modifiée');
  assert.deepEqual(removeSpot(spots, '2').map((s) => s.id), ['1', '3']);
  assert.deepEqual(removeSpot(spots, 'absent').map((s) => s.id), ['1', '2', '3']);
});
