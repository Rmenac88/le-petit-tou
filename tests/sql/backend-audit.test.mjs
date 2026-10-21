// Audit du back-end : portail admin, verrouillage anti force brute, parcours complet des notifications.
// PostgreSQL réel (PGlite). Les appels à l'API Expo sont SIMULÉS : ces tests prouvent la logique serveur,
// pas l'affichage d'une notification sur un téléphone.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const baseline = readFileSync(new URL('baseline.sql', here), 'utf8');
const m006 = readFileSync(new URL('../../src/scripts/006_security_lockdown.sql', here), 'utf8');
const m007 = readFileSync(new URL('../../src/scripts/007_push_notifications.sql', here), 'utf8');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const BAD_CODE = 'mauvais-code-de-test';
const DEV_A = '11111111-1111-4111-8111-111111111111';
const DEV_B = '22222222-2222-4222-8222-222222222222';
const DEV_C = '33333333-3333-4333-8333-333333333333';
const TOK_A = 'ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]';
const TOK_B = 'ExponentPushToken[BBBBBBBBBBBBBBBBBBBBBB]';
const TOK_C = 'ExponentPushToken[CCCCCCCCCCCCCCCCCCCCCC]';
const TOK_C2 = 'ExponentPushToken[DDDDDDDDDDDDDDDDDDDDDD]';
const DAY = '2026-07-01T10:00:00+02:00';
const DAY_PLUS_5 = '2026-07-01T10:05:00+02:00';
const DAY_PLUS_30 = '2026-07-01T10:30:00+02:00';
const NIGHT = '2026-07-01T23:00:00+02:00';
const NEXT_MORNING = '2026-07-02T09:00:00+02:00';

const NET_STUB = `
  create schema net;
  create table net._http_response (id bigint primary key, status_code integer, content_type text,
    headers jsonb, content text, timed_out boolean, error_msg text, created timestamptz default now());
  create table net._requests (id bigint generated always as identity primary key, url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint
    language plpgsql as $$ declare v bigint; begin insert into net._requests (url, body) values (url, body) returning id into v; return v; end $$;
`;

async function newDb({ withPush = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(`alter table public.addresses add column if not exists is_new boolean default false;`);
  await db.exec(m006);
  if (withPush) {
    await db.exec(NET_STUB);
    await db.exec(m007);
  }
  return db;
}

async function as(db, role, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];

const write = (db, code, table, op, id, record) =>
  as(db, 'anon', `select public.admin_write($1,$2,$3,$4,$5::jsonb) r`, [code, table, op, id, JSON.stringify(record ?? {})]).then((r) => r.rows[0].r);
const register = (db, dev, tok, plat, ev, ag, ns) =>
  as(db, 'anon', `select public.register_push_token($1,$2,$3,$4,$5,$6) r`, [dev, tok, plat, ev, ag, ns]).then((r) => r.rows[0].r);
const tick = async (db, at) => (await one(db, `select public.push_tick($1::timestamptz) r`, [at])).r;
const stats = (db, code = GOOD_CODE) => as(db, 'anon', `select public.admin_push_stats($1) r`, [code]).then((r) => r.rows[0].r);
const announce = (db, code, title, body) =>
  as(db, 'anon', `select public.admin_send_push($1,$2,$3) r`, [code, title, body]).then((r) => r.rows[0].r);

// ------------------------------------------------------------------------------------------------
describe('mise à jour de la production : ancienne version d’admin_write', () => {
  test('006 s’applique même si admin_write existe avec d’anciens noms de paramètres, et le portail refonctionne', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(baseline);
    await db.exec(`create function public.admin_write(p_code text, p_table text, p_op text, p_id text default null,
      p_payload jsonb default '{}'::jsonb) returns jsonb language sql as $$ select '{"ok":false,"error":"ancienne version"}'::jsonb $$;`);
    await db.exec(m006);

    const sigs = await rows(db, `select pg_get_function_arguments(oid) a from pg_proc where proname = 'admin_write'`);
    assert.equal(sigs.length, 1, 'une seule version d’admin_write doit subsister');
    assert.match(sigs[0].a, /p_record/);
    assert.doesNotMatch(sigs[0].a, /p_payload/);

    const ins = await write(db, GOOD_CODE, 'events', 'insert', null, { title: 'Après mise à jour' });
    assert.equal(ins.ok, true);
    assert.equal(ins.rows[0].title, 'Après mise à jour');
  });
});

