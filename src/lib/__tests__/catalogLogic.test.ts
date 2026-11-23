import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CatalogLoader, parseCachedCatalog, type CachedCatalog, type CatalogDeps } from '../catalogLogic.ts';

const ROWS = [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }];

function env(opts: { version?: string | null; rows?: any[] | null; cache?: CachedCatalog | null; failVersion?: boolean } = {}) {
  const calls = { version: 0, all: 0, writes: [] as CachedCatalog[] };
  let cache = opts.cache ?? null;
  const deps: CatalogDeps = {
    fetchVersion: async () => {
      calls.version++;
      if (opts.failVersion) throw new Error('réseau');
      return opts.version === undefined ? 'v1' : opts.version;
    },
    fetchAll: async () => {
      calls.all++;
      return opts.rows === undefined ? ROWS : opts.rows;
    },
    readCache: async () => cache,
    writeCache: async (e) => {
      calls.writes.push(e);
      cache = e;
    },
    now: () => 1000,
  };
  return { loader: new CatalogLoader(deps), calls };
}

test('premier lancement : téléchargement puis copie gardée avec l’empreinte', async () => {
  const { loader, calls } = env();
  const r = await loader.load();
  assert.equal(r.source, 'network');
  assert.deepEqual(r.rows, ROWS);
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.writes[0].version, 'v1');
});

test('lancement suivant, catalogue inchangé : aucun téléchargement du catalogue', async () => {
  const { loader, calls } = env({ cache: { version: 'v1', savedAt: 1, rows: ROWS } });
  const r = await loader.load();
  assert.equal(r.source, 'cache');
  assert.equal(calls.all, 0);
});

test('catalogue modifié en base : nouvelle empreinte, nouveau téléchargement', async () => {
  const { loader, calls } = env({ version: 'v2', cache: { version: 'v1', savedAt: 1, rows: [{ id: 'old' }] } });
  const r = await loader.load();
  assert.equal(r.source, 'network');
  assert.equal(calls.all, 1);
  assert.equal(calls.writes[0].version, 'v2');
});

test('accueil, carte et recherche en même temps : un seul téléchargement', async () => {
  const { loader, calls } = env();
  await Promise.all([loader.load(), loader.load(), loader.load()]);
  await loader.load();
  assert.equal(calls.all, 1);
  assert.equal(calls.version, 1);
});

test('hors connexion : la dernière copie sert', async () => {
  const { loader } = env({ failVersion: true, rows: null, cache: { version: 'v1', savedAt: 1, rows: ROWS } });
  const r = await loader.load();
  assert.equal(r.source, 'stale-cache');
  assert.deepEqual(r.rows, ROWS);
});

test('sans fonction d’empreinte (migration 022 absente) : un téléchargement par session, rien de gardé', async () => {
  const { loader, calls } = env({ version: null });
  await loader.load();
  await loader.load();
  assert.equal(calls.all, 1);
  assert.equal(calls.writes.length, 0);
});

test('rafraîchir revérifie l’empreinte ; après une modification admin, la mémoire est oubliée', async () => {
  const { loader, calls } = env({ cache: { version: 'v1', savedAt: 1, rows: ROWS } });
  await loader.load();
  await loader.load({ refresh: true });
  assert.equal(calls.version, 2);
  loader.invalidate();
  assert.equal(loader.peek(), null);
});

test('rien du tout (premier lancement hors connexion) : null, l’appli garde ses adresses embarquées', async () => {
  const { loader } = env({ failVersion: true, rows: null });
  const r = await loader.load();
  assert.equal(r.rows, null);
  assert.equal(r.source, 'none');
});

test('copie locale illisible ou vide : ignorée', () => {
  assert.equal(parseCachedCatalog('pas du json'), null);
  assert.equal(parseCachedCatalog(JSON.stringify({ version: 'v1', rows: [] })), null);
  assert.equal(parseCachedCatalog(JSON.stringify({ rows: ROWS })), null);
  assert.deepEqual(parseCachedCatalog(JSON.stringify({ version: 'v1', savedAt: 5, rows: ROWS }))?.rows, ROWS);
});

test('accueil, carte et recherche passent par le chargeur commun (plus de téléchargement en double)', () => {
  const home = readFileSync(new URL('../../components/views/HomeView.tsx', import.meta.url), 'utf8');
  const search = readFileSync(new URL('../../components/views/SearchView.tsx', import.meta.url), 'utf8');
  const map = readFileSync(new URL('../../components/views/MapView.tsx', import.meta.url), 'utf8');
  for (const [name, src] of [['HomeView', home], ['SearchView', search], ['MapView', map]] as const) {
    assert.match(src, /catalogStore/, name);
    assert.doesNotMatch(src, /from\('addresses'\)\s*\.select\(/, `${name} télécharge encore le catalogue lui-même`);
  }
});
