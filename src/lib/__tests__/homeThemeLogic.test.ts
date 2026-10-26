import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_THEME, THEME_PRESETS, applyPreset, sameLook, THEME_SWATCHES, THEME_TEXT_LIMITS, cleanThemeText, mixHex, normalizeHex, parseHomeTheme,
  resolveTheme, sameTheme, themePayload, validateThemeDraft, type HomeTheme,
} from '../homeThemeLogic.ts';
import { contrastRatio } from '../colorContrast.ts';

const SAMPLE: HomeTheme = { ...DEFAULT_THEME, name: 'Été', bg: '#0f2a43', bg2: '#1f5f7a', accent: '#7fe0d0', stars: false, line2: 'en bleu.' };

test('le thème d’origine est le violet sidéral actuel, avec ses étoiles et ses phrases', () => {
  assert.equal(DEFAULT_THEME.bg, '#2b1d46');
  assert.equal(DEFAULT_THEME.bg2, null);
  assert.equal(DEFAULT_THEME.stars, true);
  assert.equal(DEFAULT_THEME.line1, 'Pour voir la ville');
  assert.equal(DEFAULT_THEME.line2, 'en rose.');
});

test('lecture : un thème complet est repris tel quel ; couleurs en minuscules, textes nettoyés', () => {
  assert.deepEqual(parseHomeTheme(SAMPLE), SAMPLE);
  const t = parseHomeTheme({ ...SAMPLE, bg: '#0F2A43', line1: '  Pour   voir \n la ville ' });
  assert.equal(t.bg, '#0f2a43');
  assert.equal(t.line1, 'Pour voir la ville');
});

test('lecture : tout réglage illisible redonne le thème d’origine en entier (jamais un mélange)', () => {
  for (const bad of [null, undefined, 'texte', 12, [], {}, { ...SAMPLE, bg: 'bleu' }, { ...SAMPLE, accent: '#12' }, { ...SAMPLE, text: null },
    { ...SAMPLE, stars: 'oui' }, { ...SAMPLE, bg2: 'rouge' }, { ...SAMPLE, bg2: 5 }]) {
    assert.deepEqual(parseHomeTheme(bad), DEFAULT_THEME, JSON.stringify(bad));
  }
});

test('lecture : le dégradé est facultatif ; un texte absent retrouve sa valeur d’origine ; les textes sont bornés', () => {
  assert.equal(parseHomeTheme({ ...SAMPLE, bg2: null }).bg2, null);
  const { bg2, ...sansDegrade } = SAMPLE;
  assert.equal(parseHomeTheme(sansDegrade).bg2, null);
  const t = parseHomeTheme({ ...SAMPLE, line1: '', subtitle: 7, name: 'x'.repeat(200), line2: 'a'.repeat(100) });
  assert.equal(t.line1, DEFAULT_THEME.line1);
  assert.equal(t.subtitle, DEFAULT_THEME.subtitle);
  assert.equal(t.name.length, THEME_TEXT_LIMITS.name);
  assert.equal(t.line2.length, THEME_TEXT_LIMITS.line2);
});

test('cleanThemeText retire les caractères de contrôle et ignore ce qui n’est pas du texte', () => {
  assert.equal(cleanThemeText('a\u0001b\u007fc', 10), 'a b c');
  assert.equal(cleanThemeText(42, 10), '');
  assert.equal(cleanThemeText('  ', 10), '');
});

test('normalizeHex accepte # facultatif et majuscules, refuse le reste', () => {
  assert.equal(normalizeHex('0F2A43'), '#0f2a43');
  assert.equal(normalizeHex(' #AbCdEf '), '#abcdef');
  for (const bad of ['#abc', 'red', '', '#12345g', '#1234567', null, 5]) assert.equal(normalizeHex(bad), null);
});

