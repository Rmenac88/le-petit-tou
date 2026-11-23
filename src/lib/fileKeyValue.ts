/**
 * Stockage clé → texte rapide pour les données NON secrètes de l'appli (listes, likes, points, réglages, caches).
 *
 * Pourquoi : tout était rangé dans le coffre chiffré du téléphone (expo-secure-store, Keychain / Keystore). Ce coffre
 * est fait pour quelques petits secrets ; sur Android, chaque lecture passe par un déchiffrement matériel, et l'appli
 * en faisait des dizaines à la suite : plusieurs secondes d'attente sur un téléphone modeste (S10e).
 * Désormais : un fichier par clé dans le dossier privé de l'appli, plus une copie en mémoire. L'identifiant d'appareil,
 * qui sert de clé d'accès au profil, RESTE dans le coffre (deviceIdentity.ts ne passe pas par ici).
 *
 * Reprise : une clé absente des fichiers est cherchée dans l'ancien coffre ; trouvée, elle est recopiée en fichier puis
 * retirée du coffre. Personne ne perd ses listes, likes ou points en mettant l'appli à jour.
 * Logique pure (dépendances injectées), testée avec node:test.
 */
export interface FileBackend {
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  remove(name: string): Promise<void>;
}

export interface LegacyStore {
  get(key: string): Promise<string | null>;
  remove(key: string): Promise<void>;
}

/** Nom de fichier sûr pour une clé (lettres, chiffres, « _ », « - » et « . » gardés ; le reste encodé). */
export function fileNameFor(key: string): string {
  return (
    String(key).replace(/[^A-Za-z0-9_.-]/g, (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')) + '.txt'
  );
}

export class FileKeyValueStore {
  private mem = new Map<string, string | null>();
  private readonly files: FileBackend;
  private readonly legacy: LegacyStore | null;

  constructor(files: FileBackend, legacy: LegacyStore | null = null) {
    this.files = files;
    this.legacy = legacy;
  }

  async getItem(key: string): Promise<string | null> {
    if (this.mem.has(key)) return this.mem.get(key) ?? null;
    let value: string | null = null;
    try {
      value = await this.files.read(fileNameFor(key));
    } catch {
      value = null;
    }
    if (value === null && this.legacy) {
      try {
        value = await this.legacy.get(key);
        if (value !== null) {
          await this.files.write(fileNameFor(key), value);
          await this.legacy.remove(key).catch(() => undefined);
        }
      } catch {}
    }
    this.mem.set(key, value);
    return value;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.mem.set(key, value);
    await this.files.write(fileNameFor(key), value);
  }

  async removeItem(key: string): Promise<void> {
    this.mem.set(key, null);
    await this.files.remove(fileNameFor(key)).catch(() => undefined);
    if (this.legacy) await this.legacy.remove(key).catch(() => undefined);
  }
}
