import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BUILTIN_LISTS, MAX_LISTS, MAX_NAME_LENGTH, MAX_SPOTS_PER_LIST,
  addSpot, createList, deleteList, initialState, listsContaining, normalizeState, purgeSpots,
  removeSpot, renameList, sanitizeEmoji, toggleSpot, validateListName, type ListsState,
} from '../userListsLogic.ts';

let n = 0;
const makeId = () => `l${++n}`;
const ok = <T extends { ok: boolean }>(r: T): Extract<T, { ok: true }> => {
  assert.equal(r.ok, true, JSON.stringify(r));
  return r as Extract<T, { ok: true }>;
};

test('état initial : « À tester plus tard » et « Y retourner », vides', () => {
  const s = initialState(1);
  assert.deepEqual(s.lists.map((l) => l.name), ['À tester plus tard', 'Y retourner']);
  assert.ok(s.lists.every((l) => l.spotIds.length === 0 && l.kind !== 'custom'));
});

test('création : nom nettoyé, doublons (sans tenir compte de la casse) et noms vides ou trop longs refusés', () => {
  const s0 = initialState(1);
  const a = ok(createList(s0, '  Brunchs   du dimanche ', '🍽️', 5, makeId));
  assert.equal(a.list.name, 'Brunchs du dimanche');
  assert.equal(a.state.lists.length, 3);
  assert.equal(s0.lists.length, 2, 'l\'état d\'origine n\'est pas modifié');
  assert.equal(createList(a.state, 'BRUNCHS DU DIMANCHE', '⭐', 6, makeId).ok, false);
  assert.equal(createList(a.state, 'y retourner', '⭐', 6, makeId).ok, false, 'même nom qu\'une liste de base');
  assert.equal(createList(a.state, '   ', '⭐', 6, makeId).ok, false);
  assert.equal(createList(a.state, 'x'.repeat(MAX_NAME_LENGTH + 1), '⭐', 6, makeId).ok, false);
  assert.equal(validateListName('ok', a.state.lists).ok, true);
});

test('plafond du nombre de listes', () => {
  let s: ListsState = initialState(1);
  for (let i = 0; i < MAX_LISTS - BUILTIN_LISTS.length; i++) s = ok(createList(s, `Liste ${i}`, '⭐', 2, makeId)).state;
  assert.equal(s.lists.length, MAX_LISTS);
  const refused = createList(s, 'De trop', '⭐', 3, makeId);
  assert.equal(refused.ok, false);
});

test('renommer et supprimer : seulement les listes personnelles', () => {
  const a = ok(createList(initialState(1), 'Dates', '💑', 2, makeId));
  const renamed = ok(renameList(a.state, a.list.id, 'Sorties à deux', '🎉', 3));
  assert.equal(renamed.state.lists[2].name, 'Sorties à deux');
  assert.equal(renamed.state.lists[2].emoji, '🎉');
  assert.equal(renameList(a.state, 'later', 'Autre', '⭐', 3).ok, false);
  assert.equal(renameList(a.state, a.list.id, 'Y retourner', '⭐', 3).ok, false, 'nom déjà pris');
  assert.equal(renameList(a.state, a.list.id, 'Dates', '⭐', 3).ok, true, 'garder son propre nom est permis');
  assert.equal(deleteList(a.state, 'later').ok, false);
  assert.equal(ok(deleteList(a.state, a.list.id)).state.lists.length, 2);
  assert.equal(deleteList(a.state, 'inconnue').ok, false);
});

