import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { safeSystemPath } from '../deepLinkGuard.ts';

const root = new URL('../../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

test('lien piégé (3 000 caractères mal encodés) : ramené à l’accueil instantanément, sans décodage', () => {
  const evil = 'lepetittou://' + '%E0%A4%A'.repeat(400);
  const t = Date.now();
  assert.equal(safeSystemPath(evil), '/');
  assert.ok(Date.now() - t < 50);
  for (const p of ['/', 'lepetittou://', '', null, undefined, '/admin', 'https://exemple.fr/x']) assert.equal(safeSystemPath(p), '/');
});

test('expo-router appelle bien le garde-fou (fichier +native-intent à la racine des routes)', () => {
  assert.ok(existsSync(new URL('src/app/+native-intent.tsx', root)));
  assert.match(read('src/app/+native-intent.tsx'), /export function redirectSystemPath/);
});

test('iPad : non déclaré (l’appli est en portrait seul et n’a jamais été testée sur tablette)', () => {
  const app = JSON.parse(read('app.json')).expo;
  assert.equal(app.ios.supportsTablet, false);
});

test('permission photos : seulement dans les builds avec portail admin', () => {
  const cfg = read('app.config.js');
  assert.match(cfg, /expo-image-picker/);
  assert.match(cfg, /EXPO_PUBLIC_ENABLE_ADMIN/);
});
