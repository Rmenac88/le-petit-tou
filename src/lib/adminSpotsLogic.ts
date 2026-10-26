/**
 * Liste des adresses du portail admin : colonnes légères, recherche, mises à jour locales.
 * Logique pure (aucune dépendance React Native) pour rester testable et rapide sur téléphone.
 */

/**
 * Colonnes de la LISTE. Les descriptions (description + full_description) pèsent à elles seules 60 % des
 * 1,6 Mo de la table : elles ne sont chargées qu'à l'ouverture d'une fiche, pas pour afficher 790 lignes.
 */
export const SPOT_LIST_COLUMNS =
  'id, title, category_id, address, location, image_url, rating, price_level, is_recommended, is_new, tags';

export interface AdminSpot {
  id: string;
  title?: string;
  name?: string;
  category_id?: string | null;
  address?: string;
  location?: string;
  image_url?: string;
  tags?: unknown;
  [key: string]: unknown;
}

const strip = (s: unknown): string =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Texte de recherche calculé une seule fois par ligne (et non à chaque lettre tapée)
const haystacks = new WeakMap<object, string>();
function haystackOf(spot: AdminSpot): string {
  let h = haystacks.get(spot);
  if (h === undefined) {
    h = strip(`${spot.title ?? spot.name ?? ''} ${spot.address ?? ''} ${spot.location ?? ''}`);
    haystacks.set(spot, h);
  }
  return h;
}

/** Recherche sans accents ni majuscules : tous les mots saisis doivent apparaître (nom, rue, quartier). */
export function filterSpotsByQuery<T extends AdminSpot>(spots: readonly T[], query: string): readonly T[] {
  const words = strip(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return spots;
  return spots.filter((s) => {
    const h = haystackOf(s);
    return words.every((w) => h.includes(w));
  });
}

/** Nom de catégorie affiché sur une ligne : identifiant de la base, sinon classement automatique, sinon « Adresse ». */
export function categoryLabelFor(
  spot: AdminSpot,
  namesById: ReadonlyMap<string, string>,
  classify: (spot: AdminSpot) => string | undefined
): string {
  if (spot.category_id && namesById.has(spot.category_id)) return namesById.get(spot.category_id)!;
  const guessed = classify(spot);
  return (guessed && namesById.get(guessed)) || 'Adresse';
}

/** Ajoute une adresse en tête de liste ou remplace celle qui porte le même identifiant (sans muter la liste). */
export function upsertSpot<T extends AdminSpot>(list: readonly T[], record: T): T[] {
  const index = list.findIndex((s) => s.id === record.id);
  if (index === -1) return [record, ...list];
  const next = list.slice();
  next[index] = { ...list[index], ...record };
  return next;
}

export function removeSpot<T extends AdminSpot>(list: readonly T[], id: string): T[] {
  return list.filter((s) => s.id !== id);
}
