/**
 * Fond personnalisable du bandeau d'accueil : logique pure (sans réseau ni React), testée avec node:test.
 * Le réglage public est { mode: 'galaxy' } (thème d'origine, repli de tout) ou { mode: 'image', path, updated }.
 */

export const BACKGROUND_BUCKET = 'app-backgrounds';
export const BACKGROUND_MAX_BYTES = 2 * 1024 * 1024;
export const BACKGROUND_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const BACKGROUND_SETTING_KEY = 'home_background';

export type HomeBackground = { mode: 'galaxy' } | { mode: 'image'; path: string; updated: number };

export const GALAXY: HomeBackground = { mode: 'galaxy' };

// Même forme que celle imposée par le serveur (migration 012) : un chemin venu d'ailleurs est refusé.
const PATH_RE = /^home\/\d{8}-[0-9a-f]{32}\.(jpg|png|webp)$/;

/** Lit le réglage reçu de la base ; toute valeur inattendue donne le thème Galaxy (jamais d'erreur à l'écran). */
export function parseHomeBackground(raw: unknown): HomeBackground {
  const v = raw as { mode?: unknown; path?: unknown; updated?: unknown } | null | undefined;
  if (!v || typeof v !== 'object' || v.mode !== 'image') return GALAXY;
  if (typeof v.path !== 'string' || !PATH_RE.test(v.path)) return GALAXY;
  const updated = Number(v.updated);
  return { mode: 'image', path: v.path, updated: Number.isFinite(updated) && updated > 0 ? Math.floor(updated) : 0 };
}

/** Adresse publique de l'image (le paramètre v force le rafraîchissement quand l'admin la remplace). */
export function backgroundImageUrl(supabaseUrl: string, bg: HomeBackground): string | null {
  if (bg.mode !== 'image' || !supabaseUrl) return null;
  const base = supabaseUrl.replace(/\/+$/, '');
  return `${base}/storage/v1/object/public/${BACKGROUND_BUCKET}/${bg.path}?v=${bg.updated}`;
}

export function extensionForMime(mime: string | null | undefined): 'jpg' | 'png' | 'webp' | null {
  switch ((mime ?? '').toLowerCase()) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    default:
      return null;
  }
}

/** Type MIME d'un fichier choisi : celui annoncé par le sélecteur, sinon déduit de l'extension du nom. */
export function guessMime(uri: string, announced?: string | null): string | null {
  if (extensionForMime(announced)) return announced === 'image/jpg' ? 'image/jpeg' : (announced as string).toLowerCase();
  const m = /\.([a-z0-9]{3,4})(?:\?|#|$)/i.exec(uri);
  switch (m?.[1]?.toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return null;
  }
}

/** Message à afficher si le fichier est refusé, sinon null (le serveur et le stockage revérifient tout). */
export function validateBackgroundFile(file: { mimeType: string | null; size: number | null | undefined }): string | null {
  if (!extensionForMime(file.mimeType)) return 'Format non pris en charge : choisis une image JPEG, PNG ou WebP.';
  if (file.size == null || !(file.size > 0)) return 'Impossible de lire la taille de cette image : choisis-en une autre.';
  if (file.size > BACKGROUND_MAX_BYTES) {
    const mo = (file.size / (1024 * 1024)).toFixed(1).replace('.', ',');
    return `Image trop lourde (${mo} Mo) : 2 Mo au maximum. Recadre-la ou choisis-en une plus légère.`;
  }
  return null;
}

/** Conseil de qualité (non bloquant) : le bandeau fait environ 4:3 et s'affiche sur de grands écrans. */
export function sizeAdvice(width?: number | null, height?: number | null): string | null {
  if (!width || !height) return null;
  if (width < 800) return 'Cette image est petite : elle risque d’être floue. Vise au moins 1200 px de large.';
  return null;
}
