import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decideRestore, formatRecoveryCode, parseRecoveryCode } from '../recoveryLogic.ts';

const ID = '3f2504e0-4f89-41d3-9a0c-0305e82c3301';
const OTHER = '11111111-1111-4111-8111-111111111111';

test('le code affiché est l’identifiant, en majuscules ; la saisie tolère espaces, tirets et minuscules', () => {
  assert.equal(formatRecoveryCode(ID), '3F2504E0-4F89-41D3-9A0C-0305E82C3301');
  assert.equal(parseRecoveryCode(' 3F2504E0 4F89 41D3 9A0C 0305E82C3301 '), ID);
  assert.equal(parseRecoveryCode('3f2504e04f8941d39a0c0305e82c3301'), ID);
  assert.equal(parseRecoveryCode('trop-court'), null);
  assert.equal(parseRecoveryCode('3f2504e0-4f89-41d3-9a0c-0305e82c330Z'), null);
  assert.equal(formatRecoveryCode('pas un id'), '');
});

test('restauration : refusée si code invalide, identique, hors connexion ou ne correspondant à aucun profil', () => {
  assert.equal(decideRestore('xyz', ID, { discoveries: 1, likes: 0, lists: 0 }).ok, false);
  assert.equal(decideRestore(ID.toUpperCase(), ID, { discoveries: 1, likes: 0, lists: 0 }).ok, false);
  assert.equal(decideRestore(OTHER, ID, null).ok, false);
  const empty = decideRestore(OTHER, ID, { discoveries: 0, likes: 0, lists: 0 });
  assert.equal(empty.ok, false);
  assert.match((empty as any).error, /Aucun profil/);
});

test('restauration acceptée dès qu’il existe une trace du profil', () => {
  assert.deepEqual(decideRestore(OTHER.toUpperCase(), ID, { discoveries: 0, likes: 2, lists: 0 }), { ok: true, deviceId: OTHER });
});

test('l’écran profil propose le code de récupération et la proposition d’adresse', () => {
  const src = readFileSync(new URL('../../components/views/ProfileView.tsx', import.meta.url), 'utf8');
  assert.match(src, /RecoveryCodeModal/);
  assert.match(src, /SuggestPlaceModal/);
  const ident = readFileSync(new URL('../deviceIdentity.ts', import.meta.url), 'utf8');
  assert.match(ident, /export const replaceDeviceId/);
});