describe('mise à jour de la production : anciennes fonctions de notifications', () => {
  test('007 s’applique même si des fonctions push existent avec un autre type de retour ou d’autres paramètres', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(baseline);
    await db.exec(`alter table public.addresses add column if not exists is_new boolean default false;`);
    await db.exec(m006);
    await db.exec(NET_STUB);
    await db.exec(`
      create function public.unregister_push_token(p_device_id text) returns boolean language sql as $$ select true $$;
      create function public.register_push_token(p_device_id text, p_token text) returns void language sql as $$ select $$;
      create function public.admin_push_stats(p_code text) returns integer language sql as $$ select 1 $$;
      create function public.push_tick() returns void language sql as $$ select $$;`);
    await db.exec(m007);

    const r = await register(db, DEV_A, TOK_A, 'ios', true, true, false);
    assert.equal(r.success, true);
    assert.equal((await as(db, 'anon', `select public.unregister_push_token($1) r`, [DEV_A])).rows[0].r.success, true);
    assert.equal((await stats(db)).ok, true);
    await db.query(`insert into public.events (title, event_date) values ('Concert', '2026-08-01')`);
    assert.equal((await one(db, `select count(*)::int n from public.push_outbox`)).n, 1, 'les déclencheurs sont recréés');
    await db.exec(m007); // rejouable
  });
});

describe('surface d’attaque : fonctions appelables avec la clé publique', () => {
  // Liste blanche : tout ajout de fonction exposée doit être décidé ici, consciemment.
  const ALLOWED_ANON = [
    'admin_delete_partner_event', 'admin_list_partner_events', 'admin_push_stats', 'admin_save_partner_event',
    'admin_send_push', 'admin_write', 'delete_my_data', 'discover_place', 'get_my_card_usage', 'get_my_discoveries',
    'get_push_preferences', 'increment_spot_like', 'register_push_token', 'unregister_push_token',
    'update_push_preferences', 'use_discount_card', 'verify_admin_access',
  ];
  test('anon et authenticated ne peuvent exécuter que la liste blanche ; aucune fonction interne exposée', async () => {
    const db = await newDb();
    for (const role of ['anon', 'authenticated']) {
      const exposed = (await rows(db, `
        select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and has_function_privilege($1, p.oid, 'execute')
         order by 1`, [role])).map((r) => r.proname);
      const unexpected = [...new Set(exposed)].filter((f) => !ALLOWED_ANON.includes(f));
      assert.deepEqual(unexpected, [], `${role} peut exécuter des fonctions non prévues : ${unexpected.join(', ')}`);
    }
  });
  test('toutes les tables sensibles ont la RLS activée', async () => {
    const db = await newDb();
    const off = (await rows(db, `
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity order by 1`)).map((r) => r.relname);
    assert.deepEqual(off, [], `tables sans RLS : ${off.join(', ')}`);
  });
});

