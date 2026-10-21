import test from 'node:test';
import assert from 'node:assert/strict';
import { todayIso, upcomingEvents } from '../upcomingEvents.ts';

const ev = (id: string, event_date: unknown) => ({ id, event_date });

test('upcomingEvents garde le jour même et le futur, écarte le passé', () => {
  const list = [ev('passé', '2026-09-14'), ev('hier', '2026-10-20'), ev('jour', '2026-10-21'), ev('futur', '2026-12-01')];
  assert.deepEqual(upcomingEvents(list, '2026-10-21').map((e) => e.id), ['jour', 'futur']);
});

test('upcomingEvents accepte une date avec heure et conserve l’ordre', () => {
  const list = [ev('b', '2026-11-02T19:00:00'), ev('a', '2026-10-30')];
  assert.deepEqual(upcomingEvents(list, '2026-10-21').map((e) => e.id), ['b', 'a']);
});

test('upcomingEvents conserve un événement sans date exploitable et gère le vide', () => {
  const list = [ev('vide', null), ev('texte', 'bientôt'), ev('absent', undefined), ev('passé', '2020-01-01')];
  assert.deepEqual(upcomingEvents(list, '2026-10-21').map((e) => e.id), ['vide', 'texte', 'absent']);
  assert.deepEqual(upcomingEvents([], '2026-10-21'), []);
});

test('todayIso utilise la date locale et complète les zéros', () => {
  assert.equal(todayIso(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(todayIso(new Date(2026, 9, 21, 0, 1)), '2026-10-21');
});
