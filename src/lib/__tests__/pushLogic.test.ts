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

test('choix des notifications au premier lancement : une seule fois, jamais si déjà actif ou bloqué par le système', async () => {
  const { shouldOfferPushWelcome } = await import('../pushLogic.ts');
  const base = { supported: true, prompted: false, enabled: false, permission: 'can_ask' as const };
  assert.equal(shouldOfferPushWelcome(base), true);
  assert.equal(shouldOfferPushWelcome({ ...base, permission: 'granted' }), true); // autorisé par le système mais pas encore choisi dans l'appli
  assert.equal(shouldOfferPushWelcome({ ...base, prompted: true }), false); // déjà proposé
  assert.equal(shouldOfferPushWelcome({ ...base, enabled: true, permission: 'granted' }), false); // déjà inscrit
  assert.equal(shouldOfferPushWelcome({ ...base, permission: 'blocked' }), false); // bloqué : les réglages expliquent comment faire
  assert.equal(shouldOfferPushWelcome({ ...base, supported: false }), false); // web, simulateur
});

test('les trois familles de messages proposées correspondent aux préférences enregistrées côté serveur', async () => {
  const { PUSH_OPTIONS, DEFAULT_PUSH_PREFERENCES, hasAnyPushChoice } = await import('../pushLogic.ts');
  assert.deepEqual(PUSH_OPTIONS.map((o) => o.key).sort(), Object.keys(DEFAULT_PUSH_PREFERENCES).sort());
  for (const o of PUSH_OPTIONS) assert.ok(o.emoji && o.label && o.hint.length > 10, o.key);
  assert.equal(hasAnyPushChoice(DEFAULT_PUSH_PREFERENCES), true);
  assert.equal(hasAnyPushChoice({ notify_events: false, notify_agenda: false, notify_new_spots: false }), false);
  assert.equal(hasAnyPushChoice({ notify_events: false, notify_agenda: false, notify_new_spots: true }), true);
});