describe('comptes authentifiés et administrateurs', () => {
  const asUser = async (db, role, uid, sql, params = []) => {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);
    await db.exec(`set role ${role}`);
    try { return await db.query(sql, params); } finally { await db.exec('reset role'); await db.query(`select set_config('request.jwt.claim.sub', '', false)`); }
  };
  const ADMIN = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const USER_A = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const USER_B = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  async function setup() {
    const db = await newDb();
    await db.query(`insert into auth.users (id) values ($1), ($2), ($3)`, [ADMIN, USER_A, USER_B]);
    await db.query(`insert into public.admin_users (id, email) values ($1, 'admin@test.invalid')`, [ADMIN]);
    return db;
  }

  test('un compte admin passe avec n’importe quel code non vide ; un compte non admin ne passe jamais sans le bon code', async () => {
    const db = await setup();
    const call = (uid, code) => asUser(db, 'authenticated', uid, `select public.admin_push_stats($1) r`, [code]).then((r) => r.rows[0].r.ok);
    assert.equal(await call(ADMIN, 'x'), true, 'admin authentifié');
    assert.equal(await call(ADMIN, ''), false, 'code vide refusé même pour un admin');
    assert.equal(await call(USER_A, 'x'), false, 'utilisateur simple, mauvais code');
    assert.equal(await call(USER_A, GOOD_CODE), true, 'le bon code reste valable (mécanisme du portail actuel)');
  });

  test('l’admin authentifié écrit dans le catalogue ; un utilisateur simple écrit seulement avec le bon code', async () => {
    const db = await setup();
    const w = (uid, code) => asUser(db, 'authenticated', uid, `select public.admin_write($1,'events','insert',null,'{"title":"t"}'::jsonb) r`, [code]).then((r) => r.rows[0].r.ok);
    assert.equal(await w(ADMIN, 'x'), true);
    assert.equal(await w(USER_B, BAD_CODE), false);
    assert.equal((await one(db, `select count(*)::int n from public.events`)).n, 1);
  });

  test('utilisateur A et utilisateur B : aucune lecture, écriture ou suppression croisée de leurs données', async () => {
    const db = await setup();
    const spot = (await one(db, `insert into public.addresses (title) values ('Adresse de test') returning id`)).id;
    const found = (await asUser(db, 'authenticated', USER_A, `select public.discover_place($1, $2, 'manual_checkin') r`, [DEV_A, spot])).rows[0].r;
    assert.equal(found.success ?? found.ok ?? true, true);
    const list = (uid) => asUser(db, 'authenticated', uid, `select place_id from public.get_my_discoveries($1)`, [DEV_A]).then((r) => r.rows.map((x) => x.place_id));
    assert.deepEqual(await list(USER_A), [spot], 'A voit sa découverte');
    assert.deepEqual(await list(USER_B), [], 'B authentifié ne voit pas celle de A, même en passant l’identifiant d’appareil de A');
    await asUser(db, 'authenticated', USER_B, `select public.delete_my_data($1) r`, [DEV_A]);
    assert.equal((await one(db, `select count(*)::int n from public.user_place_discoveries where place_id = $1`, [spot])).n, 1,
      'B ne peut pas effacer les données de A');
  });

  test('suppression du compte : plus de ligne admin, de jeton, ni d’utilisateur', async () => {
    const db = await setup();
    await asUser(db, 'authenticated', ADMIN, `select public.register_push_token($1,$2,'android',true,true,false) r`, [DEV_A, TOK_A]);
    const r = await asUser(db, 'authenticated', ADMIN, `select public.delete_my_data(null) r`);
    assert.equal(r.rows[0].r.success, true);
    assert.equal((await one(db, `select count(*)::int n from public.admin_users`)).n, 0);
    assert.equal((await one(db, `select count(*)::int n from auth.users where id = $1`, [ADMIN])).n, 0);
    assert.equal((await one(db, `select count(*)::int n from public.push_devices`)).n, 0);
  });
});

describe('lecture publique du catalogue', () => {
  test('006 garantit la lecture publique des 4 tables, même si le droit SELECT manquait (cas observé en production)', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(baseline);
    await db.exec(`revoke all on public.sponsored_partners, public.categories from anon, authenticated;`);
    await db.query(`insert into public.sponsored_partners (title) values ('Partenaire')`);
    await db.query(`insert into public.categories (name) values ('Cat')`);
    await db.exec(m006);
    for (const t of ['addresses', 'categories', 'events', 'sponsored_partners']) {
      for (const role of ['anon', 'authenticated']) {
        await assert.doesNotReject(as(db, role, `select * from public.${t}`), `${role} doit lire ${t}`);
      }
    }
    assert.equal((await as(db, 'anon', `select * from public.sponsored_partners`)).rows.length, 1);
  });
});

