import { type RpcClient } from './adminApi.ts';
import { type FeaturedRow } from './featuredLogic.ts';

/**
 * Gestion des chouchous du Petit Tou depuis le portail admin. Le code admin est vérifié côté serveur
 * (admin_list_featured / admin_save_featured / admin_delete_featured) ; il est passé en argument, jamais stocké.
 */

export class FeaturedError extends Error {
  kind: 'forbidden' | 'invalid' | 'network';
  constructor(kind: 'forbidden' | 'invalid' | 'network', message: string) {
    super(message);
    this.name = 'FeaturedError';
    this.kind = kind;
  }
}

const FORBIDDEN = 'Code admin refusé ou trop de tentatives : réessaie dans quelques minutes.';
const NETWORK = 'Connexion impossible : réessaie dans un instant.';

/** Message affichable pour une réponse { ok:false, error } du serveur. */
export function featuredErrorFrom(raw: unknown): FeaturedError {
  const text = typeof raw === 'string' ? raw : '';
  if (text === 'forbidden') return new FeaturedError('forbidden', FORBIDDEN);
  if (/^invalid:/i.test(text)) {
    const clean = text.replace(/^invalid:\s*/i, '').trim();
    return new FeaturedError('invalid', clean.charAt(0).toUpperCase() + clean.slice(1));
  }
  return new FeaturedError('network', NETWORK);
}

async function call(client: RpcClient, fn: string, args: Record<string, unknown>): Promise<any> {
  let data: any;
  try {
    const res = await client.rpc(fn, args);
    if (res.error) throw featuredErrorFrom(null);
    data = res.data;
  } catch (e) {
    throw e instanceof FeaturedError ? e : featuredErrorFrom(null);
  }
  if (!data || data.ok !== true) throw featuredErrorFrom(data?.error);
  return data;
}

function requireCode(code: string) {
  if (!code || !code.trim()) throw new FeaturedError('forbidden', FORBIDDEN);
}

export async function adminListFeatured(client: RpcClient, code: string): Promise<FeaturedRow[]> {
  requireCode(code);
  const data = await call(client, 'admin_list_featured', { p_code: code });
  return (Array.isArray(data.rows) ? data.rows : []) as FeaturedRow[];
}

export interface FeaturedSaveInput {
  id?: string;
  spot_id: string;
  position?: number | string | null;
  label?: string | null;
  starts_on?: string | null;
  ends_on?: string | null;
  is_active?: boolean;
}

export async function adminSaveFeatured(client: RpcClient, code: string, item: FeaturedSaveInput): Promise<FeaturedRow> {
  requireCode(code);
  // Les champs vides deviennent « absent » : le serveur applique alors ses valeurs par défaut
  const clean: Record<string, unknown> = { ...item };
  for (const k of ['position', 'label', 'starts_on', 'ends_on']) {
    const v = clean[k];
    if (v === '' || v === undefined) clean[k] = null;
  }
  const data = await call(client, 'admin_save_featured', { p_code: code, p_item: clean });
  return data.row as FeaturedRow;
}

export async function adminDeleteFeatured(client: RpcClient, code: string, id: string): Promise<number> {
  requireCode(code);
  const data = await call(client, 'admin_delete_featured', { p_code: code, p_id: id });
  return Number(data.deleted) || 0;
}
