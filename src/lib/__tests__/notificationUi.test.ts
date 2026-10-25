import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Garde-fous de l'interface des notifications (même aspect partout, proposé une seule fois).
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const home = read('../../components/views/HomeView.tsx');
const settings = read('../../components/NotificationSettingsModal.tsx');
const welcome = read('../../components/NotificationWelcomeModal.tsx');
const push = read('../pushNotifications.ts');

test('les deux écrans de choix utilisent l\'interrupteur de marque (pas l\'interrupteur natif, différent selon le système)', () => {
  for (const [name, src] of [['réglages', settings], ['bienvenue', welcome]] as const) {
    assert.match(src, /import BrandSwitch from '\.\/BrandSwitch'/, name);
    assert.doesNotMatch(src, /<Switch\b/, name);
  }
});

test('le choix des notifications est proposé une seule fois, jamais par-dessus un autre écran', () => {
  assert.match(home, /shouldOfferPushWelcome\(\{/);
  assert.match(home, /appStorage\.setItem\(PUSH_PROMPTED_KEY, '1'\)/);
  assert.match(home, /anyModalOpenRef\.current/);
  assert.match(home, /<NotificationWelcomeModal visible=\{showNotifWelcome\}/);
  // « Effacer mes données » remet le téléphone à neuf : le choix est reproposé une fois
  assert.match(push, /removeItem\(PUSH_PROMPTED_KEY\)/);
  // la clé reste celle de la version précédente : un téléphone déjà interrogé n'est pas re-sollicité
  assert.match(push, /PUSH_PROMPTED_KEY = 'LPT_PUSH_PROMPTED_V1'/);
});

test('la demande d\'autorisation du système ne vient qu\'après le choix de l\'utilisateur', () => {
  assert.doesNotMatch(home, /requestPermissionsAsync/);
  assert.doesNotMatch(welcome, /requestPermissionsAsync/);
  assert.match(welcome, /enablePush\(prefs\)/);
});
