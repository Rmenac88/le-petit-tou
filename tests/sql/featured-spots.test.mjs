// Tests de la migration 011 : « Les chouchous du Petit Tou » (sélection éditoriale gérée depuis le portail admin).
// PostgreSQL réel (PGlite) : lecture publique limitée aux lignes en cours, aucune écriture directe, gestion par code admin.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
const baseline = read('baseline.sql');
const m006 = read('../../src/scripts/006_security_lockdown.sql');
const m011 = read('../../src/scripts/011_featured_spots.sql');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const BAD_CODE = 'mauvais-code-de-test';
const A1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const A2 = 'aaaaaaaa-0000-4000-8000-000000000002';
const A3 = 'aaaaaaaa-0000-4000-8000-000000000003';

async function newDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(m006);
  await db.exec(m011);
  for (const [id, t] of [[A1, 'Chez Un'], [A2, 'Chez Deux'], [A3, 'Chez Trois']]) {
    await db.query(`insert into public.addresses (id, title) values ($1, $2)`, [id, t]);
  }
  return db;
}
async function as(db, role, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const save = (db, code, item) => as(db, 'anon', `select public.admin_save_featured($1, $2::jsonb) r`, [code, JSON.stringify(item)]).then((r) => r.rows[0].r);
const list = (db, code) => as(db, 'anon', `select public.admin_list_featured($1) r`, [code]).then((r) => r.rows[0].r);
const del = (db, code, id) => as(db, 'anon', `select public.admin_delete_featured($1, $2) r`, [code, id]).then((r) => r.rows[0].r);
const today = async (db) => (await one(db, `select to_char(public._lpt_today(), 'YYYY-MM-DD') d`)).d;
const shift = async (db, days) => (await one(db, `select to_char(public._lpt_today() + $1::int, 'YYYY-MM-DD') d`, [days])).d;

describe('lecture publique : seulement les chouchous en cours', () => {
  test('lignes inactives, pas encore commencées ou terminées : invisibles ; période incluse aux deux bouts', async () => {
    const db = await newDb();
    const t = await today(db);
    const ins = (spot, pos, extra) => db.query(
      `insert into public.featured_spots (spot_id, position, starts_on, ends_on, is_active) values ($1, $2, $3, $4, $5)`,
      [spot, pos, extra.starts ?? null, extra.ends ?? null, extra.active ?? true]);
    await ins('en-cours-sans-dates', 30, {});
    await ins('commence-aujourdhui', 10, { starts: t });
    await ins('finit-aujourdhui', 20, { ends: t });
    await ins('commence-demain', 40, { starts: await shift(db, 1) });
    await ins('fini-hier', 50, { ends: await shift(db, -1) });
    await ins('desactive', 60, { active: false });
    const visible = (await as(db, 'anon', `select spot_id from public.featured_spots order by position`)).rows.map((r) => r.spot_id);
    assert.deepEqual(visible, ['commence-aujourdhui', 'finit-aujourdhui', 'en-cours-sans-dates']);
    const asAuth = (await as(db, 'authenticated', `select count(*)::int n from public.featured_spots`)).rows[0].n;
    assert.equal(asAuth, 3);
  });

  test('aucune écriture directe, ni par anon ni par authenticated', async () => {
    const db = await newDb();
    await db.query(`insert into public.featured_spots (spot_id) values ($1)`, [A1]);
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(as(db, role, `insert into public.featured_spots (spot_id) values ('x')`), /permission denied|row-level security/i);
      await assert.rejects(as(db, role, `update public.featured_spots set position = 1`), /permission denied|row-level security/i);
      await assert.rejects(as(db, role, `delete from public.featured_spots`), /permission denied|row-level security/i);
    }
    assert.equal((await one(db, `select count(*)::int n from public.featured_spots`)).n, 1);
  });
});

