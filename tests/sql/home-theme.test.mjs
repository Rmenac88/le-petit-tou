// Tests de la migration 014 : thème de l'année (haut de l'accueil), réglé depuis le portail.
// PostgreSQL réel (PGlite). Sans stockage Supabase : la migration 012 s'applique avec son avertissement habituel.
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
const m014 = read('../../src/scripts/014_home_theme.sql');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const BAD_CODE = 'mauvais-code-de-test';

const THEME = {
  name: 'Été 2027',
  bg: '#0F2A43',
  bg2: '#1F5F7A',
  accent: '#7FE0D0',
  text: '#FFFFFF',
  stars: false,
  line1: 'Pour voir la ville',
  line2: 'en bleu.',
  subtitle: 'Les bonnes adresses, testées pour de vrai.',
};

async function newDb({ with014 = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(m006);
  await db.exec(m012);
  if (with014) await db.exec(m014);
  return db;
}
async function as(db, role, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const setTheme = (db, code, theme) =>
  as(db, 'anon', `select public.admin_set_home_theme($1, $2::jsonb) r`, [code, theme === null ? null : JSON.stringify(theme)]).then((r) => r.rows[0].r);
const stored = (db) => db.query(`select key, value from public.app_settings order by key`).then((r) => r.rows);

describe('admin_set_home_theme : enregistrement', () => {
  test('parcours complet : enregistré, lisible par tous, couleurs en minuscules, retour au thème d’origine', async () => {
    const db = await newDb();
    const r = await setTheme(db, GOOD_CODE, THEME);
    assert.equal(r.ok, true);
    assert.deepEqual(r.setting, { ...THEME, bg: '#0f2a43', bg2: '#1f5f7a', accent: '#7fe0d0', text: '#ffffff' });

    for (const role of ['anon', 'authenticated']) {
      const pub = (await as(db, role, `select key, value from public.app_settings`)).rows;
      assert.equal(pub.length, 1);
      assert.equal(pub[0].key, 'home_theme');
      assert.equal(pub[0].value.line2, 'en bleu.');
    }

    const back = await setTheme(db, GOOD_CODE, null);
    assert.deepEqual(back, { ok: true, setting: null });
    assert.deepEqual(await stored(db), []);
  });

  test('un second enregistrement remplace le premier (une seule ligne)', async () => {
    const db = await newDb();
    await setTheme(db, GOOD_CODE, THEME);
    await setTheme(db, GOOD_CODE, { ...THEME, name: 'Hiver', stars: true, bg2: null });
    const rows = await stored(db);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].value.name, 'Hiver');
    assert.equal(rows[0].value.stars, true);
    assert.equal(rows[0].value.bg2, null);
  });

  test('le dégradé est facultatif (absent ou null) ; les espaces sont nettoyés', async () => {
    const db = await newDb();
    const { bg2, ...sansDegrade } = THEME;
    assert.equal((await setTheme(db, GOOD_CODE, sansDegrade)).setting.bg2, null);
    const r = await setTheme(db, GOOD_CODE, { ...THEME, bg2: null, line1: '  Pour   voir\tla ville \n' });
    assert.equal(r.setting.line1, 'Pour voir la ville');
  });
});

describe('admin_set_home_theme : refus (rien n’est écrit)', () => {
  test('sans le bon code, ou sans code : refusé comme les autres fonctions admin', async () => {
    const db = await newDb();
    for (const code of [BAD_CODE, '', null]) assert.deepEqual(await setTheme(db, code, THEME), { ok: false, error: 'forbidden' });
    assert.deepEqual(await setTheme(db, BAD_CODE, null), { ok: false, error: 'forbidden' });
    assert.deepEqual(await stored(db), []);
  });

  test('un échec de code compte dans le verrouillage commun (10 échecs => même le bon code est refusé)', async () => {
    const db = await newDb();
    for (let i = 0; i < 10; i += 1) await setTheme(db, BAD_CODE + i, THEME);
    assert.deepEqual(await setTheme(db, GOOD_CODE, THEME), { ok: false, error: 'forbidden' });
    assert.deepEqual(await stored(db), []);
  });

  test('couleurs : seul le format #RRGGBB est accepté', async () => {
    const db = await newDb();
    for (const field of ['bg', 'accent', 'text']) {
      for (const bad of ['red', '#fff', '#12345g', '#1234567', '0F2A43', 'rgb(1,2,3)', "#000000'; drop table x;--", '', null, 12, true]) {
        const r = await setTheme(db, GOOD_CODE, { ...THEME, [field]: bad });
        assert.equal(r.ok, false, `${field} = ${String(bad)}`);
        assert.match(r.error, /^invalid: couleur/);
      }
    }
    for (const bad of ['red', '#abc', 7, true, {}]) {
      const r = await setTheme(db, GOOD_CODE, { ...THEME, bg2: bad });
      assert.equal(r.ok, false, `bg2 = ${JSON.stringify(bad)}`);
      assert.match(r.error, /dégradé/);
    }
    assert.deepEqual(await stored(db), []);
  });

  test('étoiles : un booléen est obligatoire', async () => {
    const db = await newDb();
    for (const bad of ['true', 1, null, undefined]) {
      const t = { ...THEME, stars: bad };
      if (bad === undefined) delete t.stars;
      const r = await setTheme(db, GOOD_CODE, t);
      assert.equal(r.ok, false, String(bad));
      assert.match(r.error, /étoiles/);
    }
  });

  test('textes : obligatoires, non vides, longueur limitée, sans caractère de contrôle', async () => {
    const db = await newDb();
    const limits = { name: 40, line1: 40, line2: 40, subtitle: 90 };
    for (const [field, max] of Object.entries(limits)) {
      assert.equal((await setTheme(db, GOOD_CODE, { ...THEME, [field]: 'a'.repeat(max) })).ok, true, `${field} à la limite`);
      const long = await setTheme(db, GOOD_CODE, { ...THEME, [field]: 'a'.repeat(max + 1) });
      assert.equal(long.ok, false);
      assert.match(long.error, /trop long/);
      for (const empty of ['', '   ', '\n\t']) assert.match((await setTheme(db, GOOD_CODE, { ...THEME, [field]: empty })).error, /vide/);
      assert.match((await setTheme(db, GOOD_CODE, { ...THEME, [field]: 42 })).error, /manquant/);
      assert.match((await setTheme(db, GOOD_CODE, { ...THEME, [field]: 'a\u0001b' })).error, /non autorisés/);
    }
    const missing = { ...THEME };
    delete missing.subtitle;
    assert.match((await setTheme(db, GOOD_CODE, missing)).error, /manquant/);
  });

  test('clé inconnue, forme inattendue : refusé', async () => {
    const db = await newDb();
    assert.match((await setTheme(db, GOOD_CODE, { ...THEME, script: 'x' })).error, /réglage inconnu/);
    for (const bad of [[], 'texte', 12, true]) {
      const r = await setTheme(db, GOOD_CODE, bad);
      assert.equal(r.ok, false, JSON.stringify(bad));
      assert.match(r.error, /thème illisible/);
    }
    assert.deepEqual(await stored(db), []);
  });

  test('un refus ne modifie pas le thème déjà en place', async () => {
    const db = await newDb();
    await setTheme(db, GOOD_CODE, THEME);
    assert.equal((await setTheme(db, GOOD_CODE, { ...THEME, bg: 'bleu' })).ok, false);
    assert.equal((await stored(db))[0].value.name, 'Été 2027');
  });
});

