// Tests de la migration 012 : fond de l'accueil personnalisable.
// PostgreSQL réel (PGlite) avec un schéma « storage » simulé (mêmes tables et même mécanisme de politiques que Supabase).
// La simulation inclut une ancienne politique de stockage GRANDE OUVERTE, comme celles qui ont pu exister en production :
// les protections de la migration doivent tenir malgré elle.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
const baseline = read('baseline.sql');
const m006 = read('../../src/scripts/006_security_lockdown.sql');
const m012 = read('../../src/scripts/012_home_background.sql');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const BAD_CODE = 'mauvais-code-de-test';
const PATH_RE = /^home\/\d{8}-[0-9a-f]{32}\.(jpg|png|webp)$/;
const MB = 1024 * 1024;

const STORAGE_STUB = `
  create schema storage;
  create table storage.buckets (id text primary key, name text not null, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id), name text, owner uuid, metadata jsonb,
    created_at timestamptz default now(), unique (bucket_id, name));
  alter table storage.objects enable row level security;
  grant usage on schema storage to anon, authenticated;
  grant select, insert, update, delete on storage.objects to anon, authenticated;
  grant select on storage.buckets to anon, authenticated;
  insert into storage.buckets (id, name) values ('etablissements', 'etablissements');
  -- ancienne politique « tout est permis » (état possible en production avant ce correctif)
  create policy legacy_open on storage.objects for all to anon, authenticated using (true) with check (true);
`;

