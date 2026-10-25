/**
 * Offres et réductions (onglet « - % ») : logique pure, sans React Native ni réseau.
 * Les offres sont les cartes de réduction de la base (table discount_cards).
 */

export type OfferCategory = 'food' | 'drinks' | 'shopping' | 'culture' | 'services';

export interface Offer {
  id: string;
  /** Identifiant de l'adresse concernée, si l'offre est liée à une adresse du guide. */
  partner_id: string | null;
  title: string;
  subtitle: string;
  category: OfferCategory;
  /** Avantage tel qu'affiché (« -20% », « 1 café offert »). */
  discount_value: string;
  badge_label: string;
  description: string;
  terms: string;
  max_uses: number;
  uses_count: number;
  remaining_uses: number;
  card_color_primary: string;
  card_color_secondary: string;
  visual_url: string | null;
  is_active: boolean;
  /** Fin de validité (instant) ; absente : sans limite. */
  valid_until: string | null;
  sort_order: number;
}

/**
 * Cartes d'exemple de la migration 002 (jeu de démonstration : « Le Bibent », « La Belle Brune »…). Elles ne
 * correspondent à aucune offre réelle : l'appli ne les affiche jamais. Le portail admin les signale pour les supprimer.
 */
export const DEMO_OFFER_IDS: ReadonlySet<string> = new Set([
  'a1111111-1111-1111-1111-111111111111',
  'a2222222-2222-2222-2222-222222222222',
  'a3333333-3333-3333-3333-333333333333',
  'a4444444-4444-4444-4444-444444444444',
  'a5555555-5555-5555-5555-555555555555',
]);

export const OFFER_CATEGORIES: readonly { id: OfferCategory; label: string }[] = [
  { id: 'food', label: 'Restos' },
  { id: 'drinks', label: 'Bars & cafés' },
  { id: 'shopping', label: 'Shopping' },
  { id: 'culture', label: 'Culture' },
  { id: 'services', label: 'Services' },
];

export type OfferFilter = 'all' | OfferCategory;

const CATEGORY_IDS = new Set<string>(OFFER_CATEGORIES.map((c) => c.id));
const HEX = /^#[0-9A-Fa-f]{6}$/;
// rose foncé : le texte blanc dessus atteint 5,2:1 (le rose vif de la marque seulement 3,8:1)
const DEFAULT_PRIMARY = '#C93049';
const DEFAULT_SECONDARY = '#8E1F37';

const text = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

/**
 * Transforme une ligne de la base en offre sûre pour l'affichage (couleurs valides, textes bornés, image en https
 * uniquement). Renvoie null si la ligne est inutilisable (pas d'identifiant, de nom ou d'avantage).
 */
export function normalizeOffer(row: any, usesCount = 0): Offer | null {
  if (!row || typeof row !== 'object') return null;
  const id = text(row.id, 64);
  const title = text(row.title, 80);
  const value = text(row.discount_value, 40);
  if (!id || !title || !value) return null;
  const maxUses = Math.min(99, Math.max(1, Math.trunc(Number(row.max_uses)) || 5));
  const uses = Math.max(0, Math.trunc(Number(usesCount)) || 0);
  const visual = text(row.visual_url, 500);
  return {
    id,
    partner_id: text(row.partner_id, 64) || null,
    title,
    subtitle: text(row.subtitle, 80),
    category: CATEGORY_IDS.has(row.category) ? (row.category as OfferCategory) : 'food',
    discount_value: value,
    badge_label: text(row.badge_label, 30) || 'MEMBRE PETIT TOU',
    description: text(row.description, 400),
    terms: text(row.terms, 400),
    max_uses: maxUses,
    uses_count: uses,
    remaining_uses: Math.max(0, maxUses - uses),
    card_color_primary: HEX.test(row.card_color_primary ?? '') ? row.card_color_primary : DEFAULT_PRIMARY,
    card_color_secondary: HEX.test(row.card_color_secondary ?? '') ? row.card_color_secondary : DEFAULT_SECONDARY,
    visual_url: /^https:\/\/\S+$/i.test(visual) ? visual : null,
    is_active: row.is_active !== false,
    valid_until: row.valid_until ? String(row.valid_until) : null,
    sort_order: Math.trunc(Number(row.sort_order)) || 0,
  };
}

