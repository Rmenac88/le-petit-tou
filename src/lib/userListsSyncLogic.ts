/**
 * Synchronisation des listes personnelles avec la copie du serveur : logique pure (sans réseau ni stockage), testée avec
 * node:test. Le téléphone reste la référence ; le serveur en garde une copie rattachée à l'identifiant de l'installation.
 *
 * Règles (une installation = un seul « rédacteur », donc pas de fusion fine à chaque lancement) :
 *  - des modifications locales pas encore envoyées gagnent toujours (on envoie) ;
 *  - sinon, une copie serveur PLUS RÉCENTE que la dernière synchronisation remplace l'état local ;
 *  - première synchronisation avec des données des deux côtés : fusion (union), puis envoi ;
 *  - un téléphone vierge n'envoie rien (pas de ligne inutile côté serveur).
 */
import {
  BUILTIN_LISTS,
  MAX_SPOTS_PER_LIST,
  normalizeState,
  type ListsState,
  type UserList,
} from './userListsLogic.ts';

export interface SyncMeta {
  /** Des modifications locales n'ont pas encore été confirmées par le serveur. */
  dirty: boolean;
  /** Date serveur (ms) de la dernière copie envoyée ou reçue ; 0 = jamais synchronisé. */
  syncedAt: number;
}

export const INITIAL_META: SyncMeta = { dirty: false, syncedAt: 0 };

/** Réponse de get_my_lists : `data` nul = aucune copie sur le serveur. */
export interface RemoteLists {
  data: unknown | null;
  updated: number;
}

export type SyncPlan =
  | { action: 'none' }
  | { action: 'push' }
  | { action: 'adopt'; state: ListsState }
  | { action: 'merge'; state: ListsState };

/** Rien de saisi par l'utilisateur : uniquement les listes de base, sans adresse. */
export function isPristine(state: ListsState): boolean {
  return state.lists.length === BUILTIN_LISTS.length && state.lists.every((l) => l.kind !== 'custom' && l.spotIds.length === 0);
}

/** Lit la copie du serveur ou du stockage de façon sûre (valeurs inattendues écartées). */
export function parseSyncMeta(raw: unknown): SyncMeta {
  const v = raw as { dirty?: unknown; syncedAt?: unknown } | null | undefined;
  if (!v || typeof v !== 'object') return INITIAL_META;
  const syncedAt = Number(v.syncedAt);
  return { dirty: v.dirty === true, syncedAt: Number.isFinite(syncedAt) && syncedAt > 0 ? Math.floor(syncedAt) : 0 };
}

/** Union de deux états : listes réunies par identifiant, adresses réunies (locales d'abord), nom/pastille de la plus récente. */
export function mergeStates(local: ListsState, remote: ListsState, now: number): ListsState {
  const byId = new Map<string, UserList>();
  for (const l of local.lists) byId.set(l.id, l);
  for (const r of remote.lists) {
    const l = byId.get(r.id);
    if (!l) {
      byId.set(r.id, r);
      continue;
    }
    const newer = r.updatedAt > l.updatedAt ? r : l;
    byId.set(r.id, {
      ...l,
      name: newer.name,
      emoji: newer.emoji,
      spotIds: Array.from(new Set([...l.spotIds, ...r.spotIds])).slice(0, MAX_SPOTS_PER_LIST),
      createdAt: Math.min(l.createdAt, r.createdAt),
      updatedAt: Math.max(l.updatedAt, r.updatedAt),
    });
  }
  // normalizeState applique les plafonds (20 listes), retrouve les listes de base et écarte les valeurs invalides
  return normalizeState({ lists: Array.from(byId.values()) }, now);
}

/**
 * Que faire de la copie du serveur ? `remote` nul = serveur injoignable ou fonction pas encore installée : on ne
 * touche à rien (les modifications restent marquées « à envoyer »).
 */
export function planSync(local: ListsState, meta: SyncMeta, remote: RemoteLists | null, now: number): SyncPlan {
  if (!remote) return { action: 'none' };
  if (meta.dirty) return { action: 'push' };

  if (remote.data === null || remote.data === undefined) {
    return isPristine(local) ? { action: 'none' } : { action: 'push' };
  }
  const remoteState = normalizeState(remote.data, now);

  if (meta.syncedAt === 0) {
    if (isPristine(local)) return { action: 'adopt', state: remoteState };
    return { action: 'merge', state: mergeStates(local, remoteState, now) };
  }
  if (remote.updated > meta.syncedAt) return { action: 'adopt', state: remoteState };
  return { action: 'none' };
}

/** Faut-il envoyer maintenant ? Pas plus d'une tentative ratée toutes les 30 s (pas de martèlement hors connexion). */
export function shouldPush(meta: SyncMeta, lastFailureAt: number, now: number): boolean {
  return meta.dirty && now - lastFailureAt >= 30_000;
}
