// 024 : vue des partenaires en security invoker, prix toujours caché ; anciennes fonctions avec search_path fixe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const here = new URL('.', import.meta.url);
const read = (p) => readFileSync(new URL(p, here), 'utf8');

async function newDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(read('baseline.sql'));
  await db.exec(read('../../src/scripts/006_security_lockdown.sql'));
  await db.exec(`insert into public.sponsored_partners (title, price_paid, is_active) values ('Actif', 450, true), ('Ancien', 300, false)`);
  await db.exec(`create function public.scan_ticket_secure(t text) returns text language sql as $$ select t $$;`);
  await db.exec(read('../../src/scripts/016_hide_partner_price.sql'));
  await db.exec(read('../../src/scripts/019_close_legacy_surface.sql'));
  await db.exec(read('../../src/scripts/024_advisor_fixes.sql'));
  return db;
}
async function as(db, role, sql) {
  await db.exec(`set role ${role}`);
  try { return await db.query(sql); } finally { await db.exec('reset role'); }
}

test('la vue publique donne le même résultat : partenaires actifs, sans le prix', async () => {
  const db = await newDb();
  const rows = (await as(db, 'anon', `select * from public.sponsored_partners_public`)).rows;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].title, 'Actif');
  assert.equal('price_paid' in rows[0], false);
});

test('le prix reste illisible, même en interrogeant la table directement', async () => {
  const db = await newDb();
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(as(db, role, `select price_paid from public.sponsored_partners`), /permission denied/, role);
    await assert.rejects(as(db, role, `select * from public.sponsored_partners`), /permission denied/, role);
    await assert.rejects(as(db, role, `update public.sponsored_partners set title = 'x'`), /permission denied/, role);
  }
});

test('la vue n’utilise plus les droits de son créateur ; anciennes fonctions à search_path fixe ; relançable', async () => {
  const db = await newDb();
  const opts = (await db.query(`select reloptions from pg_class where relname = 'sponsored_partners_public'`)).rows[0].reloptions;
  assert.ok(String(opts).includes('security_invoker=true'), String(opts));
  const cfg = (await db.query(`select proconfig from pg_proc where proname = 'scan_ticket_secure'`)).rows[0].proconfig;
  assert.ok(String(cfg).includes('search_path=public'));
  await assert.doesNotReject(db.exec(read('../../src/scripts/024_advisor_fixes.sql')));
});
