import { isValidTimeRange } from './agendaOccurrences.ts';

export type AgendaErrorKind = 'forbidden' | 'network' | 'invalid';

/** Erreur de l'agenda : toujours un message en français, jamais de texte technique. */
export class AgendaError extends Error {
  kind: AgendaErrorKind;
  constructor(kind: AgendaErrorKind, message: string) {
    super(message);
    this.name = 'AgendaError';
    this.kind = kind;
  }
}

const NETWORK_MESSAGE = 'Agenda indisponible pour le moment.';
const FORBIDDEN_MESSAGE = 'Code admin refusé : reconnecte-toi.';

/** Traduit une erreur Supabase / réseau en AgendaError lisible. */
export function toAgendaError(err: unknown): AgendaError {
  const e = (err ?? {}) as { code?: string | null; message?: string | null };
  const message = String(e.message ?? '');
  if (e.code === '42501' || /forbidden/i.test(message)) {
    return new AgendaError('forbidden', FORBIDDEN_MESSAGE);
  }
  if (/^invalid:/i.test(message)) {
    const text = message.replace(/^invalid:\s*/i, '').trim();
    return new AgendaError('invalid', text.charAt(0).toUpperCase() + text.slice(1));
  }
  return new AgendaError('network', NETWORK_MESSAGE);
}

export interface EventDraft {
  spot_id: string;
  title: string;
  start_date: string;
  start_time: string;
  end_time?: string | null;
  repeat_weekly_until?: string | null;
}

const TIME_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** Renvoie le message à afficher si le brouillon est invalide, sinon null. */
export function validateEventDraft(draft: EventDraft): string | null {
  if (!draft.title.trim()) return 'Le titre est obligatoire.';
  if (!draft.spot_id.trim()) return 'Choisis une adresse.';
  if (!draft.start_date.trim()) return 'La date est obligatoire.';
  if (!TIME_RE.test(draft.start_time) || (draft.end_time && !TIME_RE.test(draft.end_time))) {
    return "Les heures s'écrivent au format HH:MM.";
  }
  if (!isValidTimeRange(draft.start_time, draft.end_time)) {
    return "L'heure de fin doit être après l'heure de début.";
  }
  if (draft.repeat_weekly_until && draft.repeat_weekly_until < draft.start_date) {
    return 'La fin de série doit être après la première date.';
  }
  return null;
}
