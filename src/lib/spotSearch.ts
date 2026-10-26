/**
 * Recherche rapide d'une adresse dans la liste du guide (portail admin) : sans accents ni majuscules, tous les
 * mots saisis doivent être trouvés (titre, quartier, adresse, étiquettes), les titres qui commencent par la saisie
 * passent en premier.
 */
const strip = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

export interface SearchableSpot {
  id: string;
  title?: string;
  name?: string;
  location?: string;
  address?: string;
  tags?: unknown;
}

// Texte normalisé de chaque adresse, calculé une seule fois (790 adresses × 4 champs à chaque lettre tapée
// coûtait plusieurs dizaines de millisecondes sur un téléphone).
const prepared = new WeakMap<object, { title: string; haystack: string }>();
function prepare(spot: SearchableSpot): { title: string; haystack: string } {
  let p = prepared.get(spot);
  if (!p) {
    const title = strip(spot.title ?? spot.name);
    const rest = [spot.location, spot.address, Array.isArray(spot.tags) ? spot.tags.join(' ') : ''].map(strip).join(' ');
    p = { title, haystack: `${title} ${rest}` };
    prepared.set(spot, p);
  }
  return p;
}

export function searchSpots<T extends SearchableSpot>(spots: readonly T[], query: string, limit = 8): T[] {
  const normalizedQuery = strip(query);
  const words = normalizedQuery.split(/\s+/).filter(Boolean);
  if (words.length === 0 || normalizedQuery.length < 2) return [];
  const scored: { spot: T; score: number }[] = [];
  for (const spot of spots) {
    const { title, haystack } = prepare(spot);
    if (!words.every((w) => haystack.includes(w))) continue;
    const score = title === normalizedQuery ? 3 : title.startsWith(words[0]) ? 2 : title.includes(words[0]) ? 1 : 0;
    scored.push({ spot, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.spot);
}