export function isExpired(offer: Pick<Offer, 'valid_until'>, nowMs: number): boolean {
  if (!offer.valid_until) return false;
  const until = Date.parse(offer.valid_until);
  return Number.isFinite(until) && until <= nowMs;
}

/** Une offre est affichée si elle est active, réelle (pas un exemple) et pas expirée. */
export function isOfferVisible(offer: Offer, nowMs: number): boolean {
  return offer.is_active && !DEMO_OFFER_IDS.has(offer.id) && !isExpired(offer, nowMs);
}

/** Ordre voulu par l'association (sort_order), puis par nom ; stable. */
export function sortOffers(offers: readonly Offer[]): Offer[] {
  return offers
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.title.localeCompare(b.title, 'fr'));
}

export function filterOffers(offers: readonly Offer[], filter: OfferFilter): Offer[] {
  return filter === 'all' ? offers.slice() : offers.filter((o) => o.category === filter);
}

/** Nombre d'offres par catégorie (pour les puces de filtre). */
export function countByCategory(offers: readonly Offer[]): Record<OfferFilter, number> {
  const counts: Record<string, number> = { all: offers.length };
  for (const c of OFFER_CATEGORIES) counts[c.id] = 0;
  for (const o of offers) counts[o.category] += 1;
  return counts as Record<OfferFilter, number>;
}

/**
 * Découpe l'avantage pour l'affichage en grand : « -20% COCKTAILS » → { big: '-20%', small: 'COCKTAILS' } ;
 * « 1 café offert » reste entier en petit titre.
 */
export function parseDiscount(value: string): { big: string; small: string; numeric: boolean } {
  const clean = value.replace(/\s+/g, ' ').trim();
  const m = clean.match(/^(-?\s?\d{1,3}(?:[.,]\d{1,2})?\s?(?:%|€))\s*(.*)$/);
  if (m) return { big: m[1].replace(/\s+/g, '').replace(/^(\d)/, '-$1'), small: m[2].trim(), numeric: true };
  return { big: clean, small: '', numeric: false };
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Mention de validité : « Jusqu'au 31 déc. 2026 », « Encore 3 jours », « Dernier jour », « Expirée », ou null. */
export function validityLabel(validUntil: string | null, nowMs: number): string | null {
  if (!validUntil) return null;
  const until = Date.parse(validUntil);
  if (!Number.isFinite(until)) return null;
  if (until <= nowMs) return 'Expirée';
  const daysLeft = Math.ceil((until - nowMs) / 86_400_000);
  if (daysLeft <= 1) return 'Dernier jour';
  if (daysLeft <= 7) return `Encore ${daysLeft} jours`;
  // fin incluse : la veille de minuit est le dernier jour valable
  const last = new Date(until - 1000);
  return `Jusqu'au ${last.getDate()} ${MONTHS[last.getMonth()]} ${last.getFullYear()}`;
}

const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const contrastOn = (fg: string, bg: string): number => {
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

/**
 * Texte lisible sur une couleur de fond choisie par l'association : blanc de préférence, puis le noir de la marque,
 * puis noir pur pour les tons moyens où aucun des deux n'atteint 4,5:1.
 */
export function readableTextOn(hex: string): '#FFFFFF' | '#1A1A22' | '#000000' {
  if (!HEX.test(hex)) return '#FFFFFF';
  for (const candidate of ['#FFFFFF', '#1A1A22', '#000000'] as const) {
    if (contrastOn(candidate, hex) >= 4.5) return candidate;
  }
  return contrastOn('#FFFFFF', hex) >= contrastOn('#000000', hex) ? '#FFFFFF' : '#000000';
}
