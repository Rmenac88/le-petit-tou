import test from 'node:test';
import assert from 'node:assert/strict';
import { adminDeleteFeatured, adminListFeatured, adminSaveFeatured, FeaturedError, featuredErrorFrom } from '../featuredAdmin.ts';

const client = (reply: any, calls: any[] = []) => ({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return typeof reply === 'function' ? reply(fn, args) : reply;
  },
});

test('liste : renvoie les lignes ; code vide refusé sans appel réseau', async () => {
  const calls: any[] = [];
  const rows = await adminListFeatured(client({ data: { ok: true, rows: [{ id: '1' }] }, error: null }, calls), 'code');
  assert.deepEqual(rows, [{ id: '1' }]);
  assert.deepEqual(calls, [{ fn: 'admin_list_featured', args: { p_code: 'code' } }]);
  await assert.rejects(adminListFeatured(client({}, calls), '  '), (e: FeaturedError) => e.kind === 'forbidden');
  assert.equal(calls.length, 1, 'aucun appel avec un code vide');
});

test('enregistrement : les champs vides sont envoyés comme absents ; la ligne enregistrée est renvoyée', async () => {
  const calls: any[] = [];
  const row = await adminSaveFeatured(client({ data: { ok: true, row: { id: 'r1', spot_id: 's' } }, error: null }, calls), 'c',
    { spot_id: 's', position: '', label: '', starts_on: '2026-11-01', ends_on: undefined });
  assert.equal(row.id, 'r1');
  assert.deepEqual(calls[0].args.p_item, { spot_id: 's', position: null, label: null, starts_on: '2026-11-01', ends_on: null });
});

test('erreurs serveur traduites en messages français ; réseau coupé = message neutre', async () => {
  await assert.rejects(adminSaveFeatured(client({ data: { ok: false, error: 'forbidden' } }), 'c', { spot_id: 's' }),
    (e: FeaturedError) => e.kind === 'forbidden' && /tentatives/.test(e.message));
  await assert.rejects(adminSaveFeatured(client({ data: { ok: false, error: "invalid: cette adresse est déjà dans les chouchous du Petit Tou" } }), 'c', { spot_id: 's' }),
    (e: FeaturedError) => e.kind === 'invalid' && e.message.startsWith('Cette adresse est déjà'));
  await assert.rejects(adminSaveFeatured(client({ data: null, error: { message: 'fetch failed' } }), 'c', { spot_id: 's' }),
    (e: FeaturedError) => e.kind === 'network');
  await assert.rejects(adminListFeatured({ rpc: async () => { throw new Error('boom'); } }, 'c'), (e: FeaturedError) => e.kind === 'network');
  assert.equal(featuredErrorFrom(undefined).kind, 'network');
});

test('retrait : renvoie le nombre de lignes retirées', async () => {
  assert.equal(await adminDeleteFeatured(client({ data: { ok: true, deleted: 1 }, error: null }), 'c', 'id'), 1);
  assert.equal(await adminDeleteFeatured(client({ data: { ok: true, deleted: 0 }, error: null }), 'c', 'id'), 0);
});
