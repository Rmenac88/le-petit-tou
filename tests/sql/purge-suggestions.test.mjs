// 018 : les suggestions de plus de 24 mois sont supprimées, les récentes restent. PostgreSQL réel (PGlite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');

async function newDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(read('baseline.sql'));
  await db.query(`insert into public.place_suggestions (device_id, title, status, created_at) values
    ('d1', 'vieille', 'pending', now() - interval '25 months'),
    ('d2', 'vieille approuvée', 'approved', now() - interval '30 months'),
    ('d3', 'récente', 'pending', now() - interval '3 months')`);
  return db;
}

test('018 supprime les suggestions de plus de 24 mois, quel que soit leur statut', async () => {
  const db = await newDb();
  await db.exec(read('../../src/scripts/018_purge_suggestions.sql'));
  const n = (await db.query(`select public.purge_old_suggestions() as n`)).rows[0].n;
  assert.equal(n, 2);
  const left = (await db.query(`select title from public.place_suggestions`)).rows.map((r) => r.title);
  assert.deepEqual(left, ['récente']);
});

test('018 : la fonction de purge est fermée à la clé publique, et le script est relançable', async () => {
  const db = await newDb();
  const sql = read('../../src/scripts/018_purge_suggestions.sql');
  await db.exec(sql);
  await assert.doesNotReject(db.exec(sql));
  await db.exec('set role anon');
  await assert.rejects(db.query(`select public.purge_old_suggestions()`), /permission denied/);
  await db.exec('reset role');
});
