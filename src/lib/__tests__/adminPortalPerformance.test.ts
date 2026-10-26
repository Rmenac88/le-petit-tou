import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Garde-fous de performance du portail admin (téléphones d'entrée de gamme) : ces choix ont été mesurés, un
// retour en arrière ferait revenir les blocages à l'ouverture (portail de 25 000 éléments, 1,9 s de blocage).
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const portal = read('../../components/AdminPortalModal.tsx');
const password = read('../../components/AdminPasswordModal.tsx');
const home = read('../../components/views/HomeView.tsx');

test('la liste des adresses est virtualisée et ne télécharge que des colonnes légères', () => {
  assert.match(portal, /<FlatList[\s\S]*data=\{filteredSpots/);
  assert.doesNotMatch(portal, /filteredSpots\.map\(/);
  assert.match(portal, /\.select\(SPOT_LIST_COLUMNS\)/);
  assert.doesNotMatch(portal, /from\('addresses'\)\.select\('\*'\)\.order/);
});

test("le portail ne diffuse plus ses téléchargements à l'appli (pas d'index de recherche refait à l'ouverture)", () => {
  assert.doesNotMatch(portal, /dataStore/);
  assert.doesNotMatch(portal, /notify(Addresses|Categories|Events)Changed/);
});

test("l'accueil ne se recharge à la fermeture du portail que si le catalogue a changé", () => {
  assert.match(home, /catalogChangedRef\.current = true/);
  assert.match(home, /if \(catalogChangedRef\.current\) \{[\s\S]*?loadSupabaseData\(true\)/);
  assert.doesNotMatch(home, /onClose=\{\(\) => \{\s*adminCodeRef\.current = '';\s*setShowAdminModal\(false\);\s*loadSupabaseData\(true\);/);
});

test('une fiche est lue en entier avant modification, et le formulaire reste verrouillé tant qu’elle manque', () => {
  assert.match(portal, /select\('\*'\)\.eq\('id', id\)\.maybeSingle\(\)/);
  assert.match(portal, /spotFormLocked = !!editingSpotId && spotDetail\.status !== 'ready'/);
  assert.match(portal, /disabled=\{isUploading \|\| spotFormLocked\}/);
  assert.match(portal, /if \(editingSpotId && spotDetail\.status !== 'ready'\)/);
});

test('un appui sur un bouton alors que le clavier est ouvert agit tout de suite (listes à formulaires)', () => {
  const scrollViews = portal.match(/(?<!useRef)<ScrollView(?=[\s>])(?:[^>]|=>)*>/g) ?? [];
  const withoutFlag = scrollViews.filter((tag) => !tag.includes('keyboardShouldPersistTaps="handled"'));
  assert.deepEqual(withoutFlag, [], `ScrollView sans keyboardShouldPersistTaps : ${withoutFlag.join(' | ')}`);
});

test('un retrait raté (hors ligne, code refusé) remet l’élément dans la liste', () => {
  assert.match(portal, /setSpots\(before\.spots\)/);
});

test('déverrouillage : plus de délai artificiel, connexion préchauffée, message en cas de réseau lent', () => {
  assert.doesNotMatch(password, /setTimeout\(\(\) => \{[\s\S]{0,200}onSuccess\(cleanPass\)/);
  assert.match(password, /select\('id', \{ head: true \}\)/);
  assert.match(password, /setTimeout\(\(\) => setIsSlow\(true\), 3000\)/);
});
