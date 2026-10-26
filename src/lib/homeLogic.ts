/**
 * Logique pure de la page d'accueil (sans React Native) : classement des « chouchous du moment »
 * et aperçu de l'agenda des partenaires.
 */
import { addDays, expandOccurrences, type Occurrence, type PartnerEventRow } from './agendaOccurrences.ts';

export interface RankableSpot {
  id: string;
  title?: string;
  rating?: number | string | null;
  is_recommended?: boolean | null;
  likes_count?: number | string | null;
}

/** Nombre de likes d'une adresse : décompte global récent s'il existe, sinon colonne de la base. */
export function likesOf(spot: RankableSpot, likesMap: Record<string, number>): number {
  const fromMap = likesMap[spot.id];
  const n = fromMap ?? Number(spot.likes_count);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * « Chouchous du moment » : plus une adresse a de likes, plus elle est mise en avant. Sont retenues les adresses qui ont
 * au moins un like et, à défaut de likes, les adresses recommandées par l'équipe. À likes égaux : recommandées d'abord,
 * puis meilleure note, puis ordre alphabétique (classement stable d'une ouverture à l'autre).
 */
export function rankChouchous<T extends RankableSpot>(
  spots: readonly T[],
  likesMap: Record<string, number>,
  limit = 12
): T[] {
  const rating = (s: T) => {
    const r = Number(s.rating);
    return Number.isFinite(r) ? r : 0;
  };
  return spots
    .filter((s) => likesOf(s, likesMap) > 0 || !!s.is_recommended)
    .slice()
    .sort((a, b) => {
      const likeDiff = likesOf(b, likesMap) - likesOf(a, likesMap);
      if (likeDiff !== 0) return likeDiff;
      const recDiff = Number(!!b.is_recommended) - Number(!!a.is_recommended);
      if (recDiff !== 0) return recDiff;
      const ratingDiff = rating(b) - rating(a);
      if (ratingDiff !== 0) return ratingDiff;
      return String(a.title ?? '').localeCompare(String(b.title ?? ''), 'fr');
    })
    .slice(0, limit);
}

/** Prochaines dates de l'agenda des partenaires (aujourd'hui inclus), uniquement pour des adresses connues. */
export function upcomingPartnerOccurrences(
  events: PartnerEventRow[],
  todayIso: string,
  knownSpotIds: ReadonlySet<string>,
  days = 14,
  limit = 6
): Occurrence[] {
  return expandOccurrences(events, todayIso, addDays(todayIso, days - 1))
    .filter((o) => knownSpotIds.has(o.event.spot_id))
    .slice(0, limit);
}
