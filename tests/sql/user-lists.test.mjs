// Tests de la migration 015 : sauvegarde serveur des listes personnelles (PostgreSQL réel, PGlite).
// Prérequis simulés comme dans le reste de la suite : 006 (identité), 007 (effacement, purge), pg_net simulé.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
const baseline = read('baseline.sql');
const m006 = read('../../src/scripts/006_security_lockdown.sql');
const m007 = read('../../src/scripts/007_push_notifications.sql');
const m015 = read('../../src/scripts/015_user_lists.sql');

const DEV_A = '11111111-1111-4111-8111-111111111111';
const DEV_B = '22222222-2222-4222-8222-222222222222';
const USER_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const USER_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

const NET_STUB = `
  create schema net;
  create table net._http_response (id bigint primary key, status_code integer, content_type text,
    headers jsonb, content text, timed_out boolean, error_msg text, created timestamptz default now());
  create table net._requests (id bigint generated always as identity primary key, url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint
    language plpgsql as $$ declare v bigint; begin insert into net._requests (url, body) values (url, body) returning id into v; return v; end $$;
`;

async function newDb({ with015 = true, with007 = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(`alter table public.addresses add column if not exists is_new boolean default false;`);
  await db.exec(m006);
  if (with007) {
    await db.exec(NET_STUB);
    await db.exec(m007);
  }
  if (with015) await db.exec(m015);
  return db;
}
async function as(db, role, sql, params = [], uid = '') {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', '', false)`); }
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const NOW = 1_790_000_000_000;
const list = (over = {}) => ({ id: 'l1', kind: 'custom', name: 'Brunchs du dimanche', emoji: '⭐', spotIds: ['a1', 'b2'], createdAt: NOW, updatedAt: NOW + 5, ...over });
const state = (...lists) => ({ version: 1, lists: lists.length ? lists : [list()] });
const save = (db, dev, data, role = 'anon') =>
  as(db, role, `select public.save_my_lists($1, $2::jsonb) r`, [dev, data === null ? null : JSON.stringify(data)]).then((r) => r.rows[0].r);
const get = (db, dev, role = 'anon') => as(db, role, `select public.get_my_lists($1) r`, [dev]).then((r) => r.rows[0].r);
const stored = async (db) => (await db.query(`select device_id, data, updated_at from public.user_lists order by device_id`)).rows;

describe('enregistrement et relecture', () => {
  test('aller-retour : ce qui est enregistré est relu à l’identique, avec la date serveur', async () => {
    const db = await newDb();
    const s = state(list(), list({ id: 'later', kind: 'later', name: 'À tester plus tard', emoji: '🕒', spotIds: [] }));
    const r = await save(db, DEV_A, s);
    assert.equal(r.ok, true);
    assert.ok(r.updated > 1_700_000_000_000, 'date en millisecondes');
    const g = await get(db, DEV_A);
    assert.equal(g.ok, true);
    assert.deepEqual(g.data, s);
    assert.equal(g.updated, r.updated);
  });

  test('appareil sans copie : réponse vide, pas d’erreur', async () => {
    const db = await newDb();
    assert.deepEqual(await get(db, DEV_A), { ok: true, data: null, updated: 0 });
  });

  test('un second enregistrement remplace le premier (une seule ligne par appareil)', async () => {
    const db = await newDb();
    await save(db, DEV_A, state(list({ name: 'Avant' })));
    await save(db, DEV_A, state(list({ name: 'Après' })));
    const rows = await stored(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].data.lists[0].name, 'Après');
  });

  test('seules les clés connues sont conservées (une clé en trop est ignorée, pas stockée)', async () => {
    const db = await newDb();
    await save(db, DEV_A, { version: 1, secret: 'x', lists: [{ ...list(), extra: { a: 1 } }] });
    const data = (await stored(db))[0].data;
    assert.deepEqual(Object.keys(data).sort(), ['lists', 'version']);
    assert.deepEqual(Object.keys(data.lists[0]).sort(), ['createdAt', 'emoji', 'id', 'kind', 'name', 'spotIds', 'updatedAt']);
  });

  test('espaces du nom nettoyés ; dates décimales arrondies', async () => {
    const db = await newDb();
    await save(db, DEV_A, state(list({ name: '  Mes   favoris \t ', createdAt: NOW + 0.7 })));
    const l = (await stored(db))[0].data.lists[0];
    assert.equal(l.name, 'Mes favoris');
    assert.equal(l.createdAt, NOW);
  });

  test('liste vide acceptée (toutes les listes supprimées)', async () => {
    const db = await newDb();
    assert.equal((await save(db, DEV_A, { version: 1, lists: [] })).ok, true);
    assert.deepEqual((await get(db, DEV_A)).data.lists, []);
  });
});

describe('identité et isolation', () => {
  test('identité invalide : refusée en lecture et en écriture, rien n’est écrit', async () => {
    const db = await newDb();
    for (const bad of [null, '', 'pas-un-uuid', 'a'.repeat(31), "11111111-1111-4111-8111-1111111111; drop table x"]) {
      assert.deepEqual(await save(db, bad, state()), { ok: false, error: 'IDENTITE_INVALIDE' }, String(bad));
      assert.deepEqual(await get(db, bad), { ok: false, error: 'IDENTITE_INVALIDE' }, String(bad));
    }
    assert.deepEqual(await stored(db), []);
  });

  test('deux appareils ne voient jamais les listes l’un de l’autre', async () => {
    const db = await newDb();
    await save(db, DEV_A, state(list({ name: 'Liste de A' })));
    await save(db, DEV_B, state(list({ name: 'Liste de B' })));
    assert.equal((await get(db, DEV_A)).data.lists[0].name, 'Liste de A');
    assert.equal((await get(db, DEV_B)).data.lists[0].name, 'Liste de B');
    assert.equal((await stored(db)).length, 2);
  });

  test('l’identifiant n’est pas sensible à la casse (même appareil)', async () => {
    const db = await newDb();
    await save(db, DEV_A.toUpperCase(), state());
    assert.equal((await get(db, DEV_A)).data.lists.length, 1);
  });

  test('compte connecté : c’est la session qui compte, pas l’identifiant d’appareil transmis', async () => {
    const db = await newDb();
    await db.query(`insert into auth.users (id) values ($1), ($2)`, [USER_A, USER_B]);
    await as(db, 'authenticated', `select public.save_my_lists($1, $2::jsonb)`, [DEV_A, JSON.stringify(state(list({ name: 'De A' })))], USER_A);
    const asB = (await as(db, 'authenticated', `select public.get_my_lists($1) r`, [DEV_A], USER_B)).rows[0].r;
    assert.equal(asB.data, null, 'B authentifié ne lit pas la copie de A, même avec l’identifiant d’appareil de A');
    const asA = (await as(db, 'authenticated', `select public.get_my_lists(null) r`, [], USER_A)).rows[0].r;
    assert.equal(asA.data.lists[0].name, 'De A');
    assert.deepEqual((await stored(db)).map((r) => r.device_id), [USER_A]);
  });

  test('la table n’est ni lisible ni inscriptible directement avec la clé publique', async () => {
    const db = await newDb();
    await save(db, DEV_A, state());
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(as(db, role, `select * from public.user_lists`), /permission denied/i);
      await assert.rejects(as(db, role, `insert into public.user_lists (device_id, data) values ('x', '{}'::jsonb)`), /permission denied/i);
      await assert.rejects(as(db, role, `update public.user_lists set data = '{}'::jsonb`), /permission denied/i);
      await assert.rejects(as(db, role, `delete from public.user_lists`), /permission denied/i);
    }
    assert.equal((await one(db, `select relrowsecurity r from pg_class where oid = 'public.user_lists'::regclass`)).r, true);
  });
});