// ------------------------------------------------------------------------------------------------
describe('portail admin : écritures du catalogue', () => {
  test('insertion, modification partielle, suppression sur les 4 tables', async () => {
    const db = await newDb({ withPush: false });
    const samples = {
      addresses: { title: 'Chez Test', description: 'Une adresse', rating: 4.5, is_recommended: true, points_reward: 25 },
      categories: { name: 'Catégorie test', slug: 'cat-test', color: '#FF0000', icon_name: 'star' },
      events: { title: 'Événement test', event_date: '2026-12-01', location: 'Toulouse' },
      sponsored_partners: { title: 'Partenaire test', price_paid: 100, rank_position: 2, is_active: true },
    };
    for (const [table, rec] of Object.entries(samples)) {
      const ins = await write(db, GOOD_CODE, table, 'insert', null, rec);
      assert.equal(ins.ok, true, `${table} insert`);
      assert.equal(ins.rows.length, 1);
      const id = ins.rows[0].id;
      const firstKey = Object.keys(rec)[0];

      const upd = await write(db, GOOD_CODE, table, 'update', id, { [firstKey]: 'Modifié' });
      assert.equal(upd.ok, true, `${table} update`);
      assert.equal(upd.rows[0][firstKey], 'Modifié');
      for (const [k, v] of Object.entries(rec).slice(1)) {
        assert.equal(String(upd.rows[0][k]), String(v), `${table}.${k} doit rester inchangé par une modification partielle`);
      }
      assert.equal(upd.rows[0].id, id);

      const del = await write(db, GOOD_CODE, table, 'delete', id, null);
      assert.equal(del.ok, true, `${table} delete`);
      assert.equal(del.rows.length, 1);
      assert.equal((await one(db, `select count(*)::int n from public.${table} where id = $1`, [id])).n, 0);
    }
  });

  test('id introuvable, id piégé, colonne id/created_at ignorées : aucune autre ligne touchée', async () => {
    const db = await newDb({ withPush: false });
    const a = (await write(db, GOOD_CODE, 'addresses', 'insert', null, { title: 'A' })).rows[0];
    const b = (await write(db, GOOD_CODE, 'addresses', 'insert', null, { title: 'B' })).rows[0];

    const missing = await write(db, GOOD_CODE, 'addresses', 'update', '99999999-9999-4999-8999-999999999999', { title: 'X' });
    assert.equal(missing.ok, true);
    assert.equal(missing.rows.length, 0);

    for (const evil of [`' or true --`, `%`, `${a.id}' or '1'='1`, `x'; delete from public.addresses; --`]) {
      const u = await write(db, GOOD_CODE, 'addresses', 'update', evil, { title: 'PIRATE' });
      const d = await write(db, GOOD_CODE, 'addresses', 'delete', evil, null);
      assert.equal(u.rows?.length ?? 0, 0, `update avec id piégé ${evil}`);
      assert.equal(d.rows?.length ?? 0, 0, `delete avec id piégé ${evil}`);
    }
    const titles = (await rows(db, `select title from public.addresses order by title`)).map((r) => r.title);
    assert.deepEqual(titles, ['A', 'B']);

    const forged = await write(db, GOOD_CODE, 'addresses', 'update', a.id,
      { id: b.id, created_at: '2000-01-01T00:00:00Z', title: 'A2' });
    assert.equal(forged.ok, true);
    assert.equal(forged.rows[0].id, a.id, 'l’id ne peut pas être réécrit');
    assert.notEqual(new Date(forged.rows[0].created_at).getFullYear(), 2000, 'created_at ne peut pas être réécrit');
  });

  test('enregistrement invalide : refus propre, jamais d’exception, rien d’écrit', async () => {
    const db = await newDb({ withPush: false });
    const cases = [
      ['events', 'insert', null, { colonne_inconnue: 1 }],
      ['events', 'insert', null, {}],
      ['events', 'insert', null, { location: 'sans titre' }],
      ['events', 'insert', null, { title: 'date absurde', event_date: '2026-13-45' }],
      ['events', 'update', null, { title: 'sans id' }],
      ['events', 'delete', '', null],
      ['addresses', 'insert', null, { title: 'note texte', rating: 'beaucoup' }],
    ];
    for (const [table, op, id, rec] of cases) {
      const r = await write(db, GOOD_CODE, table, op, id, rec);
      assert.equal(r.ok, false, `${table}/${op}/${JSON.stringify(rec)} doit être refusé`);
      assert.equal(typeof r.error, 'string');
    }
    const notObj = await as(db, 'anon', `select public.admin_write($1,'events','insert',null,'[1,2]'::jsonb) r`, [GOOD_CODE]);
    assert.equal(notObj.rows[0].r.ok, false);
    assert.equal((await one(db, `select count(*)::int n from public.events`)).n, 0);
    assert.equal((await one(db, `select count(*)::int n from public.addresses`)).n, 0);
  });
});

