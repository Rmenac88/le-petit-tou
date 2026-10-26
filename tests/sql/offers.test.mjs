// Tests de la migration 013 : offres et réductions (onglet « - % »), gérées depuis le portail admin.
// PostgreSQL réel (PGlite) : lecture publique limitée aux offres actives et non expirées, aucune écriture directe,
// gestion par code admin, validations côté serveur.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');
const baseline = read('baseline.sql');
const m006 = read('../../src/scripts/006_security_lockdown.sql');
const m013 = read('../../src/scripts/013_offers.sql');

const GOOD_CODE = 'Code-De-Test-Synthetique-01';
const BAD_CODE = 'mauvais-code-de-test';
const A1 = 'aaaaaaaa-0000-4000-8000-000000000001';

async function newDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(baseline);
  await db.exec(m006);
  await db.exec(m013);
  await db.query(`insert into public.addresses (id, title) values ($1, 'Chez Un')`, [A1]);
  return db;
}
async function as(db, role, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  await db.exec(`set role ${role}`);
  try { return await db.query(sql, params); } finally { await db.exec('reset role'); }
}
const one = async (db, sql, params = []) => (await db.query(sql, params)).rows[0];
const save = (db, code, offer) => as(db, 'anon', `select public.admin_save_offer($1, $2::jsonb) r`, [code, JSON.stringify(offer)]).then((r) => r.rows[0].r);
const list = (db, code) => as(db, 'anon', `select public.admin_list_offers($1) r`, [code]).then((r) => r.rows[0].r);
const del = (db, code, id) => as(db, 'anon', `select public.admin_delete_offer($1, $2) r`, [code, id]).then((r) => r.rows[0].r);
const shift = async (db, days) => (await one(db, `select to_char((now() at time zone 'Europe/Paris')::date + $1::int, 'YYYY-MM-DD') d`, [days])).d;
const good = { title: 'Chez Un', discount_value: '-20%' };

describe('lecture publique : seulement les offres actives et non expirées', () => {
  test('inactives et expirées invisibles ; « jusqu\'au jour J » reste valable toute la journée J', async () => {
    const db = await newDb();
    const make = async (title, extra) => { const r = await save(db, GOOD_CODE, { ...good, title, ...extra }); assert.equal(r.ok, true, JSON.stringify(r)); return r.offer; };
    await make('sans-fin', {});
    await make('finit-aujourdhui', { valid_until: await shift(db, 0) });
    await make('finit-demain', { valid_until: await shift(db, 1) });
    const expired = await make('finit-hier', { valid_until: await shift(db, -1) });
    await make('desactivee', { is_active: false });
    const names = async (role) => (await as(db, role, `select title from public.discount_cards order by title`)).rows.map((r) => r.title);
    assert.deepEqual(await names('anon'), ['finit-aujourdhui', 'finit-demain', 'sans-fin']);
    assert.deepEqual(await names('authenticated'), ['finit-aujourdhui', 'finit-demain', 'sans-fin']);
    // l'admin voit tout, avec l'état « expirée »
    const all = await list(db, GOOD_CODE);
    assert.equal(all.offers.length, 5);
    assert.equal(all.offers.find((o) => o.id === expired.id).expired, true);
    assert.equal(all.offers.find((o) => o.title === 'finit-aujourdhui').expired, false);
    assert.equal(all.offers.find((o) => o.title === 'finit-aujourdhui').valid_until_date, await shift(db, 0));
  });

  test('aucune écriture directe, ni par anon ni par authenticated', async () => {
    const db = await newDb();
    await save(db, GOOD_CODE, good);
    for (const role of ['anon', 'authenticated']) {
      await assert.rejects(as(db, role, `insert into public.discount_cards (title, discount_value) values ('x', 'y')`), /permission denied|row-level security/i);
      await assert.rejects(as(db, role, `update public.discount_cards set title = 'piraté'`), /permission denied|row-level security/i);
      await assert.rejects(as(db, role, `delete from public.discount_cards`), /permission denied|row-level security/i);
    }
    assert.equal((await one(db, `select title from public.discount_cards`)).title, 'Chez Un');
  });
});

