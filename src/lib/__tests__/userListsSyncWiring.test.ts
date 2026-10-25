import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MAX_LISTS, MAX_NAME_LENGTH, MAX_SPOTS_PER_LIST } from '../userListsLogic.ts';

// La sauvegarde serveur des listes : le SQL (migration 015), l'appel côté appli et les textes affichés à
// l'utilisateur doivent rester d'accord.
const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const sql = read('../../scripts/015_user_lists.sql');
const remote = read('../userListsRemote.ts');
const store = read('../userListsStore.ts');
const engine = read('../userListsEngine.ts');
const logic = read('../userListsLogic.ts');
const privacy = read('../../components/PrivacyPolicyModal.tsx');
const section = read('../../components/lists/MyListsSection.tsx');

test('les plafonds du SQL sont ceux du code : 20 listes, 100 adresses, noms de 30 caractères, mêmes identifiants sûrs', () => {
  assert.match(sql, new RegExp(`jsonb_array_length\\(p_data -> 'lists'\\) > ${MAX_LISTS}`));
  assert.match(sql, new RegExp(`jsonb_array_length\\(v_item -> 'spotIds'\\) > ${MAX_SPOTS_PER_LIST}`));
  assert.match(sql, new RegExp(`length\\(v_name\\) > ${MAX_NAME_LENGTH}`));
  const clientId = /const SAFE_ID = \/(.+)\/;/.exec(logic)?.[1];
  const sqlId = /v_id constant text := '(.+)';/.exec(sql)?.[1];
  assert.equal(sqlId, clientId, 'même forme d’identifiant des deux côtés');
});

test('l’appli appelle les bonnes fonctions avec les bons paramètres', () => {
  assert.match(remote, /rpc\('get_my_lists', \{ p_device_id: userId \}\)/);
  assert.match(remote, /rpc\('save_my_lists', \{ p_device_id: userId, p_data: state \}\)/);
  assert.match(sql, /function public\.get_my_lists\(p_device_id text default null\)/);
  assert.match(sql, /function public\.save_my_lists\(p_device_id text, p_data jsonb\)/);
});

test('le moteur reste sans dépendance native (testable), et la vraie instance lui branche le réseau et le stockage', () => {
  assert.doesNotMatch(engine, /react-native|expo-|from '\.\/supabase|from '\.\/storage'|appEvents/);
  assert.match(store, /new UserListsEngine\(\{/);
  assert.match(store, /remote: \{ fetch: fetchRemoteLists, push: pushRemoteLists \}/);
});

test('« Effacer mes données » arrête les envois avant d’appeler le serveur, et le serveur efface aussi les listes', () => {
  assert.match(privacy, /beforeDelete: \(\) => userListsStore\.quiesceSync\(\)/);
  assert.match(sql, /delete from public\.user_lists where device_id = v_key;/);
});

test('les textes montrés à l’utilisateur disent la vérité : sauvegarde serveur anonyme, nouveau profil après désinstallation', () => {
  assert.doesNotMatch(privacy, /ne sont jamais envoyées à nos serveurs/);
  assert.doesNotMatch(section, /restent sur ton téléphone/);
  assert.match(privacy, /sauvegardées sur nos serveurs sous votre identifiant anonyme/);
  assert.match(privacy, /si vous désinstallez l'application, un nouveau profil est créé/);
});
