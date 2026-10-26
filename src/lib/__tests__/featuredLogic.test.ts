import test from 'node:test';
import assert from 'node:assert/strict';
import {
  describePeriod,
  featuredStatus,
  isLive,
  planMove,
  isRealDay,
  liveFeatured,
  resolveFeatured,
  validateFeaturedDraft,
  type FeaturedRow,
} from '../featuredLogic.ts';

const row = (id: string, over: Partial<FeaturedRow> = {}): FeaturedRow => ({
  id, spot_id: `s-${id}`, position: 10, label: null, starts_on: null, ends_on: null, is_active: true, ...over,
});
const TODAY = '2026-11-10';

test('isLive : actif et période incluse aux deux bouts', () => {
  assert.equal(isLive(row('a'), TODAY), true);
  assert.equal(isLive(row('a', { is_active: false }), TODAY), false);
  assert.equal(isLive(row('a', { starts_on: TODAY }), TODAY), true);
  assert.equal(isLive(row('a', { ends_on: TODAY }), TODAY), true);
  assert.equal(isLive(row('a', { starts_on: '2026-11-11' }), TODAY), false);
  assert.equal(isLive(row('a', { ends_on: '2026-11-09' }), TODAY), false);
});

test('liveFeatured trie par ordre puis identifiant et écarte les périmés', () => {
  const rows = [row('c', { position: 20 }), row('b', { position: 10 }), row('a', { position: 10 }), row('x', { ends_on: '2020-01-01' })];
  assert.deepEqual(liveFeatured(rows, TODAY).map((r) => r.id), ['a', 'b', 'c']);
  assert.deepEqual(rows.map((r) => r.id), ['c', 'b', 'a', 'x'], 'la liste d’origine n’est pas modifiée par le tri');
});

test('resolveFeatured ignore les adresses supprimées, borne le nombre et garde l’ordre', () => {
  const addresses = [{ id: 's-a' }, { id: 's-c' }, { id: 's-d' }];
  const rows = [row('a', { position: 3 }), row('b', { position: 1 }), row('c', { position: 2 }), row('d', { position: 4 })];
  assert.deepEqual(resolveFeatured(rows, addresses, TODAY).map((r) => r.address.id), ['s-c', 's-a', 's-d']);
  assert.equal(resolveFeatured(rows, addresses, TODAY, 2).length, 2);
  assert.deepEqual(resolveFeatured([], addresses, TODAY), []);
});

test('isRealDay refuse les jours inexistants et les mauvais formats', () => {
  assert.equal(isRealDay('2026-11-10'), true);
  assert.equal(isRealDay('2028-02-29'), true);
  assert.equal(isRealDay('2026-02-29'), false);
  assert.equal(isRealDay('2026-13-01'), false);
  assert.equal(isRealDay('10/11/2026'), false);
  assert.equal(isRealDay('2026-1-5'), false);
});

test('validateFeaturedDraft : un message clair pour chaque erreur, rien pour un brouillon correct', () => {
  const ok = { spotId: 'x', position: '', label: '', startsOn: '', endsOn: '' };
  assert.equal(validateFeaturedDraft(ok), null);
  assert.match(validateFeaturedDraft({ ...ok, spotId: ' ' })!, /adresse/);
  assert.match(validateFeaturedDraft({ ...ok, label: 'x'.repeat(41) })!, /40 caractères/);
  assert.match(validateFeaturedDraft({ ...ok, position: 'abc' })!, /ordre/);
  assert.match(validateFeaturedDraft({ ...ok, startsOn: '2026-02-30' })!, /début/);
  assert.match(validateFeaturedDraft({ ...ok, endsOn: 'demain' })!, /fin/);
  assert.match(validateFeaturedDraft({ ...ok, startsOn: '2026-12-10', endsOn: '2026-12-01' })!, /après le début/);
  assert.equal(validateFeaturedDraft({ ...ok, startsOn: '2026-12-01', endsOn: '2026-12-01', position: '0' }), null);
});

test('describePeriod décrit la période pour l’admin', () => {
  assert.equal(describePeriod(row('a'), TODAY), 'Toujours affiché');
  assert.match(describePeriod(row('a', { starts_on: '2026-12-01', ends_on: '2026-12-31' }), TODAY), /Commence le 2026-12-01 · jusqu'au 2026-12-31/);
  assert.equal(describePeriod(row('a', { ends_on: '2026-11-01' }), TODAY), 'Terminé le 2026-11-01');
  assert.equal(describePeriod(row('a', { ends_on: '2026-11-30' }), TODAY), "Jusqu'au 2026-11-30");
  assert.equal(describePeriod(row('a', { starts_on: '2026-11-01' }), TODAY), 'Depuis le 2026-11-01');
});

test('planMove échange deux voisins et ne renvoie que les lignes modifiées', () => {
  const rows = [row('a', { position: 10 }), row('b', { position: 20 }), row('c', { position: 30 })];
  assert.deepEqual(planMove(rows, 'b', -1), [{ id: 'b', position: 10 }, { id: 'a', position: 20 }]);
  assert.deepEqual(planMove(rows, 'b', 1), [{ id: 'c', position: 20 }, { id: 'b', position: 30 }]);
  assert.deepEqual(planMove(rows, 'a', -1), [], 'déjà en haut');
  assert.deepEqual(planMove(rows, 'c', 1), [], 'déjà en bas');
  assert.deepEqual(planMove(rows, 'inconnu', 1), []);
});

test('planMove renumérote proprement quand plusieurs lignes ont le même ordre ou des trous', () => {
  const rows = [row('a', { position: 100 }), row('b', { position: 100 }), row('c', { position: 7 })];
  // ordre d'affichage : c (7), a (100), b (100) -> monter b : c, b, a
  const plan = planMove(rows, 'b', -1);
  const final = new Map(rows.map((r) => [r.id, r.position]));
  for (const u of plan) final.set(u.id, u.position);
  const order = [...final.entries()].sort((x, y) => x[1] - y[1]).map(([id]) => id);
  assert.deepEqual(order, ['c', 'b', 'a']);
  assert.equal(new Set(final.values()).size, 3, 'plus aucun doublon');
});

test('featuredStatus distingue inactif, programmé, terminé et en ligne', () => {
  assert.equal(featuredStatus(row('a', { is_active: false }), TODAY), 'inactive');
  assert.equal(featuredStatus(row('a', { starts_on: '2026-12-01' }), TODAY), 'scheduled');
  assert.equal(featuredStatus(row('a', { ends_on: '2026-11-01' }), TODAY), 'ended');
  assert.equal(featuredStatus(row('a'), TODAY), 'live');
});
