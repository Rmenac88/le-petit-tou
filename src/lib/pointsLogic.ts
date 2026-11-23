/**
 * Barème des points d'une adresse : COPIE EXACTE de la règle du serveur (discover_place, migration 006), pour que
 * l'appli affiche toujours les points réellement enregistrés. Logique pure, testée avec node:test.
 *   1. la valeur fixée pour l'adresse (points_reward > 0) ;
 *   2. sinon 25 si l'adresse est recommandée par l'équipe ;
 *   3. sinon 20 si sa note est d'au moins 4,8 ;
 *   4. sinon 10.
 */
export interface PointsSource {
  points_reward?: number | string | null;
  is_recommended?: boolean | null;
  rating?: number | string | null;
}

export function pointsFor(spot: PointsSource | null | undefined): number {
  if (!spot) return 10;
  const fixed = Number(spot.points_reward);
  if (Number.isFinite(fixed) && fixed > 0) return Math.floor(fixed);
  if (spot.is_recommended === true) return 25;
  const rating = spot.rating === null || spot.rating === undefined || spot.rating === '' ? NaN : Number(spot.rating);
  if (Number.isFinite(rating) && rating >= 4.8) return 20;
  return 10;
}
