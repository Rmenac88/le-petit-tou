/**
 * Thème de l'année du haut de l'accueil : logique pure (sans réseau ni React), testée avec node:test.
 *
 * Le réglage public est un objet { name, bg, bg2, accent, text, stars, line1, line2, subtitle } (migration 014).
 * Quoi qu'il contienne, l'écran reste lisible : `resolveTheme` corrige les couleurs de texte trop proches du fond,
 * et toute valeur illisible redonne le thème d'origine (« Galaxy ») au lieu d'une erreur ou d'un demi-thème.
 */
import { HEX_COLOR, contrastRatio, relativeLuminance } from './colorContrast.ts';

export const THEME_SETTING_KEY = 'home_theme';

/** Longueurs maximales : les mêmes que celles imposées par le serveur (migration 014). */
export const THEME_TEXT_LIMITS = { name: 40, line1: 40, line2: 40, subtitle: 90 } as const;

export interface HomeTheme {
  name: string;
  /** Couleur du fond du bandeau (début du dégradé). */
  bg: string;
  /** Fin du dégradé ; null = fond uni. */
  bg2: string | null;
  /** Couleur de la seconde ligne du titre (« en rose. »). */
  accent: string;
  /** Couleur de la première ligne du titre et du sous-titre. */
  text: string;
  stars: boolean;
  line1: string;
  line2: string;
  subtitle: string;
}

/** Thème d'origine : le violet sidéral actuel. Repli de tout. */
export const DEFAULT_THEME: HomeTheme = {
  name: 'Galaxy',
  bg: '#2b1d46',
  bg2: null,
  accent: '#ff8fa3',
  text: '#ffffff',
  stars: true,
  line1: 'Pour voir la ville',
  line2: 'en rose.',
  subtitle: 'Les bonnes adresses, testées pour de vrai.',
};

/** Thèmes proposés dans le portail : un point de départ à ajuster, pas une obligation. */
export const THEME_PRESETS: readonly HomeTheme[] = [
  DEFAULT_THEME,
  {
    ...DEFAULT_THEME,
    name: 'Rose Toulouse',
    bg: '#c93049',
    bg2: '#8e1f37',
    accent: '#ffe0a8',
    stars: false,
  },
  {
    ...DEFAULT_THEME,
    name: 'Nuit d’été',
    bg: '#0f2a43',
    bg2: '#1f5f7a',
    accent: '#7fe0d0',
    stars: true,
  },
  {
    ...DEFAULT_THEME,
    name: 'Violet Occitanie',
    bg: '#3b1f63',
    bg2: '#7a2d7e',
    accent: '#ffb86b',
    stars: true,
  },
  {
    ...DEFAULT_THEME,
    name: 'Brique',
    bg: '#5c2418',
    bg2: '#a3452c',
    accent: '#ffd9a0',
    stars: false,
  },
  {
    ...DEFAULT_THEME,
    name: 'Lumière',
    bg: '#fff1ec',
    bg2: '#ffd9e0',
    accent: '#c93049',
    text: '#2b1d46',
    stars: false,
  },
];

/** Couleurs proposées sous chaque champ du portail (en plus de la saisie libre #RRGGBB). */
export const THEME_SWATCHES: readonly string[] = [
  '#2b1d46', '#3b1f63', '#0f2a43', '#1f5f7a', '#c93049', '#8e1f37',
  '#a3452c', '#5c2418', '#ff8fa3', '#ffb86b', '#ffe0a8', '#7fe0d0',
  '#fff1ec', '#ffd9e0', '#ffffff', '#1a1a22',
];

