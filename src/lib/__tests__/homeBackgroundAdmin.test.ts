import test from 'node:test';
import assert from 'node:assert/strict';
import { adminRequestUpload, adminSetHomeBackground } from '../homeBackgroundAdmin.ts';
import { FeaturedError } from '../featuredAdmin.ts';

const client = (reply: any, calls: any[] = []) => ({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return reply;
  },
});

test('billet d’envoi : renvoie chemin, durée et taille maximale ; code vide refusé sans appel', async () => {
  const calls: any[] = [];
  const t = await adminRequestUpload(client({ data: { ok: true, bucket: 'app-backgrounds', path: 'home/x.jpg', expires_in: 600, max_bytes: 2097152 }, error: null }, calls), 'c', 'jpg');
  assert.deepEqual(t, { bucket: 'app-backgrounds', path: 'home/x.jpg', expiresIn: 600, maxBytes: 2097152 });
  assert.deepEqual(calls[0], { fn: 'admin_request_upload', args: { p_code: 'c', p_ext: 'jpg' } });
  await assert.rejects(adminRequestUpload(client({}, calls), '  ', 'png'), (e: FeaturedError) => e.kind === 'forbidden');
  assert.equal(calls.length, 1);
});

test('application du fond : image avec chemin, Galaxy sans chemin', async () => {
  const calls: any[] = [];
  const ok = client({ data: { ok: true, setting: { mode: 'galaxy' } }, error: null }, calls);
  assert.deepEqual(await adminSetHomeBackground(ok, 'c', 'galaxy', 'home/ignore.jpg'), { mode: 'galaxy' });
  assert.equal(calls[0].args.p_path, null, 'le chemin est ignoré en mode Galaxy');
  await adminSetHomeBackground(ok, 'c', 'image', 'home/y.png');
  assert.equal(calls[1].args.p_path, 'home/y.png');
});

test('erreurs du serveur traduites ; panne réseau neutre', async () => {
  await assert.rejects(adminSetHomeBackground(client({ data: { ok: false, error: "invalid: image trop lourde (2 Mo au maximum)" } }), 'c', 'image', 'home/z.jpg'),
    (e: FeaturedError) => e.kind === 'invalid' && e.message.startsWith('Image trop lourde'));
  await assert.rejects(adminRequestUpload(client({ data: { ok: false, error: 'forbidden' } }), 'c', 'jpg'), (e: FeaturedError) => e.kind === 'forbidden');
  await assert.rejects(adminRequestUpload({ rpc: async () => { throw new Error('boom'); } }, 'c', 'jpg'), (e: FeaturedError) => e.kind === 'network');
});
