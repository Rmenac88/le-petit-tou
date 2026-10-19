// Tests de la chaîne de notifications (migration 007) sur PostgreSQL réel (PGlite).
// IMPORTANT : l'appel réseau vers l'API Expo est SIMULÉ (net.http_post enregistre la requête, les réponses
// d'Expo sont préparées dans le test). Ces tests prouvent la logique serveur (règles, anti-doublon, plafond,
// reprises, invalidation des jetons) ; ils ne prouvent PAS qu'une notification s'affiche sur un téléphone.
import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const baseline = readFileSync(new URL('baseline.sql', here), 'utf8');
const m006 = readFileSync(new URL('../../src/scripts/006_security_lockdown.sql', here), 'utf8');
const m007 = readFileSync(new URL('../../src/scripts/007_push_notifications.sql', here), 'utf8');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const DEV_A = '11111111-1111-4111-8111-111111111111';
const DEV_B = '22222222-2222-4222-8222-222222222222';
const DEV_C = '33333333-3333-4333-8333-333333333333';
const TOK_A = 'ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]';
const TOK_B = 'ExponentPushToken[BBBBBBBBBBBBBBBBBBBBBB]';
const TOK_C = 'ExponentPushToken[CCCCCCCCCCCCCCCCCCCCCC]';
// Un jour d'été (Paris = UTC+2) : 10h05 = hors heures calmes ; 23h = heures calmes
const DAY = '2026-07-01T10:00:00+02:00';
const DAY_PLUS_5 = '2026-07-01T10:05:00+02:00';
const NIGHT = '2026-07-01T23:00:00+02:00';

const NET_STUB = `
  create schema net;
  create table net._http_response (id bigint primary key, status_code integer, content_type text,
    headers jsonb, content text, timed_out boolean, error_msg text, created timestamptz default now());
  create table net._requests (id bigint generated always as identity primary key, url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint
    language plpgsql as $$ declare v bigint; begin insert into net._requests (url, body) values (url, body) returning id into v; return v; end $$;
`;

async function newDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(`alter table public.addresses add column if not exists is_new boolean default false;`);
  await db.exec(`insert into public.addresses (id, title) values ('aaaaaaaa-0000-4000-8000-000000000001', 'Adresse existante');`);
  await db.exec(m006);
  await db.exec(NET_STUB);
  await db.exec(m007);
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
const denied = (p) => assert.rejects(p, /permission denied|row-level security|violates/i);
const register = (db, dev, tok, plat = 'ios', ev = true, ag = true, ns = false) =>
  as(db, 'anon', `select public.register_push_token($1,$2,$3,$4,$5,$6) r`, [dev, tok, plat, ev, ag, ns]).then((r) => r.rows[0].r);
const tick = async (db, at) => (await db.query(`select public.push_tick($1::timestamptz) r`, [at])).rows[0].r;
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const addEvent = (db, title, at = DAY) =>
  db.query(`insert into public.events (title, event_date, created_at) values ($1, '2026-08-01', $2) returning id`, [title, at]);
async function ageOutbox(db, at = DAY) {
  await db.query(`update public.push_outbox set created_at = $1::timestamptz`, [at]);
}

