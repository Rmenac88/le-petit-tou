/** Contraste entre deux couleurs hexadécimales (#RRGGBB), calcul WCAG : logique pure, partagée par les offres et le thème. */

export const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

/** Luminance relative WCAG : 0 (noir) à 1 (blanc). */
export const relativeLuminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Rapport de contraste de 1 (identiques) à 21 (noir sur blanc). */
export function contrastRatio(fg: string, bg: string): number {
  const [hi, lo] = [relativeLuminance(fg), relativeLuminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
