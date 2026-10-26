/**
 * Sélecteur « Ajouter des adresses » d'une liste : logique pure (sans React Native), testée avec node:test.
 * Sans saisie : des suggestions (adresses recommandées puis mieux notées) ; à partir de 2 lettres : recherche du guide
 * sans accents ni majuscules (la même que le portail).
 */
import { searchSpots, type SearchableSpot } from './spotSearch.ts';

export interface PickableSpot extends SearchableSpot {
  is_recommended?: boolean | null;
  rating?: number | string | null;
}

export const PICKER_SUGGESTIONS = 20;
export const PICKER_RESULTS = 40;

const ratingOf = (s: PickableSpot): number => {
  const r = Number(s.rating);
  return Number.isFinite(r) ? r : 0;
};
const titleOf = (s: PickableSpot): string => String(s.title ?? s.name ?? '');

/** Adresses proposées avant toute saisie : recommandées d'abord, puis meilleure note, puis ordre alphabétique. */
export function suggestedSpots<T extends PickableSpot>(spots: readonly T[], limit = PICKER_SUGGESTIONS): T[] {
  return spots
    .slice()
    .sort((a, b) => {
      const rec = Number(!!b.is_recommended) - Number(!!a.is_recommended);
      if (rec !== 0) return rec;
      const rate = ratingOf(b) - ratingOf(a);
      if (rate !== 0) return rate;
      return titleOf(a).localeCompare(titleOf(b), 'fr');
    })
    .slice(0, limit);
}

/** Liste affichée dans le sélecteur pour la saisie courante. */
export function pickerResults<T extends PickableSpot>(spots: readonly T[], query: string, limit = PICKER_RESULTS): T[] {
  const clean = query.trim();
  if (clean.length < 2) return suggestedSpots(spots);
  return searchSpots(spots, clean, limit);
}