describe('enregistrement des appareils', () => {
  let db;
  before(async () => { db = await newDb(); });

  test('tables fermées : aucun accès direct', async () => {
    for (const t of ['push_devices', 'push_outbox', 'push_deliveries', 'push_requests']) {
      await denied(as(db, 'anon', `select * from public.${t}`));
      await denied(as(db, 'authenticated', `insert into public.${t} default values`));
    }
  });
  test('refuse identité, jeton et plateforme invalides', async () => {
    assert.equal((await register(db, 'x', TOK_A)).error, 'IDENTITE_INVALIDE');
    assert.equal((await register(db, DEV_A, 'pas-un-jeton')).error, 'JETON_INVALIDE');
    assert.equal((await register(db, DEV_A, "ExponentPushToken[x'); drop table public.events;--]")).error, 'JETON_INVALIDE');
    assert.equal((await register(db, DEV_A, TOK_A, 'windows')).error, 'PLATEFORME_INVALIDE');
    assert.equal((await rows(db, `select count(*)::int n from public.push_devices`))[0].n, 0);
  });
  test('enregistre, met à jour les préférences, lit, désenregistre', async () => {
    assert.equal((await register(db, DEV_A, TOK_A, 'ios')).success, true);
    assert.deepEqual((await as(db, 'anon', `select public.get_push_preferences($1) r`, [DEV_A])).rows[0].r,
      { registered: true, notify_events: true, notify_agenda: true, notify_new_spots: false });
    const up = (await as(db, 'anon', `select public.update_push_preferences($1, false, true, true) r`, [DEV_A])).rows[0].r;
    assert.equal(up.success, true);
    const p = (await as(db, 'anon', `select public.get_push_preferences($1) r`, [DEV_A])).rows[0].r;
    assert.equal(p.notify_events, false);
    assert.equal(p.notify_new_spots, true);
    assert.equal((await as(db, 'anon', `select public.update_push_preferences($1, true, true, true) r`, [DEV_B])).rows[0].r.error, 'NON_ENREGISTRE');
    assert.equal((await as(db, 'anon', `select public.unregister_push_token($1) r`, [DEV_A])).rows[0].r.success, true);
    assert.equal((await as(db, 'anon', `select public.get_push_preferences($1) r`, [DEV_A])).rows[0].r.registered, false);
  });
  test('un jeton ne reste que sur un appareil ; ré-enregistrement idempotent', async () => {
    await register(db, DEV_A, TOK_A);
    await register(db, DEV_A, TOK_A);
    await register(db, DEV_B, TOK_A, 'android');
    const r = await rows(db, `select device_id, platform from public.push_devices`);
    assert.deepEqual(r, [{ device_id: DEV_B, platform: 'android' }]);
  });
  test('delete_my_data efface aussi le jeton push', async () => {
    await as(db, 'anon', `select public.delete_my_data($1)`, [DEV_B]);
    assert.equal((await rows(db, `select count(*)::int n from public.push_devices`))[0].n, 0);
  });
});

describe('détection des événements métier (triggers)', () => {
  test('événement, date d’agenda et nouvelle adresse créent chacun un message, une seule fois', async () => {
    const db = await newDb();
    await db.exec(`insert into public.events (id, title, event_date) values ('eeeeeeee-0000-4000-8000-000000000001', 'Soirée jazz', '2026-08-01')`);
    await db.exec(`insert into public.partner_events (id, spot_id, title, start_date) values ('dddddddd-0000-4000-8000-000000000001', 's1', 'Karaoké', '2026-09-03')`);
    await db.exec(`insert into public.addresses (id, title, is_new) values ('aaaaaaaa-0000-4000-8000-000000000002', 'Café neuf', true)`);
    const o = await rows(db, `select kind, title, body, data from public.push_outbox order by id`);
    assert.deepEqual(o.map((r) => r.kind), ['event', 'agenda', 'new_spot']);
    assert.equal(o[0].body, 'Soirée jazz');
    assert.equal(o[1].body, 'Karaoké — 03/09');
    assert.equal(o[2].body, 'Café neuf');
    assert.equal(o[0].data.kind, 'event');
    // mise à jour d'une ligne existante : aucun nouveau message (trigger sur INSERT seulement)
    await db.exec(`update public.events set title = 'Soirée jazz 2' where id = 'eeeeeeee-0000-4000-8000-000000000001'`);
    assert.equal((await rows(db, `select count(*)::int n from public.push_outbox`))[0].n, 3);
  });
  test('date d’agenda désactivée et adresse non « nouvelle » : aucun message', async () => {
    const db = await newDb();
    await db.exec(`insert into public.partner_events (spot_id, title, start_date, is_active) values ('s1', 'Caché', '2026-09-03', false)`);
    await db.exec(`insert into public.addresses (title, is_new) values ('Ancienne', false)`);
    assert.equal((await rows(db, `select count(*)::int n from public.push_outbox`))[0].n, 0);
  });
  test('une panne de la file de notifications ne bloque JAMAIS la création de contenu', async () => {
    const db = await newDb();
    await db.exec(`alter table public.push_outbox add constraint casse check (false) not valid`);
    const r = await addEvent(db, 'Doit exister quand même');
    assert.ok(r.rows[0].id);
    assert.equal((await rows(db, `select count(*)::int n from public.events where title = 'Doit exister quand même'`))[0].n, 1);
  });
  test('texte long tronqué, jamais de donnée personnelle dans le message', async () => {
    const db = await newDb();
    await addEvent(db, 'x'.repeat(400));
    const o = (await rows(db, `select title, body from public.push_outbox`))[0];
    assert.ok(o.body.length <= 140 && o.title.length <= 60);
  });
});