/** Nettoie un texte : espaces simplifiés, caractères de contrôle retirés, longueur bornée. */
export function cleanThemeText(raw: unknown, max: number): string {
  if (typeof raw !== 'string') return '';
  return raw.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Met une saisie au format #rrggbb, ou renvoie null si ce n'est pas une couleur valide (« abc » n'est pas acceptée). */
export function normalizeHex(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  const withHash = v.startsWith('#') ? v : `#${v}`;
  return HEX_COLOR.test(withHash) ? withHash.toLowerCase() : null;
}

/**
 * Lit le réglage reçu de la base. Une couleur ou un indicateur d'étoiles invalide = thème d'origine en entier
 * (jamais un mélange de deux thèmes) ; un texte invalide retrouve sa valeur d'origine.
 */
export function parseHomeTheme(raw: unknown): HomeTheme {
  const v = raw as Record<string, unknown> | null | undefined;
  if (!v || typeof v !== 'object' || Array.isArray(v)) return DEFAULT_THEME;
  const bg = normalizeHex(v.bg);
  const accent = normalizeHex(v.accent);
  const text = normalizeHex(v.text);
  if (!bg || !accent || !text || typeof v.stars !== 'boolean') return DEFAULT_THEME;
  const bg2 = v.bg2 == null ? null : normalizeHex(v.bg2);
  if (v.bg2 != null && !bg2) return DEFAULT_THEME;
  return {
    name: cleanThemeText(v.name, THEME_TEXT_LIMITS.name) || DEFAULT_THEME.name,
    bg,
    bg2,
    accent,
    text,
    stars: v.stars,
    line1: cleanThemeText(v.line1, THEME_TEXT_LIMITS.line1) || DEFAULT_THEME.line1,
    line2: cleanThemeText(v.line2, THEME_TEXT_LIMITS.line2) || DEFAULT_THEME.line2,
    subtitle: cleanThemeText(v.subtitle, THEME_TEXT_LIMITS.subtitle) || DEFAULT_THEME.subtitle,
  };
}

export function sameTheme(a: HomeTheme, b: HomeTheme): boolean {
  return (
    a.name === b.name && a.bg === b.bg && a.bg2 === b.bg2 && a.accent === b.accent && a.text === b.text &&
    a.stars === b.stars && a.line1 === b.line1 && a.line2 === b.line2 && a.subtitle === b.subtitle
  );
}

/** Même apparence (couleurs et étoiles), quelles que soient les phrases : sert à repérer le préréglage choisi. */
export function sameLook(a: HomeTheme, b: HomeTheme): boolean {
  return a.bg === b.bg && a.bg2 === b.bg2 && a.accent === b.accent && a.text === b.text && a.stars === b.stars;
}

/** Applique l'apparence d'un préréglage en gardant les phrases déjà saisies. */
export function applyPreset(draft: HomeTheme, preset: HomeTheme): HomeTheme {
  return { ...draft, name: preset.name, bg: preset.bg, bg2: preset.bg2, accent: preset.accent, text: preset.text, stars: preset.stars };
}

/** Ce qu'on envoie au serveur : couleurs en minuscules, textes nettoyés. */
export function themePayload(theme: HomeTheme): Record<string, unknown> {
  return {
    name: cleanThemeText(theme.name, THEME_TEXT_LIMITS.name),
    bg: theme.bg.toLowerCase(),
    bg2: theme.bg2 ? theme.bg2.toLowerCase() : null,
    accent: theme.accent.toLowerCase(),
    text: theme.text.toLowerCase(),
    stars: !!theme.stars,
    line1: cleanThemeText(theme.line1, THEME_TEXT_LIMITS.line1),
    line2: cleanThemeText(theme.line2, THEME_TEXT_LIMITS.line2),
    subtitle: cleanThemeText(theme.subtitle, THEME_TEXT_LIMITS.subtitle),
  };
}

/** Message à afficher si le thème ne peut pas être enregistré, sinon null (le serveur revérifie tout). */
export function validateThemeDraft(draft: HomeTheme): string | null {
  for (const [label, value] of [['fond', draft.bg], ['accent', draft.accent], ['texte', draft.text]] as const) {
    if (!normalizeHex(value)) return `La couleur « ${label} » doit être au format #RRGGBB (par exemple #2B1D46).`;
  }
  if (draft.bg2 != null && !normalizeHex(draft.bg2)) return 'La couleur de fin du dégradé doit être au format #RRGGBB, ou vide.';
  for (const [key, label] of [['name', 'nom du thème'], ['line1', 'première ligne'], ['line2', 'seconde ligne'], ['subtitle', 'sous-titre']] as const) {
    const text = cleanThemeText(draft[key], 1000);
    if (!text) return `Le champ « ${label} » est vide.`;
    if (text.length > THEME_TEXT_LIMITS[key]) return `Le champ « ${label} » est trop long (${THEME_TEXT_LIMITS[key]} caractères au maximum).`;
  }
  const bg2 = draft.bg2 ? normalizeHex(draft.bg2) : null;
  const resolved = resolveTheme({ ...draft, bg: normalizeHex(draft.bg) as string, bg2, accent: normalizeHex(draft.accent) as string, text: normalizeHex(draft.text) as string });
  if (!resolved.legible) {
    return 'Les deux couleurs du fond sont trop éloignées : aucun texte ne serait lisible partout. Rapproche-les (deux tons sombres, ou deux tons clairs).';
  }
  return null;
}

// --- Rendu : ce que l'écran applique réellement --------------------------------------------------------------------

export interface ResolvedTheme {
  /** Un ou deux fonds : deux = dégradé en diagonale. */
  backgrounds: string[];
  titleColor: string;
  accentColor: string;
  subtitleColor: string;
  showStars: boolean;
  /** Voile posé sur une image de fond : même teinte que le thème, pour que le texte reste lisible. */
  scrim: string;
  /** Vrai si une couleur de texte ou d'accent a dû être corrigée pour rester lisible. */
  adjusted: boolean;
  /** Faux si aucun texte ne peut être lu sur tout le fond (dégradé entre deux couleurs trop éloignées). */
  legible: boolean;
  line1: string;
  line2: string;
  subtitle: string;
}

const WHITE = '#ffffff';
const INK = '#1a1a22';
const BLACK = '#000000';

const minContrast = (fg: string, bgs: readonly string[]) => Math.min(...bgs.map((b) => contrastRatio(fg, b)));

/** Mélange de deux couleurs : t = part de `a` (0 à 1). */
export function mixHex(a: string, b: string, t: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  const part = (i: number) => Math.round(ch(a, i) * t + ch(b, i) * (1 - t)).toString(16).padStart(2, '0');
  return `#${part(1)}${part(3)}${part(5)}`;
}

/**
 * Couleurs réellement appliquées. Le texte doit atteindre 4,5:1 sur chaque couleur du fond, l'accent (grand titre en
 * gras) 3:1 ; sinon on choisit la couleur lisible la plus proche de l'intention (blanc, encre de la marque, noir).
 * Les étoiles blanches n'ont de sens que sur un fond sombre.
 */
export function resolveTheme(theme: HomeTheme): ResolvedTheme {
  const backgrounds = theme.bg2 ? [theme.bg, theme.bg2] : [theme.bg];
  let adjusted = false;

  let titleColor = theme.text;
  if (minContrast(titleColor, backgrounds) < 4.5) {
    adjusted = true;
    const ok = [WHITE, INK, BLACK].find((c) => minContrast(c, backgrounds) >= 4.5);
    titleColor = ok ?? (minContrast(WHITE, backgrounds) >= minContrast(BLACK, backgrounds) ? WHITE : BLACK);
  }

  let accentColor = theme.accent;
  if (minContrast(accentColor, backgrounds) < 3) {
    adjusted = true;
    accentColor = titleColor;
  }

  // Sous-titre : le texte légèrement estompé, tant qu'il reste à 4,5:1 (sinon plein).
  const mid = backgrounds.length === 2 ? mixHex(backgrounds[0], backgrounds[1], 0.5) : backgrounds[0];
  const soft = mixHex(titleColor, mid, 0.82);
  const subtitleColor = minContrast(soft, backgrounds) >= 4.5 ? soft : titleColor;

  const dark = backgrounds.every((b) => relativeLuminance(b) < 0.35);
  return {
    backgrounds,
    titleColor,
    accentColor,
    subtitleColor,
    showStars: theme.stars && dark,
    scrim: `${mid}80`,
    adjusted,
    legible: minContrast(titleColor, backgrounds) >= 4.5,
    line1: theme.line1,
    line2: theme.line2,
    subtitle: theme.subtitle,
  };
}
