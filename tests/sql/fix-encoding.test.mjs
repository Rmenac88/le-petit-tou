// 025 : réparation des accents abîmés dans le texte des fonctions (UTF-8 lu comme du Mac Roman). PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

const read = (p) => readFileSync(new URL(p, new URL(".", import.meta.url)), "utf8");
// Textes abîmés tels qu on les trouve en production (générés par la même erreur d encodage)
const MANGLED_TITLE = "Nouvel √©v√©nement";
const MANGLED_BODY = "‚Äî le 24/11 üéâ ¬´ √ßa ¬ª";

async function newDb() {
  const db = new PGlite();
  await db.exec("create role anon; create role authenticated;");
  await db.exec(`create table public.push_outbox (id serial primary key, title text, body text);
    insert into public.push_outbox (title, body) values ($1, $2);`.replace("$1", "'" + MANGLED_TITLE + "'").replace("$2", "'" + MANGLED_BODY + "'"));
  await db.exec(`create function public.titre_evenement() returns text language sql as $f$ select '${MANGLED_TITLE}' || ' ' || '${MANGLED_BODY}' $f$;`);
  await db.exec(`create function public.deja_correct() returns text language sql as $f$ select 'Déjà écrit correctement' $f$;`);
  await db.exec(`create function public.melange() returns text language sql as $f$ select 'é correct' || '${MANGLED_TITLE}' $f$;`);
  await db.exec(read("../../src/scripts/025_fix_encoding.sql"));
  return db;
}
const one = async (db, sql) => Object.values((await db.query(sql)).rows[0])[0];

test("une fonction abîmée retrouve ses accents, emojis compris", async () => {
  const db = await newDb();
  assert.equal(await one(db, "select public.titre_evenement()"), "Nouvel événement — le 24/11 🎉 « ça »");
});

test("une fonction déjà correcte n est pas touchée ; un mélange douteux est laissé tel quel, sans erreur", async () => {
  const db = await newDb();
  assert.equal(await one(db, "select public.deja_correct()"), "Déjà écrit correctement");
  assert.equal(await one(db, "select public.melange()"), "é correct" + MANGLED_TITLE);
});

test("les notifications déjà enregistrées sont réparées ; script relançable sans rien abîmer", async () => {
  const db = await newDb();
  assert.deepEqual((await db.query("select title, body from public.push_outbox")).rows[0], { title: "Nouvel événement", body: "— le 24/11 🎉 « ça »" });
  await db.exec(read("../../src/scripts/025_fix_encoding.sql"));
  assert.equal(await one(db, "select public.titre_evenement()"), "Nouvel événement — le 24/11 🎉 « ça »");
  assert.equal((await db.query("select title from public.push_outbox")).rows[0].title, "Nouvel événement");
});
