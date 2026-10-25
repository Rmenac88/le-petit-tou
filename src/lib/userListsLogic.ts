/**
 * Listes personnelles de l'utilisateur (« À tester plus tard », « Y retourner » et ses propres listes).
 * Logique pure (sans React Native ni stockage) : toutes les opérations renvoient un NOUVEL état.
 * Les listes restent sur le téléphone : aucune donnée personnelle de plus ne part vers un serveur.
 */

export type ListKind = 'later' | 'return' | 'custom';

export interface UserList {
  id: string;
  kind: ListKind;
  name: string;
  emoji: string;
  spotIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface ListsState {
  version: 1;
  lists: UserList[];
}

export const MAX_LISTS = 20;
export const MAX_SPOTS_PER_LIST = 100;
export const MAX_NAME_LENGTH = 30;

export const BUILTIN_LISTS: readonly Pick<UserList, 'id' | 'kind' | 'name' | 'emoji'>[] = [
  { id: 'later', kind: 'later', name: 'À tester plus tard', emoji: '🕒' },
  { id: 'return', kind: 'return', name: 'Y retourner', emoji: '🔁' },
];

/** Pastilles proposées à la création d'une liste. */
export const LIST_EMOJIS = ['⭐', '🍽️', '🍸', '☕', '🛍️', '🎉', '💑', '👯', '🌳', '🎨'] as const;

const SAFE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const DEFAULT_EMOJI = '⭐';

export function initialState(now: number): ListsState {
  return {
    version: 1,
    lists: BUILTIN_LISTS.map((b) => ({ ...b, spotIds: [], createdAt: now, updatedAt: now })),
  };
}

const cleanName = (name: unknown): string => String(name ?? '').replace(/\s+/g, ' ').trim();

/** Une seule pastille (emoji) : on garde le premier caractère « visible », sinon l'étoile. */
export function sanitizeEmoji(value: unknown): string {
  const text = String(value ?? '').trim();
  if (!text) return DEFAULT_EMOJI;
  const first = Array.from(text)[0];
  // refuse les lettres, chiffres et signes ordinaires : seule une vraie pastille est acceptée
  return /^[\p{L}\p{N}\p{P}\p{Z}]$/u.test(first) ? DEFAULT_EMOJI : first;
}

/**
 * Relit un état enregistré (peut venir d'une ancienne version ou être abîmé) : retrouve les listes de base,
 * écarte les doublons et les valeurs invalides, applique les plafonds.
 */
export function normalizeState(raw: unknown, now: number): ListsState {
  const base = initialState(now);
  const input = (raw && typeof raw === 'object' ? (raw as any).lists : null) as unknown;
  if (!Array.isArray(input)) return base;

  const seen = new Set<string>();
  const custom: UserList[] = [];
  const byBuiltin = new Map<string, UserList>(base.lists.map((l) => [l.id, l]));

  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as any).id;
    if (typeof id !== 'string' || !SAFE_ID.test(id) || seen.has(id)) continue;
    seen.add(id);
    const spotIds = Array.isArray((item as any).spotIds)
      ? Array.from(new Set((item as any).spotIds.filter((s: unknown) => typeof s === 'string' && SAFE_ID.test(s)))).slice(0, MAX_SPOTS_PER_LIST) as string[]
      : [];
    const createdAt = Number.isFinite((item as any).createdAt) ? Number((item as any).createdAt) : now;
    const updatedAt = Number.isFinite((item as any).updatedAt) ? Number((item as any).updatedAt) : createdAt;

    const builtin = byBuiltin.get(id);
    if (builtin) {
      byBuiltin.set(id, { ...builtin, spotIds, createdAt, updatedAt });
    } else if (custom.length < MAX_LISTS - BUILTIN_LISTS.length) {
      const name = cleanName((item as any).name).slice(0, MAX_NAME_LENGTH);
      if (!name) continue;
      custom.push({ id, kind: 'custom', name, emoji: sanitizeEmoji((item as any).emoji), spotIds, createdAt, updatedAt });
    }
  }
  return { version: 1, lists: [...BUILTIN_LISTS.map((b) => byBuiltin.get(b.id) as UserList), ...custom] };
}

export type ListResult<T = {}> = ({ ok: true; state: ListsState } & T) | { ok: false; error: string };

export function validateListName(name: unknown, lists: readonly UserList[], exceptId?: string): { ok: true; name: string } | { ok: false; error: string } {
  const clean = cleanName(name);
  if (!clean) return { ok: false, error: 'Donne un nom à ta liste.' };
  if (clean.length > MAX_NAME_LENGTH) return { ok: false, error: `Le nom est trop long (${MAX_NAME_LENGTH} caractères maximum).` };
  const lower = clean.toLocaleLowerCase('fr');
  if (lists.some((l) => l.id !== exceptId && l.name.toLocaleLowerCase('fr') === lower)) {
    return { ok: false, error: 'Tu as déjà une liste avec ce nom.' };
  }
  return { ok: true, name: clean };
}

