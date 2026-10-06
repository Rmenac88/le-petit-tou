/** Note affichée partout avec une décimale (« 5.0 », « 4.5 »), « – » si absente. */
export function formatRating(value: unknown): string {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n.toFixed(1) : '–';
}
