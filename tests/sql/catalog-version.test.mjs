// 022 : empreinte du catalogue. PostgreSQL réel (PGlite).
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
  await db.exec(`insert into public.addresses (id, title) values
    ('aaaaaaaa-0000-4000-8000-000000000001', 'Café cerise'), ('aaaaaaaa-0000-4000-8000-000000000002', 'Librairie')`);
  await db.exec(read('../../src/scripts/022_catalog_version.sql'));
  return db;
}
async function version(db, role = 'anon') {
  await db.exec(`set role ${role}`);
  try { return (await db.query(`select public.catalog_version() v`)).rows[0].v; } finally { await db.exec('reset role'); }
}

test('la clé publique obtient une empreinte courte et stable', async () => {
  const db = await newDb();
  const v1 = await version(db);
  assert.match(v1, /^[0-9a-f]{32}$/);
  assert.equal(await version(db), v1);
  assert.equal(await version(db, 'authenticated'), v1);
});

test('une adresse modifiée, ajoutée ou supprimée change l’empreinte', async () => {
  const db = await newDb();
  const v1 = await version(db);
  await db.exec(`update public.addresses set title = 'Café cerise (nouveau)' where id = 'aaaaaaaa-0000-4000-8000-000000000001'`);
  const v2 = await version(db);
  assert.notEqual(v2, v1);
  await db.exec(`insert into public.addresses (title) values ('Nouvelle adresse')`);
  const v3 = await version(db);
  assert.notEqual(v3, v2);
  await db.exec(`delete from public.addresses where title = 'Nouvelle adresse'`);
  assert.equal(await version(db), v2, 'retour au même contenu = même empreinte');
});

test('un like ne change pas l’empreinte (pas de retéléchargement à chaque like)', async () => {
  const db = await newDb();
  const v1 = await version(db);
  await db.exec(`update public.addresses set likes_count = likes_count + 5`);
  assert.equal(await version(db), v1);
});

test('script relançable ; la fonction ne donne aucun droit d’écriture', async () => {
  const db = await newDb();
  await assert.doesNotReject(db.exec(read('../../src/scripts/022_catalog_version.sql')));
  const r = await db.query(`select prosecdef from pg_proc where proname = 'catalog_version'`);
  assert.equal(r.rows[0].prosecdef, false, 'security invoker');
});
