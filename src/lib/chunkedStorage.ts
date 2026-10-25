/**
 * Enregistrement d'un texte potentiellement long dans un stockage à valeurs de petite taille (le coffre sécurisé du
 * téléphone n'aime pas les valeurs de plus de ~2 Ko). Le texte est découpé en morceaux ; un compteur est écrit en
 * dernier : une écriture interrompue laisse l'ancienne version lisible ou, à défaut, « rien » (jamais un texte tronqué).
 */

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const CHUNK_SIZE = 1500;

const chunkKey = (key: string, i: number) => `${key}__${i}`;
const countKey = (key: string) => `${key}__n`;

export async function saveChunked(storage: KeyValueStorage, key: string, text: string): Promise<void> {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK_SIZE) chunks.push(text.slice(i, i + CHUNK_SIZE));
  const previous = Number((await storage.getItem(countKey(key))) ?? 0) || 0;
  for (let i = 0; i < chunks.length; i++) await storage.setItem(chunkKey(key, i), chunks[i]);
  await storage.setItem(countKey(key), String(chunks.length));
  for (let i = chunks.length; i < previous; i++) await storage.removeItem(chunkKey(key, i));
}

export async function loadChunked(storage: KeyValueStorage, key: string): Promise<string | null> {
  const rawCount = await storage.getItem(countKey(key));
  if (rawCount === null) return null; // jamais enregistré
  const count = Number(rawCount);
  if (!Number.isInteger(count) || count < 0 || count > 2000) return null;
  let text = '';
  for (let i = 0; i < count; i++) {
    const part = await storage.getItem(chunkKey(key, i));
    if (part === null) return null;
    text += part;
  }
  return text;
}

export async function clearChunked(storage: KeyValueStorage, key: string): Promise<void> {
  const count = Number((await storage.getItem(countKey(key))) ?? 0) || 0;
  for (let i = 0; i < count; i++) await storage.removeItem(chunkKey(key, i));
  await storage.removeItem(countKey(key));
}