export function createList(state: ListsState, name: unknown, emoji: unknown, now: number, makeId: () => string): ListResult<{ list: UserList }> {
  if (state.lists.length >= MAX_LISTS) return { ok: false, error: `Tu as atteint la limite de ${MAX_LISTS} listes.` };
  const valid = validateListName(name, state.lists);
  if (!valid.ok) return valid;
  const id = makeId();
  if (!SAFE_ID.test(id) || state.lists.some((l) => l.id === id)) return { ok: false, error: 'Impossible de créer la liste, réessaie.' };
  const list: UserList = { id, kind: 'custom', name: valid.name, emoji: sanitizeEmoji(emoji), spotIds: [], createdAt: now, updatedAt: now };
  return { ok: true, state: { ...state, lists: [...state.lists, list] }, list };
}

export function renameList(state: ListsState, id: string, name: unknown, emoji: unknown, now: number): ListResult {
  const target = state.lists.find((l) => l.id === id);
  if (!target) return { ok: false, error: 'Liste introuvable.' };
  if (target.kind !== 'custom') return { ok: false, error: 'Cette liste ne peut pas être renommée.' };
  const valid = validateListName(name, state.lists, id);
  if (!valid.ok) return valid;
  return { ok: true, state: { ...state, lists: state.lists.map((l) => (l.id === id ? { ...l, name: valid.name, emoji: sanitizeEmoji(emoji), updatedAt: now } : l)) } };
}

export function deleteList(state: ListsState, id: string): ListResult {
  const target = state.lists.find((l) => l.id === id);
  if (!target) return { ok: false, error: 'Liste introuvable.' };
  if (target.kind !== 'custom') return { ok: false, error: 'Cette liste ne peut pas être supprimée.' };
  return { ok: true, state: { ...state, lists: state.lists.filter((l) => l.id !== id) } };
}

export function addSpot(state: ListsState, listId: string, spotId: string, now: number): ListResult {
  const target = state.lists.find((l) => l.id === listId);
  if (!target) return { ok: false, error: 'Liste introuvable.' };
  if (!SAFE_ID.test(spotId)) return { ok: false, error: 'Adresse invalide.' };
  if (target.spotIds.includes(spotId)) return { ok: true, state };
  if (target.spotIds.length >= MAX_SPOTS_PER_LIST) return { ok: false, error: `Cette liste est pleine (${MAX_SPOTS_PER_LIST} adresses maximum).` };
  // la plus récente en tête
  return { ok: true, state: { ...state, lists: state.lists.map((l) => (l.id === listId ? { ...l, spotIds: [spotId, ...l.spotIds], updatedAt: now } : l)) } };
}

export function removeSpot(state: ListsState, listId: string, spotId: string, now: number): ListResult {
  const target = state.lists.find((l) => l.id === listId);
  if (!target) return { ok: false, error: 'Liste introuvable.' };
  if (!target.spotIds.includes(spotId)) return { ok: true, state };
  return { ok: true, state: { ...state, lists: state.lists.map((l) => (l.id === listId ? { ...l, spotIds: l.spotIds.filter((s) => s !== spotId), updatedAt: now } : l)) } };
}

export function toggleSpot(state: ListsState, listId: string, spotId: string, now: number): ListResult<{ added: boolean }> {
  const target = state.lists.find((l) => l.id === listId);
  if (!target) return { ok: false, error: 'Liste introuvable.' };
  const has = target.spotIds.includes(spotId);
  const res = has ? removeSpot(state, listId, spotId, now) : addSpot(state, listId, spotId, now);
  return res.ok ? { ok: true, state: res.state, added: !has } : res;
}

/** Identifiants des listes qui contiennent cette adresse. */
export function listsContaining(state: ListsState, spotId: string): string[] {
  return state.lists.filter((l) => l.spotIds.includes(spotId)).map((l) => l.id);
}

/** Retire une adresse de toutes les listes (adresse supprimée du guide). */
export function purgeSpots(state: ListsState, existingIds: ReadonlySet<string>): ListsState {
  let changed = false;
  const lists = state.lists.map((l) => {
    const kept = l.spotIds.filter((id) => existingIds.has(id));
    if (kept.length === l.spotIds.length) return l;
    changed = true;
    return { ...l, spotIds: kept };
  });
  return changed ? { ...state, lists } : state;
}
