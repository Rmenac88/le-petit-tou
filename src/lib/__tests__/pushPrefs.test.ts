import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PREFS,
  isValidExpoPushToken,
  parsePrefs,
  pushAvailability,
  resolveProjectId,
} from '../pushPrefs.ts';

test('par défaut : événements activés, nouvelles adresses désactivées, jamais de promos partenaires', () => {
  assert.deepEqual(DEFAULT_PREFS, { events: true, spots: false });
});

test('parsePrefs renvoie les valeurs par défaut si le texte est absent ou illisible', () => {
  assert.deepEqual(parsePrefs(null), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs(undefined), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('pas du json'), DEFAULT_PREFS);
  assert.deepEqual(parsePrefs('42'), DEFAULT_PREFS);
});

test('parsePrefs complète les champs manquants et ignore les types incorrects', () => {
  assert.deepEqual(parsePrefs('{"spots":true}'), { events: true, spots: true });
  assert.deepEqual(parsePrefs('{"events":false,"spots":"oui"}'), { events: false, spots: false });
});

test('un jeton Expo valide est accepté, tout le reste est refusé', () => {
  assert.equal(isValidExpoPushToken('ExponentPushToken[abc123_-XYZ]'), true);
  assert.equal(isValidExpoPushToken('ExpoPushToken[abc123]'), true);
  assert.equal(isValidExpoPushToken('abc123'), false);
  assert.equal(isValidExpoPushToken('ExponentPushToken[]'), false);
  assert.equal(isValidExpoPushToken(''), false);
  assert.equal(isValidExpoPushToken(null), false);
});

test('resolveProjectId lit extra.eas.projectId et ignore le vide', () => {
  assert.equal(resolveProjectId({ eas: { projectId: 'aaaa-bbbb' } }), 'aaaa-bbbb');
  assert.equal(resolveProjectId({ eas: { projectId: '  ' } }), null);
  assert.equal(resolveProjectId({}), null);
  assert.equal(resolveProjectId(undefined), null);
});

test('pushAvailability : web non pris en charge, natif sans projet signalé, sinon prêt', () => {
  assert.equal(pushAvailability('web', 'aaaa'), 'unsupported');
  assert.equal(pushAvailability('ios', null), 'missing-project');
  assert.equal(pushAvailability('android', null), 'missing-project');
  assert.equal(pushAvailability('ios', 'aaaa'), 'ready');
});
