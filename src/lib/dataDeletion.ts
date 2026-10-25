/**
 * Effacement des données de l'utilisateur (RGPD art. 17).
 * Logique pure, dépendances injectées : testable sans React Native (voir __tests__/dataDeletion.test.ts).
 */

export interface DataDeletionDeps {
  /** Avant tout appel serveur : arrête les envois en attente (sinon une sauvegarde tardive recréerait des données). */
  beforeDelete?: () => Promise<void>;
  /** Identifiant de l'appareil / de la session, tel qu'envoyé aux fonctions serveur. */
  getUserId: () => Promise<string>;
  /** Appel de la fonction serveur delete_my_data. */
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: { message: string } | null }>;
  /** Nettoyage des copies locales (cache, file d'attente, likes) une fois le serveur confirmé. */
  clearLocal: () => Promise<void>;
}

export interface DataDeletionResult {
  ok: boolean;
  /** Message affichable, en français. */
  message: string;
}

export async function deleteMyData(deps: DataDeletionDeps): Promise<DataDeletionResult> {
  try {
    await deps.beforeDelete?.();
  } catch {}

  let userId: string;
  try {
    userId = await deps.getUserId();
  } catch {
    return { ok: false, message: "Impossible d'identifier cet appareil. Réessayez dans un instant." };
  }

  try {
    const { data, error } = await deps.rpc('delete_my_data', { p_device_id: userId });
    if (error || !data || data.success !== true) {
      return {
        ok: false,
        message: "L'effacement n'a pas pu être confirmé par le serveur. Vos données locales ont été conservées : réessayez avec une connexion stable.",
      };
    }
  } catch {
    return {
      ok: false,
      message: "Connexion impossible. Vos données n'ont pas été effacées : réessayez avec une connexion stable.",
    };
  }

  try {
    await deps.clearLocal();
  } catch {
    return {
      ok: true,
      message: "Vos données ont été effacées de nos serveurs. Quelques copies locales pourraient subsister : désinstallez puis réinstallez l'application pour les retirer.",
    };
  }
  return { ok: true, message: 'Vos données ont été effacées de nos serveurs et de cet appareil.' };
}
