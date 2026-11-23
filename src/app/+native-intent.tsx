import { safeSystemPath } from '../lib/deepLinkGuard';

/**
 * Appelé par expo-router pour chaque lien entrant, avant tout décodage (voir src/lib/deepLinkGuard.ts, audit S2-06).
 * Ne doit jamais lever d'erreur : en cas de doute, l'accueil.
 */
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return safeSystemPath(path);
  } catch {
    return '/';
  }
}
