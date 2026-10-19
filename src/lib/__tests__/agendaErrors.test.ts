import test from 'node:test';
import assert from 'node:assert/strict';
import { AgendaError, toAgendaError, validateEventDraft } from '../agendaErrors.ts';

test('le code 42501 devient une erreur « forbidden » lisible', () => {
  const err = toAgendaError({ code: '42501', message: 'forbidden' });
  assert.ok(err instanceof AgendaError);
  assert.equal(err.kind, 'forbidden');
  assert.match(err.message, /reconnecte-toi/i);
});

test('un message « forbidden » sans code devient aussi « forbidden »', () => {
  assert.equal(toAgendaError({ message: 'forbidden' }).kind, 'forbidden');
});

test('un message « invalid: … » devient une erreur « invalid » qui garde le texte', () => {
  const err = toAgendaError({ code: '22023', message: "invalid: l'heure de fin doit etre apres l'heure de debut" });
  assert.equal(err.kind, 'invalid');
  assert.equal(err.message, "L'heure de fin doit etre apres l'heure de debut");
});

test('toute autre erreur devient « network » sans texte technique', () => {
  const err = toAgendaError({ code: 'PGRST301', message: 'JWT expired at node_modules/...' });
  assert.equal(err.kind, 'network');
  assert.equal(err.message, 'Agenda indisponible pour le moment.');
});

const good = { spot_id: 's1', title: 'Soirée', start_date: '2026-10-22', start_time: '19:00' };

test('validateEventDraft accepte un brouillon complet', () => {
  assert.equal(validateEventDraft(good), null);
});

test('validateEventDraft exige titre, adresse et date', () => {
  assert.match(validateEventDraft({ ...good, title: '  ' })!, /titre/i);
  assert.match(validateEventDraft({ ...good, spot_id: '' })!, /adresse/i);
  assert.match(validateEventDraft({ ...good, start_date: '' })!, /date/i);
});

test('validateEventDraft refuse une heure de fin avant le début', () => {
  assert.match(validateEventDraft({ ...good, end_time: '18:00' })!, /heure de fin/i);
});

test('validateEventDraft refuse une fin de série avant la première date', () => {
  assert.match(validateEventDraft({ ...good, repeat_weekly_until: '2026-10-01' })!, /fin de série/i);
});

test('validateEventDraft refuse une heure mal écrite', () => {
  assert.match(validateEventDraft({ ...good, start_time: '7pm' })!, /HH:MM/);
});
