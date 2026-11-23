import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FileKeyValueStore, fileNameFor, type FileBackend, type LegacyStore } from '../fileKeyValue.ts';

function env(legacyData: Record<string, string> = {}) {
  const files = new Map<string, string>();
  const legacy = new Map(Object.entries(legacyData));
  const counts = { fileReads: 0, legacyReads: 0 };
  const fb: FileBackend = {
    read: async (n) => { counts.fileReads++; return files.has(n) ? files.get(n)! : null; },
    write: async (n, t) => { files.set(n, t); },
    remove: async (n) => { files.delete(n); },
  };
  const lg: LegacyStore = {
    get: async (k) => { counts.legacyReads++; return legacy.has(k) ? legacy.get(k)! : null; },
    remove: async (k) => { legacy.delete(k); },
  };
  return { store: new FileKeyValueStore(fb, lg), files, legacy, counts };
}

test('écrire puis relire ; la mémoire évite de relire le disque', async () => {
  const { store, counts } = env();
  await store.setItem('LPT_USER_LISTS_V1__0', '{"a":1}');
  assert.equal(await store.getItem('LPT_USER_LISTS_V1__0'), '{"a":1}');
  assert.equal(await store.getItem('LPT_USER_LISTS_V1__0'), '{"a":1}');
  assert.equal(counts.fileReads, 0);
});

test('mise à jour de l’appli : une donnée de l’ancien coffre est reprise, recopiée en fichier, retirée du coffre', async () => {
  const { store, files, legacy } = env({ LPT_DEVICE_LIKED_SPOTS: '["s1","s2"]' });
  assert.equal(await store.getItem('LPT_DEVICE_LIKED_SPOTS'), '["s1","s2"]');
  assert.equal(files.get(fileNameFor('LPT_DEVICE_LIKED_SPOTS')), '["s1","s2"]');
  assert.equal(legacy.has('LPT_DEVICE_LIKED_SPOTS'), false);
  // nouveau magasin (relance de l'appli) : lu depuis le fichier, sans toucher au coffre
  const again = new FileKeyValueStore(
    { read: async (n) => files.get(n) ?? null, write: async (n, t) => { files.set(n, t); }, remove: async (n) => { files.delete(n); } },
    { get: async () => { throw new Error('le coffre ne doit plus être lu'); }, remove: async () => {} },
  );
  assert.equal(await again.getItem('LPT_DEVICE_LIKED_SPOTS'), '["s1","s2"]');
});

test('clé absente partout : null, et une seule recherche', async () => {
  const { store, counts } = env();
  assert.equal(await store.getItem('rien'), null);
  assert.equal(await store.getItem('rien'), null);
  assert.equal(counts.legacyReads, 1);
});

test('supprimer retire le fichier ET l’ancienne copie du coffre (« Effacer mes données »)', async () => {
  const { store, files, legacy } = env({ K: 'ancien' });
  await store.setItem('K', 'nouveau');
  await store.removeItem('K');
  assert.equal(await store.getItem('K'), null);
  assert.equal(files.size, 0);
  assert.equal(legacy.has('K'), false);
});

test('noms de fichier sûrs (aucun « / » ni « .. » possible)', () => {
  assert.equal(fileNameFor('LPT_USER_LISTS_V1__3'), 'LPT_USER_LISTS_V1__3.txt');
  assert.doesNotMatch(fileNameFor('../../x/y'), /\//);
});

test('branchements : le stockage de l’appli passe par les fichiers ; Supabase ne relit plus le coffre à chaque requête', () => {
  const storage = readFileSync(new URL('../storage.ts', import.meta.url), 'utf8');
  assert.match(storage, /FileKeyValueStore/);
  const likes = readFileSync(new URL('../likesStore.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(likes, /SecureStore/, 'les likes passent par appStorage');
  const sb = readFileSync(new URL('../supabase.ts', import.meta.url), 'utf8');
  assert.match(sb, /persistSession:\s*false/);
  assert.doesNotMatch(sb, /SecureStore\.getItemAsync/);
  const ident = readFileSync(new URL('../deviceIdentity.ts', import.meta.url), 'utf8');
  assert.match(ident, /SecureStore\.getItemAsync\(DEVICE_ID_KEY\)/, 'l’identifiant reste dans le coffre');
});
