import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Retour de test : dans l'espace profil on pouvait créer des listes mais pas y mettre d'adresses (seul le signet de la
// fiche d'une adresse le permettait). Une liste modifiable doit proposer « Ajouter une adresse » directement.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const detail = read('../../components/lists/ListDetailModal.tsx');
const section = read('../../components/lists/MyListsSection.tsx');
const picker = read('../../components/lists/AddressPickerModal.tsx');

test('une liste modifiable propose « Ajouter une adresse » (pas la liste des likes)', () => {
  assert.match(detail, /!list\?\.readOnly && onAddSpots/);
  assert.match(detail, /Ajouter une adresse/);
  assert.match(detail, /onPress=\{onAddSpots\}/);
});

test('l’espace profil ouvre le sélecteur pour la liste affichée, jamais pour la liste des likes', () => {
  assert.match(section, /onAddSpots=\{\(\) => setPickerId\(open\?\.id \?\? null\)\}/);
  assert.match(section, /v\.id === pickerId && !v\.readOnly/);
  assert.match(section, /<AddressPickerModal list=\{picking\}/);
});

test('le sélecteur cherche dans tout le guide, ajoute et retire d’une touche, et reste ouvert', () => {
  assert.match(picker, /pickerResults\(allSpots, deferredQuery\)/);
  assert.match(picker, /userListsStore\.toggleSpot\(list\.id, String\(spot\.id\)\)/);
  assert.match(picker, /if \(!res\.ok\) setError\(res\.error\)/);
  assert.doesNotMatch(picker, /onClose\(\);\s*\}\s*;?\s*$/m);
  assert.match(picker, /keyboardShouldPersistTaps="handled"/);
});

test('zones de toucher du sélecteur : bouton « Terminé » et pastille d’ajout d’au moins 40 px', () => {
  assert.match(picker, /doneBtn: \{ minHeight: 44/);
  assert.match(picker, /toggle: \{ width: 40, height: 40/);
});

test('dans une liste, « retirer » est à côté du bouton d’ouverture de la fiche, jamais à l’intérieur (HTML invalide sur le web)', () => {
  const open = detail.indexOf('style={styles.rowMain}');
  const close = detail.indexOf('</Pressable>', open);
  const remove = detail.indexOf('Retirer ${item.title} de la liste');
  assert.ok(open > 0 && close > open && remove > close, 'le bouton « retirer » doit venir après la fermeture du bouton de la ligne');
});
