// Tests de la migration 020 : bannière « Office de tourisme », lien réglé depuis le portail.
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
const m020 = read('../../src/scripts/020_tourism_banner.sql');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const BAD_CODE = 'mauvais-code-de-test';
const URL_OK = 'https://www.toulouse-tourisme.com/sortir-a-toulouse/agenda-sorties-toulouse/';

async function newDb({ with020 = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(m006);
  await db.exec(m012);
  await db.exec(m014);
  if (with020) await db.exec(m020);
  return db;
}
async function as(db, role, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const setUrl = (db, code, url) =>
  as(db, 'anon', `select public.admin_set_tourism_banner($1, $2) r`, [code, url]).then((r) => r.rows[0].r);
const stored = (db) => db.query(`select key, value from public.app_settings order by key`).then((r) => r.rows);

describe('admin_set_tourism_banner : enregistrement', () => {
  test('parcours complet : enregistré, lisible par tous, puis retour au lien par défaut', async () => {
    const db = await newDb();
    const r = await setUrl(db, GOOD_CODE, URL_OK);
    assert.equal(r.ok, true);
    assert.deepEqual(r.setting, { url: URL_OK });
    const read = await as(db, 'anon', `select value from public.app_settings where key = 'tourism_banner'`);
    assert.deepEqual(read.rows[0].value, { url: URL_OK });
    const reset = await setUrl(db, GOOD_CODE, '   ');
    assert.deepEqual(reset, { ok: true, setting: null });
    assert.equal((await stored(db)).filter((x) => x.key === 'tourism_banner').length, 0);
  });

  test('un mauvais code est refusé et rien n’est écrit', async () => {
    const db = await newDb();
    assert.deepEqual(await setUrl(db, BAD_CODE, URL_OK), { ok: false, error: 'forbidden' });
    assert.equal((await stored(db)).filter((x) => x.key === 'tourism_banner').length, 0);
  });

  test('adresses refusées : http, schémas dangereux, espaces, identifiants, sans point, trop longues', async () => {
    const db = await newDb();
    const bad = [
      'http://exemple.fr',
      'javascript:alert(1)',
      'file:///etc/passwd',
      'https://exemple.fr/a b',
      'https://user:mdp@exemple.fr',
      'https://localhost',
      'https://exemple',
      'https://exemple.fr/' + 'a'.repeat(300),
      'https://exemple.fr/\u0007',
    ];
    for (const url of bad) {
      const r = await setUrl(db, GOOD_CODE, url);
      assert.equal(r.ok, false, url);
      assert.match(r.error, /^invalid:/, url);
    }
    assert.equal((await stored(db)).filter((x) => x.key === 'tourism_banner').length, 0);
  });

  test('remplacer le lien met à jour l’unique ligne', async () => {
    const db = await newDb();
    await setUrl(db, GOOD_CODE, URL_OK);
    await setUrl(db, GOOD_CODE, 'https://exemple.fr/agenda?mois=12');
    const rows = (await stored(db)).filter((x) => x.key === 'tourism_banner');
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0].value, { url: 'https://exemple.fr/agenda?mois=12' });
  });
});

describe('sécurité du réglage', () => {
  test('la clé publique ne peut écrire ni modifier directement app_settings', async () => {
    const db = await newDb();
    await assert.rejects(as(db, 'anon', `insert into public.app_settings (key, value) values ('tourism_banner', '{"url":"https://pirate.fr"}'::jsonb)`), /permission denied|row-level security/);
    await setUrl(db, GOOD_CODE, URL_OK);
    await assert.rejects(as(db, 'anon', `update public.app_settings set value = '{"url":"https://pirate.fr"}'::jsonb where key = 'tourism_banner'`), /permission denied|row-level security/);
  });

  test('une clé inconnue reste refusée, et le thème d’accueil reste lisible', async () => {
    const db = await newDb();
    await assert.rejects(db.query(`insert into public.app_settings (key, value) values ('autre', '{}'::jsonb)`), /check|violates/i);
    await db.query(`insert into public.app_settings (key, value) values ('home_theme', '{}'::jsonb)`);
    const r = await as(db, 'anon', `select key from public.app_settings where key = 'home_theme'`);
    assert.equal(r.rows.length, 1);
  });

  test('sans 020, la fonction n’existe pas ; le script est relançable', async () => {
    const db = await newDb({ with020: false });
    await assert.rejects(setUrl(db, GOOD_CODE, URL_OK), /does not exist|function/i);
    await db.exec(m020);
    await assert.doesNotReject(db.exec(m020));
  });
});
