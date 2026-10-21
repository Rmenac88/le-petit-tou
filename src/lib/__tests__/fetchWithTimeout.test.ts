import test from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout } from '../fetchWithTimeout.ts';

// Faux fetch : ne répond jamais, mais respecte l'annulation comme le vrai.
const hanging = ((_input: unknown, init?: { signal?: AbortSignal }) =>
  new Promise((_resolve, reject) => {
    if (init?.signal?.aborted) return reject(new Error('annulée'));
    init?.signal?.addEventListener('abort', () => reject(new Error('annulée')));
  })) as unknown as typeof fetch;

test('une requête qui ne répond jamais échoue après le délai au lieu de rester suspendue', async () => {
  const f = withTimeout(hanging, 30);
  const t0 = Date.now();
  await assert.rejects(f('https://exemple.test/'), /annulée/);
  assert.ok(Date.now() - t0 < 1000);
});

test('une réponse rapide passe sans modification', async () => {
  const ok = (async () => ({ ok: true, status: 200 })) as unknown as typeof fetch;
  const res = await withTimeout(ok, 1000)('https://exemple.test/');
  assert.equal((res as any).status, 200);
});

test('une annulation demandée par l’appelant est respectée, même avant le délai', async () => {
  const caller = new AbortController();
  const f = withTimeout(hanging, 10_000);
  const p = f('https://exemple.test/', { signal: caller.signal });
  caller.abort();
  await assert.rejects(p, /annulée/);
});

test('un signal déjà annulé annule aussitôt', async () => {
  const caller = new AbortController();
  caller.abort();
  await assert.rejects(withTimeout(hanging, 10_000)('https://exemple.test/', { signal: caller.signal }), /annulée/);
});
