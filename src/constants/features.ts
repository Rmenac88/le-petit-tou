/**
 * Interrupteurs de fonctionnalités.
 *
 * externalRatings : notes et avis issus de services tiers (Google, TripAdvisor…).
 *   Désactivé tant que le droit de les republier n'est pas confirmé (voir
 *   docs/BRIEF_PUBLICATION.md §4.1). Les notes ne sont ni affichées, ni triables,
 *   ni embarquées dans le jeu de données de l'appli.
 *
 * adminPortal : accès bénévole (7 appuis sur le logo). Activé seulement si le build est
 *   produit avec EXPO_PUBLIC_ENABLE_ADMIN=1 ; absent des builds destinés aux stores
 *   (une fonction cachée est refusée par les règles Apple 2.3.1).
 */
export const Features = {
  externalRatings: false,
  adminPortal: process.env.EXPO_PUBLIC_ENABLE_ADMIN === '1',
} as const;
