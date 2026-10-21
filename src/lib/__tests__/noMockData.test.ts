import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Garde-fou : aucune donnée fictive (partenaires, événements) ne doit pouvoir être affichée à de vrais utilisateurs.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('la liste de partenaires par défaut est vide', () => {
  assert.match(read('../partnersStore.ts'), /DEFAULT_PARTNERS: SponsoredPartner\[\] = \[\];/);
});

test('l’accueil ne contient plus d’événements fictifs', () => {
  const home = read('../../components/views/HomeView.tsx');
  assert.doesNotMatch(home, /MOCK_EVENTS/);
  assert.doesNotMatch(home, /Soirée de lancement du guide 2026/);
  assert.match(home, /upcomingEvents\(events, todayIso\(\)\)/);
});
