import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pointsFor } from '../pointsLogic.ts';

test('même barème que le serveur (discover_place)', () => {
  assert.equal(pointsFor({ points_reward: 35, is_recommended: true }), 35, 'valeur fixée en priorité');
  assert.equal(pointsFor({ points_reward: 0, is_recommended: true }), 25);
  assert.equal(pointsFor({ is_recommended: false, rating: 4.8 }), 20);
  assert.equal(pointsFor({ is_recommended: false, rating: 4.7 }), 10);
  assert.equal(pointsFor({ rating: null }), 10, 'sans note (après 017) : 10, comme le serveur');
  assert.equal(pointsFor({}), 10, 'jamais 20 « par défaut »');
  assert.equal(pointsFor(null), 10);
  assert.equal(pointsFor({ points_reward: '30' }), 30);
});

test('la règle SQL du serveur est bien celle que l’appli recopie', () => {
  const sql = readFileSync(new URL('../../scripts/006_security_lockdown.sql', import.meta.url), 'utf8');
  const body = sql.slice(sql.indexOf('function public.discover_place'), sql.indexOf('function public.use_discount_card'));
  assert.match(body, /points_reward is not null and v_spot\.points_reward > 0/);
  assert.match(body, /is_recommended is true then\s+v_points := 25/);
  assert.match(body, /rating >= 4\.8 then\s+v_points := 20/);
  assert.match(body, /v_points := 10/);
});

test('aucun écran ne recalcule les points à sa façon', () => {
  for (const f of ['../../components/AddressDetailModal.tsx', '../../components/PlaceDetailSheet.tsx', '../placesRepository.ts', '../discoveryStore.ts']) {
    const src = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /is_recommended \? '\+25 pts' : '\+10 pts'/, f);
    assert.doesNotMatch(src, /is_recommended \? 25 : \(\w+\.rating >= 4\.8 \? 20 : 10\)/, f);
    assert.doesNotMatch(src, /isRecommended \? 25 : \(rating >= 4\.8 \? 20 : 10\)/, f);
  }
});