describe('distribution : destinataires, délai, heures calmes, plafond', () => {
  test('préférences respectées, jetons invalides exclus', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A, 'ios', true, true, false);
    await register(db, DEV_B, TOK_B, 'android', false, true, false); // refuse les événements
    await register(db, DEV_C, TOK_C, 'ios', true, true, false);
    await db.exec(`update public.push_devices set invalid_at = now() where device_id = '${DEV_C}'`);
    await addEvent(db, 'Concert');
    await ageOutbox(db);
    const t = await tick(db, DAY_PLUS_5);
    assert.equal(t.fanout, 1);
    const d = await rows(db, `select device_id from public.push_deliveries`);
    assert.deepEqual(d.map((x) => x.device_id), [DEV_A]);
  });
  test('délai de regroupement de 2 minutes', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A);
    await addEvent(db, 'Trop tôt');
    await ageOutbox(db, DAY);
    assert.equal((await tick(db, '2026-07-01T10:01:00+02:00')).fanout, 0);
    assert.equal((await tick(db, '2026-07-01T10:03:00+02:00')).fanout, 1);
  });
  test('heures calmes : rien la nuit, envoi le matin', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A);
    await addEvent(db, 'Nocturne');
    await ageOutbox(db, '2026-07-01T20:50:00+02:00');
    assert.equal((await tick(db, NIGHT)).fanout, 0);
    assert.equal((await tick(db, '2026-07-02T07:59:00+02:00')).fanout, 0);
    assert.equal((await rows(db, `select status from public.push_outbox`))[0].status, 'pending');
    // le lendemain à 8h05 : le message a plus de 24 h ? non (11 h) => envoyé
    assert.equal((await tick(db, '2026-07-02T08:05:00+02:00')).fanout, 1);
  });
  test('message périmé (> 24 h) jamais envoyé en retard', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A);
    await addEvent(db, 'Périmé');
    await ageOutbox(db, '2026-06-29T10:00:00+02:00');
    assert.equal((await tick(db, DAY_PLUS_5)).fanout, 0);
    assert.equal((await rows(db, `select status from public.push_outbox`))[0].status, 'skipped');
  });
  test('plafond : 2 notifications maximum par appareil et par 24 h', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A);
    for (const t of ['E1', 'E2', 'E3', 'E4']) await addEvent(db, t);
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5);
    assert.equal((await rows(db, `select count(*)::int n from public.push_deliveries`))[0].n, 2);
  });
  test('plusieurs nouvelles adresses regroupées en un seul message (opt-in)', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A, 'ios', true, true, true);
    await register(db, DEV_B, TOK_B, 'ios', true, true, false); // pas d'opt-in nouvelles adresses
    for (let i = 0; i < 5; i++) await db.query(`insert into public.addresses (title, is_new) values ($1, true)`, ['Adresse ' + i]);
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5);
    const d = await rows(db, `select d.device_id, o.title from public.push_deliveries d join public.push_outbox o on o.id = d.outbox_id`);
    assert.deepEqual(d, [{ device_id: DEV_A, title: '5 nouvelles adresses' }]);
  });
  test('idempotence : repasser le planificateur ne crée ni doublon ni nouvel envoi', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A);
    await addEvent(db, 'Une fois');
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5);
    await tick(db, DAY_PLUS_5);
    await tick(db, DAY_PLUS_5);
    assert.equal((await rows(db, `select count(*)::int n from public.push_deliveries`))[0].n, 1);
    assert.equal((await rows(db, `select count(*)::int n from net._requests`))[0].n, 1);
  });
});