// ------------------------------------------------------------------------------------------------
describe('verrouillage anti force brute : une seule porte pour tout le portail', () => {
  const entryPoints = (db, code) => ({
    write: async () => (await write(db, code, 'events', 'insert', null, { title: 'x' })).ok === true,
    stats: async () => (await stats(db, code)).ok === true,
    announce: async () => (await announce(db, code, 'Titre', 'Message')).ok === true,
    verify: async () => (await as(db, 'anon', `select public.verify_admin_access($1) r`, [code])).rows[0].r === true,
    agenda: async () => (await as(db, 'anon', `select * from public.admin_list_partner_events($1)`, [code])).rows.length >= 0
      && (await as(db, 'anon', `select public.admin_delete_partner_event($1, gen_random_uuid()) r`, [code])).rows[0].r !== -1,
  });

  test('9 échecs n’empêchent pas le bon code ; le 10e verrouille TOUS les points d’entrée, y compris le bon code', async () => {
    const db = await newDb();
    for (let i = 0; i < 9; i++) await stats(db, BAD_CODE);
    assert.equal((await stats(db)).ok, true, 'après 9 échecs le bon code passe encore');

    await stats(db, BAD_CODE); // 10e échec
    const good = entryPoints(db, GOOD_CODE);
    assert.equal(await good.write(), false, 'admin_write verrouillé');
    assert.equal(await good.stats(), false, 'admin_push_stats verrouillé');
    assert.equal(await good.announce(), false, 'admin_send_push verrouillé');
    assert.equal(await good.verify(), false, 'verify_admin_access verrouillé');
    assert.equal(await good.agenda(), false, 'agenda verrouillé');
    assert.equal((await one(db, `select count(*)::int n from public.events`)).n, 0, 'rien d’écrit pendant le verrouillage');
    assert.equal((await one(db, `select count(*)::int n from public.push_outbox where kind = 'announcement'`)).n, 0);
  });

  test('le verrouillage se lève au bout de 15 minutes', async () => {
    const db = await newDb();
    for (let i = 0; i < 10; i++) await stats(db, BAD_CODE);
    assert.equal((await stats(db)).ok, false);
    await db.exec(`update public.admin_login_attempts set attempted_at = now() - interval '16 minutes'`);
    assert.equal((await stats(db)).ok, true, 'le bon code repasse après 16 minutes');
    const good = entryPoints(db, GOOD_CODE);
    assert.equal(await good.write(), true);
    assert.equal(await good.announce(), true);
    assert.equal(await good.verify(), true);
    assert.equal(await good.agenda(), true);
  });

  test('code vide, espaces, null : refusés et comptés comme échecs', async () => {
    const db = await newDb();
    for (const c of [null, '', '   ']) {
      assert.equal((await stats(db, c)).ok, false);
      assert.equal((await announce(db, c, 'T', 'M')).ok, false);
    }
    assert.equal((await one(db, `select count(*)::int n from public.admin_login_attempts`)).n, 6);
  });
});