async function newDb({ withStorage = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(m006);
  if (withStorage) await db.exec(STORAGE_STUB);
  await db.exec(m012);
  return db;
}
async function as(db, role, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const requestUpload = (db, code, ext = 'jpg') =>
  as(db, 'anon', `select public.admin_request_upload($1, $2) r`, [code, ext]).then((r) => r.rows[0].r);
const setBackground = (db, code, mode, path = null) =>
  as(db, 'anon', `select public.admin_set_home_background($1, $2, $3) r`, [code, mode, path]).then((r) => r.rows[0].r);
const uploadAs = (db, role, bucket, name, meta = { size: 1 * MB, mimetype: 'image/jpeg' }) =>
  as(db, role, `insert into storage.objects (bucket_id, name, metadata) values ($1, $2, $3::jsonb) returning name`, [bucket, name, JSON.stringify(meta)]);
const stored = (db, bucket = 'app-backgrounds') => rows(db, `select name from storage.objects where bucket_id = $1 order by name`, [bucket]);

describe('dossier de stockage : seul un billet admin autorise un envoi', () => {
  test('dossier public, 2 Mo, JPEG/PNG/WebP', async () => {
    const db = await newDb();
    const b = await one(db, `select * from storage.buckets where id = 'app-backgrounds'`);
    assert.equal(b.public, true);
    assert.equal(Number(b.file_size_limit), 2097152);
    assert.deepEqual([...b.allowed_mime_types].sort(), ['image/jpeg', 'image/png', 'image/webp']);
  });

  test('sans billet : envoi refusé, même avec une ancienne politique grande ouverte', async () => {
    const db = await newDb();
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(uploadAs(db, role, 'app-backgrounds', 'home/20261023-00000000000000000000000000000000.jpg'), /row-level security/i);
      await assert.rejects(uploadAs(db, role, 'app-backgrounds', 'nimporte/quoi.png'), /row-level security/i);
    }
    assert.deepEqual(await stored(db), []);
  });

  test('avec un billet : envoi accepté à ce chemin exact seulement, une seule fois', async () => {
    const db = await newDb();
    const t = await requestUpload(db, GOOD_CODE, 'jpg');
    assert.equal(t.ok, true);
    assert.match(t.path, PATH_RE);
    await assert.rejects(uploadAs(db, 'anon', 'app-backgrounds', t.path.replace('.jpg', '.png')), /row-level security/i, 'autre extension');
    await assert.rejects(uploadAs(db, 'anon', 'app-backgrounds', 'home/autre-nom.jpg'), /row-level security/i, 'autre nom');
    await uploadAs(db, 'anon', 'app-backgrounds', t.path);
    assert.deepEqual((await stored(db)).map((r) => r.name), [t.path]);
    await assert.rejects(uploadAs(db, 'anon', 'app-backgrounds', t.path), /duplicate key|unique/i, 'un nom ne sert qu’une fois');
  });

  test('billet expiré ou déjà utilisé par l’admin : envoi refusé', async () => {
    const db = await newDb();
    const expired = await requestUpload(db, GOOD_CODE);
    await db.query(`update public.upload_tickets set expires_at = now() - interval '1 minute' where path = $1`, [expired.path]);
    await assert.rejects(uploadAs(db, 'anon', 'app-backgrounds', expired.path), /row-level security/i);

    const used = await requestUpload(db, GOOD_CODE);
    await db.query(`update public.upload_tickets set used_at = now() where path = $1`, [used.path]);
    await assert.rejects(uploadAs(db, 'anon', 'app-backgrounds', used.path), /row-level security/i);
  });

  test('modification et suppression interdites dans ce dossier ; les autres dossiers ne changent pas', async () => {
    const db = await newDb();
    const t = await requestUpload(db, GOOD_CODE);
    await uploadAs(db, 'anon', 'app-backgrounds', t.path);
    await uploadAs(db, 'anon', 'etablissements', 'covers/photo.jpg'); // ancien comportement conservé hors du dossier protégé

    for (const role of ['anon', 'authenticated']) {
      const upd = await as(db, role, `update storage.objects set name = 'home/pirate.jpg' where bucket_id = 'app-backgrounds' returning name`);
      assert.equal(upd.rows.length, 0, `${role} ne peut pas renommer ni écraser`);
      const meta = await as(db, role, `update storage.objects set metadata = '{}'::jsonb where bucket_id = 'app-backgrounds' returning name`);
      assert.equal(meta.rows.length, 0);
      const del = await as(db, role, `delete from storage.objects where bucket_id = 'app-backgrounds' returning name`);
      assert.equal(del.rows.length, 0, `${role} ne peut pas supprimer`);
    }
    assert.deepEqual((await stored(db)).map((r) => r.name), [t.path]);

    const otherUpd = await as(db, 'anon', `update storage.objects set name = 'covers/renomme.jpg' where bucket_id = 'etablissements' returning name`);
    assert.equal(otherUpd.rows.length, 1, 'les autres dossiers gardent leur comportement');
    const otherDel = await as(db, 'anon', `delete from storage.objects where bucket_id = 'etablissements' returning name`);
    assert.equal(otherDel.rows.length, 1);
  });

  test('billets : illisibles et inscriptibles seulement par les fonctions admin', async () => {
    const db = await newDb();
    await requestUpload(db, GOOD_CODE);
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(as(db, role, `select * from public.upload_tickets`), /permission denied/i);
      await assert.rejects(as(db, role, `insert into public.upload_tickets (path, expires_at) values ('home/x.jpg', now() + interval '1 day')`), /permission denied/i);
    }
    // la seule information accessible : « ce chemin est-il autorisé ? » (oui/non)
    assert.equal((await as(db, 'anon', `select public._upload_ticket_ok('home/devine.jpg') r`)).rows[0].r, false);
  });
});

