import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildDayStrip,
  dayChipLabel,
  formatDateFr,
  expandOccurrences,
  isValidTimeRange,
  weekdayLabel,
  type PartnerEventRow,
} from '../agendaOccurrences.ts';

function ev(overrides: Partial<PartnerEventRow> = {}): PartnerEventRow {
  return {
    id: 'e1',
    spot_id: 's1',
    title: 'Soirée test',
    start_date: '2026-10-01',
    start_time: '19:00',
    is_active: true,
    ...overrides,
  };
}

const dates = (events: PartnerEventRow[], from: string, to: string) =>
  expandOccurrences(events, from, to).map((o) => o.occurrenceDate);

test('addDays traverse la fin du mois', () => {
  assert.equal(addDays('2026-10-30', 3), '2026-11-02');
});

test('addDays traverse la fin de l\'année', () => {
  assert.equal(addDays('2026-12-30', 3), '2027-01-02');
});

test('addDays ignore le passage à l\'heure d\'hiver (25 octobre 2026)', () => {
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
});

test('un événement ponctuel dans l\'intervalle donne une occurrence non récurrente', () => {
  const out = expandOccurrences([ev()], '2026-10-01', '2026-10-07');
  assert.equal(out.length, 1);
  assert.equal(out[0].occurrenceDate, '2026-10-01');
  assert.equal(out[0].isRecurring, false);
});

test('un événement ponctuel hors intervalle est ignoré', () => {
  assert.deepEqual(dates([ev()], '2026-10-05', '2026-10-31'), []);
});

test('un événement hebdomadaire donne une date par semaine, marquée récurrente', () => {
  const out = expandOccurrences(
    [ev({ repeat_weekly_until: '2026-10-29' })],
    '2026-10-01',
    '2026-10-31'
  );
  assert.deepEqual(
    out.map((o) => o.occurrenceDate),
    ['2026-10-01', '2026-10-08', '2026-10-15', '2026-10-22', '2026-10-29']
  );
  assert.ok(out.every((o) => o.isRecurring === true));
});

test('repeat_weekly_until égal à start_date donne une seule occurrence', () => {
  assert.deepEqual(
    dates([ev({ repeat_weekly_until: '2026-10-01' })], '2026-10-01', '2026-10-31'),
    ['2026-10-01']
  );
});

test('la date de fin de série est incluse (dernier jeudi présent)', () => {
  const out = dates([ev({ repeat_weekly_until: '2026-10-22' })], '2026-10-01', '2026-10-31');
  assert.equal(out[out.length - 1], '2026-10-22');
  assert.ok(!out.includes('2026-10-29'));
});

test('un intervalle plus court que la série ne garde que les dates dedans', () => {
  assert.deepEqual(
    dates([ev({ repeat_weekly_until: '2026-10-29' })], '2026-10-14', '2026-10-20'),
    ['2026-10-15']
  );
});

test('une série traverse le nouvel an sans décalage', () => {
  assert.deepEqual(
    dates(
      [ev({ start_date: '2026-12-24', repeat_weekly_until: '2027-01-14' })],
      '2026-12-25',
      '2027-01-10'
    ),
    ['2026-12-31', '2027-01-07']
  );
});

test('les événements inactifs sont ignorés', () => {
  assert.deepEqual(dates([ev({ is_active: false })], '2026-10-01', '2026-10-31'), []);
});

test('le tri se fait par date puis par heure de début', () => {
  const out = expandOccurrences(
    [
      ev({ id: 'tard', start_time: '21:00' }),
      ev({ id: 'tot', start_time: '18:30' }),
    ],
    '2026-10-01',
    '2026-10-01'
  );
  assert.deepEqual(
    out.map((o) => o.event.start_time),
    ['18:30', '21:00']
  );
});

test('buildDayStrip donne le nombre de jours demandé à partir d\'aujourd\'hui', () => {
  assert.deepEqual(buildDayStrip('2026-10-30', 3), ['2026-10-30', '2026-10-31', '2026-11-01']);
});

test('weekdayLabel renvoie le jour en minuscules', () => {
  assert.equal(weekdayLabel('2026-10-22'), 'jeudi');
});

test('isValidTimeRange accepte une fin après le début ou absente', () => {
  assert.equal(isValidTimeRange('19:00', '23:00'), true);
  assert.equal(isValidTimeRange('19:00', null), true);
});

test('isValidTimeRange refuse une fin égale ou avant le début', () => {
  assert.equal(isValidTimeRange('19:00', '19:00'), false);
  assert.equal(isValidTimeRange('19:00', '18:00'), false);
});

test('dayChipLabel donne un jour abrégé et le numéro du jour', () => {
  assert.deepEqual(dayChipLabel('2026-10-22'), { weekday: 'jeu.', day: '22' });
  assert.deepEqual(dayChipLabel('2026-11-01'), { weekday: 'dim.', day: '1' });
});

test('formatDateFr écrit la date en toutes lettres', () => {
  assert.equal(formatDateFr('2026-10-22'), 'jeudi 22 octobre');
  assert.equal(formatDateFr('2027-01-01'), 'vendredi 1 janvier');
});
