/**
 * Liens entrants (lepetittou://…, liens universels) : l'appli n'a qu'un écran, donc tout lien externe mène à l'accueil.
 *
 * Pourquoi : expo-router 57 décode le chemin avec decode-uri-component@0.2.2, dont le temps de calcul explose sur un
 * chemin malformé (environ 20 s pour 3 000 caractères : audit S2-06). Ramener tout lien externe à « / » AVANT ce
 * décodage supprime le problème sans attendre Expo SDK 58. Logique pure, testée avec node:test.
 */
export const HOME_PATH = '/';

export function safeSystemPath(path: unknown): string {
  // Seule route de l'appli : l'accueil. Aucun chemin reçu de l'extérieur n'est transmis au routeur.
  void path;
  return HOME_PATH;
}