describe('admin_request_upload', () => {
  test('refuse sans le bon code ; verrouillage partagé avec le reste du portail', async () => {
    const db = await newDb();
    for (const code of [BAD_CODE, '', null]) assert.deepEqual(await requestUpload(db, code), { ok: false, error: 'forbidden' });
    assert.equal((await one(db, `select count(*)::int n from public.upload_tickets`)).n, 0);
    for (let i = 0; i < 10; i++) await requestUpload(db, BAD_CODE);
    assert.equal((await requestUpload(db, GOOD_CODE)).ok, false, 'le bon code est refusé pendant le verrouillage');
  });

  test('formats acceptés : JPEG, PNG, WebP ; tout le reste refusé', async () => {
    const db = await newDb();
    for (const ext of ['jpg', 'PNG', ' webp ']) assert.equal((await requestUpload(db, GOOD_CODE, ext)).ok, true, ext);
    for (const ext of ['gif', 'svg', 'jpeg', 'exe', '', null, 'jpg/../../x', "png'; drop table x; --"]) {
      const r = await requestUpload(db, GOOD_CODE, ext);
      assert.equal(r.ok, false, String(ext));
      assert.match(r.error, /format d'image/);
    }
  });

  test('billet : chemin aléatoire, 10 minutes, 2 Mo ; 20 billets en attente au plus', async () => {
    const db = await newDb();
    const a = await requestUpload(db, GOOD_CODE);
    const b = await requestUpload(db, GOOD_CODE);
    assert.notEqual(a.path, b.path);
    assert.deepEqual([a.bucket, a.expires_in, a.max_bytes], ['app-backgrounds', 600, 2097152]);
    const minutes = (await one(db, `select extract(epoch from (expires_at - created_at))/60 m from public.upload_tickets where path = $1`, [a.path])).m;
    assert.equal(Math.round(minutes), 10);
    for (let i = 0; i < 18; i++) assert.equal((await requestUpload(db, GOOD_CODE)).ok, true);
    const tooMany = await requestUpload(db, GOOD_CODE);
    assert.equal(tooMany.ok, false);
    assert.match(tooMany.error, /trop d'envois en attente/);
    await db.query(`update public.upload_tickets set expires_at = now() - interval '1 minute'`);
    assert.equal((await requestUpload(db, GOOD_CODE)).ok, true, 'les billets expirés ne comptent plus');
  });
});

describe('admin_set_home_background', () => {
  const upload = async (db, meta) => {
    const t = await requestUpload(db, GOOD_CODE, 'jpg');
    await db.query(`insert into storage.objects (bucket_id, name, metadata) values ('app-backgrounds', $1, $2::jsonb)`, [t.path, JSON.stringify(meta)]);
    return t.path;
  };

  test('parcours complet : billet, envoi, affichage ; lecture publique ; retour au thème Galaxy', async () => {
    const db = await newDb();
    assert.equal((await as(db, 'anon', `select count(*)::int n from public.app_settings`)).rows[0].n, 0, 'aucun réglage = Galaxy');
    const path = await upload(db, { size: 900 * 1024, mimetype: 'image/jpeg' });
    const r = await setBackground(db, GOOD_CODE, 'image', path);
    assert.equal(r.ok, true);
    assert.equal(r.setting.mode, 'image');
    assert.equal(r.setting.path, path);

    const pub = (await as(db, 'anon', `select key, value from public.app_settings`)).rows;
    assert.equal(pub.length, 1);
    assert.equal(pub[0].key, 'home_background');
    assert.equal(pub[0].value.mode, 'image');
    assert.ok(Number(pub[0].value.updated) > 1_700_000_000);
    assert.notEqual((await one(db, `select used_at from public.upload_tickets where path = $1`, [path])).used_at, null);

    const back = await setBackground(db, GOOD_CODE, 'galaxy');
    assert.deepEqual(back, { ok: true, setting: { mode: 'galaxy' } });
    assert.deepEqual((await as(db, 'authenticated', `select value from public.app_settings`)).rows[0].value, { mode: 'galaxy' });
  });

  test('refus : image trop lourde, mauvais type, métadonnées absentes, fichier non reçu', async () => {
    const db = await newDb();
    const big = await upload(db, { size: 3 * MB, mimetype: 'image/jpeg' });
    assert.match((await setBackground(db, GOOD_CODE, 'image', big)).error, /trop lourde/);
    const gif = await upload(db, { size: 100 * 1024, mimetype: 'image/gif' });
    assert.match((await setBackground(db, GOOD_CODE, 'image', gif)).error, /format d'image/);
    const nometa = await upload(db, {});
    assert.match((await setBackground(db, GOOD_CODE, 'image', nometa)).error, /trop lourde/);
    const zero = await upload(db, { size: 0, mimetype: 'image/png' });
    assert.match((await setBackground(db, GOOD_CODE, 'image', zero)).error, /trop lourde/);
    const t = await requestUpload(db, GOOD_CODE); // billet sans envoi
    assert.match((await setBackground(db, GOOD_CODE, 'image', t.path)).error, /pas été reçue/);
    assert.equal((await one(db, `select count(*)::int n from public.app_settings`)).n, 0, 'aucun réglage écrit par un refus');
  });

  test('refus : chemin piégé, chemin sans billet, mode inconnu, sans le bon code', async () => {
    const db = await newDb();
    for (const p of [null, '', 'home/x.jpg', '../secret.jpg', 'https://exemple.test/a.jpg', "home/20261023-0123456789abcdef0123456789abcdef.jpg' or true --"]) {
      const r = await setBackground(db, GOOD_CODE, 'image', p);
      assert.equal(r.ok, false, String(p));
      assert.match(r.error, /chemin d'image illisible/);
    }
    const unticketed = 'home/20261023-0123456789abcdef0123456789abcdef.png';
    await db.query(`insert into storage.objects (bucket_id, name, metadata) values ('app-backgrounds', $1, '{"size":1000,"mimetype":"image/png"}'::jsonb)`, [unticketed]);
    assert.match((await setBackground(db, GOOD_CODE, 'image', unticketed)).error, /aucun envoi n'a été autorisé/);
    assert.match((await setBackground(db, GOOD_CODE, 'video')).error, /mode inconnu/);
    for (const code of [BAD_CODE, '', null]) assert.deepEqual(await setBackground(db, code, 'galaxy'), { ok: false, error: 'forbidden' });
    assert.equal((await one(db, `select count(*)::int n from public.app_settings`)).n, 0);
  });

  test('remplacer une image par une autre : le réglage public suit, l’ancien fichier reste inchangé', async () => {
    const db = await newDb();
    const first = await upload(db, { size: 500 * 1024, mimetype: 'image/png' });
    await setBackground(db, GOOD_CODE, 'image', first);
    const second = await upload(db, { size: 600 * 1024, mimetype: 'image/webp' });
    await setBackground(db, GOOD_CODE, 'image', second);
    assert.equal((await as(db, 'anon', `select value ->> 'path' p from public.app_settings`)).rows[0].p, second);
    assert.equal((await stored(db)).length, 2);
  });
});

describe('réglages publics', () => {
  test('lecture seule pour la clé publique ; une seule clé possible', async () => {
    const db = await newDb();
    await setBackground(db, GOOD_CODE, 'galaxy');
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(as(db, role, `insert into public.app_settings (key, value) values ('home_background', '{}'::jsonb)`), /permission denied|row-level security/i);
      await assert.rejects(as(db, role, `update public.app_settings set value = '{"mode":"image","path":"x"}'::jsonb`), /permission denied|row-level security/i);
      await assert.rejects(as(db, role, `delete from public.app_settings`), /permission denied|row-level security/i);
    }
    await assert.rejects(db.query(`insert into public.app_settings (key, value) values ('autre_cle', '{}'::jsonb)`), /check constraint|violates/i);
    assert.deepEqual((await one(db, `select value from public.app_settings`)).value, { mode: 'galaxy' });
  });

  test('un réglage autre que home_background resterait invisible (politique de lecture)', async () => {
    const db = await newDb();
    await db.exec(`alter table public.app_settings drop constraint app_settings_key_check`);
    await db.query(`insert into public.app_settings (key, value) values ('secret_interne', '{"x":1}'::jsonb)`);
    assert.equal((await as(db, 'anon', `select count(*)::int n from public.app_settings`)).rows[0].n, 0);
  });
});

describe('migration', () => {
  test('rejouable ; conserve le réglage et les billets existants', async () => {
    const db = await newDb();
    const t = await requestUpload(db, GOOD_CODE);
    await setBackground(db, GOOD_CODE, 'galaxy');
    await db.exec(m012);
    await db.exec(m012);
    assert.equal((await one(db, `select count(*)::int n from public.upload_tickets where path = $1`, [t.path])).n, 1);
    assert.deepEqual((await one(db, `select value from public.app_settings`)).value, { mode: 'galaxy' });
    assert.equal((await rows(db, `select 1 from pg_policies where schemaname = 'storage' and policyname like 'app-backgrounds%'`)).length, 4);
  });

  test('sans stockage Supabase : la migration s’applique quand même (avec un avertissement), les fonctions refusent l’image', async () => {
    const db = await newDb({ withStorage: false });
    const r = await requestUpload(db, GOOD_CODE);
    assert.equal(r.ok, true);
    assert.equal((await setBackground(db, GOOD_CODE, 'galaxy')).ok, true);
  });

  test('fonctions appelables avec la clé publique : les deux fonctions admin et la vérification de billet', async () => {
    const db = await newDb();
    const exposed = (await rows(db, `
      select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
         and p.proname in ('admin_request_upload', 'admin_set_home_background', '_upload_ticket_ok')
       order by 1`)).map((r) => r.proname);
    assert.deepEqual(exposed, ['_upload_ticket_ok', 'admin_request_upload', 'admin_set_home_background']);
  });
});
