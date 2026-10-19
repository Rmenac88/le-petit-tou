import test from 'node:test';
import assert from 'node:assert/strict';
import { adminSendPush, adminPushStats, validateAnnouncement } from '../pushAdmin.ts';

const client = (reply: { data: any; error: { message: string } | null }, calls: any[] = []) => ({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return reply;
  },
});

test('validation locale des annonces (mêmes bornes que le serveur)', () => {
  assert.equal(validateAnnouncement('Titre', 'Message'), null);
  assert.match(validateAnnouncement('', 'm')!, /titre/i);
  assert.match(validateAnnouncement('t', '   ')!, /message/i);
  assert.match(validateAnnouncement('t'.repeat(51), 'm')!, /titre/i);
  assert.match(validateAnnouncement('t', 'm'.repeat(141))!, /message/i);
  assert.equal(validateAnnouncement('t'.repeat(50), 'm'.repeat(140)), null);
});

test('annonce envoyée : appelle admin_send_push avec le code et le texte nettoyé', async () => {
  const calls: any[] = [];
  const res = await adminSendPush(client({ data: { ok: true, recipients: 12 }, error: null }, calls), 'code', '  Titre ', ' Message  ');
  assert.deepEqual(res, { ok: true, recipients: 12 });
  assert.deepEqual(calls[0], { fn: 'admin_send_push', args: { p_code: 'code', p_title: 'Titre', p_body: 'Message' } });
});

test('annonce invalide ou code vide : aucun appel réseau', async () => {
  const calls: any[] = [];
  const c = client({ data: { ok: true, recipients: 1 }, error: null }, calls);
  assert.equal((await adminSendPush(c, 'code', '', 'x')).ok, false);
  assert.equal((await adminSendPush(c, '  ', 'a', 'b')).ok, false);
  assert.equal(calls.length, 0);
});

test('refus serveur et panne réseau : messages lisibles, jamais d’exception', async () => {
  const refused = await adminSendPush(client({ data: { ok: false, error: 'forbidden' }, error: null }), 'c', 'a', 'b');
  assert.equal(refused.ok, false);
  assert.match((refused as any).message, /Code admin refusé/);
  const down = await adminSendPush(client({ data: null, error: { message: 'x' } }), 'c', 'a', 'b');
  assert.equal(down.ok, false);
  const throwing = await adminSendPush({ rpc: async () => { throw new Error('off'); } }, 'c', 'a', 'b');
  assert.equal(throwing.ok, false);
});

test('statistiques : conversion et valeurs par défaut', async () => {
  const res = await adminPushStats(
    client({ data: { ok: true, devices: 4, ios: 3, android: 1, pending_messages: 2, deliveries_7d: { sent: 7 } }, error: null }), 'c');
  assert.deepEqual(res, { ok: true, stats: { devices: 4, ios: 3, android: 1, pendingMessages: 2, deliveries7d: { sent: 7 } } });
  const odd = await adminPushStats(client({ data: { ok: true }, error: null }), 'c');
  assert.deepEqual((odd as any).stats, { devices: 0, ios: 0, android: 0, pendingMessages: 0, deliveries7d: {} });
  assert.equal((await adminPushStats(client({ data: { ok: false, error: 'forbidden' }, error: null }), 'c')).ok, false);
});
