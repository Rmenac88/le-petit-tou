import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Le portail admin n'existe que si le build est produit avec EXPO_PUBLIC_ENABLE_ADMIN=1 (src/constants/features.ts) :
 * présent dans l'APK de test des bénévoles (profil preview), absent des builds pour les boutiques (règle Apple 2.3.1).
 */
const eas = JSON.parse(readFileSync(new URL('../../../eas.json', import.meta.url), 'utf8'));

test('APK de test (preview) : portail admin activé', () => {
  assert.equal(eas.build.preview.env.EXPO_PUBLIC_ENABLE_ADMIN, '1');
});

test('build des boutiques (production) : aucun portail admin', () => {
  assert.equal(eas.build.production.env?.EXPO_PUBLIC_ENABLE_ADMIN, undefined);
});

test('les profils ne contiennent que la clé publique de la base (jamais une clé de service)', () => {
  for (const [name, profile] of Object.entries<any>(eas.build)) {
    const key = profile.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!key) continue;
    const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString());
    assert.equal(payload.role, 'anon', name);
  }
});
