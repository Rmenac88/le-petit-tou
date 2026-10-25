import test from 'node:test';
import assert from 'node:assert/strict';
import { addSpot, createList, initialState, type ListsState } from '../userListsLogic.ts';
import { INITIAL_META, isPristine, mergeStates, parseSyncMeta, planSync, shouldPush } from '../userListsSyncLogic.ts';

const NOW = 1_790_000_000_000;
const mk = (() => { let n = 0; return () => `id${++n}`; })();
const withSpot = (s: ListsState, listId: string, spot: string, t = NOW): ListsState => {
  const r = addSpot(s, listId, spot, t);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const withCustom = (s: ListsState, name: string, t = NOW): ListsState => {
  const r = createList(s, name, '⭐', t, mk);
  if (!r.ok) throw new Error(r.error);
  return r.state;
};
const fresh = initialState(NOW);
const filled = withSpot(withCustom(fresh, 'Brunchs'), 'later', 'a1');

test('téléphone vierge : seules les listes de base, sans adresse', () => {
  assert.equal(isPristine(fresh), true);
  assert.equal(isPristine(withSpot(fresh, 'later', 'a1')), false);
  assert.equal(isPristine(withCustom(fresh, 'Mes favoris')), false);
});

test('serveur injoignable ou fonction absente (remote nul) : on ne touche à rien, même avec des modifications à envoyer', () => {
  assert.deepEqual(planSync(filled, { dirty: true, syncedAt: 5 }, null, NOW), { action: 'none' });
  assert.deepEqual(planSync(filled, INITIAL_META, null, NOW), { action: 'none' });
});

test('des modifications locales pas encore envoyées gagnent toujours, même si le serveur est plus récent', () => {
  const remote = { data: initialState(NOW), updated: NOW + 999 };
  assert.deepEqual(planSync(filled, { dirty: true, syncedAt: NOW }, remote, NOW), { action: 'push' });
});

test('aucune copie serveur : on envoie des données existantes, mais jamais un téléphone vierge', () => {
  const none = { data: null, updated: 0 };
  assert.deepEqual(planSync(filled, INITIAL_META, none, NOW), { action: 'push' }, 'ancienne version : listes locales à sauvegarder');
  assert.deepEqual(planSync(fresh, INITIAL_META, none, NOW), { action: 'none' }, 'rien à sauvegarder');
});

test('première synchronisation, téléphone vierge, copie serveur existante : la copie est adoptée', () => {
  const plan = planSync(fresh, INITIAL_META, { data: filled, updated: NOW + 1 }, NOW);
  assert.equal(plan.action, 'adopt');
  if (plan.action === 'adopt') {
    assert.equal(plan.state.lists.find((l) => l.kind === 'custom')?.name, 'Brunchs');
    assert.deepEqual(plan.state.lists.find((l) => l.id === 'later')?.spotIds, ['a1']);
  }
});

test('première synchronisation avec des données des deux côtés : fusion (union des listes et des adresses)', () => {
  const local = withSpot(withCustom(fresh, 'Locale'), 'later', 'l1');
  const remote = withSpot(withCustom(fresh, 'Serveur'), 'later', 'r1');
  const plan = planSync(local, INITIAL_META, { data: remote, updated: NOW + 1 }, NOW);
  assert.equal(plan.action, 'merge');
  if (plan.action === 'merge') {
    assert.deepEqual(plan.state.lists.filter((l) => l.kind === 'custom').map((l) => l.name).sort(), ['Locale', 'Serveur']);
    assert.deepEqual(plan.state.lists.find((l) => l.id === 'later')?.spotIds.sort(), ['l1', 'r1']);
  }
});

test('déjà synchronisé : une copie serveur plus récente remplace l’état local, sinon rien à faire', () => {
  const meta = { dirty: false, syncedAt: NOW };
  assert.equal(planSync(filled, meta, { data: withSpot(filled, 'later', 'b2'), updated: NOW + 10 }, NOW).action, 'adopt');
  assert.equal(planSync(filled, meta, { data: filled, updated: NOW }, NOW).action, 'none');
  assert.equal(planSync(filled, meta, { data: fresh, updated: NOW - 10 }, NOW).action, 'none', 'copie plus ancienne : ignorée');
});

test('une copie serveur abîmée est ramenée à un état valide (jamais d’erreur)', () => {
  const plan = planSync(fresh, INITIAL_META, { data: { lists: [{ id: "x'; drop", kind: 'custom', name: 'Piège', spotIds: ['../x'] }, 12, null] }, updated: 5 }, NOW);
  assert.equal(plan.action, 'adopt');
  if (plan.action === 'adopt') {
    assert.equal(plan.state.lists.some((l) => l.name === 'Piège'), false);
    assert.equal(isPristine(plan.state), true);
  }
});

test('fusion : nom et pastille de la liste la plus récente, adresses réunies sans doublon, plafonds respectés', () => {
  const a = { ...withCustom(fresh, 'Ancien nom', NOW) };
  const id = a.lists.find((l) => l.kind === 'custom')!.id;
  const local = withSpot(a, id, 'x1', NOW + 1);
  const remote: ListsState = { ...a, lists: a.lists.map((l) => (l.id === id ? { ...l, name: 'Nouveau nom', spotIds: ['x1', 'y2'], updatedAt: NOW + 50 } : l)) };
  const merged = mergeStates(local, remote, NOW);
  const m = merged.lists.find((l) => l.id === id)!;
  assert.equal(m.name, 'Nouveau nom');
  assert.deepEqual(m.spotIds, ['x1', 'y2']);
  assert.equal(m.updatedAt, NOW + 50);

  const many = (prefix: string) => Array.from({ length: 80 }, (_, i) => `${prefix}${i}`);
  const big = mergeStates(
    { ...fresh, lists: fresh.lists.map((l) => (l.id === 'later' ? { ...l, spotIds: many('a') } : l)) },
    { ...fresh, lists: fresh.lists.map((l) => (l.id === 'later' ? { ...l, spotIds: many('b') } : l)) },
    NOW
  );
  assert.equal(big.lists.find((l) => l.id === 'later')!.spotIds.length, 100);
});

test('lecture de l’état de synchronisation : valeurs inattendues ignorées', () => {
  assert.deepEqual(parseSyncMeta({ dirty: true, syncedAt: 12.9 }), { dirty: true, syncedAt: 12 });
  for (const bad of [null, undefined, 'x', 5, { dirty: 'oui', syncedAt: 'hier' }, { syncedAt: -3 }]) {
    assert.deepEqual(parseSyncMeta(bad), INITIAL_META, JSON.stringify(bad));
  }
});

test('envoi : seulement s’il y a des modifications, et pas plus d’une tentative ratée toutes les 30 s', () => {
  assert.equal(shouldPush({ dirty: false, syncedAt: 1 }, 0, NOW), false);
  assert.equal(shouldPush({ dirty: true, syncedAt: 1 }, 0, NOW), true);
  assert.equal(shouldPush({ dirty: true, syncedAt: 1 }, NOW - 10_000, NOW), false);
  assert.equal(shouldPush({ dirty: true, syncedAt: 1 }, NOW - 31_000, NOW), true);
});
