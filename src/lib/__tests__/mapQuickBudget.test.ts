import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Réunion du 22/10 : le filtre de prix doit être directement accessible depuis la carte (sans ouvrir les filtres).
const map = readFileSync(new URL('../../components/views/MapView.tsx', import.meta.url), 'utf8');

test('la barre de la carte propose des budgets en un appui, avec les paliers du curseur des filtres', () => {
  const quick = /const QUICK_BUDGETS = \[([\d, ]+)\] as const;/.exec(map)?.[1].split(',').map((n) => Number(n.trim()));
  assert.deepEqual(quick, [10, 20, 30]);
  const sliderPresets = /\{\[([\d, ]+)\]\.map\(\(val\) => \(\s*<Pressable/.exec(map)?.[1].split(',').map((n) => Number(n.trim())) ?? [];
  for (const v of quick ?? []) assert.ok(sliderPresets.includes(v), `${v} € doit aussi être un palier du curseur`);
});

test('un second appui retire la limite, et les puces vivent dans la barre qui défile (pas de contenu centré)', () => {
  assert.match(map, /setBudget\(isSelected \? 50 : val\)/);
  assert.match(map, /QUICK_BUDGETS\.map\(\(val\) =>/);
  const bar = map.slice(map.indexOf('styles.categoryScrollContent'), map.indexOf('Apple Maps-like Continuous'));
  assert.ok(bar.includes('QUICK_BUDGETS.map'), 'les budgets sont dans la barre de catégories');
  assert.doesNotMatch(map.slice(map.indexOf('categoryScrollContent: {'), map.indexOf('categoryPill: {')), /justifyContent:\s*'center'/);
});

test('les puces de budget sont accessibles (rôle, état, libellé) et à la taille tactile minimale', () => {
  assert.match(map, /accessibilityLabel=\{`Budget jusqu'à \$\{val\} euros par personne`\}/);
  assert.match(map, /minHeight: 44/);
});
