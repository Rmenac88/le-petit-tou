// Tests de la migration 010 : notifications « aux couleurs du Petit Tou ».
// PostgreSQL réel (PGlite). L'API Expo est SIMULÉE : on vérifie le message envoyé, pas l'affichage sur un appareil.
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
const m010 = read('../../src/scripts/010_push_style.sql');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const DEV = {
  A: '11111111-1111-4111-8111-111111111111', // Android, nouveaux canaux
  B: '22222222-2222-4222-8222-222222222222', // Android, ancienne version de l'appli
  C: '33333333-3333-4333-8333-333333333333', // iOS
  D: '44444444-4444-4444-8444-444444444444', // Android, nouvelles adresses
};
const TOK = {
  A: 'ExponentPushToken[AAAAAAAAAAAAAAAAAAAAAA]',
  B: 'ExponentPushToken[BBBBBBBBBBBBBBBBBBBBBB]',
  C: 'ExponentPushToken[CCCCCCCCCCCCCCCCCCCCCC]',
  D: 'ExponentPushToken[DDDDDDDDDDDDDDDDDDDDDD]',
};
const DAY = '2026-07-01T10:00:00+02:00';
const DAY_PLUS_5 = '2026-07-01T10:05:00+02:00';
const IMG = 'https://exemple.test/photos/chez-test.jpg';

const NET_STUB = `
  create schema net;
  create table net._http_response (id bigint primary key, status_code integer, content_type text,
    headers jsonb, content text, timed_out boolean, error_msg text, created timestamptz default now());
  create table net._requests (id bigint generated always as identity primary key, url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}',
    headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint
    language plpgsql as $$ declare v bigint; begin insert into net._requests (url, body) values (url, body) returning id into v; return v; end $$;
`;

async function newDb({ withEightZeroTen = true, imageColumns = true } = {}) {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(`alter table public.addresses add column if not exists is_new boolean default false;`);
  if (imageColumns) {
    await db.exec(`alter table public.addresses add column if not exists image_url text;
                   alter table public.events add column if not exists image_url text;`);
  }
  await db.exec(m006);
  await db.exec(NET_STUB);
  await db.exec(m007);
  if (withEightZeroTen) await db.exec(m010);
  return db;
}

