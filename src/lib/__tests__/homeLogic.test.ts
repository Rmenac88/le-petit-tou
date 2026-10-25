import test from 'node:test';
import assert from 'node:assert/strict';
import { likesOf, rankChouchous, upcomingPartnerOccurrences } from '../homeLogic.ts';
import type { PartnerEventRow } from '../agendaOccurrences.ts';

const spot = (id: string, extra: Record<string, unknown> = {}) => ({ id, title: id.toUpperCase(), rating: 4, ...extra });

test('likes : le décompte global récent prime sur la colonne de la base ; valeurs invalides = 0', () => {
  assert.equal(likesOf(spot('a', { likes_count: 3 }), { a: 7 }), 7);
  assert.equal(likesOf(spot('a', { likes_count: 3 }), {}), 3);
  assert.equal(likesOf(spot('a', { likes_count: 'x' }), {}), 0);
  assert.equal(likesOf(spot('a'), { a: -2 }), 0);
});

test('chouchous du moment : plus il y a de likes, plus l\'adresse est en tête', () => {
  const spots = [spot('a'), spot('b'), spot('c'), spot('d')];
  const out = rankChouchous(spots, { a: 2, b: 9, c: 5 });
  assert.deepEqual(out.map((s) => s.id), ['b', 'c', 'a']); // d : ni like ni recommandation -> absente
});

test('chouchous du moment : sans likes, ce sont les adresses recommandées ; à likes égaux recommandée, note, nom', () => {
  const spots = [
    spot('z', { is_recommended: true, rating: 4.1 }),
    spot('y', { is_recommended: true, rating: 4.9 }),
    spot('x', { rating: 5 }),
  ];
  assert.deepEqual(rankChouchous(spots, {}).map((s) => s.id), ['y', 'z']);
  const tie = [spot('b', { rating: 4.5 }), spot('a', { rating: 4.5 }), spot('c', { rating: 4.8, is_recommended: false })];
  assert.deepEqual(rankChouchous(tie, { a: 1, b: 1, c: 1 }).map((s) => s.id), ['c', 'a', 'b']);
});

test('chouchous du moment : limite, immutabilité, une adresse recommandée sans like passe après celles qui ont des likes', () => {
  const many = Array.from({ length: 30 }, (_, i) => spot(`s${String(i).padStart(2, '0')}`));
  const likes = Object.fromEntries(many.map((s, i) => [s.id, i + 1]));
  const out = rankChouchous(many, likes, 5);
  assert.equal(out.length, 5);
  assert.equal(out[0].id, 's29');
  assert.equal(many[0].id, 's00'); // liste d'origine inchangée
  const mixed = rankChouchous([spot('r', { is_recommended: true }), spot('l')], { l: 1 });
  assert.deepEqual(mixed.map((s) => s.id), ['l', 'r']);
});

const ev = (id: string, spot_id: string, start_date: string, extra: Partial<PartnerEventRow> = {}): PartnerEventRow => ({
  id, spot_id, title: `Soirée ${id}`, start_date, start_time: '19:00', is_active: true, ...extra,
});

test('agenda sur l\'accueil : aujourd\'hui inclus, 14 jours, adresses connues seulement, ordre chronologique, limite', () => {
  const events = [
    ev('e1', 'known', '2026-10-27'),
    ev('e2', 'inconnue', '2026-10-26'),
    ev('e3', 'known', '2026-10-25', { start_time: '12:00' }),
    ev('e4', 'known', '2026-11-20'), // trop loin
    ev('e5', 'known', '2026-10-10', { repeat_weekly_until: '2026-12-31' }), // chaque samedi
  ];
  const out = upcomingPartnerOccurrences(events, '2026-10-25', new Set(['known']), 14, 10);
  assert.deepEqual(out.map((o) => `${o.occurrenceDate} ${o.event.id}`), [
    '2026-10-25 e3', '2026-10-27 e1', '2026-10-31 e5', '2026-11-07 e5',
  ]);
  assert.equal(upcomingPartnerOccurrences(events, '2026-10-25', new Set(['known']), 14, 2).length, 2);
  assert.deepEqual(upcomingPartnerOccurrences([], '2026-10-25', new Set(['known'])), []);
});
