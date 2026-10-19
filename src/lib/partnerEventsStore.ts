import { supabase } from './supabase';
import { AgendaError, toAgendaError, validateEventDraft } from './agendaErrors.ts';
import type { PartnerEventRow } from './agendaOccurrences.ts';

export { AgendaError };

/**
 * Accès aux dates de l'agenda des partenaires.
 * - Lecture publique : directement sur la table (lignes actives uniquement, RLS).
 * - Admin : uniquement via les fonctions admin_* qui vérifient le code côté serveur.
 * Le code admin n'est jamais stocké ni journalisé ici : il est passé en argument.
 */

type SaveInput = Pick<PartnerEventRow, 'spot_id' | 'title' | 'start_date' | 'start_time'> &
  Partial<PartnerEventRow>;

function requireClient() {
  if (!supabase) throw toAgendaError(null);
  return supabase;
}

function requireCode(code: string) {
  if (!code || !code.trim()) throw new AgendaError('forbidden', 'Code admin refusé : reconnecte-toi.');
}

/** Dates actives encore à venir : ponctuelles dans le futur, ou séries pas encore terminées. */
export async function fetchPublicPartnerEvents(todayIso: string): Promise<PartnerEventRow[]> {
  try {
    const { data, error } = await requireClient()
      .from('partner_events')
      .select('*')
      .or(`repeat_weekly_until.gte.${todayIso},start_date.gte.${todayIso}`)
      .order('start_date', { ascending: true });
    if (error) throw toAgendaError(error);
    return (data ?? []) as PartnerEventRow[];
  } catch (err) {
    throw err instanceof AgendaError ? err : toAgendaError(err);
  }
}

export async function adminListPartnerEvents(code: string): Promise<PartnerEventRow[]> {
  requireCode(code);
  try {
    const { data, error } = await requireClient().rpc('admin_list_partner_events', { p_code: code });
    if (error) throw toAgendaError(error);
    return (data ?? []) as PartnerEventRow[];
  } catch (err) {
    throw err instanceof AgendaError ? err : toAgendaError(err);
  }
}

export async function adminSavePartnerEvent(code: string, event: SaveInput): Promise<PartnerEventRow> {
  requireCode(code);
  const problem = validateEventDraft(event);
  if (problem) throw new AgendaError('invalid', problem);
  try {
    const { data, error } = await requireClient().rpc('admin_save_partner_event', {
      p_code: code,
      p_event: event,
    });
    if (error) throw toAgendaError(error);
    if (!data) throw toAgendaError(null);
    return data as PartnerEventRow;
  } catch (err) {
    throw err instanceof AgendaError ? err : toAgendaError(err);
  }
}

/** Renvoie le nombre de lignes supprimées (0 = rien trouvé). */
export async function adminDeletePartnerEvent(code: string, id: string): Promise<number> {
  requireCode(code);
  try {
    const { data, error } = await requireClient().rpc('admin_delete_partner_event', {
      p_code: code,
      p_id: id,
    });
    if (error) throw toAgendaError(error);
    return typeof data === 'number' ? data : 0;
  } catch (err) {
    throw err instanceof AgendaError ? err : toAgendaError(err);
  }
}
