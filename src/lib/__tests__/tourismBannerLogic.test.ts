import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_TOURISM_URL,
  TOURISM_SETTING_KEY,
  TOURISM_URL_MAX,
  parseTourismBanner,
  validateTourismUrl,
} from '../tourismBannerLogic.ts';

test('le lien par défaut est l’agenda officiel de l’Office de tourisme, en https', () => {
  assert.equal(DEFAULT_TOURISM_URL, 'https://www.toulouse-tourisme.com/sortir-a-toulouse/agenda-sorties-toulouse/');
  assert.equal(TOURISM_SETTING_KEY, 'tourism_banner');
});

test('aucun réglage ou réglage illisible : lien par défaut', () => {
  for (const v of [undefined, null, '', 42, [], {}, { url: 7 }, { url: '' }, { url: 'javascript:alert(1)' }, 'https://x.fr']) {
    assert.equal(parseTourismBanner(v), DEFAULT_TOURISM_URL, JSON.stringify(v));
  }
});

test('un réglage valide est repris tel quel', () => {
  assert.equal(parseTourismBanner({ url: 'https://exemple.fr/agenda?mois=12' }), 'https://exemple.fr/agenda?mois=12');
});

test('validation : adresse https propre acceptée, sans schéma complétée en https', () => {
  assert.deepEqual(validateTourismUrl('https://www.toulouse-tourisme.com/agenda'), { ok: true, url: 'https://www.toulouse-tourisme.com/agenda' });
  assert.deepEqual(validateTourismUrl('  toulouse-tourisme.com/agenda  '), { ok: true, url: 'https://toulouse-tourisme.com/agenda' });
});

test('validation : vide = retour au lien par défaut (url null)', () => {
  assert.deepEqual(validateTourismUrl(''), { ok: true, url: null });
  assert.deepEqual(validateTourismUrl('   '), { ok: true, url: null });
});

test('validation : refuse http, schémas dangereux, espaces, identifiants dans l’adresse, adresses trop longues', () => {
  const bad = [
    'http://exemple.fr',
    'javascript:alert(1)',
    'file:///etc/passwd',
    'intent://x#Intent;end',
    'https://exemple.fr/a b',
    'https://user:mdp@exemple.fr',
    'https://localhost',
    'https://exemple',
    'https://exemple.fr/' + 'a'.repeat(TOURISM_URL_MAX),
  ];
  for (const raw of bad) {
    const r = validateTourismUrl(raw);
    assert.equal(r.ok, false, raw);
    if (!r.ok) assert.ok(r.error.length > 5);
  }
});
