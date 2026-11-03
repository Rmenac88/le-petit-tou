import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSetTourismBanner, tourismErrorFrom, TourismBannerError } from '../tourismBannerAdmin.ts';

function fakeClient(reply: { data: any; error: any }) {
  const calls: any[] = [];
  return { calls, client: { rpc: async (fn: string, args: Record<string, unknown>) => { calls.push({ fn, args }); return reply; } } };
}

test('envoie le code et l’adresse à admin_set_tourism_banner et renvoie le réglage retenu', async () => {
  const { client, calls } = fakeClient({ data: { ok: true, setting: { url: 'https://exemple.fr/' } }, error: null });
  const s = await adminSetTourismBanner(client, 'mon-code', 'https://exemple.fr/');
  assert.deepEqual(s, { url: 'https://exemple.fr/' });
  assert.deepEqual(calls[0], { fn: 'admin_set_tourism_banner', args: { p_code: 'mon-code', p_url: 'https://exemple.fr/' } });
});

test('un code vide est refusé sans appel serveur', async () => {
  const { client, calls } = fakeClient({ data: { ok: true }, error: null });
  await assert.rejects(adminSetTourismBanner(client, '  ', 'https://exemple.fr/'), (e: any) => e instanceof TourismBannerError && e.kind === 'forbidden');
  assert.equal(calls.length, 0);
});

test('messages d’erreur lisibles : code refusé, adresse refusée, migration absente, réseau', async () => {
  assert.equal(tourismErrorFrom('forbidden').kind, 'forbidden');
  const inv = tourismErrorFrom('invalid: adresse non valide (https://nom-du-site.fr/...)');
  assert.equal(inv.kind, 'invalid');
  assert.match(inv.message, /^Adresse non valide/);
  assert.match(tourismErrorFrom(null, { code: 'PGRST202' }).message, /pas encore activée/);
  assert.match(tourismErrorFrom(undefined).message, /Connexion impossible/);
});

test('un refus du serveur remonte comme erreur typée', async () => {
  const { client } = fakeClient({ data: { ok: false, error: 'forbidden' }, error: null });
  await assert.rejects(adminSetTourismBanner(client, 'faux', 'https://exemple.fr/'), (e: any) => e.kind === 'forbidden');
});
