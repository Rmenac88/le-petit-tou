/**
 * Interrupteurs de fonctionnalités.
 *
 * externalRatings : notes et avis issus de services tiers (Google, TripAdvisor…).
 *   Désactivé tant que le droit de les republier n'est pas confirmé (voir
 *   docs/BRIEF_PUBLICATION.md §4.1). Les notes ne sont ni affichées, ni triables,
 *   ni embarquées dans le jeu de données de l'appli.
 */
export const Features = {
  externalRatings: false,
} as const;
