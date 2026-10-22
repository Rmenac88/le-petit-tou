const strip = (s: string): string =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/**
 * Texte de catégorie d'une adresse, utilisé par les filtres rapides et la recherche.
 * Le jeu de données ne porte pas de champ `category` mais un `category_id` : on le traduit en nom de
 * catégorie et on y ajoute les tags et le fil d'Ariane (ex. « Brunch », « Terrasse »).
 */
export function categoryText(address: any, categoryNames: Record<string, string>): string {
  const parts: unknown[] = [address?.category, categoryNames[address?.category_id]];
  if (Array.isArray(address?.tags)) parts.push(...address.tags);
  if (Array.isArray(address?.breadcrumbs)) parts.push(...address.breadcrumbs);
  return strip(parts.filter((p): p is string => typeof p === 'string' && p.length > 0).join(' '));
}
