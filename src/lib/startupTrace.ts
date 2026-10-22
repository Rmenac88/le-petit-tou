/**
 * Chronométrage du démarrage (diagnostic) : `performance.now()` part du lancement de l'appli, donc chaque repère
 * indique à quel moment il a été atteint. Affiché en maintenant le doigt sur « LE PETIT TOU » en bas de l'accueil.
 */
const marks: [string, number][] = [];
const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();

/** Enregistre un repère (une seule fois par nom). */
export function mark(name: string): void {
  if (!marks.some((m) => m[0] === name)) marks.push([name, now()]);
}

export function startupReport(): string {
  if (marks.length === 0) return 'Aucune mesure.';
  return marks.map(([name, t]) => `${(t / 1000).toFixed(1)} s  ${name}`).join('\n');
}
