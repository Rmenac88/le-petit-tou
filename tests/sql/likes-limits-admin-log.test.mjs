// 023 : likes relus depuis le serveur, limites par identité, verrouillage admin par source, journal admin.
// PostgreSQL réel (PGlite). La « source » est simulée avec l'en-tête que l'hébergeur transmet (request.headers).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
const GOOD = 'Code-De-Test-Synthetique-01';
const DEV_A = '11111111-1111-4111-8111-111111111111';
const DEV_B = '22222222-2222-4222-8222-222222222222';

async function newDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(read('baseline.sql'));
  await db.exec(read('../../src/scripts/006_security_lockdown.sql'));
  await db.exec(`insert into public.admin_secrets (key, value)
    values ('admin_code_sha256', encode(extensions.digest('${GOOD}', 'sha256'), 'hex'))
    on conflict (key) do update set value = excluded.value`);
  const ids = Array.from({ length: 105 }, (_, i) => `aaaaaaaa-0000-4000-8000-${String(i).padStart(12, '0')}`);
  await db.exec(`insert into public.addresses (id, title) values ${ids.map((id) => `('${id}', 'A')`).join(',')}`);
  await db.exec(read('../../src/scripts/023_likes_limits_admin_log.sql'));
  return { db, ids };
}
async function as(db, role, sql, params = [], ip = null) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.query(`select set_config('request.headers', $1, false)`, [ip ? JSON.stringify({ 'x-forwarded-for': `${ip}, 10.0.0.1` }) : '']);
  await db.query(`select set_config('request.path', '/rpc/verify_admin_access', false)`);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const like = (db, dev, spot, delta = 1) =>
  as(db, 'anon', `select public.increment_spot_like($1, $2, $3) n`, [spot, delta, dev]).then((r) => r.rows[0].n);
const myLikes = (db, dev) => as(db, 'anon', `select public.get_my_likes($1) r`, [dev]).then((r) => r.rows[0].r);
const login = (db, code, ip) => as(db, 'anon', `select public.verify_admin_access($1) ok`, [code], ip).then((r) => r.rows[0].ok);

test('get_my_likes : chacun relit SES likes, jamais ceux d’un autre ; identité invalide refusée', async () => {
  const { db, ids } = await newDb();
  await like(db, DEV_A, ids[0]);
  await like(db, DEV_A, ids[1]);
  await like(db, DEV_B, ids[2]);
  assert.deepEqual([...(await myLikes(db, DEV_A)).spot_ids].sort(), [ids[0], ids[1]].sort());
  assert.deepEqual((await myLikes(db, DEV_B)).spot_ids, [ids[2]]);
  await like(db, DEV_A, ids[0], -1);
  assert.deepEqual((await myLikes(db, DEV_A)).spot_ids, [ids[1]]);
  assert.equal((await myLikes(db, 'pas-un-uuid')).ok, false);
  await assert.rejects(as(db, 'anon', `select * from public.spot_user_likes`), /permission denied/);
});

test('like : toujours un seul par identité et par adresse ; au-delà de 100 nouveaux likes par jour, plus rien ne compte', async () => {
  const { db, ids } = await newDb();
  assert.equal(await like(db, DEV_A, ids[0]), 1);
  assert.equal(await like(db, DEV_A, ids[0]), 1, 'second like sans effet');
  for (let i = 1; i < 100; i++) await like(db, DEV_A, ids[i]);
  assert.equal(await like(db, DEV_A, ids[100]), 0, 'le 101e like du jour est ignoré');
  assert.equal((await db.query(`select count(*)::int n from public.spot_user_likes where device_id = $1`, [DEV_A])).rows[0].n, 100);
  assert.equal(await like(db, DEV_A, ids[5], -1), 0, 'retirer un like reste toujours possible');
  assert.equal(await like(db, DEV_B, ids[100]), 1, 'une autre identité n’est pas touchée');
});

test('suggestions : 5 par jour et par identité', async () => {
  const { db } = await newDb();
  const add = () => db.query(`insert into public.place_suggestions (device_id, title) values ($1, 'Un lieu')`, [DEV_A]);
  for (let i = 0; i < 5; i++) await add();
  await assert.rejects(add(), /5 suggestions par jour/);
  await assert.doesNotReject(db.query(`insert into public.place_suggestions (device_id, title) values ($1, 'Autre')`, [DEV_B]));
});

test('admin : 10 faux codes d’UNE source ne bloquent plus le bon code envoyé d’ailleurs', async () => {
  const { db } = await newDb();
  for (let i = 0; i < 10; i++) assert.equal(await login(db, 'mauvais-code', '203.0.113.9'), false);
  assert.equal(await login(db, GOOD, '203.0.113.9'), false, 'la source fautive est bloquée, même avec le bon code');
  assert.equal(await login(db, GOOD, '198.51.100.7'), true, 'l’équipe, depuis une autre source, entre');
});

test('admin : limite globale de 100 échecs en 15 minutes (essais répartis sur de fausses adresses)', async () => {
  const { db } = await newDb();
  await db.exec(`insert into public.admin_login_attempts (source) select 'ip-' || g from generate_series(1, 100) g`);
  assert.equal(await login(db, GOOD, '198.51.100.7'), false);
  await db.exec(`update public.admin_login_attempts set attempted_at = now() - interval '16 minutes'`);
  assert.equal(await login(db, GOOD, '198.51.100.7'), true);
});

test('journal admin : chaque accès réussi est noté (fonction, source), jamais lisible par la clé publique', async () => {
  const { db } = await newDb();
  await login(db, GOOD, '198.51.100.7');
  await login(db, 'mauvais-code', '198.51.100.7');
  const rows = (await db.query(`select action, source from public.admin_audit_log`)).rows;
  assert.deepEqual(rows, [{ action: '/rpc/verify_admin_access', source: '198.51.100.7' }]);
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(as(db, role, `select * from public.admin_audit_log`), /permission denied/, role);
    await assert.rejects(as(db, role, `select public._request_source()`), /permission denied/, role);
  }
});

test('hors API (SQL Editor) : source « inconnu », aucune erreur ; script relançable', async () => {
  const { db } = await newDb();
  assert.equal((await db.query(`select public._request_source() s`)).rows[0].s, 'inconnu');
  await assert.doesNotReject(db.exec(read('../../src/scripts/023_likes_limits_admin_log.sql')));
});
