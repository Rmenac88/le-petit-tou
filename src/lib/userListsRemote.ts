import { supabase } from './supabase';
import { authService } from './authService';
import type { ListsState } from './userListsLogic';
import type { RemoteLists } from './userListsSyncLogic';

/**
 * Copie des listes sur le serveur (fonctions get_my_lists / save_my_lists, migration 015). Tout échec — hors connexion,
 * fonction pas encore installée, identité refusée — est silencieux et renvoie null : les listes restent sur le
 * téléphone et seront envoyées plus tard.
 */

export async function fetchRemoteLists(): Promise<RemoteLists | null> {
  try {
    const userId = await authService.getUserId();
    const { data, error } = await supabase.rpc('get_my_lists', { p_device_id: userId });
    if (error || !data || data.ok !== true) return null;
    return { data: data.data ?? null, updated: Number(data.updated) || 0 };
  } catch {
    return null;
  }
}

/** Envoie l'état complet ; renvoie la date serveur (ms) de la copie, ou null si l'envoi n'a pas abouti. */
export async function pushRemoteLists(state: ListsState): Promise<number | null> {
  try {
    const userId = await authService.getUserId();
    const { data, error } = await supabase.rpc('save_my_lists', { p_device_id: userId, p_data: state });
    if (error || !data || data.ok !== true) return null;
    const updated = Number(data.updated);
    return Number.isFinite(updated) && updated > 0 ? updated : null;
  } catch {
    return null;
  }
}
