import test from 'node:test';
import assert from 'node:assert/strict';
import { withTimeout, withDeadline } from '../fetchWithTimeout.ts';

// Faux fetch : ne répond jamais, mais respecte l'annulation comme le vrai.
const hanging = ((_input: unknown, init?: { signal?: AbortSignal }) =>
  new Promise((_resolve, reject) => {
    if (init?.signal?.aborted) return reject(new Error('annulée'));
    init?.signal?.addEventListener('abort', () => reject(new Error('annulée')));
  })) as unknown as typeof fetch;

test('une requête qui ne répond jamais échoue après le délai, avec une erreur AbortError (non relancée par supabase-js)', async () => {
  const f = withTimeout(hanging, 30);
  const t0 = Date.now();
  await assert.rejects(f('https://exemple.test/'), (e: Error) => e.name === 'AbortError' && /Délai dépassé/.test(e.message));
  assert.ok(Date.now() - t0 < 1000);
});

test('le délai couvre aussi la lecture du corps : une réponse dont le corps ne vient jamais est annulée', async () => {
  let seenSignal: AbortSignal | undefined;
  const slowBody = ((_input: unknown, init?: { signal?: AbortSignal }) => {
    seenSignal = init?.signal;
    return Promise.resolve({ ok: true, status: 200 });
  }) as unknown as typeof fetch;
  await withTimeout(slowBody, 30)('https://exemple.test/');
  assert.equal(seenSignal?.aborted, false);
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(seenSignal?.aborted, true, 'le minuteur doit rester actif après les en-têtes');
});

test('une erreur réseau ordinaire est transmise telle quelle', async () => {
  const boom = (async () => { throw new TypeError('Network request failed'); }) as unknown as typeof fetch;
  await assert.rejects(withTimeout(boom, 1000)('https://exemple.test/'), (e: Error) => e.name === 'TypeError');
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

test('withDeadline échoue après le délai si l’opération ne répond jamais', async () => {
  await assert.rejects(withDeadline(new Promise(() => {}), 30, 'GPS muet'), /GPS muet/);
});

test('withDeadline laisse passer une réponse rapide et propage ses erreurs', async () => {
  assert.equal(await withDeadline(Promise.resolve(42), 1000), 42);
  await assert.rejects(withDeadline(Promise.reject(new Error('refusé')), 1000), /refusé/);
});
