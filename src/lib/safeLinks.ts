/**
 * Liens issus de la base (site web, téléphone, réservation) : on n'ouvre que du http(s) et du tel: propres.
 * Évite d'ouvrir javascript:, file:, intent: ou un schéma applicatif inattendu glissé dans une fiche.
 */

/** Renvoie une URL http(s) sûre, ou null. Une adresse sans schéma (« exemple.fr ») est complétée en https. */
export function safeWebUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (!value || /\s/.test(value)) return null;
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(value);
  if (hasScheme && !/^https?:\/\//i.test(value)) return null;
  const candidate = hasScheme ? value : `https://${value}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** Renvoie « tel:+33… » (chiffres, + initial, espaces retirés) ou null si le numéro est inexploitable. */
export function safeTelUrl(raw: string | null | undefined): string | null {
  const digits = (raw ?? '').replace(/[^\d+]/g, '');
  const normalized = digits.replace(/(?!^)\+/g, '');
  if (normalized.replace('+', '').length < 6 || normalized.length > 20) return null;
  return `tel:${normalized}`;
}
