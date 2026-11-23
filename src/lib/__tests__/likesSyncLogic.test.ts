import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clearPending, mergeServerLikes, parsePending, recordPending } from '../likesSyncLogic.ts';

test('le serveur fait foi : un like perdu sur le téléphone revient', () => {
  assert.deepEqual(mergeServerLikes(['a', 'b'], {}), ['a', 'b']);
});

test('un geste pas encore envoyé corrige l’affichage (like hors connexion, retrait hors connexion)', () => {
  assert.deepEqual(mergeServerLikes(['a', 'b'], { c: 1 }), ['a', 'b', 'c']);
  assert.deepEqual(mergeServerLikes(['a', 'b'], { a: -1 }), ['b']);
  assert.deepEqual(mergeServerLikes(['a'], { a: 1 }), ['a'], 'pas de doublon');
});

test('le dernier geste l’emporte ; un envoi réussi retire l’attente', () => {
  let p = recordPending({}, 'a', 1);
  p = recordPending(p, 'a', -1);
  assert.deepEqual(p, { a: -1 });
  assert.deepEqual(clearPending(p, 'a'), {});
});

test('attente illisible ou corrompue : ignorée', () => {
  assert.deepEqual(parsePending('pas du json'), {});
  assert.deepEqual(parsePending('[1,2]'), {});
  assert.deepEqual(parsePending(JSON.stringify({ a: 1, b: 5, c: -1, '': 1 })), { a: 1, c: -1 });
});

test('likesStore : envoi gardé en attente si échec, relecture du serveur, attente effacée avec les données', () => {
  const src = readFileSync(new URL('../likesStore.ts', import.meta.url), 'utf8');
  assert.match(src, /recordPending\(/);
  assert.match(src, /'get_my_likes'/);
  assert.match(src, /export const syncDeviceLikes/);
  assert.match(src, /clearDeviceLikedSpotIds[\s\S]{0,200}PENDING_KEY/);
  const home = readFileSync(new URL('../../components/views/HomeView.tsx', import.meta.url), 'utf8');
  assert.match(home, /syncDeviceLikes\(\)/);
});
