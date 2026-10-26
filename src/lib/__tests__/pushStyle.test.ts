import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import {
  NOTIFICATION_ACCENT,
  NOTIFICATION_CHANNELS,
  NOTIFICATION_CHANNEL_GROUP,
  isMissingFunctionError,
} from '../pushLogic.ts';

const root = new URL('../../../', import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), 'utf8');

test('les canaux Android de l’appli correspondent exactement à ceux envoyés par le serveur (migration 010)', () => {
  const sql = read('src/scripts/010_push_style.sql');
  const fromSql = [...sql.matchAll(/'channel', '([a-z-]+)'/g)].map((m) => m[1]).sort();
  const fromApp = NOTIFICATION_CHANNELS.map((c) => c.id).filter((id) => id !== 'default').sort();
  assert.deepEqual(fromApp, fromSql, 'un canal envoyé par le serveur doit exister dans l’appli, sinon la notification est perdue');
  assert.ok(NOTIFICATION_CHANNELS.some((c) => c.id === 'default'), 'le canal « default » sert aux anciens messages');
});

test('canaux : identifiants uniques, noms et descriptions renseignés, importance connue', () => {
  const ids = NOTIFICATION_CHANNELS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const c of NOTIFICATION_CHANNELS) {
    assert.match(c.id, /^[a-z][a-z-]*$/);
    assert.ok(c.name.length > 0 && c.name.length <= 40);
    assert.ok(c.description.length > 0);
    assert.ok(['default', 'high'].includes(c.importance));
  }
  assert.equal(NOTIFICATION_CHANNEL_GROUP.name, 'Le Petit Tou');
});

test('couleur d’accent : celle du plugin expo-notifications et de la charte graphique', () => {
  const app = JSON.parse(read('app.json')).expo;
  const plugin = app.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-notifications');
  assert.equal(plugin[1].color, NOTIFICATION_ACCENT);
  assert.match(read('src/constants/brand.ts'), new RegExp(`primary: '${NOTIFICATION_ACCENT}'`));
  assert.equal(plugin[1].defaultChannel, 'default');
});

test('l’icône de notification Android existe, en PNG, au chemin déclaré dans le plugin', () => {
  const app = JSON.parse(read('app.json')).expo;
  const plugin = app.plugins.find((p: any) => Array.isArray(p) && p[0] === 'expo-notifications');
  const path = plugin[1].icon.replace('./', '');
  assert.ok(existsSync(new URL(path, root)), `${path} introuvable`);
  const buf = readFileSync(new URL(path, root));
  assert.equal(buf.subarray(1, 4).toString(), 'PNG');
  assert.equal(buf.readUInt32BE(16), 96, 'largeur 96 px attendue');
  assert.equal(buf.readUInt32BE(20), 96, 'hauteur 96 px attendue');
});

test('isMissingFunctionError reconnaît une base pas encore migrée et rien d’autre', () => {
  assert.equal(isMissingFunctionError({ code: 'PGRST202', message: 'x' }), true);
  assert.equal(isMissingFunctionError({ message: 'Could not find the function public.register_push_token(...) in the schema cache' }), true);
  assert.equal(isMissingFunctionError({ code: '42501', message: 'permission denied' }), false);
  assert.equal(isMissingFunctionError({ message: 'fetch failed' }), false);
  assert.equal(isMissingFunctionError(null), false);
});
