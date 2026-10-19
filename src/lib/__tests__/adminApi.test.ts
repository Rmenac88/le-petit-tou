import test from 'node:test';
import assert from 'node:assert/strict';
import { createAdminDb, adminErrorMessage } from '../adminApi.ts';

type Call = { fn: string; args: Record<string, unknown> };

function fakeClient(reply: { data: any; error: { message: string } | null }) {
  const calls: Call[] = [];
  return {
    calls,
    client: {
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return reply;
      },
    },
  };
}

test('insert : envoie le code, la table, l’opération et l’enregistrement à admin_write', async () => {
  const { client, calls } = fakeClient({ data: { ok: true, rows: [{ id: 'a' }] }, error: null });
  const res = await createAdminDb('mon-code', client).from('events').insert({ title: 'T' }).select();
  assert.deepEqual(res.data, [{ id: 'a' }]);
  assert.equal(res.error, null);
  assert.deepEqual(calls[0], {
    fn: 'admin_write',
    args: { p_code: 'mon-code', p_table: 'events', p_op: 'insert', p_id: null, p_record: { title: 'T' } },
  });
});

test('update et delete transmettent l’identifiant fourni par .eq("id", …)', async () => {
  const { client, calls } = fakeClient({ data: { ok: true, rows: [{ id: 'x' }] }, error: null });
  const db = createAdminDb('c', client);
  await db.from('addresses').update({ title: 'N' }).eq('id', 'x');
  await db.from('categories').delete().eq('id', 'y').select();
  assert.equal(calls[0].args.p_op, 'update');
  assert.equal(calls[0].args.p_id, 'x');
  assert.equal(calls[1].args.p_op, 'delete');
  assert.equal(calls[1].args.p_id, 'y');
});

test('update ou delete sans identifiant : refus local, aucun appel réseau', async () => {
  const { client, calls } = fakeClient({ data: { ok: true, rows: [] }, error: null });
  const res = await createAdminDb('c', client).from('events').delete();
  assert.ok(res.error);
  assert.equal(calls.length, 0);
});

test('code vide : refus local sans appel réseau', async () => {
  const { client, calls } = fakeClient({ data: { ok: true, rows: [] }, error: null });
  const res = await createAdminDb('  ', client).from('events').insert({ title: 'x' });
  assert.match(res.error!.message, /Code admin refusé/);
  assert.equal(calls.length, 0);
});

test('refus serveur (forbidden) : message lisible, pas de données', async () => {
  const { client } = fakeClient({ data: { ok: false, error: 'forbidden' }, error: null });
  const res = await createAdminDb('c', client).from('events').insert({ title: 'x' });
  assert.equal(res.data, null);
  assert.match(res.error!.message, /Code admin refusé/);
});

test('erreur de validation serveur : préfixe technique retiré', async () => {
  const { client } = fakeClient({ data: { ok: false, error: 'invalid: aucune colonne reconnue' }, error: null });
  const res = await createAdminDb('c', client).from('events').insert({});
  assert.equal(res.error!.message, 'aucune colonne reconnue');
});

test('erreur réseau/RPC et exception : { data: null, error } sans lever', async () => {
  const a = await createAdminDb('c', fakeClient({ data: null, error: { message: 'timeout' } }).client)
    .from('events').insert({ title: 'x' });
  assert.equal(a.error!.message, 'timeout');
  const throwing = { rpc: async () => { throw new Error('offline'); } };
  const b = await createAdminDb('c', throwing).from('events').insert({ title: 'x' });
  assert.equal(b.error!.message, 'offline');
});

test('.eq sur une autre colonne que id est refusé (jamais d’écriture de masse)', () => {
  const { client } = fakeClient({ data: { ok: true, rows: [] }, error: null });
  assert.throws(() => createAdminDb('c', client).from('events').update({ title: 'x' }).eq('title', 'y'));
});

test('adminErrorMessage', () => {
  assert.match(adminErrorMessage('forbidden'), /tentatives/);
  assert.equal(adminErrorMessage(undefined), 'Opération refusée.');
});
