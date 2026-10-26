import test from 'node:test';
import assert from 'node:assert/strict';
import { PICKER_SUGGESTIONS, pickerResults, suggestedSpots } from '../listPickerLogic.ts';

const spot = (id: string, title: string, extra: Record<string, unknown> = {}) => ({ id, title, location: 'Toulouse', ...extra });
const SPOTS = [
  spot('1', 'Café des Arts', { rating: 4.2 }),
  spot('2', 'Bonopandas', { rating: 4.9 }),
  spot('3', 'Le Capitole Bar', { rating: 4.1, is_recommended: true }),
  spot('4', 'Zèbre Coffee', { rating: 4.9 }),
  spot('5', 'Atelier Éclair', { rating: 4.9 }),
];

test('sans saisie : recommandées d’abord, puis meilleure note, puis ordre alphabétique', () => {
  assert.deepEqual(suggestedSpots(SPOTS).map((s) => s.id), ['3', '5', '2', '4', '1']);
});

test('les suggestions sont limitées et ne modifient pas la liste d’origine', () => {
  const many = Array.from({ length: 60 }, (_, i) => spot(String(i), `Adresse ${String(i).padStart(2, '0')}`));
  assert.equal(suggestedSpots(many).length, PICKER_SUGGESTIONS);
  const before = many.map((s) => s.id).join();
  suggestedSpots(many);
  assert.equal(many.map((s) => s.id).join(), before);
});

test('une lettre ou des espaces : encore les suggestions (la recherche commence à 2 lettres)', () => {
  assert.deepEqual(pickerResults(SPOTS, 'b').map((s) => s.id), suggestedSpots(SPOTS).map((s) => s.id));
  assert.deepEqual(pickerResults(SPOTS, '   ').map((s) => s.id), suggestedSpots(SPOTS).map((s) => s.id));
});

test('recherche sans accents ni majuscules ; les titres qui commencent par la saisie passent en premier', () => {
  assert.deepEqual(pickerResults(SPOTS, 'zebre').map((s) => s.id), ['4']);
  assert.deepEqual(pickerResults(SPOTS, 'ECLAIR').map((s) => s.id), ['5']);
  assert.deepEqual(pickerResults(SPOTS, 'ca').map((s) => s.id), ['1', '3']);
});

test('aucun résultat : liste vide (le sélecteur l’explique)', () => {
  assert.deepEqual(pickerResults(SPOTS, 'introuvable'), []);
});
