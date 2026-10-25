import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteMyData } from '../dataDeletion.ts';

const okRpc = async () => ({ data: { success: true }, error: null });

test("appelle delete_my_data avec l'identifiant de l'appareil puis nettoie le local", async () => {
  const calls: string[] = [];
  const res = await deleteMyData({
    getUserId: async () => 'dev-1',
    rpc: async (fn, args) => {
      calls.push(`${fn}:${args.p_device_id}`);
      return { data: { success: true }, error: null };
    },
    clearLocal: async () => {
      calls.push('local');
    },
  });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ['delete_my_data:dev-1', 'local']);
});

test('erreur serveur : rien n’est effacé en local', async () => {
  let cleared = false;
  const res = await deleteMyData({
    getUserId: async () => 'dev-1',
    rpc: async () => ({ data: null, error: { message: 'boom' } }),
    clearLocal: async () => {
      cleared = true;
    },
  });
  assert.equal(res.ok, false);
  assert.equal(cleared, false);
});

test('réponse success:false (identité invalide) : échec, local conservé', async () => {
  let cleared = false;
  const res = await deleteMyData({
    getUserId: async () => 'x',
    rpc: async () => ({ data: { success: false, error: 'IDENTITE_INVALIDE' }, error: null }),
    clearLocal: async () => {
      cleared = true;
    },
  });
  assert.equal(res.ok, false);
  assert.equal(cleared, false);
});

test('réseau coupé (exception) : échec propre sans exception', async () => {
  const res = await deleteMyData({
    getUserId: async () => 'dev-1',
    rpc: async () => {
      throw new Error('network');
    },
    clearLocal: async () => {},
  });
  assert.equal(res.ok, false);
});

test("échec du nettoyage local : serveur effacé, l'utilisateur en est informé", async () => {
  const res = await deleteMyData({
    getUserId: async () => 'dev-1',
    rpc: okRpc,
    clearLocal: async () => {
      throw new Error('disk');
    },
  });
  assert.equal(res.ok, true);
  assert.match(res.message, /copies locales/);
});

test("identifiant d'appareil introuvable : échec propre", async () => {
  const res = await deleteMyData({
    getUserId: async () => {
      throw new Error('no id');
    },
    rpc: okRpc,
    clearLocal: async () => {},
  });
  assert.equal(res.ok, false);
});

test('beforeDelete est appelé en premier (arrêt des sauvegardes en attente) ; son échec ne bloque pas l’effacement', async () => {
  const calls: string[] = [];
  const res = await deleteMyData({
    beforeDelete: async () => {
      calls.push('before');
    },
    getUserId: async () => 'dev-1',
    rpc: async (fn) => {
      calls.push(fn);
      return { data: { success: true }, error: null };
    },
    clearLocal: async () => {
      calls.push('local');
    },
  });
  assert.equal(res.ok, true);
  assert.deepEqual(calls, ['before', 'delete_my_data', 'local']);

  const failing = await deleteMyData({
    beforeDelete: async () => {
      throw new Error('boom');
    },
    getUserId: async () => 'dev-1',
    rpc: okRpc,
    clearLocal: async () => {},
  });
  assert.equal(failing.ok, true);
});
