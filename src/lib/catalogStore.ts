import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import { supabase } from './supabase';
import { CATALOG_COLUMNS, CatalogLoader, parseCachedCatalog, type CachedCatalog } from './catalogLogic';

/**
 * Instance réelle du chargeur de catalogue (voir catalogLogic.ts).
 * La copie locale est un fichier du téléphone (Paths.document), pas le trousseau sécurisé : le catalogue est public et
 * pèse environ 2 Mo. Sur le web : localStorage (ignoré si plein).
 */
const CACHE_FILE = 'lpt_catalog_v1.json';
const WEB_KEY = 'LPT_CATALOG_V1';

function cacheFile(): File | null {
  try {
    return new File(Paths.document, CACHE_FILE);
  } catch {
    return null;
  }
}

async function readCache(): Promise<CachedCatalog | null> {
  if (Platform.OS === 'web') {
    try {
      return parseCachedCatalog(window.localStorage.getItem(WEB_KEY));
    } catch {
      return null;
    }
  }
  const f = cacheFile();
  if (!f || !f.exists) return null;
  return parseCachedCatalog(await f.text());
}

async function writeCache(entry: CachedCatalog): Promise<void> {
  const text = JSON.stringify(entry);
  if (Platform.OS === 'web') {
    try {
      window.localStorage.setItem(WEB_KEY, text);
    } catch {}
    return;
  }
  const f = cacheFile();
  if (!f) return;
  try {
    if (!f.exists) f.create();
    // SDK 58 : File.write() est asynchrone
    await f.write(text);
  } catch {}
}

export const catalogStore = new CatalogLoader({
  async fetchVersion() {
    const { data, error } = await supabase.rpc('catalog_version');
    return !error && typeof data === 'string' && data.length > 0 ? data : null;
  },
  async fetchAll() {
    const { data, error } = await supabase.from('addresses').select(CATALOG_COLUMNS).order('created_at', { ascending: false });
    return !error && Array.isArray(data) ? data : null;
  },
  readCache,
  writeCache,
  now: () => Date.now(),
});
