import { appStorage } from './storage';
import { emitAppEvent } from './appEvents';
import { fetchRemoteLists, pushRemoteLists } from './userListsRemote';
import { USER_LISTS_CHANGED_EVENT, UserListsEngine } from './userListsEngine';

export { USER_LISTS_CHANGED_EVENT };

const makeId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/**
 * Listes personnelles de l'appli : enregistrées sur le téléphone, avec une copie serveur rattachée à l'identifiant
 * anonyme de l'installation (voir userListsEngine.ts pour le fonctionnement, testé avec des dépendances simulées).
 */
export const userListsStore = new UserListsEngine({
  storage: appStorage,
  remote: { fetch: fetchRemoteLists, push: pushRemoteLists },
  emit: emitAppEvent,
  now: () => Date.now(),
  setTimer: (fn, ms) => setTimeout(fn, ms),
  clearTimer: (h) => clearTimeout(h as ReturnType<typeof setTimeout>),
  makeId,
});
