import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { Directory, File, Paths } from 'expo-file-system';
import { FileKeyValueStore, type FileBackend } from './fileKeyValue';

/**
 * Stockage clé → texte de l'appli (listes, likes, points, réglages, caches), sur toutes les plateformes.
 * - Téléphone : fichiers privés de l'appli + copie en mémoire (fileKeyValue.ts). Avant, tout passait par le coffre
 *   chiffré (SecureStore), très lent sur Android : plusieurs secondes d'attente à l'ouverture des écrans.
 *   Les anciennes valeurs du coffre sont reprises automatiquement à la première lecture.
 * - Web : localStorage, avec une copie en mémoire si le navigateur le refuse.
 * L'identifiant d'appareil reste dans le coffre (deviceIdentity.ts), lui seul sert de secret.
 */

let kvDir: Directory | null = null;
function dir(): Directory {
  if (!kvDir) {
    kvDir = new Directory(Paths.document, 'lpt-kv');
    if (!kvDir.exists) kvDir.create({ intermediates: true });
  }
  return kvDir;
}

const nativeFiles: FileBackend = {
  async read(name) {
    const f = new File(dir(), name);
    return f.exists ? await f.text() : null;
  },
  async write(name, text) {
    const f = new File(dir(), name);
    if (!f.exists) f.create();
    // SDK 58 : File.write() est asynchrone ; on attend la fin de l'écriture avant de confirmer
    await f.write(text);
  },
  async remove(name) {
    const f = new File(dir(), name);
    if (f.exists) f.delete();
  },
};

const nativeStore =
  Platform.OS === 'web'
    ? null
    : new FileKeyValueStore(nativeFiles, {
        get: (key) => SecureStore.getItemAsync(key),
        remove: (key) => SecureStore.deleteItemAsync(key),
      });

class AppStorage {
  private memCache = new Map<string, string>();

  async getItem(key: string): Promise<string | null> {
    try {
      if (nativeStore) return await nativeStore.getItem(key);
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
      return this.memCache.get(key) ?? null;
    } catch (err) {
      console.warn(`[AppStorage] Error reading key "${key}":`, err);
      return this.memCache.get(key) ?? null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    this.memCache.set(key, value);
    try {
      if (nativeStore) return await nativeStore.setItem(key, value);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
      }
    } catch (err) {
      console.warn(`[AppStorage] Error writing key "${key}":`, err);
    }
  }

  async removeItem(key: string): Promise<void> {
    this.memCache.delete(key);
    try {
      if (nativeStore) return await nativeStore.removeItem(key);
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (err) {
      console.warn(`[AppStorage] Error removing key "${key}":`, err);
    }
  }

  async getJSON<T>(key: string, defaultValue: T): Promise<T> {
    try {
      const raw = await this.getItem(key);
      if (!raw) return defaultValue;
      return JSON.parse(raw) as T;
    } catch {
      return defaultValue;
    }
  }

  async setJSON<T>(key: string, value: T): Promise<void> {
    try {
      await this.setItem(key, JSON.stringify(value));
    } catch (err) {
      console.warn(`[AppStorage] Error serializing key "${key}":`, err);
    }
  }
}

export const appStorage = new AppStorage();
