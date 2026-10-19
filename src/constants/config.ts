/**
 * Constantes métier et de configuration centralisées (une seule source de vérité).
 * Les valeurs sensibles ou propres à un environnement (URL, clés) restent dans les variables d'environnement.
 */

/** Verrouillage automatique du portail admin après cette durée sans interaction. */
export const ADMIN_IDLE_LOCK_MS = 15 * 60 * 1000;

/** Adresse de contact pour les demandes RGPD (affichée dans l'appli et sur les pages web). */
export const PRIVACY_CONTACT_EMAIL = 'contact@lepetittou.net';

/** Zone de départ de la carte (centre de Toulouse). */
export const TOULOUSE_CENTER = { lat: 43.6047, lng: 1.4442 } as const;