describe('refus (rien n’est écrit, l’ancienne copie reste intacte)', () => {
  const bigName = 'x'.repeat(31);
  const cases = [
    ['pas un objet', 'texte', /illisibles/],
    ['listes absentes', { version: 1 }, /illisibles/],
    ['listes pas un tableau', { lists: 'x' }, /illisibles/],
    ['21 listes', { lists: Array.from({ length: 21 }, (_, i) => list({ id: `l${i}` })) }, /trop de listes/],
    ['liste pas un objet', { lists: ['x'] }, /liste illisible/],
    ['identifiant absent', { lists: [{ ...list(), id: undefined }] }, /identifiant de liste/],
    ['identifiant piégé', { lists: [list({ id: "a'; drop table x;--" })] }, /identifiant de liste/],
    ['identifiant trop long', { lists: [list({ id: 'a'.repeat(65) })] }, /identifiant de liste/],
    ['doublon', { lists: [list(), list()] }, /en double/],
    ['type inconnu', { lists: [list({ kind: 'admin' })] }, /type de liste/],
    ['type absent', { lists: [{ ...list(), kind: undefined }] }, /type de liste/],
    ['nom vide', { lists: [list({ name: '   ' })] }, /nom de liste/],
    ['nom trop long', { lists: [list({ name: bigName })] }, /nom de liste/],
    ['nom pas du texte', { lists: [list({ name: 5 })] }, /nom de liste/],
    ['nom avec caractère de contrôle', { lists: [list({ name: 'a\u0001b' })] }, /nom de liste/],
    ['pastille vide', { lists: [list({ emoji: '' })] }, /pastille/],
    ['pastille trop longue', { lists: [list({ emoji: 'e'.repeat(17) })] }, /pastille/],
    ['adresses pas un tableau', { lists: [list({ spotIds: 'a1' })] }, /adresses de la liste/],
    ['101 adresses', { lists: [list({ spotIds: Array.from({ length: 101 }, (_, i) => `s${i}`) })] }, /adresses de la liste/],
    ['adresse piégée', { lists: [list({ spotIds: ['ok', '../etc'] })] }, /identifiant d'adresse/],
    ['adresse pas du texte', { lists: [list({ spotIds: [12] })] }, /identifiant d'adresse/],
    ['date en texte', { lists: [list({ createdAt: 'hier' })] }, /dates/],
    ['date absente', { lists: [{ ...list(), updatedAt: undefined }] }, /dates/],
    ['date hors plage', { lists: [list({ updatedAt: -1 })] }, /dates/],
    ['date démesurée', { lists: [list({ updatedAt: 1e20 })] }, /dates/],
  ];
  for (const [label, payload, pattern] of cases) {
    test(label, async () => {
      const db = await newDb();
      await save(db, DEV_A, state(list({ name: 'Copie existante' })));
      const before = await stored(db);
      const r = typeof payload === 'string' ? await as(db, 'anon', `select public.save_my_lists($1, $2::jsonb) r`, [DEV_A, JSON.stringify(payload)]).then((x) => x.rows[0].r) : await save(db, DEV_A, payload);
      assert.equal(r.ok, false, label);
      assert.match(r.error, pattern);
      assert.deepEqual(await stored(db), before, 'l’ancienne copie est intacte');
    });
  }

  test('listes trop volumineuses (plus de 120 Ko)', async () => {
    const db = await newDb();
    const lists = Array.from({ length: 20 }, (_, i) => list({ id: `l${i}`, spotIds: Array.from({ length: 100 }, (_, j) => `${'x'.repeat(60)}${i}-${j}`) }));
    const r = await save(db, DEV_A, { version: 1, lists });
    assert.equal(r.ok, false);
    assert.match(r.error, /volumineuses/);
  });

  test('plafonds exacts acceptés : 20 listes, 100 adresses, nom de 30 caractères', async () => {
    const db = await newDb();
    const lists = Array.from({ length: 20 }, (_, i) => list({ id: `l${i}`, name: 'n'.repeat(30), spotIds: Array.from({ length: 100 }, (_, j) => `s${j}`) }));
    assert.equal((await save(db, DEV_A, { version: 1, lists })).ok, true);
  });
});

describe('effacement des données et purge', () => {
  test('« Effacer mes données » efface les listes de l’appelant et épargne les autres', async () => {
    const db = await newDb();
    await save(db, DEV_A, state());
    await save(db, DEV_B, state());
    const r = (await as(db, 'anon', `select public.delete_my_data($1) r`, [DEV_A])).rows[0].r;
    assert.equal(r.success, true);
    assert.deepEqual((await stored(db)).map((x) => x.device_id), [DEV_B]);
  });

  test('un compte connecté efface ses listes ; un autre compte ne peut pas effacer celles d’autrui', async () => {
    const db = await newDb();
    await db.query(`insert into auth.users (id) values ($1), ($2)`, [USER_A, USER_B]);
    await as(db, 'authenticated', `select public.save_my_lists(null, $1::jsonb)`, [JSON.stringify(state())], USER_A);
    await as(db, 'authenticated', `select public.delete_my_data($1)`, [USER_A], USER_B);
    assert.equal((await stored(db)).length, 1, 'B n’a pas pu effacer les listes de A');
    await as(db, 'authenticated', `select public.delete_my_data(null)`, [], USER_A);
    assert.equal((await stored(db)).length, 0);
  });

  test('« Effacer mes données » garde ses autres effets (les découvertes sont toujours effacées)', async () => {
    const db = await newDb();
    await db.exec(`insert into public.user_place_discoveries (device_id, place_id) values ('${DEV_A}', 'p1')`);
    await save(db, DEV_A, state());
    const r = (await as(db, 'anon', `select public.delete_my_data($1) r`, [DEV_A])).rows[0].r;
    assert.equal(r.deleted.discoveries, 1);
    assert.equal((await one(db, `select count(*)::int n from public.user_place_discoveries`)).n, 0);
  });

  test('purge : listes inactives depuis plus de 24 mois supprimées, listes récentes ou d’un appareil actif conservées', async () => {
    const db = await newDb();
    const DEV_C = '33333333-3333-4333-8333-333333333333';
    for (const d of [DEV_A, DEV_B, DEV_C]) await save(db, d, state());
    await db.exec(`update public.user_lists set updated_at = '2023-01-01' where device_id in ('${DEV_A}', '${DEV_B}')`);
    await db.exec(`insert into public.user_place_discoveries (device_id, place_id, created_at) values ('${DEV_B}', 'p1', '2026-06-01')`);
    const r = (await one(db, `select public.purge_old_data('2026-07-01T10:00:00+02:00') r`)).r;
    assert.equal(typeof r.push_deliveries, 'number', 'la forme de la réponse est inchangée');
    assert.deepEqual((await stored(db)).map((x) => x.device_id).sort(), [DEV_B, DEV_C].sort());
  });
});

describe('migration', () => {
  const countOf = async (db, fn) => {
    const def = (await one(db, `select pg_get_functiondef($1::regprocedure) d`, [fn])).d;
    return def.split('user_lists').length - 1;
  };

  test('rejouable : une seule ligne ajoutée dans chaque fonction modifiée, copies existantes conservées', async () => {
    const db = await newDb();
    await save(db, DEV_A, state());
    const before = [await countOf(db, 'public.delete_my_data(text)'), await countOf(db, 'public.purge_old_data(timestamptz)')];
    await db.exec(m015);
    await db.exec(m015);
    assert.deepEqual([await countOf(db, 'public.delete_my_data(text)'), await countOf(db, 'public.purge_old_data(timestamptz)')], before);
    assert.equal((await stored(db)).length, 1);
    assert.equal((await as(db, 'anon', `select public.delete_my_data($1) r`, [DEV_A])).rows[0].r.success, true);
    assert.equal((await stored(db)).length, 0);
  });

  test('les fonctions modifiées gardent leurs droits : appelables par la clé publique (effacement), pas la purge', async () => {
    const db = await newDb();
    const can = async (role, fn) => (await one(db, `select has_function_privilege($1, $2::regprocedure, 'execute') ok`, [role, fn])).ok;
    for (const role of ['anon', 'authenticated']) {
      assert.equal(await can(role, 'public.delete_my_data(text)'), true);
      assert.equal(await can(role, 'public.purge_old_data(timestamptz)'), false);
      assert.equal(await can(role, 'public.get_my_lists(text)'), true);
      assert.equal(await can(role, 'public.save_my_lists(text, jsonb)'), true);
    }
    const defs = (await db.query(`select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname in ('delete_my_data', 'purge_old_data', 'get_my_lists', 'save_my_lists') order by 1`)).rows;
    for (const d of defs) {
      assert.equal(d.prosecdef, true, `${d.proname} reste SECURITY DEFINER`);
      assert.ok(String(d.proconfig).includes('search_path'), `${d.proname} garde son search_path fixé`);
    }
  });

  test('si le texte de delete_my_data ne contient pas le point d’insertion, la migration s’arrête et ne change RIEN', async () => {
    const db = await newDb({ with015: false });
    await db.exec(`create or replace function public.delete_my_data(p_device_id text default null) returns jsonb language sql security definer as $$ select '{}'::jsonb $$;`);
    await assert.rejects(db.exec(m015), /point d'insertion introuvable/);
    await db.exec('rollback').catch(() => {});
    assert.equal((await one(db, `select to_regclass('public.user_lists') t`)).t, null, 'la table n’est pas créée');
    assert.equal((await one(db, `select count(*)::int n from pg_proc where proname in ('get_my_lists', 'save_my_lists')`)).n, 0);
  });

  test('sans 006 / 007 : message clair, rien n’est créé', async () => {
    const db = await newDb({ with015: false, with007: false });
    await assert.rejects(db.exec(m015), /007_push_notifications/);
    await db.exec('rollback').catch(() => {});
    assert.equal((await one(db, `select to_regclass('public.user_lists') t`)).t, null);
  });

  test('seules get_my_lists et save_my_lists s’ajoutent à la surface publique ; aucune fonction interne exposée', async () => {
    const exposed = async (d) => (await d.query(`select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`)).rows.map((r) => r.proname);
    const before = await exposed(await newDb({ with015: false }));
    const after = await exposed(await newDb());
    assert.deepEqual(after.filter((f) => !before.includes(f)), ['get_my_lists', 'save_my_lists']);
    assert.equal(after.includes('_lpt_identity'), false);
  });
});
