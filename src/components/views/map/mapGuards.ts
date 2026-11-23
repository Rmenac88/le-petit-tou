/**
 * Garde-fous de la carte (audit S2-12). Logique pure, testée avec node:test.
 *
 * - Web : la carte vit dans une iframe ; la page n'accepte que les messages envoyés par CETTE iframe
 *   (une autre fenêtre ou un autre onglet ne peut pas faire croire à un clic sur une adresse).
 * - Téléphone : la WebView n'affiche que la page de carte embarquée (https://localhost). Toute autre navigation
 *   (lien « © Mapbox », redirection) est refusée dans la WebView ; un lien https est ouvert dans le navigateur.
 */

/** Vrai si le message vient de la fenêtre attendue. Sans fenêtre attendue connue, le message est refusé. */
export function isTrustedMapMessage(source: unknown, expected: unknown): boolean {
  return expected != null && source === expected;
}

export type MapNavigation = 'allow' | 'external' | 'block';

/** Décision pour une navigation demandée par la WebView. */
export function mapNavigationDecision(url: string | null | undefined): MapNavigation {
  const value = String(url ?? '').trim();
  if (!value || value === 'about:blank' || value.startsWith('about:srcdoc')) return 'allow';
  if (/^(data|blob):/i.test(value)) return 'allow';
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return 'block';
  }
  if (parsed.protocol === 'https:' && parsed.hostname === 'localhost' && !parsed.port) return 'allow';
  if (parsed.protocol === 'https:' && !parsed.username && !parsed.password && parsed.hostname.includes('.')) return 'external';
  return 'block';
}
