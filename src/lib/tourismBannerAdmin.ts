import { type RpcClient } from './adminApi.ts';

/**
 * Lien de la bannière « Office de tourisme » depuis le portail admin. Le code admin est vérifié côté serveur
 * (admin_set_tourism_banner) ; il est passé en argument, jamais stocké. Les messages d'erreur sont en français.
 */

export class TourismBannerError extends Error {
  kind: 'forbidden' | 'invalid' | 'network';
  constructor(kind: 'forbidden' | 'invalid' | 'network', message: string) {
    super(message);
    this.name = 'TourismBannerError';
    this.kind = kind;
  }
}

const FORBIDDEN = 'Code admin refusé ou trop de tentatives : réessaie dans quelques minutes.';
const NETWORK = 'Connexion impossible : réessaie dans un instant.';
const NOT_DEPLOYED = 'La bannière n’est pas encore activée sur le serveur (mise à jour de la base à appliquer).';

export function tourismErrorFrom(raw: unknown, rpcError?: { code?: string; message?: string } | null): TourismBannerError {
  // fonction absente de la base (migration 020 pas encore appliquée)
  if (rpcError && (rpcError.code === 'PGRST202' || /could not find the function|schema cache/i.test(rpcError.message ?? ''))) {
    return new TourismBannerError('network', NOT_DEPLOYED);
  }
  const text = typeof raw === 'string' ? raw : '';
  if (text === 'forbidden') return new TourismBannerError('forbidden', FORBIDDEN);
  if (/^invalid:/i.test(text)) {
    const clean = text.replace(/^invalid:\s*/i, '').trim();
    return new TourismBannerError('invalid', clean.charAt(0).toUpperCase() + clean.slice(1));
  }
  return new TourismBannerError('network', NETWORK);
}

/** Enregistre le lien (adresse vide = retour au lien par défaut) ; renvoie le réglage tel que le serveur l'a retenu. */
export async function adminSetTourismBanner(client: RpcClient, code: string, url: string): Promise<unknown> {
  if (!code || !code.trim()) throw new TourismBannerError('forbidden', FORBIDDEN);
  let data: any;
  try {
    const res = await client.rpc('admin_set_tourism_banner', { p_code: code, p_url: url });
    if (res.error) throw tourismErrorFrom(null, res.error as any);
    data = res.data;
  } catch (e) {
    throw e instanceof TourismBannerError ? e : tourismErrorFrom(null);
  }
  if (!data || data.ok !== true) throw tourismErrorFrom(data?.error);
  return data.setting;
}