test('envoi : payload au format attendu par le serveur', () => {
  const p = themePayload({ ...SAMPLE, bg: '#0F2A43', name: ' Été  2027 ' });
  assert.deepEqual(Object.keys(p).sort(), ['accent', 'bg', 'bg2', 'line1', 'line2', 'name', 'stars', 'subtitle', 'text']);
  assert.equal(p.bg, '#0f2a43');
  assert.equal(p.name, 'Été 2027');
  assert.equal(themePayload({ ...SAMPLE, bg2: null }).bg2, null);
});

test('validation avant envoi : couleurs, dégradé, textes vides ou trop longs', () => {
  assert.equal(validateThemeDraft(SAMPLE), null);
  assert.match(validateThemeDraft({ ...SAMPLE, bg: 'bleu' }) ?? '', /fond/);
  assert.match(validateThemeDraft({ ...SAMPLE, accent: '#12' }) ?? '', /accent/);
  assert.match(validateThemeDraft({ ...SAMPLE, text: '' }) ?? '', /texte/);
  assert.match(validateThemeDraft({ ...SAMPLE, bg2: 'x' }) ?? '', /dégradé/);
  assert.match(validateThemeDraft({ ...SAMPLE, line1: '   ' }) ?? '', /première ligne/);
  assert.match(validateThemeDraft({ ...SAMPLE, subtitle: 'a'.repeat(91) }) ?? '', /sous-titre.*trop long/);
  assert.match(validateThemeDraft({ ...SAMPLE, name: '' }) ?? '', /nom du thème/);
});

test('sameTheme compare tous les champs', () => {
  assert.equal(sameTheme(SAMPLE, { ...SAMPLE }), true);
  for (const change of [{ name: 'x' }, { bg: '#000000' }, { bg2: null }, { accent: '#000000' }, { text: '#000000' }, { stars: true }, { line1: 'x' }, { line2: 'x' }, { subtitle: 'x' }]) {
    assert.equal(sameTheme(SAMPLE, { ...SAMPLE, ...change }), false, JSON.stringify(change));
  }
});

test('rendu : le thème d’origine s’affiche comme avant (blanc, rose clair, étoiles) et sans correction', () => {
  const r = resolveTheme(DEFAULT_THEME);
  assert.deepEqual(r.backgrounds, ['#2b1d46']);
  assert.equal(r.titleColor, '#ffffff');
  assert.equal(r.accentColor, '#ff8fa3');
  assert.equal(r.showStars, true);
  assert.equal(r.adjusted, false);
  assert.ok(contrastRatio(r.subtitleColor, '#2b1d46') >= 4.5);
});

test('rendu : texte illisible corrigé (blanc sur fond clair devient sombre, sombre sur fond foncé devient blanc)', () => {
  const clair = resolveTheme({ ...DEFAULT_THEME, bg: '#fff1ec', text: '#ffffff', accent: '#ffffff', stars: true });
  assert.equal(clair.adjusted, true);
  assert.ok(contrastRatio(clair.titleColor, '#fff1ec') >= 4.5);
  assert.ok(contrastRatio(clair.accentColor, '#fff1ec') >= 3);
  assert.equal(clair.showStars, false, 'pas d’étoiles blanches sur un fond clair');
  const sombre = resolveTheme({ ...DEFAULT_THEME, text: '#1a1a22' });
  assert.equal(sombre.titleColor, '#ffffff');
  assert.equal(sombre.adjusted, true);
});

test('rendu : sur un dégradé, le texte doit être lisible sur les deux extrémités', () => {
  const r = resolveTheme({ ...DEFAULT_THEME, bg: '#1a1a22', bg2: '#fff1ec', text: '#ffffff' });
  assert.deepEqual(r.backgrounds, ['#1a1a22', '#fff1ec']);
  const sombres = resolveTheme({ ...DEFAULT_THEME, bg: '#0f2a43', bg2: '#8e1f37', text: '#1a1a22' });
  assert.equal(sombres.adjusted, true);
  assert.equal(sombres.legible, true);
  for (const bg of ['#0f2a43', '#8e1f37']) assert.ok(contrastRatio(sombres.titleColor, bg) >= 4.5, `${sombres.titleColor} sur ${bg}`);
});

