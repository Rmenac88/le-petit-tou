/**
 * Likes : le serveur fait foi (get_my_likes, migration 023) ; les likes pas encore reçus par le serveur (hors
 * connexion, erreur) sont gardés « en attente » et renvoyés au prochain lancement. Logique pure, testée avec node:test.
 */
export type PendingLikes = Record<string, 1 | -1>;

export function parsePending(text: string | null | undefined): PendingLikes {
  if (!text) return {};
  try {
    const v = JSON.parse(text);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: PendingLikes = {};
    for (const [k, d] of Object.entries(v)) if ((d === 1 || d === -1) && k.length > 0 && k.length <= 64) out[k] = d;
    return out;
  } catch {
    return {};
  }
}

/** Le dernier geste sur une adresse remplace le précédent (liker puis retirer = retirer). */
export function recordPending(pending: PendingLikes, spotId: string, delta: 1 | -1): PendingLikes {
  return { ...pending, [spotId]: delta };
}

export function clearPending(pending: PendingLikes, spotId: string): PendingLikes {
  const next = { ...pending };
  delete next[spotId];
  return next;
}

/** Likes à afficher : ceux du serveur, corrigés par les gestes pas encore envoyés. Ordre du serveur conservé. */
export function mergeServerLikes(serverIds: readonly string[], pending: PendingLikes): string[] {
  const out = serverIds.map(String).filter((id) => pending[id] !== -1);
  const seen = new Set(out);
  for (const [id, d] of Object.entries(pending)) if (d === 1 && !seen.has(id)) out.push(id);
  return out;
}
