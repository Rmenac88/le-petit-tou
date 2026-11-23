import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { webcrypto } from 'node:crypto';
import { isUuidV4, secureUuid, uuidFromBytes } from '../secureUuid.ts';

test('randomUUID natif utilisé quand il existe', () => {
  assert.equal(secureUuid({ randomUUID: () => '3F2504E0-4F89-41D3-9A0C-0305E82C3301' }), '3f2504e0-4f89-41d3-9a0c-0305e82c3301');
});

test('sinon, octets sûrs mis en forme de UUID v4 (version et variante correctes)', () => {
  const id = secureUuid({ getRandomValues: (b) => webcrypto.getRandomValues(b) });
  assert.ok(isUuidV4(id), id);
  assert.equal(uuidFromBytes(new Uint8Array(16).fill(0xff)), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
  assert.equal(uuidFromBytes(new Uint8Array(16)), '00000000-0000-4000-8000-000000000000');
});

test('un randomUUID défaillant passe au générateur d’octets ; aucun générateur sûr = erreur, jamais Math.random', () => {
  const id = secureUuid({ randomUUID: () => 'pas-un-uuid', getRandomValues: (b) => webcrypto.getRandomValues(b) });
  assert.ok(isUuidV4(id));
  assert.throws(() => secureUuid({}));
});

test('mille identifiants tous différents', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 1000; i++) seen.add(secureUuid({ getRandomValues: (b) => webcrypto.getRandomValues(b) }));
  assert.equal(seen.size, 1000);
});

test('deviceIdentity passe par le générateur sûr (expo-crypto) et n’utilise plus Math.random', () => {
  const src = readFileSync(new URL('../deviceIdentity.ts', import.meta.url), 'utf8');
  assert.match(src, /from 'expo-crypto'/);
  assert.match(src, /secureUuid\(/);
  assert.doesNotMatch(src, /Math\.random/);
});

test('l’identifiant accepté par le serveur (_lpt_identity) reste compatible', () => {
  const id = secureUuid({ getRandomValues: (b) => webcrypto.getRandomValues(b) });
  assert.match(id, /^[0-9a-f-]{32,40}$/);
});