describe('gestion par code admin', () => {
  test('sans le bon code : refus pour les trois fonctions', async () => {
    const db = await newDb();
    for (const code of [BAD_CODE, '', null, '   ']) {
      assert.deepEqual(await save(db, code, good), { ok: false, error: 'forbidden' });
      assert.deepEqual(await list(db, code), { ok: false, error: 'forbidden' });
      assert.deepEqual(await del(db, code, '11111111-1111-4111-8111-111111111111'), { ok: false, error: 'forbidden' });
    }
    assert.equal((await one(db, `select count(*)::int n from public.discount_cards`)).n, 0);
  });

  test('verrouillage anti force brute partagé avec le reste du portail', async () => {
    const db = await newDb();
    for (let i = 0; i < 10; i++) await list(db, BAD_CODE);
    assert.equal((await save(db, GOOD_CODE, good)).ok, false);
    await db.exec(`update public.admin_login_attempts set attempted_at = now() - interval '16 minutes'`);
    assert.equal((await save(db, GOOD_CODE, good)).ok, true);
  });

  test('création avec valeurs par défaut, modification complète, suppression avec ses compteurs', async () => {
    const db = await newDb();
    const created = await save(db, GOOD_CODE, good);
    assert.equal(created.ok, true);
    const o = created.offer;
    assert.equal(o.category, 'food');
    assert.equal(o.max_uses, 5);
    assert.equal(o.badge_label, 'MEMBRE PETIT TOU');
    assert.equal(o.card_color_primary, '#C93049');
    assert.equal(o.is_active, true);
    assert.equal(o.valid_until, null);
    assert.match(o.terms, /Valable 1 fois par visite/);

    const updated = await save(db, GOOD_CODE, {
      id: o.id, title: 'Chez Un — Brunch', subtitle: 'Capitole', category: 'drinks', discount_value: '1 café offert',
      badge_label: 'PAUSE', description: 'Un café offert.', terms: 'Le dimanche.', max_uses: 3,
      card_color_primary: '#112233', card_color_secondary: '#aabbcc', visual_url: 'https://exemple.fr/a.jpg',
      partner_id: A1, valid_until: await shift(db, 30), sort_order: -5, is_active: true,
    });
    assert.equal(updated.ok, true, JSON.stringify(updated));
    assert.equal(updated.offer.title, 'Chez Un — Brunch');
    assert.equal(updated.offer.partner_id, A1);
    assert.equal(updated.offer.sort_order, -5);
    assert.equal((await one(db, `select count(*)::int n from public.discount_cards`)).n, 1);

    // des utilisations existent : l'admin les voit, la suppression les emporte
    await db.query(`insert into public.user_discount_cards (device_id, discount_card_id, uses_count) values ('d1', $1, 2), ('d2', $1, 1)`, [o.id]);
    await db.query(`insert into public.discount_card_uses (device_id, discount_card_id) values ('d1', $1)`, [o.id]);
    assert.equal((await list(db, GOOD_CODE)).offers[0].uses_total, 3);
    assert.deepEqual(await del(db, GOOD_CODE, o.id), { ok: true, deleted: 1 });
    assert.deepEqual(await del(db, GOOD_CODE, o.id), { ok: true, deleted: 0 });
    assert.equal((await one(db, `select count(*)::int n from public.user_discount_cards`)).n, 0);
    assert.equal((await one(db, `select count(*)::int n from public.discount_card_uses`)).n, 0);
  });

  test('ordre d\'affichage : sort_order puis le plus récent', async () => {
    const db = await newDb();
    await save(db, GOOD_CODE, { ...good, title: 'B', sort_order: 0 });
    await save(db, GOOD_CODE, { ...good, title: 'A', sort_order: -1 });
    await save(db, GOOD_CODE, { ...good, title: 'C', sort_order: 0 });
    assert.deepEqual((await list(db, GOOD_CODE)).offers.map((o) => o.title), ['A', 'C', 'B']);
  });
});

