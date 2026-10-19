/**
 * Écritures du portail admin sur le catalogue (addresses, categories, events, sponsored_partners).
 * Les tables sont en lecture seule pour l'appli : tout passe par la fonction serveur admin_write,
 * qui vérifie le code admin (jamais stocké ici, passé en argument) et borne tables et colonnes.
 *
 * L'objet imite le sous-ensemble de supabase.from(...) utilisé par le portail :
 *   adminDb.from('events').insert(rec) / .update(rec).eq('id', id) / .delete().eq('id', id)  (+ .select() facultatif)
 * et se résout en { data, error } comme supabase-js.
 */

export type AdminTable = 'addresses' | 'categories' | 'events' | 'sponsored_partners';
type AdminOp = 'insert' | 'update' | 'delete';
export interface AdminResult {
  data: any[] | null;
  error: { message: string } | null;
}

export interface RpcClient {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: { message: string } | null }>;
}

/** Message affichable pour une réponse d'admin_write. */
export function adminErrorMessage(raw: string | undefined): string {
  if (!raw) return 'Opération refusée.';
  if (raw === 'forbidden') return 'Code admin refusé ou trop de tentatives : réessaie dans quelques minutes.';
  return raw.replace(/^invalid:\s*/, '');
}

class AdminQuery implements PromiseLike<AdminResult> {
  private id: string | null = null;

  private readonly client: RpcClient;
  private readonly code: string;
  private readonly table: AdminTable;
  private readonly op: AdminOp;
  private readonly record: Record<string, unknown>;

  constructor(client: RpcClient, code: string, table: AdminTable, op: AdminOp, record: Record<string, unknown>) {
    this.client = client;
    this.code = code;
    this.table = table;
    this.op = op;
    this.record = record;
  }

  eq(column: string, value: string | number): this {
    if (column !== 'id') throw new Error("adminDb: seul .eq('id', …) est pris en charge");
    this.id = String(value);
    return this;
  }

  /** Les écritures renvoient déjà les lignes touchées : présent pour garder la syntaxe supabase-js. */
  select(): this {
    return this;
  }

  private async run(): Promise<AdminResult> {
    if (!this.code || !this.code.trim()) {
      return { data: null, error: { message: adminErrorMessage('forbidden') } };
    }
    if (this.op !== 'insert' && !this.id) {
      return { data: null, error: { message: 'Identifiant manquant.' } };
    }
    try {
      const { data, error } = await this.client.rpc('admin_write', {
        p_code: this.code,
        p_table: this.table,
        p_op: this.op,
        p_id: this.id,
        p_record: this.record,
      });
      if (error) return { data: null, error: { message: error.message } };
      if (!data || data.ok !== true) {
        return { data: null, error: { message: adminErrorMessage(data?.error) } };
      }
      return { data: Array.isArray(data.rows) ? data.rows : [], error: null };
    } catch (e: any) {
      return { data: null, error: { message: e?.message || 'Connexion impossible.' } };
    }
  }

  then<R1 = AdminResult, R2 = never>(
    onfulfilled?: ((value: AdminResult) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: any) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

export function createAdminDb(code: string, client: RpcClient) {
  return {
    from(table: AdminTable) {
      return {
        insert: (record: Record<string, unknown>) => new AdminQuery(client, code, table, 'insert', record),
        update: (record: Record<string, unknown>) => new AdminQuery(client, code, table, 'update', record),
        delete: () => new AdminQuery(client, code, table, 'delete', {}),
      };
    },
  };
}
