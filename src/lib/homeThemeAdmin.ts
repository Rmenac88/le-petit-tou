import { type RpcClient } from './adminApi.ts';
import { themePayload, type HomeTheme } from './homeThemeLogic.ts';

/**
 * Thème de l'année depuis le portail admin. Le code admin est vérifié côté serveur (admin_set_home_theme) ;
 * il est passé en argument, jamais stocké. Les messages d'erreur sont en français.
 */

export class ThemeError extends Error {
  kind: 'forbidden' | 'invalid' | 'network';
  constructor(kind: 'forbidden' | 'invalid' | 'network', message: string) {
    super(message);
    this.name = 'ThemeError';
    this.kind = kind;
  }
}

const FORBIDDEN = 'Code admin refusé ou trop de tentatives : réessaie dans quelques minutes.';
const NETWORK = 'Connexion impossible : réessaie dans un instant.';
const NOT_DEPLOYED = 'Le thème de l\'année n\'est pas encore activé sur le serveur (mise à jour de la base à appliquer).';

export function themeErrorFrom(raw: unknown, rpcError?: { code?: string; message?: string } | null): ThemeError {
  // fonction absente de la base (migration 014 pas encore appliquée)
  if (rpcError && (rpcError.code === 'PGRST202' || /could not find the function|schema cache/i.test(rpcError.message ?? ''))) {
    return new ThemeError('network', NOT_DEPLOYED);
  }
  const text = typeof raw === 'string' ? raw : '';
  if (text === 'forbidden') return new ThemeError('forbidden', FORBIDDEN);
  if (/^invalid:/i.test(text)) {
    const clean = text.replace(/^invalid:\s*/i, '').trim();
    return new ThemeError('invalid', clean.charAt(0).toUpperCase() + clean.slice(1));
  }
  return new ThemeError('network', NETWORK);
}

async function call(client: RpcClient, args: Record<string, unknown>): Promise<any> {
  let data: any;
  try {
    const res = await client.rpc('admin_set_home_theme', args);
    if (res.error) throw themeErrorFrom(null, res.error as any);
    data = res.data;
  } catch (e) {
    throw e instanceof ThemeError ? e : themeErrorFrom(null);
  }
  if (!data || data.ok !== true) throw themeErrorFrom(data?.error);
  return data;
}

function requireCode(code: string) {
  if (!code || !code.trim()) throw new ThemeError('forbidden', FORBIDDEN);
}

/** Enregistre le thème ; renvoie le réglage tel que le serveur l'a retenu. */
export async function adminSetHomeTheme(client: RpcClient, code: string, theme: HomeTheme): Promise<unknown> {
  requireCode(code);
  const d = await call(client, { p_code: code, p_theme: themePayload(theme) });
  return d.setting;
}

/** Retour au thème d'origine (le réglage est retiré). */
export async function adminResetHomeTheme(client: RpcClient, code: string): Promise<void> {
  requireCode(code);
  await call(client, { p_code: code, p_theme: null });
}
