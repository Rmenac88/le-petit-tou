import test from 'node:test';
import assert from 'node:assert/strict';
import { Brand } from '../../constants/brand.ts';

// Lisibilité (WCAG AA : 4,5:1 pour du texte courant). Les couples ci-dessous sont ceux réellement utilisés par l'appli ;
// une couleur de marque modifiée par mégarde sous ces seuils fait échouer le test.
const toRgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const luminance = (hex: string) => {
  const [r, g, b] = toRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (fg: string, bg: string) => {
  const [a, b] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
};

const PAIRS: [string, string, string, number][] = [
  ['texte blanc sur bouton rose foncé', Brand.white, Brand.primaryDeep, 4.5],
  ['texte rose foncé sur fond rose doux (erreurs, sélection)', Brand.primaryInk, Brand.primarySofter, 4.5],
  ['texte rose foncé sur fond rose très doux', Brand.primaryInk, Brand.primarySoft, 4.5],
  ['texte blanc sur bouton vert « Ajouter »', Brand.white, Brand.successDeep, 4.5],
  ['note chiffrée ambre sur fond blanc', Brand.ratingInk, Brand.white, 4.5],
  ['texte sombre sur le jaune « Voir les résultats »', Brand.ink, Brand.chouchou, 7],
  ['texte secondaire sur fond blanc', Brand.inkSoft, Brand.white, 4.5],
  ['texte secondaire sur fond de page', Brand.inkSoft, Brand.bg, 4.5],
  ['texte principal sur fond de page', Brand.ink, Brand.bg, 12],
];

for (const [name, fg, bg, min] of PAIRS) {
  test(`contraste : ${name} ≥ ${min}:1`, () => {
    const ratio = contrast(fg, bg);
    assert.ok(ratio >= min, `${fg} sur ${bg} = ${ratio.toFixed(2)}:1`);
  });
}

test('le blanc sur le rose vif n\'est PAS un couple de texte courant (3,8:1) : il reste réservé aux gros éléments', () => {
  assert.ok(contrast(Brand.white, Brand.primary) < 4.5);
});
