// Tests de la migration 006 sur une vraie base PostgreSQL (PGlite, en mémoire, données synthétiques).
// Lancer : npm run test:sql
// Limite : PGlite n'est pas Supabase (pas de PostgREST, pas de JWT réel) ; les rôles anon/authenticated
// et auth.uid() sont reproduits à l'identique dans baseline.sql. Un test sur le projet Supabase réel reste à faire.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const baseline = readFileSync(new URL('baseline.sql', here), 'utf8');
const migration = readFileSync(new URL('../../src/scripts/006_security_lockdown.sql', here), 'utf8');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const DEV_A = '11111111-1111-4111-8111-111111111111';
const DEV_B = '22222222-2222-4222-8222-222222222222';

async function newDb(applyMigration) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(`
    insert into public.addresses (id, title, rating, is_recommended, points_reward) values
      ('aaaaaaaa-0000-4000-8000-000000000001', 'Adresse test 1', 4.9, true, 10),
      ('aaaaaaaa-0000-4000-8000-000000000002', 'Adresse test 2', 4.0, false, 0);
    insert into public.categories (id, name) values ('cccccccc-0000-4000-8000-000000000001', 'Cat test');
    insert into public.events (id, title) values ('eeeeeeee-0000-4000-8000-000000000001', 'Event test');
    insert into public.sponsored_partners (id, title) values ('bbbbbbbb-0000-4000-8000-000000000001', 'Partenaire test');
    insert into public.discount_cards (id, title, max_uses) values ('dddddddd-0000-4000-8000-000000000001', 'Carte test', 2);
    insert into public.user_place_discoveries (device_id, place_id) values ('${DEV_B}', 'aaaaaaaa-0000-4000-8000-000000000002');
  `);
  if (applyMigration) await db.exec(migration);
  return db;
}

/** Exécute une requête avec le rôle Supabase demandé (anon / authenticated) et, éventuellement, un utilisateur. */
async function as(db, role, sub, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [sub ?? '']);
  await db.exec(`set role ${role}`);
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
  }
}
const denied = (p) => assert.rejects(p, /permission denied|row-level security|violates/i);

describe('AVANT 006 : preuve des failles (état de production observé)', () => {
  let db;
  before(async () => { db = await newDb(false); });

  test("S-01 un visiteur anonyme peut modifier et supprimer le catalogue", async () => {
    const upd = await as(db, 'anon', null, `update public.addresses set title = 'PIRATE' returning id`);
    assert.equal(upd.rows.length, 2);
    const del = await as(db, 'anon', null, `delete from public.events returning id`);
    assert.equal(del.rows.length, 1);
  });

  test("S-03 un visiteur anonyme lit les identifiants d'appareil des autres", async () => {
    const r = await as(db, 'anon', null, `select device_id from public.user_place_discoveries`);
    assert.equal(r.rows.length, 1);
  });
});

