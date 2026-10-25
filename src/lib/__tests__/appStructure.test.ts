import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Structure demandée à la réunion du 22/10 : ordre de l'accueil, onglet Offres, profil en haut à droite, barre de recherche unique.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const home = read('../../components/views/HomeView.tsx');
const dock = read('../../components/FloatingDock.tsx');
const app = read('../../app/index.tsx');
const portal = read('../../components/AdminPortalModal.tsx');

test('accueil : chouchous du moment, puis chouchous du Petit Tou, puis agenda des partenaires, puis événements ; plus de « Fraîchement testées »', () => {
  const order = ['>Les chouchous du moment</Text>', '>Les chouchous du Petit Tou</Text>', '<HomeAgendaSection', ">Événements de l'association</Text>"].map((m) => home.indexOf(m));
  assert.ok(order.every((i) => i > 0), `section introuvable : ${order.join(',')}`);
  assert.deepEqual(order.slice().sort((a, b) => a - b), order, 'ordre des sections');
  assert.doesNotMatch(home, /Fraîchement|see_all_new|newAddresses/);
});

test('chouchous du moment : classés par likes (rankChouchous)', () => {
  assert.match(home, /rankChouchous\(categoryBaseAddresses/);
});

test('barre du bas : Accueil, Recherche, Carte, Offres (« - % »), Agenda ; le profil n\'y est plus', () => {
  const tabs = [...dock.matchAll(/\{ type: '(\w+)', icon: (\w+) \}/g)].map((m) => `${m[1]}:${m[2]}`);
  assert.deepEqual(tabs, ['home:Home', 'search:Search', 'map:Map', 'offers:Percent', 'agenda:CalendarDays']);
  assert.match(dock, /TabType = 'home' \| 'search' \| 'map' \| 'offers' \| 'agenda' \| 'profile'/);
});

test('profil : bouton en haut à droite de l\'accueil, de la recherche, de l\'agenda et des offres ; retour à l\'onglet d\'origine', () => {
  for (const f of ['../../components/views/home/HomeHeader.tsx', '../../components/views/SearchView.tsx', '../../components/views/AgendaView.tsx', '../../components/views/OffersView.tsx']) {
    assert.match(read(f), /<ProfileButton /, f);
  }
  assert.match(app, /tabBeforeProfile/);
  assert.match(app, /<ProfileView[\s\S]*onBack=\{\(\) => setActiveTab\(tabBeforeProfile\)\}/);
  assert.match(app, /<OffersView/);
  assert.doesNotMatch(app, /CardsView/);
});

test('une seule barre de recherche (celle de la carte) sur l\'accueil, la recherche et la carte', () => {
  for (const f of ['../../components/views/home/HomeHeader.tsx', '../../components/views/SearchView.tsx', '../../components/views/MapView.tsx']) {
    assert.match(read(f), /<SearchPill/, f);
  }
});

test('offres : onglet du portail, aucune offre fictive affichée, aucun cache d\'exemple relu', () => {
  assert.match(portal, /activeTab === 'offers' && <OffersAdminPanel/);
  const store = read('../discountCardsStore.ts');
  assert.match(store, /isOfferVisible\(o, now\)/);
  assert.doesNotMatch(store, /DEFAULT_DISCOUNT_CARDS|unsplash/);
  assert.match(store, /removeItem\(LEGACY_CARDS_STORAGE_KEY\)/);
});

test('listes personnelles : stockées uniquement sur le téléphone (aucun appel réseau dans leur stockage) et effacées avec « Effacer mes données »', () => {
  const store = read('../userListsStore.ts');
  assert.doesNotMatch(store, /supabase|fetch\(/);
  assert.match(read('../../components/PrivacyPolicyModal.tsx'), /userListsStore\.resetLocal\(\)/);
});
