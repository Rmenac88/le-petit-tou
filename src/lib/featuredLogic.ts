/**
 * « Les chouchous du Petit Tou » : logique pure (sans réseau ni React), testée avec node:test.
 * Les dates sont des jours AAAA-MM-JJ ; le serveur n'envoie déjà que les lignes en cours, mais l'appli refiltre
 * avec la date du téléphone (une liste gardée en mémoire ne doit pas afficher un chouchou périmé).
 */

export interface FeaturedRow {
  id: string;
  spot_id: string;
  position: number;
  label: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
}

export const FEATURED_LABEL_MAX = 40;
/** Nombre maximal de cartes affichées sur l'accueil. */
export const FEATURED_DISPLAY_MAX = 12;

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Vrai si « AAAA-MM-JJ » désigne un jour qui existe (le 2026-02-30 est refusé). */
export function isRealDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

/** Une ligne s'affiche si elle est active et si aujourd'hui est dans sa période (bornes incluses). */
export function isLive(row: FeaturedRow, todayIso: string): boolean {
  if (!row.is_active) return false;
  if (row.starts_on && row.starts_on > todayIso) return false;
  if (row.ends_on && row.ends_on < todayIso) return false;
  return true;
}

/** Lignes en cours, dans l'ordre d'affichage (ordre croissant, puis identifiant pour un résultat stable). */
export function liveFeatured(rows: readonly FeaturedRow[], todayIso: string): FeaturedRow[] {
  return rows
    .filter((r) => isLive(r, todayIso))
    .sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
}

/** Associe chaque chouchou à son adresse ; une adresse supprimée du guide est ignorée sans erreur. */
export function resolveFeatured<T extends { id: string }>(
  rows: readonly FeaturedRow[],
  addresses: readonly T[],
  todayIso: string,
  max: number = FEATURED_DISPLAY_MAX
): { row: FeaturedRow; address: T }[] {
  const byId = new Map(addresses.map((a) => [String(a.id), a]));
  const out: { row: FeaturedRow; address: T }[] = [];
  for (const row of liveFeatured(rows, todayIso)) {
    const address = byId.get(String(row.spot_id));
    if (address) out.push({ row, address });
    if (out.length >= max) break;
  }
  return out;
}

export interface FeaturedDraft {
  spotId: string;
  position: string;
  label: string;
  startsOn: string;
  endsOn: string;
}

/** Message à afficher si le brouillon est invalide, sinon null (le serveur revérifie tout). */
export function validateFeaturedDraft(d: FeaturedDraft): string | null {
  if (!d.spotId.trim()) return 'Choisis une adresse.';
  if (d.label.trim().length > FEATURED_LABEL_MAX) return `La mention fait ${FEATURED_LABEL_MAX} caractères au plus.`;
  if (d.position.trim() && !/^\d{1,4}$/.test(d.position.trim())) return "L'ordre est un nombre entre 0 et 9999.";
  const start = d.startsOn.trim();
  const end = d.endsOn.trim();
  if (start && !isRealDay(start)) return 'La date de début doit s’écrire AAAA-MM-JJ (par exemple 2026-11-01).';
  if (end && !isRealDay(end)) return 'La date de fin doit s’écrire AAAA-MM-JJ (par exemple 2026-11-30).';
  if (start && end && end < start) return 'La fin doit être après le début.';
  return null;
}

/** Libellé de période pour la liste admin. */
export function describePeriod(row: Pick<FeaturedRow, 'starts_on' | 'ends_on'>, todayIso: string): string {
  const { starts_on: s, ends_on: e } = row;
  if (!s && !e) return 'Toujours affiché';
  if (s && s > todayIso) return `Commence le ${s}${e ? ` · jusqu'au ${e}` : ''}`;
  if (e && e < todayIso) return `Terminé le ${e}`;
  return e ? `Jusqu'au ${e}` : `Depuis le ${s}`;
}

/**
 * Déplace un chouchou d'un cran (-1 vers le haut, +1 vers le bas) dans l'ordre d'affichage.
 * Renvoie les seules lignes dont l'ordre change, après renumérotation propre (10, 20, 30…) : cela règle aussi
 * le cas de plusieurs lignes avec le même ordre. Liste vide si le déplacement est impossible.
 */
export function planMove(rows: readonly FeaturedRow[], id: string, direction: -1 | 1): { id: string; position: number }[] {
  const ordered = [...rows].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  const from = ordered.findIndex((r) => r.id === id);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ordered.length) return [];
  const moved = [...ordered];
  [moved[from], moved[to]] = [moved[to], moved[from]];
  const updates: { id: string; position: number }[] = [];
  moved.forEach((r, i) => {
    const position = (i + 1) * 10;
    if (r.position !== position) updates.push({ id: r.id, position });
  });
  return updates;
}

/** Statut d'une ligne pour l'admin. */
export function featuredStatus(row: FeaturedRow, todayIso: string): 'inactive' | 'scheduled' | 'ended' | 'live' {
  if (!row.is_active) return 'inactive';
  if (row.starts_on && row.starts_on > todayIso) return 'scheduled';
  if (row.ends_on && row.ends_on < todayIso) return 'ended';
  return 'live';
}
