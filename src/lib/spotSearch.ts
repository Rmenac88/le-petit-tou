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

export function searchSpots<T extends SearchableSpot>(spots: readonly T[], query: string, limit = 8): T[] {
  const words = strip(query).split(/\s+/).filter(Boolean);
  if (words.length === 0 || strip(query).length < 2) return [];
  const scored: { spot: T; score: number }[] = [];
  for (const spot of spots) {
    const title = strip(spot.title ?? spot.name);
    const rest = [spot.location, spot.address, Array.isArray(spot.tags) ? spot.tags.join(' ') : ''].map(strip).join(' ');
    const haystack = `${title} ${rest}`;
    if (!words.every((w) => haystack.includes(w))) continue;
    const score = title === strip(query) ? 3 : title.startsWith(words[0]) ? 2 : title.includes(words[0]) ? 1 : 0;
    scored.push({ spot, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.spot);
}
