import { type RpcClient } from './adminApi.ts';
import { featuredErrorFrom, FeaturedError } from './featuredAdmin.ts';

/**
 * Appels admin du fond d'accueil : le code est vérifié côté serveur (admin_request_upload /
 * admin_set_home_background), jamais stocké ici. Les messages d'erreur sont ceux, en français, du serveur.
 */

export interface UploadTicket {
  bucket: string;
  path: string;
  expiresIn: number;
  maxBytes: number;
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
  if (!code || !code.trim()) throw featuredErrorFrom('forbidden');
}

export async function adminRequestUpload(client: RpcClient, code: string, ext: 'jpg' | 'png' | 'webp'): Promise<UploadTicket> {
  requireCode(code);
  const d = await call(client, 'admin_request_upload', { p_code: code, p_ext: ext });
  return { bucket: String(d.bucket), path: String(d.path), expiresIn: Number(d.expires_in) || 600, maxBytes: Number(d.max_bytes) || 0 };
}

export async function adminSetHomeBackground(
  client: RpcClient,
  code: string,
  mode: 'galaxy' | 'image',
  path?: string
): Promise<unknown> {
  requireCode(code);
  const d = await call(client, 'admin_set_home_background', { p_code: code, p_mode: mode, p_path: mode === 'image' ? path ?? null : null });
  return d.setting;
}
