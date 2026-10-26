import test from 'node:test';
import assert from 'node:assert/strict';
import { adminDeleteOffer, adminListOffers, adminSaveOffer, OffersError, offersErrorFrom } from '../offersAdmin.ts';

const client = (reply: any, calls: any[] = []) => ({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return typeof reply === 'function' ? reply(fn, args) : reply;
  },
});

test('liste : renvoie les offres ; code vide refusé sans appel réseau', async () => {
  const calls: any[] = [];
  const offers = await adminListOffers(client({ data: { ok: true, offers: [{ id: '1' }] }, error: null }, calls), 'code');
  assert.deepEqual(offers, [{ id: '1' }]);
  assert.deepEqual(calls, [{ fn: 'admin_list_offers', args: { p_code: 'code' } }]);
  await assert.rejects(adminListOffers(client({}, calls), ' '), (e: OffersError) => e.kind === 'forbidden');
  assert.equal(calls.length, 1);
});

test('enregistrement : champs vides envoyés comme absents ; booléen et valeurs gardés', async () => {
  const calls: any[] = [];
  const out = await adminSaveOffer(client({ data: { ok: true, offer: { id: 'x', title: 'T' } }, error: null }, calls), 'c', {
    title: 'T', discount_value: '-10%', subtitle: '', max_uses: '', valid_until: undefined, is_active: false, sort_order: 0,
  });
  assert.equal(out.id, 'x');
  const sent = calls[0].args.p_offer;
  assert.equal(sent.title, 'T');
  assert.equal(sent.discount_value, '-10%');
  assert.equal(sent.is_active, false);
  assert.equal(sent.sort_order, 0, 'zéro est une valeur, pas un champ vide');
  for (const k of ['subtitle', 'max_uses', 'valid_until', 'description', 'visual_url', 'partner_id']) assert.equal(sent[k], null, k);
});

test('erreurs : refus de code, validation traduite, réseau coupé, migration pas encore appliquée', async () => {
  await assert.rejects(adminSaveOffer(client({ data: { ok: false, error: 'forbidden' } }), 'c', { title: 'T', discount_value: 'v' }),
    (e: OffersError) => e.kind === 'forbidden' && /tentatives/.test(e.message));
  await assert.rejects(adminSaveOffer(client({ data: { ok: false, error: 'invalid: les couleurs s\'écrivent #RRGGBB' } }), 'c', { title: 'T', discount_value: 'v' }),
    (e: OffersError) => e.kind === 'invalid' && e.message.startsWith('Les couleurs'));
  await assert.rejects(adminListOffers(client({ data: null, error: { message: 'fetch failed' } }), 'c'), (e: OffersError) => e.kind === 'network' && /Connexion/.test(e.message));
  await assert.rejects(adminListOffers({ rpc: async () => { throw new Error('boom'); } }, 'c'), (e: OffersError) => e.kind === 'network');
  await assert.rejects(adminListOffers(client({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.admin_list_offers' } }), 'c'),
    (e: OffersError) => /pas encore activée/.test(e.message));
  assert.equal(offersErrorFrom(undefined).kind, 'network');
});

test('suppression : renvoie le nombre d\'offres retirées', async () => {
  const calls: any[] = [];
  assert.equal(await adminDeleteOffer(client({ data: { ok: true, deleted: 1 }, error: null }, calls), 'c', 'id-1'), 1);
  assert.deepEqual(calls[0], { fn: 'admin_delete_offer', args: { p_code: 'c', p_id: 'id-1' } });
  assert.equal(await adminDeleteOffer(client({ data: { ok: true, deleted: 0 }, error: null }), 'c', 'id-2'), 0);
});