describe('réglages publics après la migration 014', () => {
  test('lecture seule pour la clé publique, pour le thème comme pour le fond', async () => {
    const db = await newDb();
    await setTheme(db, GOOD_CODE, THEME);
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(as(db, role, `insert into public.app_settings (key, value) values ('home_theme', '{}'::jsonb)`), /permission denied|row-level security/i);
      await assert.rejects(as(db, role, `update public.app_settings set value = '{"bg":"#000000"}'::jsonb`), /permission denied|row-level security/i);
      await assert.rejects(as(db, role, `delete from public.app_settings`), /permission denied|row-level security/i);
    }
    assert.equal((await one(db, `select value ->> 'name' n from public.app_settings where key = 'home_theme'`)).n, 'Été 2027');
  });

  test('la liste de clés reste fermée : deux clés seulement', async () => {
    const db = await newDb();
    await db.query(`insert into public.app_settings (key, value) values ('home_background', '{"mode":"galaxy"}'::jsonb), ('home_theme', '{}'::jsonb)`);
    await assert.rejects(db.query(`insert into public.app_settings (key, value) values ('autre_cle', '{}'::jsonb)`), /check constraint|violates/i);
    const keys = (await as(db, 'anon', `select key from public.app_settings order by 1`)).rows.map((r) => r.key);
    assert.deepEqual(keys, ['home_background', 'home_theme']);
  });

  test('un réglage hors liste resterait invisible (politique de lecture)', async () => {
    const db = await newDb();
    await db.exec(`alter table public.app_settings drop constraint app_settings_key_check`);
    await db.query(`insert into public.app_settings (key, value) values ('secret_interne', '{"x":1}'::jsonb), ('home_theme', '{}'::jsonb)`);
    assert.deepEqual((await as(db, 'anon', `select key from public.app_settings`)).rows.map((r) => r.key), ['home_theme']);
  });

  test('avant la migration, le thème ne peut pas être écrit (la clé n’existe pas encore)', async () => {
    const db = await newDb({ with014: false });
    await assert.rejects(db.query(`insert into public.app_settings (key, value) values ('home_theme', '{}'::jsonb)`), /check constraint|violates/i);
  });
});

describe('migration 014', () => {
  test('rejouable ; conserve le thème et le fond déjà réglés', async () => {
    const db = await newDb();
    await db.exec(`insert into public.app_settings (key, value) values ('home_background', '{"mode":"galaxy"}'::jsonb)`);
    await setTheme(db, GOOD_CODE, THEME);
    await db.exec(m014);
    await db.exec(m014);
    const rows = await stored(db);
    assert.deepEqual(rows.map((r) => r.key), ['home_background', 'home_theme']);
    assert.equal(rows[1].value.name, 'Été 2027');
    assert.equal((await one(db, `select count(*)::int n from pg_constraint where conrelid = 'public.app_settings'::regclass and contype = 'c'`)).n, 1);
  });

  test('seule la fonction admin_set_home_theme est ajoutée à la surface publique', async () => {
    const exposed = async (d) =>
      (await d.query(`
        select distinct p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute') order by 1`)).rows.map((r) => r.proname);
    const before = await exposed(await newDb({ with014: false }));
    const after = await exposed(await newDb());
    assert.deepEqual(after.filter((f) => !before.includes(f)), ['admin_set_home_theme']);
  });
});
