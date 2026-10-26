// 016 : le montant payé par les partenaires reste interne. PostgreSQL réel (PGlite).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
const baseline = read('baseline.sql');
const m006 = read('../../src/scripts/006_security_lockdown.sql');
const m009 = read('../../src/scripts/016_hide_partner_price.sql');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';

async function newDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(m006);
  await db.query(`insert into public.sponsored_partners (title, price_paid, rank_position, is_active) values ('Actif', 150, 1, true), ('Inactif', 90, 2, false)`);
  await db.exec(m009);
  return db;
}
async function as(db, role, sql, params = []) {
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}

describe('016 : prix des partenaires', () => {
  test("la clé publique ne peut plus lire la table des partenaires", async () => {
    const db = await newDb();
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(as(db, role, `select price_paid from public.sponsored_partners`), /permission denied/);
      await assert.rejects(as(db, role, `select * from public.sponsored_partners`), /permission denied/);
    }
  });

  test('la vue publique ne montre que les partenaires actifs, sans prix', async () => {
    const db = await newDb();
    const r = await as(db, 'anon', `select * from public.sponsored_partners_public`);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].title, 'Actif');
    assert.ok(!('price_paid' in r.rows[0]));
    await assert.rejects(as(db, 'anon', `select price_paid from public.sponsored_partners_public`), /price_paid/);
  });

  test('admin_read avec le bon code renvoie tout, prix compris, trié par rang', async () => {
    const db = await newDb();
    const r = (await as(db, 'anon', `select public.admin_read($1, 'sponsored_partners') as r`, [GOOD_CODE])).rows[0].r;
    assert.equal(r.ok, true);
    assert.deepEqual(r.rows.map((x) => [x.title, Number(x.price_paid)]), [['Actif', 150], ['Inactif', 90]]);
  });

  test('admin_read refuse un mauvais code et une autre table', async () => {
    const db = await newDb();
    const bad = (await as(db, 'anon', `select public.admin_read('mauvais-code', 'sponsored_partners') as r`)).rows[0].r;
    assert.deepEqual(bad, { ok: false, error: 'forbidden' });
    const other = (await as(db, 'anon', `select public.admin_read($1, 'admin_secrets') as r`, [GOOD_CODE])).rows[0].r;
    assert.equal(other.ok, false);
  });

  test('le script est relançable', async () => {
    const db = await newDb();
    await assert.doesNotReject(db.exec(m009));
  });
});
