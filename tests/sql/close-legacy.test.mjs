// 019 : les anciens éléments ne sont plus accessibles à la clé publique, les données restent. PostgreSQL réel (PGlite).
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
  await db.exec(`
    create table public.spots (id serial primary key, name text);
    insert into public.spots (name) values ('ancien 1'), ('ancien 2');
    create table public.reviews (id serial primary key, body text);
    create table public.merchant_notifications (id serial primary key);
    create table public.merchant_visits (id serial primary key);
    grant all on public.spots, public.reviews, public.merchant_notifications, public.merchant_visits to anon, authenticated;
    create function public.scan_ticket_secure(t text) returns text language sql as $$ select t $$;
    create function public.generate_ticket_number() returns text language sql as $$ select 'x' $$;
    grant execute on function public.scan_ticket_secure(text), public.generate_ticket_number() to anon, authenticated;
  `);
  await db.exec(read('../../src/scripts/019_close_legacy_surface.sql'));
  return db;
}
async function as(db, role, sql) {
  await db.exec(`set role ${role}`);
  try { return await db.query(sql); } finally { await db.exec('reset role'); }
}

test("la clé publique ne peut plus lire ni écrire les anciennes tables", async () => {
  const db = await newDb();
  for (const role of ['anon', 'authenticated']) {
    for (const t of ['spots', 'reviews', 'merchant_notifications', 'merchant_visits']) {
      await assert.rejects(as(db, role, `select * from public.${t}`), /permission denied/, `${role} lit ${t}`);
      await assert.rejects(as(db, role, `delete from public.${t}`), /permission denied/, `${role} écrit ${t}`);
    }
  }
});

test('les anciennes fonctions ne sont plus exécutables par la clé publique', async () => {
  const db = await newDb();
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(as(db, role, `select public.scan_ticket_secure('a')`), /permission denied/);
    await assert.rejects(as(db, role, `select public.generate_ticket_number()`), /permission denied/);
  }
});

test('les données anciennes sont conservées, et le script est relançable', async () => {
  const db = await newDb();
  assert.equal((await db.query(`select count(*)::int n from public.spots`)).rows[0].n, 2);
  await assert.doesNotReject(db.exec(read('../../src/scripts/019_close_legacy_surface.sql')));
});
