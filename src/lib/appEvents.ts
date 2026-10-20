/**
 * Petit bus d'événements interne, identique sur web, iOS et Android.
 * Remplace window.addEventListener / dispatchEvent / CustomEvent : sur téléphone `window` existe mais ces
 * fonctions n'existent pas, ce qui faisait planter l'écran d'accueil au lancement.
 */

export type AppEventListener = (event: { detail: any }) => void;

const listeners = new Map<string, Set<AppEventListener>>();

/** S'abonne à un événement ; renvoie la fonction de désabonnement. */
export function onAppEvent(name: string, listener: AppEventListener): () => void {
  let set = listeners.get(name);
  if (!set) {
    set = new Set();
    listeners.set(name, set);
  }
  set.add(listener);
  return () => {
    set!.delete(listener);
  };
}

/** Diffuse un événement. Une erreur dans un abonné n'empêche jamais les autres de recevoir. */
export function emitAppEvent(name: string, detail?: any): void {
  const set = listeners.get(name);
  if (!set) return;
  for (const listener of Array.from(set)) {
    try {
      listener({ detail });
    } catch (e) {
      console.warn(`[appEvents] abonné en erreur pour « ${name} »:`, e);
    }
  }
}
