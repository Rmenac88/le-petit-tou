import test from 'node:test';
import assert from 'node:assert/strict';
import { safeWebUrl, safeTelUrl } from '../safeLinks.ts';

test('safeWebUrl accepte http(s) et complète une adresse sans schéma', () => {
  assert.equal(safeWebUrl('https://exemple.fr/page'), 'https://exemple.fr/page');
  assert.equal(safeWebUrl('http://exemple.fr'), 'http://exemple.fr/');
  assert.equal(safeWebUrl('exemple.fr'), 'https://exemple.fr/');
  assert.equal(safeWebUrl('  www.exemple.fr/menu  '), 'https://www.exemple.fr/menu');
});

test('safeWebUrl refuse les schémas dangereux ou inattendus', () => {
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<script>', 'file:///etc/passwd',
    'intent://scan#Intent;end', 'lepetittou://admin', 'ftp://exemple.fr', 'vbscript:x']) {
    assert.equal(safeWebUrl(bad), null, bad);
  }
});

test('safeWebUrl refuse le vide, les espaces internes et les hôtes sans point', () => {
  for (const bad of ['', '   ', null, undefined, 'mon site.fr', 'intranet', 'https://']) {
    assert.equal(safeWebUrl(bad as any), null, String(bad));
  }
});

test('safeTelUrl normalise un numéro français', () => {
  assert.equal(safeTelUrl('05 61 23 45 67'), 'tel:0561234567');
  assert.equal(safeTelUrl('+33 5 61 23 45 67'), 'tel:+33561234567');
  assert.equal(safeTelUrl('05.61.23.45.67'), 'tel:0561234567');
});

test('safeTelUrl refuse les valeurs inexploitables ou piégées', () => {
  for (const bad of ['', null, undefined, 'abc', '12', '1'.repeat(30)]) {
    assert.equal(safeTelUrl(bad as any), null, String(bad));
  }
  assert.equal(safeTelUrl('0561234567;rm -rf'), 'tel:0561234567');
});
