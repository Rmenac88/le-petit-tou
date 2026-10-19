import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isValidExpoPushToken,
  targetForNotification,
  permissionOutcome,
  DEFAULT_PUSH_PREFERENCES,
  ENABLE_FAILURE_MESSAGES,
} from '../pushLogic.ts';

test('jeton Expo : formats valides et invalides', () => {
  assert.equal(isValidExpoPushToken('ExponentPushToken[abcdefghij1234567890]'), true);
  assert.equal(isValidExpoPushToken('ExpoPushToken[abcdefghij1234567890]'), true);
  for (const bad of ['', 'abc', 'ExponentPushToken[]', 'ExponentPushToken[court]', "ExponentPushToken[abcdefghij']; drop--]", null, undefined, 42, {}]) {
    assert.equal(isValidExpoPushToken(bad), false, String(bad));
  }
});

test('destination selon le type de notification', () => {
  assert.deepEqual(targetForNotification({ kind: 'agenda', id: 'x' }), { tab: 'agenda' });
  assert.deepEqual(targetForNotification({ kind: 'event' }), { tab: 'home' });
  assert.deepEqual(targetForNotification({ kind: 'announcement' }), { tab: 'home' });
  assert.deepEqual(targetForNotification({ kind: 'new_spot', id: '3af402f7-5526-58f6-9d42-ac1234567890' }),
    { tab: 'map', spotId: '3af402f7-5526-58f6-9d42-ac1234567890' });
  assert.deepEqual(targetForNotification({ kind: 'new_spot' }), { tab: 'home' });
});

test('contenu inattendu ou hostile : retour à l’accueil, aucun identifiant douteux transmis', () => {
  for (const bad of [null, undefined, 'texte', 12, [], {}, { kind: 'inconnu' }, { kind: 'new_spot', id: '../../etc' },
    { kind: 'new_spot', id: 'x'.repeat(200) }, { kind: 'new_spot', id: { a: 1 } }, { kind: 'new_spot', id: "1'; drop table" }]) {
    const t = targetForNotification(bad);
    assert.equal(t.tab === 'home' || t.tab === 'agenda', true, JSON.stringify(bad));
    assert.equal(t.spotId, undefined, JSON.stringify(bad));
  }
});

test('permission système résumée en trois cas', () => {
  assert.equal(permissionOutcome({ granted: true, canAskAgain: true }), 'granted');
  assert.equal(permissionOutcome({ granted: false, canAskAgain: true }), 'can_ask');
  assert.equal(permissionOutcome({ granted: false, canAskAgain: false }), 'blocked');
  assert.equal(permissionOutcome(null), 'can_ask');
});

test('valeurs par défaut prudentes et messages d’erreur en français pour chaque cas', () => {
  assert.deepEqual(DEFAULT_PUSH_PREFERENCES, { notify_events: true, notify_agenda: true, notify_new_spots: false });
  for (const k of ['unsupported', 'permission_denied', 'no_project', 'token_error', 'server_error'] as const) {
    assert.ok(ENABLE_FAILURE_MESSAGES[k].length > 20);
  }
});
