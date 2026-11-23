import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

/**
 * Piège Android : dans une feuille du bas qui n'a qu'une hauteur MAXIMALE (maxHeight), un ScrollView en `flex: 1`
 * s'écrase à 0 pixel. C'était le cas de « Confidentialité et RGPD » (écran vide, seul « J'ai compris » visible).
 */
const dir = new URL('../../components/', import.meta.url);
const modals = readdirSync(dir).filter((f) => /Modal\.tsx$/.test(f));

test('aucune feuille à hauteur maximale n’a de ScrollView en flex: 1', () => {
  for (const f of modals) {
    const src = readFileSync(new URL(f, dir), 'utf8');
    if (!/maxHeight:\s*'\d+%'/.test(src)) continue;
    const scrollStyles = [...src.matchAll(/<ScrollView[^>]*style=\{styles\.(\w+)\}/g)].map((m) => m[1]);
    for (const name of scrollStyles) {
      const def = src.match(new RegExp(`\\b${name}:\\s*\\{([^}]*)\\}`));
      assert.ok(def, `${f} : style ${name} introuvable`);
      assert.doesNotMatch(def![1], /\bflex:\s*1\b/, `${f} : ${name} en flex: 1 (texte invisible sur Android)`);
    }
  }
});

test('Confidentialité : la liste du texte se limite à la hauteur disponible', () => {
  const src = readFileSync(new URL('PrivacyPolicyModal.tsx', dir), 'utf8');
  assert.match(src, /bodyScroll:\s*\{[^}]*flexShrink:\s*1/);
});
