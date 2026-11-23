/**
 * UUID v4 tiré d'un générateur cryptographique. L'identifiant d'appareil sert de secret d'accès aux données de
 * l'installation (listes, découvertes, likes) : il ne doit jamais venir de Math.random, qui est prévisible.
 * Logique pure (sources injectées), testée avec node:test.
 */
export interface RandomSources {
  /** crypto.randomUUID natif (navigateur, Node, Hermes récent). */
  randomUUID?: () => string;
  /** Remplit un tableau d'octets aléatoires sûrs (crypto.getRandomValues ou expo-crypto). */
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV4(value: string): boolean {
  return UUID_RE.test(value);
}

export function uuidFromBytes(bytes: Uint8Array): string {
  const b = Uint8Array.from(bytes.subarray(0, 16));
  b[6] = (b[6] & 0x0f) | 0x40; // version 4
  b[8] = (b[8] & 0x3f) | 0x80; // variante RFC 4122
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Premier générateur sûr disponible ; erreur s'il n'y en a aucun (jamais de repli sur Math.random). */
export function secureUuid(sources: RandomSources): string {
  if (sources.randomUUID) {
    try {
      const id = sources.randomUUID().toLowerCase();
      if (isUuidV4(id)) return id;
    } catch {}
  }
  if (sources.getRandomValues) {
    const bytes = sources.getRandomValues(new Uint8Array(16));
    if (bytes && bytes.length >= 16) return uuidFromBytes(bytes);
  }
  throw new Error('Aucun générateur aléatoire sûr disponible');
}