describe('envoi, tickets, reprises, reçus (réponses Expo SIMULÉES)', () => {
  async function setup() {
    const db = await newDb();
    await register(db, DEV_A, TOK_A, 'ios');
    await register(db, DEV_B, TOK_B, 'android');
    await addEvent(db, 'Soirée');
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5);
    return db;
  }
  const respond = (db, id, status, content) =>
    db.query(`insert into net._http_response (id, status_code, content) values ($1, $2, $3)`, [id, status, content]);

  test('requête vers l’API Expo : lot, destinataires, contenu minimal', async () => {
    const db = await setup();
    const req = (await rows(db, `select url, body from net._requests`))[0];
    assert.equal(req.url, 'https://exp.host/--/api/v2/push/send');
    assert.equal(req.body.length, 2);
    assert.deepEqual(req.body.map((m) => m.to).sort(), [TOK_A, TOK_B]);
    const m = req.body[0];
    assert.equal(m.title, 'Nouvel événement');
    assert.equal(m.body, 'Soirée');
    assert.deepEqual(Object.keys(m).sort(), ['body', 'channelId', 'data', 'sound', 'title', 'to', 'ttl']);
    assert.ok(!JSON.stringify(req.body).includes(DEV_A), "l'identifiant d'appareil ne part jamais chez le fournisseur");
    assert.deepEqual((await rows(db, `select distinct status from public.push_deliveries`)).map((r) => r.status), ['queued']);
  });
  test('tickets : ok => envoyé ; DeviceNotRegistered => jeton invalidé', async () => {
    const db = await setup();
    const id = (await rows(db, `select request_id from public.push_requests`))[0].request_id;
    await respond(db, id, 200, JSON.stringify({ data: [
      { status: 'ok', id: 'ticket-1' },
      { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } }] }));
    await tick(db, DAY_PLUS_5);
    const d = await rows(db, `select d.status, d.ticket_id, d.token from public.push_deliveries d order by d.id`);
    assert.equal(d[0].status, 'sent');
    assert.equal(d[0].ticket_id, 'ticket-1');
    assert.equal(d[1].status, 'invalid_token');
    const dev = await rows(db, `select token, invalid_at is not null as inv from public.push_devices order by device_id`);
    assert.deepEqual(dev.map((x) => x.inv), [false, true]);
  });
  test('erreur serveur : 3 tentatives puis échec définitif', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A);
    await addEvent(db, 'Panne fournisseur');
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const id = (await rows(db, `select request_id from public.push_deliveries`))[0].request_id;
      await respond(db, id, 503, 'Service Unavailable');
      await tick(db, DAY_PLUS_5);
      const st = (await rows(db, `select status, attempts from public.push_deliveries`))[0];
      if (attempt < 3) {
        assert.equal(st.status, 'queued', `tentative ${attempt + 1} déjà renvoyée dans le même passage`);
        assert.equal(st.attempts, attempt + 1);
      } else {
        assert.equal(st.status, 'failed');
      }
    }
    assert.equal((await rows(db, `select count(*)::int n from net._requests`))[0].n, 3);
  });
  test('aucune réponse après 10 min : nouvelle tentative', async () => {
    const db = await setup();
    // l'horloge du test est fictive (juillet 2026) : on date la requête au moment de l'envoi simulé
    await db.query(`update public.push_requests set created_at = $1::timestamptz`, [DAY_PLUS_5]);
    await tick(db, '2026-07-01T10:20:00+02:00');
    const d = await rows(db, `select status, attempts from public.push_deliveries order by id`);
    assert.deepEqual(d.map((x) => x.attempts), [2, 2]);
  });
  test('reçus à 15 min : ok => receipt_ok ; erreur => receipt_error + jeton invalidé', async () => {
    const db = await setup();
    const id = (await rows(db, `select request_id from public.push_requests`))[0].request_id;
    await respond(db, id, 200, JSON.stringify({ data: [{ status: 'ok', id: 'tk-A' }, { status: 'ok', id: 'tk-B' }] }));
    await tick(db, DAY_PLUS_5);
    assert.equal((await tick(db, '2026-07-01T10:10:00+02:00')).receipts, 0, 'trop tôt');
    const t = await tick(db, '2026-07-01T10:30:00+02:00');
    assert.equal(t.receipts, 2);
    const rq = (await rows(db, `select url, body from net._requests order by id desc limit 1`))[0];
    assert.equal(rq.url, 'https://exp.host/--/api/v2/push/getReceipts');
    assert.deepEqual(rq.body.ids.sort(), ['tk-A', 'tk-B']);
    const rid = (await rows(db, `select request_id from public.push_requests where kind = 'receipts'`))[0].request_id;
    await respond(db, rid, 200, JSON.stringify({ data: {
      'tk-A': { status: 'ok' },
      'tk-B': { status: 'error', message: 'x', details: { error: 'DeviceNotRegistered' } } } }));
    await tick(db, '2026-07-01T10:31:00+02:00');
    const d = await rows(db, `select ticket_id, status from public.push_deliveries order by id`);
    assert.deepEqual(d, [{ ticket_id: 'tk-A', status: 'receipt_ok' }, { ticket_id: 'tk-B', status: 'receipt_error' }]);
    assert.equal((await rows(db, `select count(*)::int n from public.push_devices where invalid_at is not null`))[0].n, 1);
    assert.equal((await tick(db, '2026-07-01T10:40:00+02:00')).receipts, 0, 'reçus déjà traités : pas de nouvelle requête');
  });
});

