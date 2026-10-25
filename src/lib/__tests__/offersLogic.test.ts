import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEMO_OFFER_IDS, countByCategory, filterOffers, isExpired, isOfferVisible, normalizeOffer,
  parseDiscount, readableTextOn, sortOffers, validityLabel, type Offer,
} from '../offersLogic.ts';

const row = (extra: Record<string, unknown> = {}) => ({ id: 'o1', title: 'Chez Un', discount_value: '-20%', ...extra });
const offer = (extra: Partial<Offer> = {}): Offer => ({ ...(normalizeOffer(row()) as Offer), ...extra });
const NOW = Date.parse('2026-10-25T12:00:00Z');

test('normalisation : valeurs par défaut, textes bornés, couleurs et image sûres', () => {
  const o = normalizeOffer(row({ category: 'casino', card_color_primary: 'rouge', visual_url: 'http://x.fr/a.jpg', max_uses: 500, sort_order: '3', title: ` ${'x'.repeat(200)} ` }), 2) as Offer;
  assert.equal(o.title.length, 80);
  assert.equal(o.category, 'food');
  assert.equal(o.card_color_primary, '#C93049');
  assert.equal(o.visual_url, null, 'image http refusée');
  assert.equal(o.max_uses, 99);
  assert.equal(o.uses_count, 2);
  assert.equal(o.remaining_uses, 97);
  assert.equal(o.sort_order, 3);
  assert.equal(o.badge_label, 'MEMBRE PETIT TOU');
  const ok = normalizeOffer(row({ visual_url: 'https://exemple.fr/a.jpg', card_color_secondary: '#112233', max_uses: 3 }), 5) as Offer;
  assert.equal(ok.visual_url, 'https://exemple.fr/a.jpg');
  assert.equal(ok.card_color_secondary, '#112233');
  assert.equal(ok.remaining_uses, 0, 'jamais négatif');
});

test('lignes inutilisables écartées', () => {
  for (const bad of [null, undefined, 'x', {}, { id: 'a' }, { id: 'a', title: 'T' }, { id: 'a', title: '  ', discount_value: '-5%' }, { title: 'T', discount_value: '-5%' }]) {
    assert.equal(normalizeOffer(bad as any), null);
  }
});

test('visibilité : active, réelle (pas un exemple) et pas expirée', () => {
  assert.equal(isOfferVisible(offer(), NOW), true);
  assert.equal(isOfferVisible(offer({ is_active: false }), NOW), false);
  assert.equal(isOfferVisible(offer({ valid_until: '2026-10-25T11:59:59Z' }), NOW), false);
  assert.equal(isOfferVisible(offer({ valid_until: '2026-10-25T12:00:00Z' }), NOW), false, 'la fin exacte est exclue');
  assert.equal(isOfferVisible(offer({ valid_until: '2026-10-26T00:00:00Z' }), NOW), true);
  assert.equal(isExpired({ valid_until: 'pas une date' }, NOW), false);
  for (const id of DEMO_OFFER_IDS) assert.equal(isOfferVisible(offer({ id }), NOW), false, `exemple ${id}`);
  assert.equal(DEMO_OFFER_IDS.size, 5);
});

test('tri, filtre et compteurs', () => {
  const list = [
    offer({ id: '1', title: 'B', sort_order: 0, category: 'drinks' }),
    offer({ id: '2', title: 'A', sort_order: 0, category: 'food' }),
    offer({ id: '3', title: 'Z', sort_order: -1, category: 'food' }),
  ];
  assert.deepEqual(sortOffers(list).map((o) => o.id), ['3', '2', '1']);
  assert.deepEqual(filterOffers(list, 'food').map((o) => o.id), ['1', '2', '3'].filter((id) => id !== '1'));
  assert.equal(filterOffers(list, 'all').length, 3);
  assert.deepEqual(countByCategory(list), { all: 3, food: 2, drinks: 1, shopping: 0, culture: 0, services: 0 });
  assert.equal(list[0].id, '1', 'liste d\'origine inchangée');
});

test('avantage affiché en grand', () => {
  assert.deepEqual(parseDiscount('-20% COCKTAILS'), { big: '-20%', small: 'COCKTAILS', numeric: true });
  assert.deepEqual(parseDiscount('-15 %'), { big: '-15%', small: '', numeric: true });
  assert.deepEqual(parseDiscount('20% sur la carte'), { big: '-20%', small: 'sur la carte', numeric: true });
  assert.deepEqual(parseDiscount('5€ offerts'), { big: '-5€', small: 'offerts', numeric: true });
  assert.deepEqual(parseDiscount('1 Coupe Offerte'), { big: '1 Coupe Offerte', small: '', numeric: false });
  assert.deepEqual(parseDiscount('  Café   offert '), { big: 'Café offert', small: '', numeric: false });
});

test('mention de validité', () => {
  assert.equal(validityLabel(null, NOW), null);
  assert.equal(validityLabel('n\'importe quoi', NOW), null);
  assert.equal(validityLabel('2026-10-25T11:00:00Z', NOW), 'Expirée');
  assert.equal(validityLabel('2026-10-25T20:00:00Z', NOW), 'Dernier jour');
  assert.equal(validityLabel('2026-10-28T12:00:00Z', NOW), 'Encore 3 jours');
  assert.match(validityLabel('2026-12-31T23:00:00Z', NOW) as string, /^Jusqu'au \d{1,2} (janv\.|déc\.) 202[67]$/);
});

test('texte lisible sur n\'importe quelle couleur choisie (contraste ≥ 4,5:1 avec la couleur retenue)', () => {
  assert.equal(readableTextOn('#000000'), '#FFFFFF');
  assert.equal(readableTextOn('#FFFFFF'), '#1A1A22');
  assert.equal(readableTextOn('#F2B835'), '#1A1A22'); // jaune
  assert.equal(readableTextOn('#C93049'), '#FFFFFF'); // rose foncé
  assert.equal(readableTextOn('#6666ff'), '#000000'); // ton moyen : ni le blanc ni le noir de la marque n'atteignent 4,5:1
  assert.equal(readableTextOn('pas une couleur'), '#FFFFFF');
  const lum = (hex: string) => { const f = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(1) + 0.7152 * f(3) + 0.0722 * f(5); };
  for (let r = 0; r < 256; r += 51) for (let g = 0; g < 256; g += 51) for (let b = 0; b < 256; b += 51) {
    const hex = '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
    const text = readableTextOn(hex);
    const [a, c] = [lum(hex), lum(text)].sort((x, y) => y - x);
    assert.ok((a + 0.05) / (c + 0.05) >= 4.5, `${hex} -> ${text}`);
  }
});