describe('validations côté serveur (jamais d\'exception brute vers l\'appli)', () => {
  const bad = [
    ['titre vide', { title: '   ' }, /nom de l'offre/],
    ['titre trop long', { title: 'x'.repeat(81) }, /nom de l'offre/],
    ['sous-titre trop long', { subtitle: 'x'.repeat(81) }, /sous-titre/],
    ['catégorie inconnue', { category: 'casino' }, /catégorie/],
    ['avantage vide', { discount_value: '' }, /avantage/],
    ['avantage trop long', { discount_value: 'x'.repeat(41) }, /avantage/],
    ['badge trop long', { badge_label: 'x'.repeat(31) }, /badge/],
    ['description trop longue', { description: 'x'.repeat(401) }, /400 caractères/],
    ['conditions trop longues', { terms: 'x'.repeat(401) }, /400 caractères/],
    ['0 utilisation', { max_uses: 0 }, /utilisations/],
    ['100 utilisations', { max_uses: 100 }, /utilisations/],
    ['utilisations illisibles', { max_uses: 'beaucoup' }, /utilisations/],
    ['ordre illisible', { sort_order: 'x' }, /ordre/],
    ['couleur invalide', { card_color_primary: 'rouge' }, /couleurs/],
    ['couleur piégée', { card_color_secondary: '#12345; drop table x' }, /couleurs/],
    ['image http', { visual_url: 'http://exemple.fr/a.jpg' }, /https/],
    ['image javascript', { visual_url: 'javascript:alert(1)' }, /https/],
    ['image avec espace', { visual_url: 'https://exemple.fr/a b.jpg' }, /https/],
    ['image trop longue', { visual_url: 'https://e.fr/' + 'a'.repeat(500) }, /https/],
    ['adresse inconnue', { partner_id: 'nexistepas' }, /adresse n'existe pas/],
    ['date mal écrite', { valid_until: '31/12/2027' }, /AAAA-MM-JJ/],
    ['date impossible', { valid_until: '2027-02-31' }, /calendrier/],
    ['date trop lointaine', { valid_until: '2099-01-01' }, /lointaine/],
    ['actif illisible', { is_active: 'peut-être' }, /vrai ou faux/],
    ['identifiant illisible', { id: 'pas-un-uuid' }, /identifiant/],
  ];
  for (const [name, patch, re] of bad) {
    test(name, async () => {
      const db = await newDb();
      const r = await save(db, GOOD_CODE, { ...good, ...patch });
      assert.equal(r.ok, false, JSON.stringify(r));
      assert.match(r.error, /^invalid: /);
      assert.match(r.error, re);
      assert.equal((await one(db, `select count(*)::int n from public.discount_cards`)).n, 0);
    });
  }

  test('modifier une offre qui n\'existe plus ; enregistrement non objet', async () => {
    const db = await newDb();
    const r = await save(db, GOOD_CODE, { ...good, id: '99999999-9999-4999-8999-999999999999' });
    assert.match(r.error, /n'existe plus/);
    const r2 = await as(db, 'anon', `select public.admin_save_offer($1, '[]'::jsonb) r`, [GOOD_CODE]);
    assert.match(r2.rows[0].r.error, /enregistrement attendu/);
    assert.deepEqual(await del(db, GOOD_CODE, 'pas-un-uuid'), { ok: false, error: 'invalid: identifiant illisible' });
  });

  test('un texte piégé reste une simple donnée', async () => {
    const db = await newDb();
    const trap = `L'offre "spéciale"; drop table discount_cards; --`;
    const r = await save(db, GOOD_CODE, { ...good, title: trap, description: trap, terms: trap });
    assert.equal(r.ok, true);
    assert.equal((await one(db, `select title from public.discount_cards`)).title, trap);
  });
});

describe('rejouable', () => {
  test('relancer la migration ne change rien aux offres existantes', async () => {
    const db = await newDb();
    const r = await save(db, GOOD_CODE, { ...good, valid_until: await shift(db, 10) });
    await db.exec(m013);
    await db.exec(m013);
    const after = await one(db, `select title, valid_until from public.discount_cards where id = $1`, [r.offer.id]);
    assert.equal(after.title, 'Chez Un');
    assert.equal((await as(db, 'anon', `select count(*)::int n from public.discount_cards`)).rows[0].n, 1);
  });
});