async function as(db, role, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const rows = async (db, sql, params = []) => (await db.query(sql, params)).rows;
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const register = (db, dev, tok, plat, ev, ag, ns, v2) =>
  as(db, 'anon', v2 === undefined
    ? `select public.register_push_token($1,$2,$3,$4,$5,$6) r`
    : `select public.register_push_token($1,$2,$3,$4,$5,$6,$7) r`,
    v2 === undefined ? [dev, tok, plat, ev, ag, ns] : [dev, tok, plat, ev, ag, ns, v2]).then((r) => r.rows[0].r);
const tick = async (db, at) => (await one(db, `select public.push_tick($1::timestamptz) r`, [at])).r;
const ageOutbox = (db, at = DAY) => db.query(`update public.push_outbox set created_at = $1::timestamptz`, [at]);
const sentMessages = async (db) =>
  (await rows(db, `select body from net._requests where url like '%/push/send' order by id`)).flatMap((r) => r.body);
const byToken = (msgs, tok) => msgs.filter((m) => m.to === tok);

describe('inscription et compatibilité', () => {
  test('l’ancien appel à 6 paramètres fonctionne toujours ; le 7e annonce les nouveaux canaux ; une seule signature existe', async () => {
    const db = await newDb();
    assert.equal((await register(db, DEV.B, TOK.B, 'android', true, true, false)).success, true);
    assert.equal((await register(db, DEV.A, TOK.A, 'android', true, true, false, true)).success, true);
    const flags = await rows(db, `select device_id, channels_v2 from public.push_devices order by device_id`);
    assert.deepEqual(flags.map((f) => f.channels_v2), [true, false]);
    // l'appli passe à la nouvelle version : le drapeau est mis à jour sans doublon
    await register(db, DEV.B, TOK.B, 'android', true, true, false, true);
    assert.equal((await one(db, `select channels_v2 from public.push_devices where device_id = $1`, [DEV.B])).channels_v2, true);
    assert.equal((await rows(db, `select 1 from pg_proc where proname = 'register_push_token'`)).length, 1);
  });

  test('010 est rejouable et s’applique sur une base qui a déjà l’ancienne signature de 007', async () => {
    const db = await newDb();
    await db.exec(m010);
    await db.exec(m010);
    assert.equal((await rows(db, `select 1 from pg_proc where proname = '_push_enqueue'`)).length, 1);
    assert.equal((await register(db, DEV.A, TOK.A, 'ios', true, true, false)).success, true);
  });

  test('fonctions internes fermées : seule l’inscription est appelable avec la clé publique', async () => {
    const db = await newDb();
    for (const fn of ['_push_style(text)', '_push_decorate_title(text,text)', 'push_send()']) {
      await assert.rejects(as(db, 'anon', `select public.${fn.replace('(text,text)', "('event','x')").replace('(text)', "('event')")}`),
        /permission denied/i, `${fn} ne doit pas être appelable par anon`);
    }
  });
});

describe('style par type de notification (Android et iOS)', () => {
  async function scenario() {
    const db = await newDb();
    await register(db, DEV.A, TOK.A, 'android', true, true, false, true);
    await register(db, DEV.B, TOK.B, 'android', true, true, false); // ancienne appli
    await register(db, DEV.C, TOK.C, 'ios', true, true, false);
    await register(db, DEV.D, TOK.D, 'android', false, false, true, true);
    await db.query(`insert into public.events (title, event_date, image_url) values ('Concert', '2026-08-01', $1)`, [IMG]);
    await db.query(`insert into public.partner_events (spot_id, title, start_date, start_time, is_active)
                    values ('spot-1', 'Soirée jazz', '2026-08-02', '20:00', true)`);
    await db.query(`insert into public.addresses (title, is_new, image_url) values ('Chez Neuf', true, $1)`, [IMG]);
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5);
    return db;
  }

  test('événement : émoji, date, canal dédié, image (Android), sous-titre et regroupement (iOS)', async () => {
    const db = await scenario();
    const msgs = await sentMessages(db);
    const evA = byToken(msgs, TOK.A).find((m) => m.threadId === 'event');
    assert.equal(evA.title, '🎉 Nouvel événement');
    assert.equal(evA.body, 'Concert — le 01/08');
    assert.equal(evA.channelId, 'lpt-events');
    assert.equal(evA.subtitle, 'Événements de l\'association');
    assert.equal(evA.interruptionLevel, 'active');
    assert.equal(evA.priority, 'default');
    assert.deepEqual(evA.richContent, { image: IMG });
    assert.equal(evA.sound, 'default');
    assert.deepEqual(evA.data, { kind: 'event', id: evA.data.id });
  });

  test('agenda : émoji calendrier, canal dédié, pas d’image', async () => {
    const db = await scenario();
    const ag = byToken(await sentMessages(db), TOK.A).find((m) => m.threadId === 'agenda');
    assert.equal(ag.title, '📅 À l\'agenda');
    assert.equal(ag.body, 'Soirée jazz — 02/08');
    assert.equal(ag.channelId, 'lpt-agenda');
    assert.equal(ag.richContent, undefined);
  });

  test('nouvelle adresse : émoji, canal dédié, niveau discret (iOS), image', async () => {
    const db = await scenario();
    const ns = byToken(await sentMessages(db), TOK.D)[0];
    assert.equal(ns.title, '✨ Nouvelle adresse');
    assert.equal(ns.body, 'Chez Neuf');
    assert.equal(ns.channelId, 'lpt-new-spots');
    assert.equal(ns.interruptionLevel, 'passive');
    assert.deepEqual(ns.richContent, { image: IMG });
  });

  test('ancienne version de l’appli : canal « default » partout (un canal inconnu ferait perdre la notification)', async () => {
    const db = await scenario();
    const forLegacy = byToken(await sentMessages(db), TOK.B);
    assert.ok(forLegacy.length >= 2);
    assert.ok(forLegacy.every((m) => m.channelId === 'default'));
    // iOS : le canal est ignoré ; le contenu reste identique à celui d'Android
    const forIos = byToken(await sentMessages(db), TOK.C).find((m) => m.threadId === 'event');
    assert.equal(forIos.title, '🎉 Nouvel événement');
    assert.equal(forIos.subtitle, 'Événements de l\'association');
  });

  test('aucune donnée personnelle dans les messages : ni identifiant d’appareil, ni autre jeton', async () => {
    const db = await scenario();
    const raw = JSON.stringify(await sentMessages(db));
    for (const id of Object.values(DEV)) assert.ok(!raw.includes(id), `identifiant ${id} présent dans le message`);
    for (const m of await sentMessages(db)) {
      assert.deepEqual(
        Object.keys(m).filter((k) => !['to', 'title', 'subtitle', 'body', 'data', 'sound', 'priority', 'ttl', 'channelId', 'threadId', 'interruptionLevel', 'richContent'].includes(k)),
        [], 'champ inattendu');
    }
  });
});

