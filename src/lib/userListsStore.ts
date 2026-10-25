import { appStorage } from './storage';
import { emitAppEvent } from './appEvents';
import { clearChunked, loadChunked, saveChunked } from './chunkedStorage';
import {
  addSpot,
  createList,
  deleteList,
  initialState,
  normalizeState,
  purgeSpots,
  removeSpot,
  renameList,
  toggleSpot,
  type ListsState,
  type UserList,
} from './userListsLogic';

/** Événement diffusé à chaque modification (les écrans ouverts se mettent à jour). */
export const USER_LISTS_CHANGED_EVENT = 'pt_user_lists_changed';

const STORAGE_KEY = 'LPT_USER_LISTS_V1';

const makeId = () => `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Listes personnelles : enregistrées UNIQUEMENT sur le téléphone (aucun envoi au serveur). Les opérations sont
 * appliquées dans l'ordre et chaque modification est écrite avant d'être confirmée.
 */
class UserListsStore {
  private state: ListsState = initialState(Date.now());
  private loadPromise: Promise<ListsState> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(state: ListsState) => void>();

  load(): Promise<ListsState> {
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const text = await loadChunked(appStorage, STORAGE_KEY);
          this.state = normalizeState(text ? JSON.parse(text) : null, Date.now());
        } catch {
          this.state = initialState(Date.now());
        }
        this.notify();
        return this.state;
      })();
    }
    return this.loadPromise;
  }

  getState(): ListsState {
    return this.state;
  }

  subscribe(listener: (state: ListsState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    this.load();
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((l) => {
      try {
        l(this.state);
      } catch {}
    });
    emitAppEvent(USER_LISTS_CHANGED_EVENT, this.state);
  }

  /** Applique une opération pure sur l'état, puis l'écrit ; les appels simultanés passent l'un après l'autre. */
  private apply<T>(op: (state: ListsState) => ({ ok: true; state: ListsState } & T) | { ok: false; error: string }): Promise<Result<T>> {
    const run = async (): Promise<Result<T>> => {
      await this.load();
      const res = op(this.state);
      if (!res.ok) return res;
      const previous = this.state;
      this.state = res.state;
      try {
        await saveChunked(appStorage, STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        this.state = previous;
        this.notify();
        return { ok: false, error: 'Impossible d\'enregistrer sur ce téléphone, réessaie.' };
      }
      this.notify();
      return res as Result<T>;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  createList(name: string, emoji: string): Promise<Result<{ list: UserList }>> {
    return this.apply((s) => createList(s, name, emoji, Date.now(), makeId));
  }
  renameList(id: string, name: string, emoji: string) {
    return this.apply((s) => renameList(s, id, name, emoji, Date.now()));
  }
  deleteList(id: string) {
    return this.apply((s) => deleteList(s, id));
  }
  addSpot(listId: string, spotId: string) {
    return this.apply((s) => addSpot(s, listId, spotId, Date.now()));
  }
  removeSpot(listId: string, spotId: string) {
    return this.apply((s) => removeSpot(s, listId, spotId, Date.now()));
  }
  toggleSpot(listId: string, spotId: string) {
    return this.apply((s) => toggleSpot(s, listId, spotId, Date.now()));
  }
  /** Retire des listes les adresses qui n'existent plus dans le guide. */
  purge(existingIds: ReadonlySet<string>) {
    return this.apply((s) => {
      const next = purgeSpots(s, existingIds);
      return { ok: true as const, state: next };
    });
  }

  /** « Effacer mes données » : les listes repartent de zéro. */
  async resetLocal(): Promise<void> {
    await this.queue.catch(() => undefined);
    await clearChunked(appStorage, STORAGE_KEY);
    this.state = initialState(Date.now());
    this.loadPromise = Promise.resolve(this.state);
    this.notify();
  }
}

export const userListsStore = new UserListsStore();