describe('annonces et statistiques admin', () => {
  test('annonce : code obligatoire, longueurs bornées, hors plafond, heures calmes respectées', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A);
    const call = (code, t, b) => as(db, 'anon', `select public.admin_send_push($1,$2,$3) r`, [code, t, b]).then((r) => r.rows[0].r);
    assert.equal((await call('mauvais', 'Titre', 'Message')).error, 'forbidden');
    assert.match((await call(GOOD_CODE, '', 'Message')).error, /invalid/);
    assert.match((await call(GOOD_CODE, 'T', 'm'.repeat(141))).error, /invalid/);
    for (const t of ['E1', 'E2']) await addEvent(db, t);
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5); // plafond atteint par les 2 événements
    const ok = await call(GOOD_CODE, 'Fermeture exceptionnelle', 'Rendez-vous demain');
    assert.deepEqual(ok, { ok: true, recipients: 1 });
    await db.query(`update public.push_outbox set created_at = $1::timestamptz where kind = 'announcement'`, [DAY_PLUS_5]);
    assert.equal((await tick(db, NIGHT)).fanout, 0);
    assert.equal((await tick(db, '2026-07-01T10:06:00+02:00')).fanout, 1, "l'annonce part malgré le plafond");
  });
  test('statistiques réservées à l’admin', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A, 'ios');
    await register(db, DEV_B, TOK_B, 'android');
    assert.equal((await as(db, 'anon', `select public.admin_push_stats('faux') r`)).rows[0].r.ok, false);
    const s = (await as(db, 'anon', `select public.admin_push_stats($1) r`, [GOOD_CODE])).rows[0].r;
    assert.deepEqual([s.ok, s.devices, s.ios, s.android], [true, 2, 1, 1]);
  });
});

describe('conservation et purge', () => {
  test('purge : journaux > 30 j, consultations > 13 mois, appareils inactifs > 24 mois ; le récent est conservé', async () => {
    const db = await newDb();
    await register(db, DEV_A, TOK_A);
    await addEvent(db, 'Vieux');
    await ageOutbox(db, '2026-05-01T10:00:00+02:00');
    await db.exec(`insert into public.push_deliveries (outbox_id, device_id, token, created_at)
                   select id, '${DEV_A}', '${TOK_A}', '2026-05-01T10:00:00+02:00' from public.push_outbox`);
    await db.exec(`insert into public.address_views (spot_id, viewed_at) values ('s', '2025-01-01'), ('s', '2026-06-20')`);
    await db.exec(`insert into public.user_place_discoveries (device_id, place_id, created_at)
                   values ('${DEV_B}', 'p1', '2023-01-01'), ('${DEV_C}', 'p1', '2026-06-01')`);
    const r = (await rows(db, `select public.purge_old_data('2026-07-01T10:00:00+02:00') r`))[0].r;
    assert.equal(r.push_deliveries, 1);
    assert.equal(r.push_outbox, 1);
    assert.equal(r.address_views, 1);
    assert.equal(r.inactive_devices, 1);
    const left = await rows(db, `select device_id from public.user_place_discoveries`);
    assert.deepEqual(left.map((x) => x.device_id), [DEV_C]);
    assert.equal((await rows(db, `select count(*)::int n from public.address_views`))[0].n, 1);
  });
});

describe('migration', () => {
  test('007 rejouable', async () => {
    const db = await newDb();
    await db.exec(m007);
    await db.exec(m007);
  });
});