test('ajouter / retirer / basculer une adresse : sans doublon, la plus récente en tête, état d\'origine intact', () => {
  const s0 = initialState(1);
  const s1 = ok(addSpot(s0, 'later', 'spot-1', 2)).state;
  const s2 = ok(addSpot(s1, 'later', 'spot-2', 3)).state;
  assert.deepEqual(s2.lists[0].spotIds, ['spot-2', 'spot-1']);
  assert.equal(ok(addSpot(s2, 'later', 'spot-1', 4)).state, s2, 'déjà présente : rien ne change');
  assert.deepEqual(s0.lists[0].spotIds, []);
  assert.deepEqual(listsContaining(s2, 'spot-1'), ['later']);
  const t = ok(toggleSpot(s2, 'later', 'spot-1', 5));
  assert.equal(t.added, false);
  assert.deepEqual(t.state.lists[0].spotIds, ['spot-2']);
  const t2 = ok(toggleSpot(t.state, 'return', 'spot-1', 6));
  assert.equal(t2.added, true);
  assert.equal(addSpot(s2, 'later', 'mauvais id !', 7).ok, false);
  assert.equal(addSpot(s2, 'nope', 'spot-1', 7).ok, false);
  assert.equal(ok(removeSpot(s2, 'later', 'absente', 8)).state, s2);
});

test('plafond du nombre d\'adresses par liste', () => {
  let s = initialState(1);
  for (let i = 0; i < MAX_SPOTS_PER_LIST; i++) s = ok(addSpot(s, 'later', `s${i}`, 2)).state;
  assert.equal(addSpot(s, 'later', 'une-de-plus', 3).ok, false);
});

test('relecture d\'un état abîmé : listes de base retrouvées, doublons, ids dangereux, noms vides et plafonds écartés', () => {
  assert.deepEqual(normalizeState(null, 1), initialState(1));
  assert.deepEqual(normalizeState('n\'importe quoi', 1), initialState(1));
  const raw = {
    lists: [
      { id: 'return', name: 'ignoré', spotIds: ['a', 'a', 'b', 42, '<script>'], createdAt: 5 },
      { id: 'mine', kind: 'custom', name: '  Ma liste  ', emoji: 'abc', spotIds: ['x'] },
      { id: 'mine', name: 'doublon' },
      { id: '../evil', name: 'dangereux' },
      { id: 'vide', name: '   ' },
      null,
      { id: 'longue', name: 'n'.repeat(80), emoji: '🌳' },
    ],
  };
  const s = normalizeState(raw, 9);
  assert.deepEqual(s.lists.map((l) => l.id), ['later', 'return', 'mine', 'longue']);
  assert.deepEqual(s.lists[1].spotIds, ['a', 'b']);
  assert.equal(s.lists[1].name, 'Y retourner', 'le nom d\'une liste de base ne vient jamais du stockage');
  assert.equal(s.lists[2].name, 'Ma liste');
  assert.equal(s.lists[2].emoji, '⭐', 'pastille invalide -> étoile');
  assert.equal(s.lists[3].name.length, MAX_NAME_LENGTH);
  const many = { lists: Array.from({ length: 50 }, (_, i) => ({ id: `c${i}`, name: `L${i}` })) };
  assert.equal(normalizeState(many, 1).lists.length, MAX_LISTS);
});

test('pastille : un emoji passe, du texte ordinaire retombe sur l\'étoile', () => {
  assert.equal(sanitizeEmoji('🍸'), '🍸');
  assert.equal(sanitizeEmoji('  ☕ café'), '☕');
  assert.equal(sanitizeEmoji('a'), '⭐');
  assert.equal(sanitizeEmoji('7'), '⭐');
  assert.equal(sanitizeEmoji(''), '⭐');
  assert.equal(sanitizeEmoji(undefined), '⭐');
});

test('nettoyage : une adresse supprimée du guide disparaît des listes', () => {
  const s = ok(addSpot(ok(addSpot(initialState(1), 'later', 'a', 2)).state, 'return', 'b', 3)).state;
  const purged = purgeSpots(s, new Set(['b']));
  assert.deepEqual(purged.lists[0].spotIds, []);
  assert.deepEqual(purged.lists[1].spotIds, ['b']);
  assert.equal(purgeSpots(s, new Set(['a', 'b'])), s, 'rien à retirer : même objet');
});
