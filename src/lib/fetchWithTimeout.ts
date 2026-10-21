/**
 * Enveloppe un fetch pour qu'aucune requête ne reste suspendue indéfiniment (réseau coupé, filtré ou très lent) :
 * passé le délai, la requête est annulée et échoue, ce qui permet à l'appli d'utiliser ses données locales
 * au lieu d'afficher un chargement sans fin. Une annulation demandée par l'appelant reste respectée.
 */
export function withTimeout(fetchImpl: typeof fetch, ms: number): typeof fetch {
  return (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ms);
    const upstream = init?.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener('abort', () => controller.abort(), { once: true });
    }
    return fetchImpl(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
  };
}