// ------------------------------------------------------------------------------------------------
describe('annonces admin : bornes et robustesse', () => {
  test('titre 50 / message 140 acceptés, 51 / 141 refusés, accents et emojis comptés en caractères', async () => {
    const db = await newDb();
    assert.equal((await announce(db, GOOD_CODE, 'é'.repeat(50), '😀'.repeat(140))).ok, true);
    assert.equal((await announce(db, GOOD_CODE, 'é'.repeat(51), 'ok')).ok, false);
    assert.equal((await announce(db, GOOD_CODE, 'ok', 'a'.repeat(141))).ok, false);
    assert.equal((await announce(db, GOOD_CODE, '   ', 'ok')).ok, false);
    assert.equal((await announce(db, GOOD_CODE, 'ok', null)).ok, false);
  });

  test('deux annonces rapprochées donnent deux messages distincts (pas d’écrasement)', async () => {
    const db = await newDb();
    await announce(db, GOOD_CODE, 'Première', 'Message 1');
    await announce(db, GOOD_CODE, 'Seconde', 'Message 2');
    assert.equal((await one(db, `select count(*)::int n from public.push_outbox where kind = 'announcement'`)).n, 2);
  });

  test('guillemets, apostrophes et SQL dans le texte sont conservés tels quels, sans effet', async () => {
    const db = await newDb();
    const t = `L'été "chaud"; drop table public.events; --`;
    assert.equal((await announce(db, GOOD_CODE, t.slice(0, 50), t.slice(0, 100))).ok, true);
    assert.equal((await one(db, `select count(*)::int n from public.events`)).n, 0);
    assert.ok(await one(db, `select to_regclass('public.events') t`).then((r) => r.t));
    const o = await one(db, `select title, body from public.push_outbox where kind = 'announcement'`);
    assert.equal(o.title, t.slice(0, 50));
  });
});

