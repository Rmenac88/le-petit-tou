/**
 * Chargement du catalogue d'adresses : un seul téléchargement par session, partagé par l'accueil, la carte et la
 * recherche, et aucun téléchargement si le catalogue n'a pas changé depuis la copie gardée sur le téléphone.
 *
 * Le serveur donne une empreinte du catalogue (catalog_version, migration 022 : quelques dizaines d'octets). Si elle est
 * égale à celle de la copie locale, la copie sert telle quelle. Sinon (ou sans empreinte : fonction pas encore
 * installée), le catalogue est téléchargé une fois puis gardé. Hors connexion, la dernière copie sert.
 * Logique pure (dépendances injectées), testée avec node:test.
 */

/** Colonnes utiles à l'accueil, à la carte, à la recherche et aux fiches (jamais `*` : pas de colonne inattendue). */
export const CATALOG_COLUMNS =
  'id, title, category_id, location, address, image_url, rating, price_level, is_recommended, is_new, lat, lng, tags, ' +
  'telephone, site_web, horaires, description, gallery_urls, full_description, points_reward, created_at';

export interface CachedCatalog {
  version: string;
  savedAt: number;
  rows: any[];
}

export interface CatalogDeps {
  /** Empreinte du catalogue en base ; null si injoignable ou fonction absente. */
  fetchVersion(): Promise<string | null>;
  /** Catalogue complet trié du plus récent au plus ancien ; null si l'envoi a échoué. */
  fetchAll(): Promise<any[] | null>;
  readCache(): Promise<CachedCatalog | null>;
  writeCache(entry: CachedCatalog): Promise<void>;
  now(): number;
}

export type CatalogSource = 'memory' | 'cache' | 'network' | 'stale-cache' | 'none';

export interface CatalogResult {
  rows: any[] | null;
  source: CatalogSource;
}

/** Lit une copie locale ; toute copie illisible ou vide est ignorée. */
export function parseCachedCatalog(text: string | null | undefined): CachedCatalog | null {
  if (!text) return null;
  try {
    const value = JSON.parse(text);
    if (!value || typeof value !== 'object') return null;
    if (typeof value.version !== 'string' || !Array.isArray(value.rows) || value.rows.length === 0) return null;
    return { version: value.version, savedAt: Number(value.savedAt) || 0, rows: value.rows };
  } catch {
    return null;
  }
}

export class CatalogLoader {
  private memory: any[] | null = null;
  private inFlight: Promise<CatalogResult> | null = null;
  private readonly deps: CatalogDeps;

  constructor(deps: CatalogDeps) {
    this.deps = deps;
  }

  /** Dernier catalogue chargé pendant cette session (sans réseau). */
  peek(): any[] | null {
    return this.memory;
  }

  /**
   * Catalogue à afficher. `refresh` : revérifie l'empreinte même si un catalogue est déjà en mémoire (tirer pour
   * rafraîchir, retour au premier plan). Les appels simultanés partagent le même chargement.
   */
  load(options: { refresh?: boolean } = {}): Promise<CatalogResult> {
    if (!options.refresh && this.memory) return Promise.resolve({ rows: this.memory, source: 'memory' });
    if (this.inFlight) return this.inFlight;
    this.inFlight = this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Après une modification depuis le portail : le prochain chargement revérifie le serveur. */
  invalidate(): void {
    this.memory = null;
  }

  private async run(): Promise<CatalogResult> {
    const [cached, version] = await Promise.all([
      this.deps.readCache().catch(() => null),
      this.deps.fetchVersion().catch(() => null),
    ]);

    if (cached && version && cached.version === version) {
      this.memory = cached.rows;
      return { rows: cached.rows, source: 'cache' };
    }

    const rows = await this.deps.fetchAll().catch(() => null);
    if (rows && rows.length > 0) {
      this.memory = rows;
      // Sans empreinte, rien n'est gardé : la copie ne pourrait pas être revalidée au prochain lancement
      if (version) await this.deps.writeCache({ version, savedAt: this.deps.now(), rows }).catch(() => undefined);
      return { rows, source: 'network' };
    }

    if (cached) {
      this.memory = cached.rows;
      return { rows: cached.rows, source: 'stale-cache' };
    }
    return { rows: this.memory, source: this.memory ? 'memory' : 'none' };
  }
}
