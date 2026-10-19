/**
 * Calcul des dates de l'agenda des partenaires.
 * Logique pure, sans React ni Supabase. Les dates sont des chaînes calendaires
 * « YYYY-MM-DD » et les heures des chaînes « HH:MM » : on ne passe jamais par un
 * fuseau local, pour qu'un changement d'heure ne décale jamais un jour.
 */

export interface PartnerEventRow {
  id: string;
  spot_id: string;
  title: string;
  description?: string | null;
  start_date: string;
  start_time: string;
  end_time?: string | null;
  repeat_weekly_until?: string | null;
  location_override?: string | null;
  link_url?: string | null;
  is_active: boolean;
}

export interface Occurrence {
  event: PartnerEventRow;
  occurrenceDate: string;
  isRecurring: boolean;
}

const DAY_MS = 86400000;
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const WEEKDAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

function toUtcMs(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms: number): string {
  const date = new Date(ms);
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(isoDate: string, days: number): string {
  return fromUtcMs(toUtcMs(isoDate) + days * DAY_MS);
}

export function weekdayLabel(isoDate: string): string {
  return WEEKDAYS[new Date(toUtcMs(isoDate)).getUTCDay()];
}

/** Libellé d'une puce de jour : « jeu. » et « 22 ». */
export function dayChipLabel(isoDate: string): { weekday: string; day: string } {
  return {
    weekday: `${weekdayLabel(isoDate).slice(0, 3)}.`,
    day: String(Number(isoDate.slice(8, 10))),
  };
}

/** Date en toutes lettres : « jeudi 22 octobre ». */
export function formatDateFr(isoDate: string): string {
  const month = MONTHS[Number(isoDate.slice(5, 7)) - 1];
  return `${weekdayLabel(isoDate)} ${Number(isoDate.slice(8, 10))} ${month}`;
}

/** Vrai pour une vraie date « AAAA-MM-JJ » (refuse « 10/11/2026 » et « 2026-02-30 »). */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return fromUtcMs(toUtcMs(value)) === value;
}

/** Si le jour sélectionné est passé (l'appli est restée ouverte), on revient à aujourd'hui. */
export function clampSelectedDay(selected: string, todayIso: string): string {
  return selected < todayIso ? todayIso : selected;
}

export function buildDayStrip(todayIso: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addDays(todayIso, i));
}

export function isValidTimeRange(start: string, end?: string | null): boolean {
  if (!end) return true;
  return end > start;
}

export function expandOccurrences(
  events: PartnerEventRow[],
  rangeStart: string,
  rangeEnd: string
): Occurrence[] {
  const out: Occurrence[] = [];

  for (const event of events) {
    if (!event.is_active) continue;
    const until = event.repeat_weekly_until;

    if (!until) {
      if (event.start_date >= rangeStart && event.start_date <= rangeEnd) {
        out.push({ event, occurrenceDate: event.start_date, isRecurring: false });
      }
      continue;
    }

    const isRecurring = until > event.start_date;
    const last = until < rangeEnd ? until : rangeEnd;
    // saute directement à la première semaine qui touche l'intervalle
    let date = event.start_date;
    if (date < rangeStart) {
      const gapDays = Math.round((toUtcMs(rangeStart) - toUtcMs(date)) / DAY_MS);
      date = addDays(date, Math.ceil(gapDays / 7) * 7);
    }
    for (; date <= last; date = addDays(date, 7)) {
      out.push({ event, occurrenceDate: date, isRecurring });
    }
  }

  return out.sort((a, b) =>
    a.occurrenceDate === b.occurrenceDate
      ? a.event.start_time.localeCompare(b.event.start_time)
      : a.occurrenceDate.localeCompare(b.occurrenceDate)
  );
}
