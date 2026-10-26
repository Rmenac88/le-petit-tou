import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { categoryText } from '../searchCategory.ts';

const names = { c1: 'Restaurants & Gastronomie', c2: 'Bars, Cafés & Salons de thé', c3: 'Beauté, Coiffure & Spa' };

test('le nom de la catégorie est déduit de category_id, sans accents ni majuscules', () => {
  assert.match(categoryText({ category_id: 'c3' }, names), /beaute, coiffure & spa/);
});

test('les tags et le fil d’Ariane sont ajoutés ; valeurs absentes ou invalides ignorées', () => {
  const t = categoryText({ category_id: 'c1', tags: ['Brunch', null, 3], breadcrumbs: ['Terrasse'] }, names);
  assert.match(t, /restaurants/);
  assert.match(t, /brunch/);
  assert.match(t, /terrasse/);
  assert.equal(categoryText({}, names), '');
  assert.equal(categoryText({ category_id: 'inconnu', tags: 'pas un tableau' }, names), '');
});

test('sur le vrai jeu de données, chacun des 9 filtres rapides renvoie au moins une adresse', () => {
  const d = JSON.parse(readFileSync(new URL('../../constants/dataset.json', import.meta.url), 'utf8'));
  const cat: Record<string, string> = Object.fromEntries(d.categories.map((c: any) => [c.id, c.name]));
  const texts: string[] = d.addresses.map((a: any) => categoryText(a, cat));
  for (const tag of ['restaurants', 'bars', 'brunch', 'shopping', 'beaute', 'culture', 'sport', 'terrasse', 'bio']) {
    const n = texts.filter((t) => t.includes(tag)).length;
    assert.ok(n > 0, `le filtre « ${tag} » ne renvoie rien`);
  }
});