describe('APRÈS 006', () => {
  let db;
  before(async () => { db = await newDb(true); });

  test('006 est rejouable sans erreur', async () => {
    await db.exec(migration);
  });

  describe('catalogue (S-01)', () => {
    test('lecture publique conservée', async () => {
      const r = await as(db, 'anon', null, `select count(*)::int n from public.addresses`);
      assert.equal(r.rows[0].n, 2);
      for (const t of ['categories', 'events', 'sponsored_partners']) {
        await as(db, 'anon', null, `select * from public.${t}`);
      }
    });
    test('écriture directe refusée (anon et authenticated)', async () => {
      for (const role of ['anon', 'authenticated']) {
        for (const t of ['addresses', 'categories', 'events', 'sponsored_partners']) {
          await denied(as(db, role, null, `update public.${t} set created_at = now()`));
          await denied(as(db, role, null, `delete from public.${t}`));
          await denied(as(db, role, null, `insert into public.${t} (id) values (gen_random_uuid())`));
        }
      }
    });
  });

  describe('admin_write (code serveur)', () => {
    const row = (r) => r.rows[0].admin_write;
    const call = (code, table, op, id, rec) =>
      as(db, 'anon', null, `select public.admin_write($1,$2,$3,$4,$5::jsonb) as admin_write`,
        [code, table, op, id, JSON.stringify(rec ?? {})]);

    test('verify_admin_access : bon code accepté', async () => {
      const r = await as(db, 'anon', null, `select public.verify_admin_access($1) ok`, [GOOD_CODE]);
      assert.equal(r.rows[0].ok, true);
    });
    test('CRUD complet avec le bon code', async () => {
      const id = 'aaaaaaaa-0000-4000-8000-0000000000ff';
      const ins = row(await call(GOOD_CODE, 'addresses', 'insert', null,
        { id, title: 'Nouvelle adresse', rating: 4.5, colonne_inconnue: 'ignorée', created_at: '2000-01-01' }));
      assert.equal(ins.ok, true);
      assert.equal(ins.rows[0].title, 'Nouvelle adresse');
      assert.notEqual(ins.rows[0].created_at.slice(0, 4), '2000', 'created_at ne doit pas être imposé par le client');

      const upd = row(await call(GOOD_CODE, 'addresses', 'update', id, { title: 'Renommée', id: 'ffffffff-0000-4000-8000-000000000000' }));
      assert.equal(upd.rows[0].title, 'Renommée');
      assert.equal(upd.rows[0].id, id, "l'identifiant ne peut pas être modifié");

      const del = row(await call(GOOD_CODE, 'addresses', 'delete', id));
      assert.equal(del.rows.length, 1);
      const again = row(await call(GOOD_CODE, 'addresses', 'delete', id));
      assert.equal(again.rows.length, 0);
    });
    test('toutes les tables du portail sont couvertes', async () => {
      for (const [t, rec] of [['categories', { name: 'C' }], ['events', { title: 'E' }], ['sponsored_partners', { title: 'P' }]]) {
        const r = row(await call(GOOD_CODE, t, 'insert', null, rec));
        assert.equal(r.ok, true, t);
      }
    });
    test('tables non autorisées et opérations inconnues refusées', async () => {
      assert.equal(row(await call(GOOD_CODE, 'admin_secrets', 'insert', null, { key: 'k', value: 'v' })).ok, false);
      assert.equal(row(await call(GOOD_CODE, 'auth.users', 'delete', 'x')).ok, false);
      assert.equal(row(await call(GOOD_CODE, 'addresses', 'truncate', null)).ok, false);
      assert.equal(row(await call(GOOD_CODE, 'addresses', 'update', null, { title: 'x' })).ok, false);
    });
    test('injection SQL via le nom de table ou la clé refusée sans effet', async () => {
      const r = row(await call(GOOD_CODE, 'addresses; drop table public.events;--', 'insert', null, { title: 'x' }));
      assert.equal(r.ok, false);
      const r2 = row(await call(GOOD_CODE, 'addresses', 'insert', null, { 'title"); drop table public.events;--': 'x' }));
      assert.equal(r2.ok, false);
      await as(db, 'anon', null, `select 1 from public.events limit 1`); // la table existe toujours
    });
    test('mauvais code ou code vide : aucune écriture', async () => {
      for (const code of ['mauvais', '', null, ` ${GOOD_CODE}x`]) {
        const r = row(await call(code, 'addresses', 'update', 'aaaaaaaa-0000-4000-8000-000000000001', { title: 'PIRATE' }));
        assert.equal(r.ok, false);
        assert.equal(r.error, 'forbidden');
      }
      const t = await as(db, 'anon', null, `select title from public.addresses where id = 'aaaaaaaa-0000-4000-8000-000000000001'`);
      assert.notEqual(t.rows[0].title, 'PIRATE');
    });
  });

  describe('agenda des partenaires', () => {
    const ev = { spot_id: 'aaaaaaaa-0000-4000-8000-000000000001', title: 'Soirée test', start_date: '2027-05-01' };
    test('code refusé : null / vide / -1, sans exception', async () => {
      const s = await as(db, 'anon', null, `select (public.admin_save_partner_event($1,$2::jsonb)).id as id`, ['faux', JSON.stringify(ev)]);
      assert.equal(s.rows[0].id, null);
      const l = await as(db, 'anon', null, `select * from public.admin_list_partner_events($1)`, ['faux']);
      assert.equal(l.rows.length, 0);
      const d = await as(db, 'anon', null, `select public.admin_delete_partner_event($1, gen_random_uuid()) n`, ['faux']);
      assert.equal(d.rows[0].n, -1);
    });
    test('bon code : ajout, liste, suppression ; validations conservées', async () => {
      const s = await as(db, 'anon', null, `select (public.admin_save_partner_event($1,$2::jsonb)).id as id`, [GOOD_CODE, JSON.stringify(ev)]);
      const id = s.rows[0].id;
      assert.ok(id);
      const l = await as(db, 'anon', null, `select * from public.admin_list_partner_events($1)`, [GOOD_CODE]);
      assert.equal(l.rows.length, 1);
      await assert.rejects(as(db, 'anon', null, `select public.admin_save_partner_event($1,$2::jsonb)`,
        [GOOD_CODE, JSON.stringify({ ...ev, start_date: '10/11/2026' })]), /AAAA-MM-JJ/);
      await assert.rejects(as(db, 'anon', null, `select public.admin_save_partner_event($1,$2::jsonb)`,
        [GOOD_CODE, JSON.stringify({ ...ev, link_url: 'javascript:alert(1)' })]), /http/);
      const d = await as(db, 'anon', null, `select public.admin_delete_partner_event($1, $2) n`, [GOOD_CODE, id]);
      assert.equal(d.rows[0].n, 1);
    });
    test('écriture directe refusée', async () => {
      await denied(as(db, 'anon', null, `insert into public.partner_events (spot_id, title, start_date) values ('x','y','2027-01-01')`));
    });
  });

  describe('données utilisateur (S-03)', () => {
    const place1 = 'aaaaaaaa-0000-4000-8000-000000000001';
    test('plus aucun accès direct aux tables', async () => {
      for (const t of ['user_place_discoveries', 'user_discount_cards', 'discount_card_uses']) {
        await denied(as(db, 'anon', null, `select * from public.${t}`));
        await denied(as(db, 'authenticated', DEV_A, `select * from public.${t}`));
        await denied(as(db, 'anon', null, `delete from public.${t}`));
      }
      await denied(as(db, 'anon', null, `insert into public.user_place_discoveries (device_id, place_id) values ('${DEV_A}','p')`));
    });
    test('discover_place : points serveur, idempotent, identité obligatoire', async () => {
      const bad = await as(db, 'anon', null, `select public.discover_place('pas-un-uuid', $1, 'x') r`, [place1]);
      assert.equal(bad.rows[0].r.error, 'IDENTITE_INVALIDE');
      const none = await as(db, 'anon', null, `select public.discover_place(null, $1, 'x') r`, [place1]);
      assert.equal(none.rows[0].r.error, 'IDENTITE_INVALIDE');

      const first = (await as(db, 'anon', null, `select public.discover_place($1, $2, 'manual_checkin') r`, [DEV_A, place1])).rows[0].r;
      assert.equal(first.success, true);
      assert.equal(first.points_earned, 10);
      assert.equal(first.already_discovered, false);
      const second = (await as(db, 'anon', null, `select public.discover_place($1, $2, 'manual_checkin') r`, [DEV_A, place1])).rows[0].r;
      assert.equal(second.already_discovered, true);
      assert.equal(second.points_earned, 0);
      assert.equal(second.total_points, 10);

      const ghost = (await as(db, 'anon', null, `select public.discover_place($1, 'inexistante', 'x') r`, [DEV_A])).rows[0].r;
      assert.equal(ghost.error, 'ADRESSE_INTROUVABLE');
      const total = await db.query(`select count(*)::int n from public.user_place_discoveries where device_id = $1`, [DEV_A]);
      assert.equal(total.rows[0].n, 1, 'une seule ligne malgré deux appels');
    });
    test('get_my_discoveries ne renvoie que les lignes de l’appelant', async () => {
      const a = await as(db, 'anon', null, `select * from public.get_my_discoveries($1)`, [DEV_A]);
      assert.deepEqual(a.rows.map((r) => r.place_id), ['aaaaaaaa-0000-4000-8000-000000000001']);
      const b = await as(db, 'anon', null, `select * from public.get_my_discoveries($1)`, [DEV_B]);
      assert.equal(b.rows.length, 1);
      assert.notEqual(b.rows[0].place_id, 'aaaaaaaa-0000-4000-8000-000000000001');
      const none = await as(db, 'anon', null, `select * from public.get_my_discoveries(null)`);
      assert.equal(none.rows.length, 0);
    });
    test("une session authentifiée prime sur l'identifiant d'appareil fourni", async () => {
      const uid = '33333333-3333-4333-8333-333333333333';
      await db.exec(`insert into auth.users (id) values ('${uid}')`);
      const r = (await as(db, 'authenticated', uid, `select public.discover_place($1, $2, 'x') r`, [DEV_B, 'aaaaaaaa-0000-4000-8000-000000000001'])).rows[0].r;
      assert.equal(r.success, true);
      const rows = await db.query(`select device_id, user_id from public.user_place_discoveries where place_id = 'aaaaaaaa-0000-4000-8000-000000000001' and user_id is not null`);
      assert.equal(rows.rows[0].device_id, uid, "pas d'usurpation d'un autre appareil via p_device_id");
    });
    test('use_discount_card : quota appliqué côté serveur', async () => {
      const card = 'dddddddd-0000-4000-8000-000000000001';
      const use = async () => (await as(db, 'anon', null, `select public.use_discount_card($1::uuid, $2) r`, [card, DEV_A])).rows[0].r;
      assert.equal((await use()).remaining_uses, 1);
      assert.equal((await use()).remaining_uses, 0);
      const third = await use();
      assert.equal(third.success, false);
      assert.equal(third.error, 'QUOTA_MAX_ATTEINT');
      const log = await db.query(`select count(*)::int n from public.discount_card_uses where device_id = $1`, [DEV_A]);
      assert.equal(log.rows[0].n, 2);
      const usage = await as(db, 'anon', null, `select * from public.get_my_card_usage($1)`, [DEV_A]);
      assert.equal(usage.rows[0].uses_count, 2);
      const other = await as(db, 'anon', null, `select * from public.get_my_card_usage($1)`, [DEV_B]);
      assert.equal(other.rows.length, 0);
    });
    test('carte inconnue ou désactivée refusée', async () => {
      const r = (await as(db, 'anon', null, `select public.use_discount_card(gen_random_uuid(), $1) r`, [DEV_A])).rows[0].r;
      assert.equal(r.success, false);
    });
  });

  describe('likes (S-04)', () => {
    const spot = 'aaaaaaaa-0000-4000-8000-000000000002';
    const like = async (dev, delta) =>
      (await as(db, 'anon', null, `select public.increment_spot_like($1, $2, $3) n`, [spot, delta, dev])).rows[0].n;
    test('delta arbitraire refusé, like idempotent par appareil', async () => {
      assert.equal(await like(DEV_A, 500), 0);
      assert.equal(await like(DEV_A, 1), 1);
      assert.equal(await like(DEV_A, 1), 1, 'même appareil : pas de double comptage');
      assert.equal(await like(DEV_B, 1), 2);
      assert.equal(await like(DEV_A, -1), 1);
      assert.equal(await like(DEV_A, -1), 1, 'retrait répété : pas de compteur négatif');
      assert.equal(await like('pas-un-uuid', 1), 0);
    });
    test('écriture directe sur spot_likes refusée', async () => {
      await denied(as(db, 'anon', null, `update public.spot_likes set likes_count = 99999`));
      await denied(as(db, 'anon', null, `insert into public.spot_likes (spot_id, likes_count) values ('x', 5)`));
    });
  });

  describe('tables secondaires (S-05, S-07)', () => {
    test('place_suggestions : insertion bornée, lecture interdite', async () => {
      await as(db, 'anon', null, `insert into public.place_suggestions (device_id, title) values ($1, 'Super bar')`, [DEV_A]);
      await denied(as(db, 'anon', null, `select * from public.place_suggestions`));
      await denied(as(db, 'anon', null, `insert into public.place_suggestions (device_id, title) values ($1, $2)`, [DEV_A, 'x'.repeat(500)]));
      await denied(as(db, 'anon', null, `insert into public.place_suggestions (device_id, title, status) values ($1, 'ok', 'approved')`, [DEV_A]));
    });
    test('address_views : insertion anonyme seule', async () => {
      await as(db, 'anon', null, `insert into public.address_views (spot_id, source) values ('s1', 'app')`);
      await denied(as(db, 'anon', null, `select * from public.address_views`));
      await denied(as(db, 'anon', null, `delete from public.address_views`));
    });
    test('user_push_tokens fermée', async () => {
      await denied(as(db, 'anon', null, `select * from public.user_push_tokens`));
      await denied(as(db, 'anon', null, `insert into public.user_push_tokens (device_id) values ('x')`));
    });
  });

  describe('suppression des données (S-06)', () => {
    test("delete_my_data efface l'appareil appelant et épargne les autres", async () => {
      const r = (await as(db, 'anon', null, `select public.delete_my_data($1) r`, [DEV_A])).rows[0].r;
      assert.equal(r.success, true);
      assert.ok(r.deleted.discoveries >= 1 && r.deleted.cards === 1 && r.deleted.card_uses === 2);
      for (const t of ['user_place_discoveries', 'user_discount_cards', 'discount_card_uses', 'place_suggestions']) {
        const left = await db.query(`select count(*)::int n from public.${t} where device_id = $1`, [DEV_A]);
        assert.equal(left.rows[0].n, 0, t);
      }
      const other = await db.query(`select count(*)::int n from public.user_place_discoveries where device_id = $1`, [DEV_B]);
      assert.equal(other.rows[0].n, 1, "les données d'un autre appareil sont intactes");
      const likes = await db.query(`select count(*)::int n from public.spot_user_likes where device_id = $1`, [DEV_A]);
      assert.equal(likes.rows[0].n, 0);
    });
    test('identité invalide refusée, session supprimée avec le compte', async () => {
      const bad = (await as(db, 'anon', null, `select public.delete_my_data('x') r`)).rows[0].r;
      assert.equal(bad.success, false);
      const uid = '33333333-3333-4333-8333-333333333333';
      const r = (await as(db, 'authenticated', uid, `select public.delete_my_data(null) r`)).rows[0].r;
      assert.equal(r.success, true);
      const u = await db.query(`select count(*)::int n from auth.users where id = $1`, [uid]);
      assert.equal(u.rows[0].n, 0);
    });
  });

  describe('verrouillage anti force brute (S-02)', () => {
    test('10 échecs en 15 min bloquent même le bon code ; secrets illisibles', async () => {
      await denied(as(db, 'anon', null, `select * from public.admin_secrets`));
      await denied(as(db, 'anon', null, `select * from public.admin_login_attempts`));
      for (let i = 0; i < 10; i++) {
        const r = await as(db, 'anon', null, `select public.verify_admin_access($1) ok`, [`essai-${i}`]);
        assert.equal(r.rows[0].ok, false);
      }
      const r = await as(db, 'anon', null, `select public.verify_admin_access($1) ok`, [GOOD_CODE]);
      assert.equal(r.rows[0].ok, false, 'verrouillé');
      const w = await as(db, 'anon', null, `select public.admin_write($1,'addresses','insert',null,'{"title":"x"}') r`, [GOOD_CODE]);
      assert.equal(w.rows[0].r.error, 'forbidden');
      await db.exec(`update public.admin_login_attempts set attempted_at = now() - interval '16 minutes'`);
      const ok = await as(db, 'anon', null, `select public.verify_admin_access($1) ok`, [GOOD_CODE]);
      assert.equal(ok.rows[0].ok, true, 'déverrouillé après 15 minutes');
    });
  });
});

describe('garde-fou de la migration', () => {
  test('006 refuse de tourner si le code admin n’a pas été changé via 005', async () => {
    const db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(baseline);
    await db.exec(`delete from public.admin_secrets`);
    await assert.rejects(db.exec(migration), /005_admin_secure_writes/);
  });
});
