/**
 * Code de récupération du profil : c'est l'identifiant anonyme de l'installation, affiché pour que la personne le
 * note. Sur un nouveau téléphone (ou après réinstallation sur Android), le saisir retrouve ses likes, listes, points
 * et cartes utilisées. C'est aussi lui qu'on cite pour demander l'effacement d'un profil perdu (contact@…).
 * Attention : quiconque connaît ce code accède au profil ; il se garde comme un mot de passe.
 * Logique pure, testée avec node:test.
 */
const UUID_HEX = /^[0-9a-f]{32}$/;

/** Affichage : majuscules, en groupes lisibles (même valeur que l'identifiant, rien n'est ajouté). */
export function formatRecoveryCode(deviceId: string): string {
  const hex = String(deviceId ?? '').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (!UUID_HEX.test(hex)) return '';
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`.toUpperCase();
}

/** Saisie : espaces, tirets et casse ignorés ; renvoie l'identifiant normalisé, ou null si ce n'est pas un code. */
export function parseRecoveryCode(input: string): string | null {
  const hex = String(input ?? '').toLowerCase().replace(/[\s-]/g, '');
  if (!UUID_HEX.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface ProfileFootprint {
  discoveries: number;
  likes: number;
  lists: number;
}

export type RestoreDecision =
  | { ok: true; deviceId: string }
  | { ok: false; error: string };

/** Décide si l'on remplace le profil de ce téléphone par celui du code saisi. */
export function decideRestore(input: string, currentId: string, footprint: ProfileFootprint | null): RestoreDecision {
  const id = parseRecoveryCode(input);
  if (!id) return { ok: false, error: 'Code non valide : il compte 32 caractères (chiffres et lettres de A à F).' };
  if (id === parseRecoveryCode(currentId)) return { ok: false, error: 'C’est déjà le profil de ce téléphone.' };
  if (!footprint) return { ok: false, error: 'Connexion impossible : réessaie avec du réseau.' };
  if (footprint.discoveries + footprint.likes + footprint.lists === 0) {
    return { ok: false, error: 'Aucun profil ne correspond à ce code. Vérifie qu’il est complet.' };
  }
  return { ok: true, deviceId: id };
}
