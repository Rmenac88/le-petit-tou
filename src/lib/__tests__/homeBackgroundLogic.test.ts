import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BACKGROUND_MAX_BYTES,
  GALAXY,
  backgroundImageUrl,
  extensionForMime,
  guessMime,
  parseHomeBackground,
  sizeAdvice,
  validateBackgroundFile,
} from '../homeBackgroundLogic.ts';

const PATH = 'home/20261023-0123456789abcdef0123456789abcdef.jpg';

test('parseHomeBackground : Galaxy pour tout ce qui n’est pas une image valide', () => {
  for (const raw of [null, undefined, 42, 'x', {}, { mode: 'galaxy' }, { mode: 'image' }, { mode: 'image', path: '../etc/passwd' },
    { mode: 'image', path: 'https://exemple.test/a.jpg' }, { mode: 'image', path: 'home/x.jpg' }, { mode: 'video', path: PATH }]) {
    assert.deepEqual(parseHomeBackground(raw), GALAXY, JSON.stringify(raw));
  }
});

test('parseHomeBackground : lit une image valide et tolère une date absente ou illisible', () => {
  assert.deepEqual(parseHomeBackground({ mode: 'image', path: PATH, updated: 1792000000 }), { mode: 'image', path: PATH, updated: 1792000000 });
  assert.deepEqual(parseHomeBackground({ mode: 'image', path: PATH }), { mode: 'image', path: PATH, updated: 0 });
  assert.deepEqual(parseHomeBackground({ mode: 'image', path: PATH, updated: 'hier' }), { mode: 'image', path: PATH, updated: 0 });
});

test('backgroundImageUrl : adresse publique du stockage avec numéro de version ; rien pour Galaxy', () => {
  const bg = parseHomeBackground({ mode: 'image', path: PATH, updated: 1792000000 });
  assert.equal(backgroundImageUrl('https://abc.supabase.co/', bg), `https://abc.supabase.co/storage/v1/object/public/app-backgrounds/${PATH}?v=1792000000`);
  assert.equal(backgroundImageUrl('https://abc.supabase.co', GALAXY), null);
  assert.equal(backgroundImageUrl('', bg), null);
});

test('formats : JPEG, PNG, WebP seulement ; type deviné depuis l’extension à défaut', () => {
  assert.equal(extensionForMime('image/jpeg'), 'jpg');
  assert.equal(extensionForMime('IMAGE/PNG'), 'png');
  assert.equal(extensionForMime('image/webp'), 'webp');
  for (const bad of ['image/gif', 'image/svg+xml', 'application/pdf', '', null, undefined]) assert.equal(extensionForMime(bad), null);
  assert.equal(guessMime('file:///x/photo.JPG?cache=1'), 'image/jpeg');
  assert.equal(guessMime('file:///x/photo.png'), 'image/png');
  assert.equal(guessMime('content://media/1234'), null);
  assert.equal(guessMime('file:///x/a.gif', 'image/jpg'), 'image/jpeg');
});

test('validateBackgroundFile : un message clair par refus, rien pour un fichier correct', () => {
  assert.equal(validateBackgroundFile({ mimeType: 'image/jpeg', size: 1_000_000 }), null);
  assert.equal(validateBackgroundFile({ mimeType: 'image/png', size: BACKGROUND_MAX_BYTES }), null);
  assert.match(validateBackgroundFile({ mimeType: 'image/gif', size: 1000 })!, /Format non pris en charge/);
  assert.match(validateBackgroundFile({ mimeType: 'image/jpeg', size: BACKGROUND_MAX_BYTES + 1 })!, /trop lourde \(2,0 Mo\)/);
  assert.match(validateBackgroundFile({ mimeType: 'image/jpeg', size: 5.5 * 1024 * 1024 })!, /5,5 Mo/);
  assert.match(validateBackgroundFile({ mimeType: 'image/jpeg', size: 0 })!, /taille/);
  assert.match(validateBackgroundFile({ mimeType: 'image/jpeg', size: null })!, /taille/);
});

test('sizeAdvice : conseil seulement pour une image étroite', () => {
  assert.match(sizeAdvice(600, 400)!, /1200 px/);
  assert.equal(sizeAdvice(1600, 1200), null);
  assert.equal(sizeAdvice(null, null), null);
});

test('les constantes de l’appli suivent celles de la migration 012 (dossier, taille, types, forme du chemin)', () => {
  const sql = readFileSync(new URL('../../../src/scripts/012_home_background.sql', import.meta.url), 'utf8');
  assert.ok(sql.includes("'app-backgrounds'"));
  assert.ok(sql.includes(String(BACKGROUND_MAX_BYTES)));
  for (const mime of ['image/jpeg', 'image/png', 'image/webp']) assert.ok(sql.includes(`'${mime}'`), mime);
  // un chemin produit par le serveur doit être accepté par le lecteur de l'appli
  const serverShape = "'home/' || to_char(now(), 'YYYYMMDD') || '-' || replace(gen_random_uuid()::text, '-', '') || '.' || v_ext";
  assert.ok(sql.includes(serverShape));
});