describe('gestion par code admin', () => {
  test('sans le bon code : refus pour les trois fonctions, rien n’est écrit ni lu', async () => {
    const db = await newDb();
    for (const code of [BAD_CODE, '', null, '   ']) {
      assert.deepEqual(await save(db, code, { spot_id: A1 }), { ok: false, error: 'forbidden' });
      assert.deepEqual(await list(db, code), { ok: false, error: 'forbidden' });
      assert.deepEqual(await del(db, code, '11111111-1111-4111-8111-111111111111'), { ok: false, error: 'forbidden' });
    }
    assert.equal((await one(db, `select count(*)::int n from public.featured_spots`)).n, 0);
  });

  test('verrouillage anti force brute partagé avec le reste du portail', async () => {
    const db = await newDb();
    for (let i = 0; i < 10; i++) await list(db, BAD_CODE);
    assert.equal((await save(db, GOOD_CODE, { spot_id: A1 })).ok, false, 'le bon code est refusé pendant le verrouillage');
    await db.exec(`update public.admin_login_attempts set attempted_at = now() - interval '16 minutes'`);
    assert.equal((await save(db, GOOD_CODE, { spot_id: A1 })).ok, true);
  });

  test('ajout, lecture complète (y compris hors période), modification, retrait', async () => {
    const db = await newDb();
    const t = await today(db);
    const first = await save(db, GOOD_CODE, { spot_id: A1, label: 'Coup de cœur de la semaine' });
    assert.equal(first.ok, true);
    assert.equal(first.row.position, 10, 'premier ordre = 10');
    const second = await save(db, GOOD_CODE, { spot_id: A2, starts_on: await shift(db, 5), ends_on: await shift(db, 9) });
    assert.equal(second.row.position, 20, 'l’ordre suit le plus grand + 10');
    const third = await save(db, GOOD_CODE, { spot_id: A3, position: 5, is_active: false });
    assert.equal(third.row.position, 5);
    assert.equal(third.row.is_active, false);

    // l'admin voit tout (même ce que le public ne voit pas), dans l'ordre d'affichage
    const all = await list(db, GOOD_CODE);
    assert.deepEqual(all.rows.map((r) => r.spot_id), [A3, A1, A2]);
    // le public ne voit que la première
    assert.deepEqual((await as(db, 'anon', `select spot_id from public.featured_spots`)).rows.map((r) => r.spot_id), [A1]);

    const upd = await save(db, GOOD_CODE, { id: third.row.id, spot_id: A3, is_active: true, position: 1, label: null, starts_on: t, ends_on: await shift(db, 30) });
    assert.equal(upd.ok, true);
    assert.equal(upd.row.is_active, true);
    assert.equal(upd.row.label, null);
    assert.deepEqual((await as(db, 'anon', `select spot_id from public.featured_spots order by position`)).rows.map((r) => r.spot_id), [A3, A1]);

    assert.deepEqual(await del(db, GOOD_CODE, first.row.id), { ok: true, deleted: 1 });
    assert.deepEqual(await del(db, GOOD_CODE, first.row.id), { ok: true, deleted: 0 });
    assert.equal((await list(db, GOOD_CODE)).rows.length, 2);
  });

  test('validations : adresse, mention, ordre, dates, doublon, identifiants', async () => {
    const db = await newDb();
    const bad = async (item, re) => {
      const r = await save(db, GOOD_CODE, item);
      assert.equal(r.ok, false, JSON.stringify(item));
      assert.match(r.error, re, JSON.stringify(item));
    };
    await bad({}, /choisis une adresse/);
    await bad({ spot_id: '   ' }, /choisis une adresse/);
    await bad({ spot_id: 'adresse-inconnue' }, /n'existe pas/);
    await bad({ spot_id: A1, label: 'x'.repeat(41) }, /40 caractères/);
    await bad({ spot_id: A1, position: 'abc' }, /ordre/);
    await bad({ spot_id: A1, position: '-5' }, /ordre/);
    await bad({ spot_id: A1, position: '10000' }, /ordre/);
    await bad({ spot_id: A1, starts_on: '10/11/2026' }, /AAAA-MM-JJ/);
    await bad({ spot_id: A1, ends_on: '2026-1-5' }, /AAAA-MM-JJ/);
    await bad({ spot_id: A1, starts_on: '2026-02-30' }, /n'existe pas dans le calendrier/);
    await bad({ spot_id: A1, starts_on: '2026-12-10', ends_on: '2026-12-01' }, /fin doit être après le début/);
    await bad({ spot_id: A1, is_active: 'peut-être' }, /vrai ou faux/);
    await bad({ id: 'pas-un-uuid', spot_id: A1 }, /identifiant illisible/);
    await bad({ id: '99999999-9999-4999-8999-999999999999', spot_id: A1 }, /n'existe plus/);
    const notObject = await as(db, 'anon', `select public.admin_save_featured($1, '[1]'::jsonb) r`, [GOOD_CODE]);
    assert.equal(notObject.rows[0].r.ok, false);
    assert.equal((await one(db, `select count(*)::int n from public.featured_spots`)).n, 0, 'aucune ligne écrite par un refus');

    const ok = await save(db, GOOD_CODE, { spot_id: A1 });
    assert.equal(ok.ok, true);
    await bad({ spot_id: A1 }, /déjà dans les chouchous/);
    const other = await save(db, GOOD_CODE, { spot_id: A2 });
    await bad({ id: other.row.id, spot_id: A1 }, /déjà dans les chouchous/);
    assert.deepEqual(await del(db, GOOD_CODE, 'pas-un-uuid'), { ok: false, error: 'invalid: identifiant illisible' });
  });

  test('texte piégé : mention et identifiants traités comme du texte, jamais exécutés', async () => {
    const db = await newDb();
    const evil = `'); drop table public.featured_spots; --`;
    const r = await save(db, GOOD_CODE, { spot_id: A1, label: evil.slice(0, 40) });
    assert.equal(r.ok, true);
    assert.equal(r.row.label, evil.slice(0, 40));
    assert.equal((await save(db, GOOD_CODE, { spot_id: `${A2}' or '1'='1` })).ok, false);
    assert.deepEqual(await del(db, GOOD_CODE, `${r.row.id}' or true --`), { ok: false, error: 'invalid: identifiant illisible' });
    assert.equal((await one(db, `select count(*)::int n from public.featured_spots`)).n, 1);
  });
});

describe('migration', () => {
  test('011 est rejouable et conserve les lignes existantes', async () => {
    const db = await newDb();
    await save(db, GOOD_CODE, { spot_id: A1, label: 'Garde-moi' });
    await db.exec(m011);
    await db.exec(m011);
    const r = await list(db, GOOD_CODE);
    assert.equal(r.rows.length, 1);
    assert.equal(r.rows[0].label, 'Garde-moi');
  });

  test('une adresse supprimée du guide laisse une ligne orpheline visible par l’admin, retirable', async () => {
    const db = await newDb();
    const r = await save(db, GOOD_CODE, { spot_id: A1 });
    await db.query(`delete from public.addresses where id = $1`, [A1]);
    const all = await list(db, GOOD_CODE);
    assert.equal(all.rows.length, 1);
    assert.deepEqual(await del(db, GOOD_CODE, r.row.id), { ok: true, deleted: 1 });
  });

  test('fonctions appelables avec la clé publique : les trois fonctions admin et la date du jour, rien d’autre', async () => {
    const db = await newDb();
    const exposed = (await rows(db, `
      select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
         and p.proname in ('admin_list_featured','admin_save_featured','admin_delete_featured','_lpt_today','_admin_gate')
       order by 1`)).map((r) => r.proname);
    assert.deepEqual(exposed, ['_lpt_today', 'admin_delete_featured', 'admin_list_featured', 'admin_save_featured']);
  });
});
