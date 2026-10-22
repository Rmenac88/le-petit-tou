import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { classifyAddress, classificationCacheSize, getCategorySpotCount, getOrderedPopularCategories } from '../categoryResolver.ts';

const d = JSON.parse(readFileSync(new URL('../../constants/dataset.json', import.meta.url), 'utf8'));
// Données « comme en base » : anciennes grandes catégories, donc chemin de classification long
const LEGACY_PARENT = 'e6134429-0000-0000-0000-000000000000';
const fromDb = d.addresses.map((a: any) => ({ ...a, category_id: LEGACY_PARENT }));

test('une adresse n’est classée qu’une fois : les appels répétés relisent la mémoire', () => {
  const before = classificationCacheSize();
  const first = fromDb.map((a: any) => classifyAddress(a));
  const afterFirst = classificationCacheSize();
  assert.ok(afterFirst - before >= 1 && afterFirst - before <= fromDb.length);
  for (let i = 0; i < 19; i++) fromDb.forEach((a: any, idx: number) => assert.equal(classifyAddress(a), first[idx]));
  assert.equal(classificationCacheSize(), afterFirst, 'aucune nouvelle classification après les 19 relectures');
});

test('modifier le titre, la catégorie ou la description d’une adresse relance une classification', () => {
  const a = { id: 'x1', title: 'Chez Test', category_id: LEGACY_PARENT, description: 'un bar à cocktails', tags: [], breadcrumbs: [] };
  classifyAddress(a);
  const n = classificationCacheSize();
  classifyAddress({ ...a, title: 'Salle de sport Test' });
  classifyAddress({ ...a, description: 'un bar à cocktails et des jeux de société' });
  assert.equal(classificationCacheSize(), n + 2);
  assert.equal(classifyAddress(null), classifyAddress(undefined));
});

test('les comptes par catégorie sur données « base » ne changent pas de valeur et restent rapides', () => {
  const cats = d.categories;
  const t0 = performance.now();
  const counts = cats.map((c: any) => getCategorySpotCount(fromDb, c.id));
  getOrderedPopularCategories(cats, fromDb, false);
  const ms = performance.now() - t0;
  assert.ok(counts.some((n: number) => n > 0));
  assert.ok(ms < 400, `${Math.round(ms)} ms : le calcul reste trop lent`);
});
