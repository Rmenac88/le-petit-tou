import { adminErrorMessage, type RpcClient } from './adminApi.ts';

/** Annonces et statistiques push du portail admin. Le code admin est vérifié côté serveur (admin_send_push / admin_push_stats). */

export const PUSH_TITLE_MAX = 50;
export const PUSH_BODY_MAX = 140;

export type SendResult = { ok: true; recipients: number } | { ok: false; message: string };

export function validateAnnouncement(title: string, body: string): string | null {
  const t = title.trim();
  const b = body.trim();
  if (!t) return 'Le titre est obligatoire.';
  if (!b) return 'Le message est obligatoire.';
  if (t.length > PUSH_TITLE_MAX) return `Le titre ne peut pas dépasser ${PUSH_TITLE_MAX} caractères.`;
  if (b.length > PUSH_BODY_MAX) return `Le message ne peut pas dépasser ${PUSH_BODY_MAX} caractères.`;
  return null;
}

export async function adminSendPush(client: RpcClient, code: string, title: string, body: string): Promise<SendResult> {
  const problem = validateAnnouncement(title, body);
  if (problem) return { ok: false, message: problem };
  if (!code || !code.trim()) return { ok: false, message: adminErrorMessage('forbidden') };
  try {
    const { data, error } = await client.rpc('admin_send_push', { p_code: code, p_title: title.trim(), p_body: body.trim() });
    if (error) return { ok: false, message: 'Connexion impossible : réessaie dans un instant.' };
    if (!data || data.ok !== true) return { ok: false, message: adminErrorMessage(data?.error) };
    return { ok: true, recipients: Number(data.recipients) || 0 };
  } catch {
    return { ok: false, message: 'Connexion impossible : réessaie dans un instant.' };
  }
}

export interface PushStats {
  devices: number;
  ios: number;
  android: number;
  pendingMessages: number;
  deliveries7d: Record<string, number>;
}

export async function adminPushStats(
  client: RpcClient,
  code: string
): Promise<{ ok: true; stats: PushStats } | { ok: false; message: string }> {
  if (!code || !code.trim()) return { ok: false, message: adminErrorMessage('forbidden') };
  try {
    const { data, error } = await client.rpc('admin_push_stats', { p_code: code });
    if (error) return { ok: false, message: 'Connexion impossible : réessaie dans un instant.' };
    if (!data || data.ok !== true) return { ok: false, message: adminErrorMessage(data?.error) };
    return {
      ok: true,
      stats: {
        devices: Number(data.devices) || 0,
        ios: Number(data.ios) || 0,
        android: Number(data.android) || 0,
        pendingMessages: Number(data.pending_messages) || 0,
        deliveries7d: (data.deliveries_7d && typeof data.deliveries_7d === 'object' ? data.deliveries_7d : {}) as Record<string, number>,
      },
    };
  } catch {
    return { ok: false, message: 'Connexion impossible : réessaie dans un instant.' };
  }
}
