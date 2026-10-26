import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEME_PRESETS, THEME_SETTING_KEY, THEME_TEXT_LIMITS } from '../homeThemeLogic.ts';

// Garde-fous du thème de l'année : le SQL (migration 014) et le code doivent rester d'accord, et l'accueil doit
// réellement appliquer le thème (sinon le portail changerait un réglage sans effet visible).
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const sql = read('../../scripts/014_home_theme.sql');
const header = read('../../components/views/home/HomeHeader.tsx');
const home = read('../../components/views/HomeView.tsx');
const background = read('../../components/admin/HomeBackgroundAdminPanel.tsx');
const store = read('../homeThemeStore.ts');

test('la clé du réglage et les limites de texte sont les mêmes dans le SQL et dans le code', () => {
  assert.match(sql, new RegExp(`'${THEME_SETTING_KEY}'`));
  const limits = JSON.parse(/v_limits constant jsonb := '(\{[^']+\})'/.exec(sql)?.[1] ?? '{}');
  assert.deepEqual(limits, THEME_TEXT_LIMITS);
  const keys = /v_key not in \(([^)]+)\)/.exec(sql)?.[1].split(',').map((k) => k.trim().replace(/'/g, '')).sort();
  assert.deepEqual(keys, ['accent', 'bg', 'bg2', 'line1', 'line2', 'name', 'stars', 'subtitle', 'text']);
  assert.match(store, new RegExp(`THEME_SETTING_KEY`));
});

test('les préréglages respectent les limites du serveur', () => {
  for (const p of THEME_PRESETS) {
    for (const [key, max] of Object.entries(THEME_TEXT_LIMITS)) assert.ok(((p as any)[key] as string).length <= max, `${p.name}.${key}`);
  }
});

test('le haut de l’accueil applique le thème : plus de couleur ni de phrase figée', () => {
  assert.doesNotMatch(header, /#FF8FA3|rgba\(255,\s*255,\s*255,\s*0\.78\)|Pour voir la ville|en rose\./);
  assert.match(header, /theme\.line1/);
  assert.match(header, /theme\.accentColor/);
  assert.match(header, /theme\.showStars/);
  assert.match(header, /theme\.scrim/);
});

test('l’accueil charge le thème au lancement, au retour au premier plan et après un changement du portail', () => {
  assert.match(home, /loadStoredHomeTheme\(\)/);
  assert.match(home, /onAppEvent\(HOME_THEME_CHANGED_EVENT, refresh\)/);
  assert.match(home, /theme=\{resolvedHomeTheme\}/);
});

test('le portail propose le thème en haut de l’onglet Apparence', () => {
  assert.match(background, /<HomeThemeSection adminCode=\{adminCode\} \/>/);
});