// ------------------------------------------------------------------------------------------------
describe('notifications : parcours complet (réponses Expo SIMULÉES)', () => {
  const respond = (db, id, status, content) =>
    db.query(`insert into net._http_response (id, status_code, content) values ($1, $2, $3)`, [id, status, JSON.stringify(content)]);
  const pendingRequest = async (db, kind) =>
    (await one(db, `select request_id from public.push_requests where kind = $1 and collected_at is null order by created_at desc limit 1`, [kind]))?.request_id;
  const deliveries = (db) => rows(db, `
    select d.device_id, o.kind, d.status from public.push_deliveries d
    join public.push_outbox o on o.id = d.outbox_id order by d.id`);

  test('inscription -> contenu publié -> distribution -> envoi -> tickets -> reçus -> statistiques', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A, 'ios', true, true, false);
    await register(db, DEV_B, TOK_B, 'android', false, true, false);
    await register(db, DEV_C, TOK_C, 'android', true, false, true);

    const s0 = await stats(db);
    assert.deepEqual([s0.devices, s0.ios, s0.android], [3, 1, 2]);

    // Contenu publié : un événement, une date d'agenda active, une date d'agenda INACTIVE
    await db.query(`insert into public.events (title, event_date) values ('Concert', '2026-08-01')`);
    await db.query(`insert into public.partner_events (spot_id, title, start_date, start_time, is_active)
                    values ('spot-1', 'Soirée jazz', '2026-08-02', '20:00', true), ('spot-1', 'Brouillon', '2026-08-03', '20:00', false)`);
    await db.query(`update public.push_outbox set created_at = $1::timestamptz`, [DAY]);
    assert.equal((await one(db, `select count(*)::int n from public.push_outbox`)).n, 2, 'la date inactive ne crée aucun message');

    // Distribution à 10h05 : événement => A et C ; agenda => A et B (C a coupé l'agenda)
    const t1 = await tick(db, DAY_PLUS_5);
    assert.equal(t1.fanout, 4);
    assert.equal(t1.sent, 4);
    const d1 = await deliveries(db);
    const by = (kind) => d1.filter((x) => x.kind === kind).map((x) => x.device_id).sort();
    assert.deepEqual(by('event'), [DEV_A, DEV_C]);
    assert.deepEqual(by('agenda'), [DEV_A, DEV_B]);
    assert.ok(d1.every((x) => x.status === 'queued'));

    // Expo accepte tout sauf un jeton périmé (celui de C)
    const sendReq = await pendingRequest(db, 'send');
    const sentRows = await rows(db, `select id, device_id from public.push_deliveries where request_id = $1 order by id`, [sendReq]);
    await respond(db, sendReq, 200, {
      data: sentRows.map((r, i) => (r.device_id === DEV_C
        ? { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } }
        : { status: 'ok', id: `ticket-${i}` })),
    });
    await tick(db, DAY_PLUS_5);
    const d2 = await deliveries(db);
    assert.equal(d2.filter((x) => x.status === 'sent').length, 3);
    assert.equal(d2.filter((x) => x.status === 'invalid_token').length, 1);
    assert.equal((await one(db, `select invalid_at is not null inv from public.push_devices where device_id = $1`, [DEV_C])).inv, true);

    // Reçus après 15 minutes : tout est accepté par Apple/Google
    await tick(db, DAY_PLUS_30);
    const recReq = await pendingRequest(db, 'receipts');
    assert.ok(recReq, 'une demande de reçus doit partir après 15 minutes');
    const tickets = (await rows(db, `select ticket_id from public.push_deliveries where status = 'sent'`)).map((r) => r.ticket_id);
    await respond(db, recReq, 200, { data: Object.fromEntries(tickets.map((t) => [t, { status: 'ok' }])) });
    await tick(db, DAY_PLUS_30);
    assert.equal((await deliveries(db)).filter((x) => x.status === 'receipt_ok').length, 3);

    const s1 = await stats(db);
    assert.equal(s1.devices, 2, 'le jeton périmé de C n’est plus compté');
    assert.equal(s1.pending_messages, 0);
    assert.equal(s1.deliveries_7d.receipt_ok, 3);
    assert.equal(s1.deliveries_7d.invalid_token, 1);

    // C réinstalle l'appli : nouveau jeton, il est de nouveau joignable
    assert.equal((await register(db, DEV_C, TOK_C2, 'android', true, false, true)).success, true);
    assert.equal((await stats(db)).devices, 3);
    const pref = (await as(db, 'anon', `select public.get_push_preferences($1) r`, [DEV_C])).rows[0].r;
    assert.equal(pref.registered, true);
  });

  test('annonce admin envoyée la nuit : retenue jusqu’au matin, puis reçue seulement par ceux qui acceptent', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A, 'ios', true, true, false);
    await register(db, DEV_B, TOK_B, 'android', false, true, false);

    const res = await announce(db, GOOD_CODE, 'Fermeture exceptionnelle', 'Le marché est fermé demain.');
    assert.deepEqual([res.ok, res.recipients], [true, 1]);
    await db.query(`update public.push_outbox set created_at = $1::timestamptz`, [NIGHT]);

    assert.equal((await tick(db, NIGHT)).fanout, 0, 'rien la nuit');
    assert.equal((await stats(db)).pending_messages, 1);

    const morning = await tick(db, NEXT_MORNING);
    assert.equal(morning.fanout, 1);
    assert.deepEqual((await deliveries(db)).map((x) => x.device_id), [DEV_A]);
    assert.equal((await stats(db)).pending_messages, 0);
  });

  test('désinscription et effacement : l’appareil ne reçoit plus rien et ne laisse aucune trace', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A, 'ios', true, true, false);
    await register(db, DEV_B, TOK_B, 'android', true, true, false);
    await as(db, 'anon', `select public.unregister_push_token($1)`, [DEV_A]);
    await as(db, 'anon', `select public.delete_my_data($1)`, [DEV_B]);
    await db.query(`insert into public.events (title, event_date) values ('Concert', '2026-08-01')`);
    await db.query(`update public.push_outbox set created_at = $1::timestamptz`, [DAY]);
    assert.equal((await tick(db, DAY_PLUS_5)).fanout, 0);
    assert.equal((await one(db, `select count(*)::int n from public.push_devices`)).n, 0);
    assert.equal((await one(db, `select count(*)::int n from public.push_deliveries`)).n, 0);
  });

  test('jeton mal formé ou piégé : refusé, rien d’enregistré', async () => {
    const db = await newDb();
    const bad = [
      'ExponentPushToken[court]', 'expopushtoken[AAAAAAAAAAAAAAAAAAAAAA]', 'ExponentPushToken[AAAAAAAAAAAA AAAAAAAAAA]',
      `ExponentPushToken[AAAAAAAAAAAAAAAA'; drop table public.push_devices; --]`, 'ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]x', '',
    ];
    for (const t of bad) {
      const r = await register(db, DEV_A, t, 'ios', true, true, false);
      assert.equal(r.success, false, `jeton accepté à tort : ${t}`);
    }
    assert.equal((await register(db, DEV_A, 'ExpoPushToken[AAAAAAAAAAAAAAAAAAAAAA]', 'ios', true, true, false)).success, true);
    assert.equal((await one(db, `select count(*)::int n from public.push_devices`)).n, 1);
  });
});
