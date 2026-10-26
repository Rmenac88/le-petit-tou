import { type RpcClient } from './adminApi.ts';

/**
 * Gestion des offres depuis le portail admin. Le code admin est vérifié côté serveur
 * (admin_list_offers / admin_save_offer / admin_delete_offer) ; il est passé en argument, jamais stocké.
 */

export class OffersError extends Error {
  kind: 'forbidden' | 'invalid' | 'network';
  constructor(kind: 'forbidden' | 'invalid' | 'network', message: string) {
    super(message);
    this.name = 'OffersError';
    this.kind = kind;
  }
}

const FORBIDDEN = 'Code admin refusé ou trop de tentatives : réessaie dans quelques minutes.';
const NETWORK = 'Connexion impossible : réessaie dans un instant.';
const NOT_DEPLOYED = 'La gestion des offres n\'est pas encore activée sur le serveur (mise à jour de la base à appliquer).';

/** Message affichable pour une réponse { ok:false, error } ou une erreur du serveur. */
export function offersErrorFrom(raw: unknown, rpcError?: { code?: string; message?: string } | null): OffersError {
  // fonction absente de la base (migration 013 pas encore appliquée)
  if (rpcError && (rpcError.code === 'PGRST202' || /could not find the function|schema cache/i.test(rpcError.message ?? ''))) {
    return new OffersError('network', NOT_DEPLOYED);
  }
  const textValue = typeof raw === 'string' ? raw : '';
  if (textValue === 'forbidden') return new OffersError('forbidden', FORBIDDEN);
  if (/^invalid:/i.test(textValue)) {
    const clean = textValue.replace(/^invalid:\s*/i, '').trim();
    return new OffersError('invalid', clean.charAt(0).toUpperCase() + clean.slice(1));
  }
  return new OffersError('network', NETWORK);
}

async function call(client: RpcClient, fn: string, args: Record<string, unknown>): Promise<any> {
  let data: any;
  try {
    const res = await client.rpc(fn, args);
    if (res.error) throw offersErrorFrom(null, res.error as any);
    data = res.data;
  } catch (e) {
    throw e instanceof OffersError ? e : offersErrorFrom(null);
  }
  if (!data || data.ok !== true) throw offersErrorFrom(data?.error);
  return data;
}

function requireCode(code: string) {
  if (!code || !code.trim()) throw new OffersError('forbidden', FORBIDDEN);
}

/** Ligne telle que l'admin la voit : l'offre + compteurs et état. */
export interface AdminOffer {
  id: string;
  partner_id: string | null;
  title: string;
  subtitle: string | null;
  category: string;
  discount_value: string;
  badge_label: string | null;
  description: string | null;
  terms: string | null;
  max_uses: number;
  card_color_primary: string | null;
  card_color_secondary: string | null;
  visual_url: string | null;
  is_active: boolean;
  valid_until: string | null;
  sort_order: number;
  uses_total: number;
  /** Dernier jour valable (AAAA-MM-JJ, fin incluse), ou null. */
  valid_until_date: string | null;
  expired: boolean;
}

export async function adminListOffers(client: RpcClient, code: string): Promise<AdminOffer[]> {
  requireCode(code);
  const data = await call(client, 'admin_list_offers', { p_code: code });
  return (Array.isArray(data.offers) ? data.offers : []) as AdminOffer[];
}

export interface OfferSaveInput {
  id?: string;
  title: string;
  discount_value: string;
  subtitle?: string | null;
  category?: string;
  badge_label?: string | null;
  description?: string | null;
  terms?: string | null;
  max_uses?: number | string | null;
  card_color_primary?: string | null;
  card_color_secondary?: string | null;
  visual_url?: string | null;
  partner_id?: string | null;
  /** Dernier jour valable, AAAA-MM-JJ ; vide = sans date de fin. */
  valid_until?: string | null;
  sort_order?: number | string | null;
  is_active?: boolean;
}

const OPTIONAL = ['subtitle', 'badge_label', 'description', 'terms', 'max_uses', 'card_color_primary', 'card_color_secondary', 'visual_url', 'partner_id', 'valid_until', 'sort_order'];

export async function adminSaveOffer(client: RpcClient, code: string, offer: OfferSaveInput): Promise<AdminOffer> {
  requireCode(code);
  // Les champs vides deviennent « absent » : le serveur applique alors ses valeurs par défaut
  const clean: Record<string, unknown> = { ...offer };
  for (const k of OPTIONAL) {
    const v = clean[k];
    if (v === '' || v === undefined) clean[k] = null;
  }
  const data = await call(client, 'admin_save_offer', { p_code: code, p_offer: clean });
  return data.offer as AdminOffer;
}

export async function adminDeleteOffer(client: RpcClient, code: string, id: string): Promise<number> {
  requireCode(code);
  const data = await call(client, 'admin_delete_offer', { p_code: code, p_id: id });
  return Number(data.deleted) || 0;
}
