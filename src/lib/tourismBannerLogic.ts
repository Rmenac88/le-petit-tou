/**
 * Bannière « Office de tourisme de Toulouse » de l'accueil : logique pure (sans réseau ni React), testée avec node:test.
 *
 * Le réglage public est un objet { url } (migration 020). L'Office de tourisme peut y mettre le lien de son choix depuis
 * le portail admin ; sans réglage, ou si le réglage est illisible, la bannière renvoie vers l'agenda officiel.
 * Seules les adresses https sont acceptées : jamais de http, de javascript:, de file: ni d'adresse avec identifiants.
 */
import { safeWebUrl } from './safeLinks.ts';

export const TOURISM_SETTING_KEY = 'tourism_banner';

/** Liste complète de l'agenda des sorties, sur le site officiel de l'Office de tourisme de Toulouse. */
export const DEFAULT_TOURISM_URL = 'https://www.toulouse-tourisme.com/sortir-a-toulouse/agenda-sorties-toulouse/';

/** Longueur maximale : la même que celle imposée par le serveur (migration 020). */
export const TOURISM_URL_MAX = 300;

export type TourismUrlCheck = { ok: true; url: string | null } | { ok: false; error: string };

/** Contrôle de ce que saisit l'admin. Vide = retour au lien par défaut (url null). Sans schéma : complété en https. */
export function validateTourismUrl(raw: string): TourismUrlCheck {
  const value = (raw ?? '').trim();
  if (!value) return { ok: true, url: null };
  if (value.length > TOURISM_URL_MAX) {
    return { ok: false, error: `Adresse trop longue (${TOURISM_URL_MAX} caractères au maximum).` };
  }
  if (/^http:\/\//i.test(value)) {
    return { ok: false, error: 'Utilise une adresse sécurisée qui commence par https://.' };
  }
  const safe = safeWebUrl(value);
  if (!safe) return { ok: false, error: 'Adresse non valide. Exemple : https://www.exemple.fr/agenda' };
  let parsed: URL;
  try {
    parsed = new URL(safe);
  } catch {
    return { ok: false, error: 'Adresse non valide. Exemple : https://www.exemple.fr/agenda' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, error: 'Utilise une adresse sécurisée qui commence par https://.' };
  if (parsed.username || parsed.password) {
    return { ok: false, error: 'L’adresse ne doit contenir ni identifiant ni mot de passe.' };
  }
  if (!parsed.hostname.includes('.') || parsed.hostname === 'localhost') {
    return { ok: false, error: 'Adresse non valide : il faut un nom de site complet (exemple.fr).' };
  }
  if (safe.length > TOURISM_URL_MAX) {
    return { ok: false, error: `Adresse trop longue (${TOURISM_URL_MAX} caractères au maximum).` };
  }
  return { ok: true, url: safe };
}

/** Réglage lu en base → lien à ouvrir. Toute valeur illisible redonne le lien par défaut. */
export function parseTourismBanner(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const url = (value as { url?: unknown }).url;
    if (typeof url === 'string') {
      const check = validateTourismUrl(url);
      if (check.ok && check.url) return check.url;
    }
  }
  return DEFAULT_TOURISM_URL;
}
