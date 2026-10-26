/**
 * Direction artistique Le Petit Tou (cf. audit de marque)
 * - Rose brique = action & identité · rose poudré = surfaces douces
 * - Jaune ocre = label « Chouchou » · anthracite = texte · violet sidéral = nuit / pass
 */
export const Brand = {
  primary: '#E84A5F',
  primaryDeep: '#C93049',
  primarySoft: '#FDECEF',
  primarySofter: '#FCE4E8',
  /** Texte rose foncé lisible (≥ 4,5:1) sur les fonds roses doux — primaryDeep n'atteint que 4,3:1 dessus. */
  primaryInk: '#A52A40',
  /** Vert d'action (bouton « Ajouter » du portail) : texte blanc dessus ≥ 4,5:1. */
  successDeep: '#12805B',
  /** Ambre foncé pour la note chiffrée (étoile) sur fond blanc : ≥ 4,5:1. */
  ratingInk: '#B45309',
  chouchou: '#F2B835',
  chouchouDeep: '#B07A0A',
  ink: '#1A1A22',
  inkSoft: '#6A6A78',
  inkMute: '#9A9AA8',
  bg: '#F8F9FA',
  white: '#FFFFFF',
  line: '#ECE6EA',
  night: '#2B1D46',
  nightMid: '#3A235C',
  violet: '#6C4AB6',
} as const;

/** Échelle typographique (px) — aucune autre taille de texte courant */
export const Type = { caption: 12, small: 13, body: 14, bodyLg: 16, title3: 18, title2: 22, title1: 28 } as const;

/** Rayons d'angle */
export const Radius = { sm: 8, md: 12, lg: 20, xl: 28, pill: 999 } as const;

/** Cible tactile minimale et largeur de lecture sur grands écrans */
export const Touch = { min: 44 } as const;
export const Layout = { maxWidth: 720 } as const;

export const Gradients = {
  night: ['#2B1D46', '#3A235C', '#8A2F63'] as const,
  rose: ['#EE3B65', '#E84A5F', '#F2845C'] as const,
} as const;

export const Font = {
  display: 'BricolageGrotesque_700Bold',
  displayBlack: 'BricolageGrotesque_800ExtraBold',
} as const;

export const Shadow = {
  soft: {
    shadowColor: '#2B1D46',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  lift: {
    shadowColor: '#2B1D46',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 8,
  },
} as const;