describe('cas limites', () => {
  test('images : seules les adresses https sont acceptées ; regroupement de nouvelles adresses sans image', async () => {
    const db = await newDb();
    await register(db, DEV.D, TOK.D, 'android', false, false, true, true);
    for (const [i, url] of ['http://exemple.test/a.jpg', 'javascript:alert(1)', 'https://exemple.test/avec espace.jpg', ''].entries()) {
      await db.query(`insert into public.events (title, event_date, image_url) values ($1, '2026-08-01', $2)`, ['Evt ' + i, url]);
    }
    const stored = await rows(db, `select image_url from public.push_outbox where kind = 'event' order by id`);
    assert.deepEqual(stored.map((r) => r.image_url), [null, null, null, null]);

    await db.query(`insert into public.addresses (title, is_new, image_url) values ('Un', true, $1), ('Deux', true, $1)`, [IMG]);
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5);
    const grouped = byToken(await sentMessages(db), TOK.D);
    assert.equal(grouped.length, 1);
    assert.equal(grouped[0].title, '✨ 2 nouvelles adresses');
    assert.equal(grouped[0].richContent, undefined, 'l’image d’une seule adresse ne doit pas illustrer un regroupement');
  });

  test('événement sans date : le texte reste le titre seul ; table sans colonne image : rien ne casse', async () => {
    const db = await newDb({ imageColumns: false });
    await db.query(`insert into public.events (title) values ('Sans date')`);
    const o = await one(db, `select body, image_url from public.push_outbox where kind = 'event'`);
    assert.equal(o.body, 'Sans date');
    assert.equal(o.image_url, null);
  });

  test('annonce admin : émoji ajouté seulement s’il manque ; canal et priorité dédiés', async () => {
    const db = await newDb();
    await register(db, DEV.A, TOK.A, 'android', true, true, false, true);
    const send = (title) => as(db, 'anon', `select public.admin_send_push($1,$2,'Message') r`, [GOOD_CODE, title]).then((r) => r.rows[0].r);
    assert.equal((await send('Fermeture exceptionnelle')).ok, true);
    assert.equal((await send('🎁 Cadeau pour tous')).ok, true);
    assert.equal((await send('★ Soldes')).ok, true);
    assert.equal((await send('Éclipse ce soir')).ok, true); // accent : pas un émoji
    await ageOutbox(db);
    await tick(db, DAY_PLUS_5);
    const titles = byToken(await sentMessages(db), TOK.A).map((m) => m.title);
    assert.deepEqual(titles.sort(), ['★ Soldes', '📣 Fermeture exceptionnelle', '📣 Éclipse ce soir', '🎁 Cadeau pour tous'].sort());
    const msg = byToken(await sentMessages(db), TOK.A)[0];
    assert.equal(msg.channelId, 'lpt-announcements');
    assert.equal(msg.priority, 'high');
    assert.equal(msg.subtitle, 'Message du Petit Tou');
    // le titre stocké reste celui saisi par l'admin (le décor n'est ajouté qu'à l'envoi)
    assert.equal((await one(db, `select title from public.push_outbox order by id limit 1`)).title, 'Fermeture exceptionnelle');
  });

  test('styles : quatre types connus, tout type inconnu retombe sur « annonce »', async () => {
    const db = await newDb();
    const s = async (k) => (await one(db, `select public._push_style($1) s`, [k])).s;
    assert.equal((await s('event')).channel, 'lpt-events');
    assert.equal((await s('agenda')).channel, 'lpt-agenda');
    assert.equal((await s('new_spot')).channel, 'lpt-new-spots');
    assert.equal((await s('announcement')).channel, 'lpt-announcements');
    assert.equal((await s('autre')).channel, 'lpt-announcements');
  });
});
