// 017 : plus aucune note externe en base. PostgreSQL réel (PGlite).
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
  await db.query(`insert into public.addresses (title, rating) values ('A', 4.9), ('B', 3.2), ('C', null)`);
  return db;
}

test('017 efface toutes les notes et laisse les adresses', async () => {
  const db = await newDb();
  await db.exec(read('../../src/scripts/017_remove_external_ratings.sql'));
  const r = await db.query(`select count(*)::int total, count(rating)::int notes from public.addresses`);
  assert.deepEqual(r.rows[0], { total: 3, notes: 0 });
});

test("017 : une adresse ajoutée ensuite (sans note) n'en reçoit pas par défaut", async () => {
  const db = await newDb();
  await db.exec(read('../../src/scripts/017_remove_external_ratings.sql'));
  await db.query(`insert into public.addresses (title) values ('D')`);
  const r = await db.query(`select rating from public.addresses where title = 'D'`);
  assert.equal(r.rows[0].rating, null);
});

test('017 est relançable', async () => {
  const db = await newDb();
  const sql = read('../../src/scripts/017_remove_external_ratings.sql');
  await db.exec(sql);
  await assert.doesNotReject(db.exec(sql));
});
