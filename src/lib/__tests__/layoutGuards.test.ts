import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Garde-fous de mise en page : chaque point ci-dessous était un défaut visible (relevé par captures d'écran).
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const map = read('../../components/views/MapView.tsx');
const homeStyles = read('../../components/views/home/homeStyles.ts');
const home = read('../../components/views/HomeView.tsx');
const portal = read('../../components/AdminPortalModal.tsx');
const detail = read('../../components/AddressDetailModal.tsx');

const block = (src: string, startMarker: string, length = 900) => {
  const i = src.indexOf(startMarker);
  assert.ok(i >= 0, `bloc introuvable : ${startMarker}`);
  return src.slice(i, i + length);
};

test('carte : la liste des puces de catégories défile depuis son début (pas de contenu centré qui déborde des deux côtés)', () => {
  const content = block(map, 'categoryScrollContent: {', 400);
  assert.doesNotMatch(content.slice(0, content.indexOf('},')), /justifyContent:\s*'center'/);
  assert.doesNotMatch(block(map, 'floatingCategoryBar: {', 300).slice(0, 300), /alignItems:\s*'center'/);
});

test('carte : les compteurs des puces viennent des données réelles, plus de nombres figés', () => {
  assert.doesNotMatch(map, /label: '(Tous|Restos|Shopping|Bars & Cafés|Beauté|Culture|Sport) \(\d+\)'/);
  assert.match(map, /categoryCounts\.food/);
});

test('carte : la fenêtre de filtres est ancrée en bas (hauteur animée) : son bouton reste accessible à mi-hauteur', () => {
  assert.match(map, /height: filterAnim\.interpolate\(/);
  assert.doesNotMatch(map, /translateY: filterAnim/);
  const region = map.slice(map.indexOf('const FILTER_DRAWER_HEIGHT'), map.indexOf('const handleResetFilters'));
  assert.doesNotMatch(region, /useNativeDriver: true/); // la hauteur ne s'anime pas avec le pilote natif
});

test('carte : texte lisible sur le bouton jaune, interrupteur de marque, libellé accentué', () => {
  assert.match(block(map, 'submitFilterBtnText: {', 200), /color: Brand\.ink/);
  assert.match(map, /<BrandSwitch value=\{openOnly\}/);
  assert.match(map, /evenements: 'Événements'/);
});

test('catégories : deux colonnes dont le nom a toute la largeur de la carte (avant : 65 px, noms coupés)', () => {
  const grid = block(homeStyles, 'categoriesGrid: {', 700);
  assert.match(grid, /rowGap: 12/);
  assert.doesNotMatch(grid.slice(0, grid.indexOf('gridItemText')), /width: '47%'/);
  assert.match(grid, /flexDirection: 'column'/); // icône au-dessus du nom
  assert.match(block(homeStyles, 'gridItemCountSelected: {', 120), /Brand\.primaryDeep/); // plus de blanc sur fond rose
  assert.match(home, /styles\.gridItemText/);
});

test('accueil : zones de toucher agrandies (liens « Voir tout », boutons du pied de page, réservation)', () => {
  assert.match(home, /SEE_ALL_HIT_SLOP/);
  assert.equal((home.match(/hitSlop=\{SEE_ALL_HIT_SLOP\}/g) ?? []).length, 3);
  assert.match(block(homeStyles, 'privacyPolicyFooterBtn: {', 200), /minHeight: 44/);
  assert.match(block(homeStyles, 'bookBtn: {', 250), /minHeight: 40/);
});

test('portail : champs côte à côte sans débordement, boutons d\'action de 40 px, lignes de catégories aérées', () => {
  assert.doesNotMatch(portal, /styles\.input, \{ flex: 1 \}\]/);
  assert.match(block(portal, 'inputHalf: {', 100), /minWidth: 0/);
  assert.match(block(portal, 'actionBtnEdit: {', 80), /width: 40/);
  assert.match(block(portal, 'catAdminCard: {', 200), /gap: 12/);
});

test('fiche d\'une adresse : barre d\'action opaque et marge de sécurité en bas', () => {
  assert.doesNotMatch(block(detail, 'floatingBar: {', 400), /rgba\(255, 255, 255, 0\.96\)/);
  assert.match(detail, /useSafeAreaInsets\(\)/);
});
