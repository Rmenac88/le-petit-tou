import test from 'node:test';
import assert from 'node:assert/strict';
import { CHUNK_SIZE, clearChunked, loadChunked, saveChunked, type KeyValueStorage } from '../chunkedStorage.ts';

const memory = () => {
  const m = new Map<string, string>();
  const storage: KeyValueStorage = {
    getItem: async (k) => m.get(k) ?? null,
    setItem: async (k, v) => { assert.ok(v.length <= CHUNK_SIZE + 10, `valeur trop grosse : ${v.length}`); m.set(k, v); },
    removeItem: async (k) => { m.delete(k); },
  };
  return { m, storage };
};

test('texte court, long et vide : relu à l\'identique, aucune valeur au-dessus de la taille d\'un morceau', async () => {
  for (const len of [0, 10, CHUNK_SIZE, CHUNK_SIZE + 1, CHUNK_SIZE * 5 + 17]) {
    const { storage } = memory();
    const text = Array.from({ length: len }, (_, i) => String.fromCharCode(97 + (i % 26))).join('');
    await saveChunked(storage, 'K', text);
    assert.equal(await loadChunked(storage, 'K'), text, `longueur ${len}`);
  }
});

test('réécriture plus courte : les anciens morceaux sont retirés', async () => {
  const { m, storage } = memory();
  await saveChunked(storage, 'K', 'x'.repeat(CHUNK_SIZE * 4));
  assert.equal([...m.keys()].filter((k) => k.startsWith('K__')).length, 5); // 4 morceaux + compteur
  await saveChunked(storage, 'K', 'petit');
  assert.deepEqual([...m.keys()].sort(), ['K__0', 'K__n']);
  assert.equal(await loadChunked(storage, 'K'), 'petit');
});

test('stockage abîmé ou absent : « rien », jamais un texte tronqué', async () => {
  const { m, storage } = memory();
  assert.equal(await loadChunked(storage, 'K'), null);
  await saveChunked(storage, 'K', 'y'.repeat(CHUNK_SIZE * 3));
  m.delete('K__1');
  assert.equal(await loadChunked(storage, 'K'), null);
  m.set('K__n', 'pas un nombre');
  assert.equal(await loadChunked(storage, 'K'), null);
  m.set('K__n', '999999');
  assert.equal(await loadChunked(storage, 'K'), null);
});

test('effacement complet', async () => {
  const { m, storage } = memory();
  await saveChunked(storage, 'K', 'z'.repeat(CHUNK_SIZE * 2 + 5));
  await clearChunked(storage, 'K');
  assert.equal(m.size, 0);
});
