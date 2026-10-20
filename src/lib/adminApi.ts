import { supabase } from './supabase';

/**
 * Écritures du portail admin. Elles passent toutes par les fonctions serveur
 * admin_write / admin_read (voir scripts/007_lock_tables_admin_rpc.sql), qui vérifient
 * le code admin ; les tables ne sont plus modifiables directement depuis l'appli.
 */
export type AdminTable = 'addresses' | 'categories' | 'events' | 'sponsored_partners';
type Result = { data: any[] | null; error: { message: string } | null };

const fail = (message: string): Result => ({ data: null, error: { message } });

export async function adminWrite(
  code: string | undefined,
  table: AdminTable,
  op: 'insert' | 'update' | 'delete',
  id: string | number | null,
  payload: Record<string, unknown> = {}
): Promise<Result> {
  if (!code) return fail('Session admin expirée. Reconnecte-toi.');
  const { data, error } = await supabase.rpc('admin_write', {
    p_code: code,
    p_table: table,
    p_op: op,
    p_id: id === null ? null : String(id),
    p_payload: payload,
  });
  if (error) return fail(error.message);
  return { data: Array.isArray(data) ? data : [], error: null };
}

export async function adminRead(code: string | undefined, table: 'sponsored_partners'): Promise<Result> {
  if (!code) return fail('Session admin expirée. Reconnecte-toi.');
  const { data, error } = await supabase.rpc('admin_read', { p_code: code, p_table: table });
  if (error) return fail(error.message);
  return { data: Array.isArray(data) ? data : [], error: null };
}