test('dégradé entre deux couleurs trop éloignées : aucun texte lisible partout, l’enregistrement est refusé', () => {
  const extreme = { ...DEFAULT_THEME, bg: '#000000', bg2: '#ffffff' };
  assert.equal(resolveTheme(extreme).legible, false);
  assert.match(validateThemeDraft(extreme) ?? '', /trop éloignées/);
  assert.equal(validateThemeDraft({ ...extreme, bg2: '#1a1a22' }), null);
});

test('rendu : chaque préréglage est lisible sans correction, texte ≥ 4,5:1, accent ≥ 3:1, sous-titre ≥ 4,5:1', () => {
  for (const preset of THEME_PRESETS) {
    const r = resolveTheme(preset);
    const bgs = r.backgrounds;
    assert.equal(r.adjusted, false, `${preset.name} : corrigé`);
    for (const bg of bgs) {
      assert.ok(contrastRatio(r.titleColor, bg) >= 4.5, `${preset.name} : titre sur ${bg}`);
      assert.ok(contrastRatio(r.accentColor, bg) >= 3, `${preset.name} : accent sur ${bg}`);
      assert.ok(contrastRatio(r.subtitleColor, bg) >= 4.5, `${preset.name} : sous-titre sur ${bg}`);
    }
    assert.deepEqual(parseHomeTheme(preset), preset, `${preset.name} : doit survivre à l'aller-retour serveur`);
    assert.equal(validateThemeDraft(preset), null, preset.name);
  }
});

test('rendu : n’importe quel couple de couleurs de la palette donne un texte et un accent lisibles', () => {
  for (const bg of THEME_SWATCHES) {
    for (const text of THEME_SWATCHES) {
      const r = resolveTheme({ ...DEFAULT_THEME, bg, text, accent: text });
      assert.ok(contrastRatio(r.titleColor, bg) >= 4.5 || r.titleColor === '#000000' || r.titleColor === '#ffffff', `${text} sur ${bg}`);
      assert.ok(contrastRatio(r.titleColor, bg) >= 3, `${text} sur ${bg} : ${r.titleColor}`);
    }
  }
});

test('préréglages : noms distincts, le premier est le thème d’origine, étoiles seulement sur fond sombre', () => {
  assert.equal(THEME_PRESETS[0], DEFAULT_THEME);
  assert.equal(new Set(THEME_PRESETS.map((p) => p.name)).size, THEME_PRESETS.length);
  for (const p of THEME_PRESETS) {
    const r = resolveTheme(p);
    assert.equal(r.showStars, p.stars, p.name);
  }
});

test('mixHex mélange deux couleurs', () => {
  assert.equal(mixHex('#ffffff', '#000000', 0.5), '#808080');
  assert.equal(mixHex('#102030', '#102030', 0.3), '#102030');
});

test('le voile posé sur une image reprend la teinte du thème, à moitié transparent', () => {
  assert.match(resolveTheme(DEFAULT_THEME).scrim, /^#[0-9a-f]{6}80$/);
  assert.equal(resolveTheme(DEFAULT_THEME).scrim, '#2b1d4680');
});

test('un préréglage change l’apparence mais garde les phrases saisies', () => {
  const draft = { ...DEFAULT_THEME, line1: 'Ma phrase', line2: 'en vert.', subtitle: 'Mon sous-titre' };
  const preset = THEME_PRESETS.find((p) => p.name === 'Rose Toulouse') as HomeTheme;
  const out = applyPreset(draft, preset);
  assert.equal(out.bg, preset.bg);
  assert.equal(out.bg2, preset.bg2);
  assert.equal(out.accent, preset.accent);
  assert.equal(out.stars, preset.stars);
  assert.equal(out.name, 'Rose Toulouse');
  assert.equal(out.line1, 'Ma phrase');
  assert.equal(out.line2, 'en vert.');
  assert.equal(out.subtitle, 'Mon sous-titre');
  assert.equal(sameLook(out, preset), true);
  assert.equal(sameLook(out, DEFAULT_THEME), false);
});
