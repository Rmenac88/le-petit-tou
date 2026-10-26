import test from 'node:test';
import assert from 'node:assert/strict';
import { adminResetHomeTheme, adminSetHomeTheme, ThemeError, themeErrorFrom } from '../homeThemeAdmin.ts';
import { DEFAULT_THEME } from '../homeThemeLogic.ts';

const client = (reply: any, calls: any[] = []) => ({
  rpc: async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    return reply;
  },
});

test('enregistrement : appelle admin_set_home_theme avec le code et le thème nettoyé', async () => {
  const calls: any[] = [];
  const setting = await adminSetHomeTheme(client({ data: { ok: true, setting: { name: 'Galaxy' } }, error: null }, calls), 'mon-code', { ...DEFAULT_THEME, bg: '#2B1D46' });
  assert.deepEqual(setting, { name: 'Galaxy' });
  assert.equal(calls[0].fn, 'admin_set_home_theme');
  assert.equal(calls[0].args.p_code, 'mon-code');
  assert.equal(calls[0].args.p_theme.bg, '#2b1d46');
  assert.equal(calls[0].args.p_theme.bg2, null);
});

test('retour au thème d’origine : thème nul envoyé au serveur', async () => {
  const calls: any[] = [];
  await adminResetHomeTheme(client({ data: { ok: true, setting: null }, error: null }, calls), 'c');
  assert.deepEqual(calls[0], { fn: 'admin_set_home_theme', args: { p_code: 'c', p_theme: null } });
});

test('code vide : refusé sans appel réseau', async () => {
  const calls: any[] = [];
  await assert.rejects(adminSetHomeTheme(client({}, calls), ' ', DEFAULT_THEME), (e: ThemeError) => e.kind === 'forbidden');
  await assert.rejects(adminResetHomeTheme(client({}, calls), ''), (e: ThemeError) => e.kind === 'forbidden');
  assert.equal(calls.length, 0);
});

test('erreurs : code refusé, validation traduite, réseau coupé, migration pas encore appliquée', async () => {
  await assert.rejects(adminSetHomeTheme(client({ data: { ok: false, error: 'forbidden' } }), 'c', DEFAULT_THEME),
    (e: ThemeError) => e.kind === 'forbidden' && /tentatives/.test(e.message));
  await assert.rejects(adminSetHomeTheme(client({ data: { ok: false, error: 'invalid: texte « line1 » vide' } }), 'c', DEFAULT_THEME),
    (e: ThemeError) => e.kind === 'invalid' && e.message.startsWith('Texte'));
  await assert.rejects(adminSetHomeTheme(client({ data: null, error: { message: 'fetch failed' } }), 'c', DEFAULT_THEME),
    (e: ThemeError) => e.kind === 'network' && /Connexion/.test(e.message));
  await assert.rejects(adminSetHomeTheme({ rpc: async () => { throw new Error('boom'); } }, 'c', DEFAULT_THEME), (e: ThemeError) => e.kind === 'network');
  await assert.rejects(adminSetHomeTheme(client({ data: null, error: { code: 'PGRST202', message: 'Could not find the function public.admin_set_home_theme' } }), 'c', DEFAULT_THEME),
    (e: ThemeError) => /pas encore activé/.test(e.message));
  assert.equal(themeErrorFrom(undefined).kind, 'network');
});
