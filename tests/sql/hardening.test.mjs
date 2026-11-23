// 021 : durcissement (jeton de notification borné, admin_users fermée). PostgreSQL réel (PGlite).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
const NET_STUB = `
  create schema net;
  create table net._http_response (id bigint primary key, status_code integer, content_type text,
    headers jsonb, content text, timed_out boolean, error_msg text, created timestamptz default now());
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint
    language plpgsql as $$ begin return 1; end $$;
`;
const DEV = '11111111-1111-4111-8111-111111111111';
const DEV2 = '22222222-2222-4222-8222-222222222222';

async function newDb({ preexisting } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(read('baseline.sql'));
  await db.exec(`alter table public.addresses add column if not exists is_new boolean default false;`);
  await db.exec(read('../../src/scripts/006_security_lockdown.sql'));
  await db.exec(NET_STUB);
  await db.exec(read('../../src/scripts/007_push_notifications.sql'));
  await db.exec(`grant select on public.admin_users to anon, authenticated;`); // état constaté en production (S2-14)
  if (preexisting) {
    await db.query(`insert into public.push_devices (device_id, token, platform) values ($1, $2, 'android')`, [DEV2, preexisting]);
  }
  await db.exec(read('../../src/scripts/021_hardening.sql'));
  return db;
}
async function as(db, role, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const register = (db, token) =>
  as(db, 'anon', `select public.register_push_token($1, $2, 'android', true, true, false) r`, [DEV, token]).then((r) => r.rows[0].r);

test('un vrai jeton Expo s’inscrit toujours', async () => {
  const db = await newDb();
  const r = await register(db, 'ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]');
  assert.notEqual(r?.success ?? r?.ok, false, JSON.stringify(r));
  assert.equal((await db.query(`select count(*)::int n from public.push_devices`)).rows[0].n, 1);
});

test('un « jeton » géant est refusé et rien n’est écrit', async () => {
  const db = await newDb();
  const huge = 'ExponentPushToken[' + 'A'.repeat(5000) + ']';
  await register(db, huge).catch(() => null);
  assert.equal((await db.query(`select count(*)::int n from public.push_devices where char_length(token) > 256`)).rows[0].n, 0);
});

test('admin_users n’est plus lisible avec la clé publique', async () => {
  const db = await newDb();
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(as(db, role, `select * from public.admin_users`), /permission denied/, role);
  }
});

test('une ancienne ligne trop longue ne bloque pas la migration (règle pour la suite seulement), et le script est relançable', async () => {
  const db = await newDb({ preexisting: 'X'.repeat(400) });
  assert.equal((await db.query(`select count(*)::int n from public.push_devices`)).rows[0].n, 1, 'aucune donnée supprimée');
  await assert.doesNotReject(db.exec(read('../../src/scripts/021_hardening.sql')));
});
