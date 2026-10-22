/**
 * Enveloppe un fetch pour qu'aucune requête ne reste suspendue indéfiniment (réseau coupé, filtré ou très lent) :
 * passé le délai, la requête est annulée et échoue, ce qui permet à l'appli d'utiliser ses données locales
 * au lieu d'afficher un chargement sans fin. Une annulation demandée par l'appelant reste respectée.
 *
 * - Le minuteur n'est PAS arrêté à l'arrivée des en-têtes : il couvre aussi la lecture du corps de la réponse
 *   (annuler une requête déjà terminée est sans effet).
 * - Un dépassement de délai échoue avec une erreur nommée « AbortError » : c'est le nom que supabase-js
 *   reconnaît comme une annulation volontaire et ne relance donc pas (sinon, jusqu'à 3 nouvelles tentatives).
 */
export function withTimeout(fetchImpl: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, ms);
    const upstream = init?.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return fetchImpl(input, { ...init, signal: controller.signal }).catch((err) => {
      clearTimeout(timer);
      if (timedOut) {
        const e = new Error(`Délai dépassé (${Math.round(ms / 1000)} s)`);
        e.name = 'AbortError';
        throw e;
      }
      throw err;
    });
  };
}

/**
 * Limite le temps d'attente d'une opération sans annulation possible (ex. position GPS) :
 * passé le délai, la promesse échoue au lieu de rester suspendue indéfiniment.
 */
export function withDeadline<T>(promise: Promise<T>, ms: number, message = 'Délai dépassé'): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, deadline]).finally(() => clearTimeout(timer));
}
