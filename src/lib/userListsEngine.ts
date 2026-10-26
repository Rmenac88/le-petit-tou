import { clearChunked, loadChunked, saveChunked, type KeyValueStorage } from './chunkedStorage.ts';
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
} from './userListsLogic.ts';
import { INITIAL_META, parseSyncMeta, planSync, shouldPush, type RemoteLists, type SyncMeta } from './userListsSyncLogic.ts';

/** Événement diffusé à chaque modification (les écrans ouverts se mettent à jour). */
export const USER_LISTS_CHANGED_EVENT = 'pt_user_lists_changed';

const STORAGE_KEY = 'LPT_USER_LISTS_V1';
/** État de la copie serveur : modifications à envoyer, date de la dernière synchronisation. */
const SYNC_KEY = 'LPT_USER_LISTS_SYNC_V1';
/** Délai avant l'envoi : plusieurs ajouts à la suite partent en une seule fois. */
const PUSH_DELAY_MS = 2000;

/** Dépendances injectées : le moteur n'importe rien de natif (testable avec node:test). */
export interface ListsEngineDeps {
  storage: KeyValueStorage;
  remote: {
    /** Copie du serveur ; null = injoignable ou fonction pas installée. */
    fetch(): Promise<RemoteLists | null>;
    /** Envoie l'état complet ; renvoie la date serveur (ms) ou null si l'envoi n'a pas abouti. */
    push(state: ListsState): Promise<number | null>;
  };
  emit(event: string, payload: unknown): void;
  now(): number;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  makeId(): string;
}

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

/**
 * Listes personnelles : enregistrées d'abord sur le téléphone, puis copiées sur le serveur sous l'identifiant de
 * l'installation (migration 015 ; silencieux et sans conséquence si elle n'est pas installée ou hors connexion).
 * Les opérations sont appliquées dans l'ordre et chaque modification est écrite avant d'être confirmée.
 */
export class UserListsEngine {
  private state: ListsState;
  private loadPromise: Promise<ListsState> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(state: ListsState) => void>();
  private readonly deps: ListsEngineDeps;

  // (pas de « propriété de paramètre » : non prise en charge par l'exécution des tests)
  constructor(deps: ListsEngineDeps) {
    this.deps = deps;
    this.state = initialState(deps.now());
  }

  // Copie serveur
  private meta: SyncMeta = INITIAL_META;
  private rev = 0;
  private pushTimer: unknown = null;
  private inFlight: Promise<void> | null = null;
  private lastFailureAt = 0;

  load(): Promise<ListsState> {
    if (!this.loadPromise) {
      this.loadPromise = (async () => {
        try {
          const text = await loadChunked(this.deps.storage, STORAGE_KEY);
          this.state = normalizeState(text ? JSON.parse(text) : null, this.deps.now());
        } catch {
          this.state = initialState(this.deps.now());
        }
        try {
          const rawMeta = await this.deps.storage.getItem(SYNC_KEY);
          this.meta = rawMeta ? parseSyncMeta(JSON.parse(rawMeta)) : INITIAL_META;
        } catch {
          this.meta = INITIAL_META;
        }
        this.notify();
        // Rapprochement avec la copie serveur, sans faire attendre l'écran
        this.deps.setTimer(() => void this.sync(), 0);
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
    this.deps.emit(USER_LISTS_CHANGED_EVENT, this.state);
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
        await saveChunked(this.deps.storage, STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        this.state = previous;
        this.notify();
        return { ok: false, error: 'Impossible d\'enregistrer sur ce téléphone, réessaie.' };
      }
      // Une opération sans effet (ex. nettoyage qui ne retire rien) ne déclenche aucun envoi
      const changed = res.state !== previous;
      if (changed) {
        this.rev += 1;
        this.setMeta({ ...this.meta, dirty: true });
      }
      this.notify();
      if (changed) this.schedulePush(PUSH_DELAY_MS);
      return res as Result<T>;
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  createList(name: string, emoji: string): Promise<Result<{ list: UserList }>> {
    return this.apply((s) => createList(s, name, emoji, this.deps.now(), this.deps.makeId));
  }
  renameList(id: string, name: string, emoji: string) {
    return this.apply((s) => renameList(s, id, name, emoji, this.deps.now()));
  }
  deleteList(id: string) {
    return this.apply((s) => deleteList(s, id));
  }
  addSpot(listId: string, spotId: string) {
    return this.apply((s) => addSpot(s, listId, spotId, this.deps.now()));
  }
  removeSpot(listId: string, spotId: string) {
    return this.apply((s) => removeSpot(s, listId, spotId, this.deps.now()));
  }
  toggleSpot(listId: string, spotId: string) {
    return this.apply((s) => toggleSpot(s, listId, spotId, this.deps.now()));
  }
  /** Retire des listes les adresses qui n'existent plus dans le guide. */
  purge(existingIds: ReadonlySet<string>) {
    return this.apply((s) => {
      const next = purgeSpots(s, existingIds);
      return { ok: true as const, state: next };
    });
  }

  // --- Copie serveur ----------------------------------------------------------------------------------------------

  private setMeta(meta: SyncMeta) {
    this.meta = meta;
    this.deps.storage.setItem(SYNC_KEY, JSON.stringify(meta)).catch(() => {});
  }

  private schedulePush(delay: number) {
    if (this.pushTimer) this.deps.clearTimer(this.pushTimer);
    this.pushTimer = this.deps.setTimer(() => {
      this.pushTimer = null;
      void this.pushNow();
    }, delay);
  }

  /** Envoie l'état complet. Une modification faite pendant l'envoi reste « à envoyer » et repart aussitôt. */
  private pushNow(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    if (!shouldPush(this.meta, this.lastFailureAt, this.deps.now())) return Promise.resolve();
    const snapshot = this.state;
    const revAtStart = this.rev;
    this.inFlight = (async () => {
      const updated = await this.deps.remote.push(snapshot);
      if (updated === null) {
        this.lastFailureAt = this.deps.now();
        return;
      }
      this.lastFailureAt = 0;
      const changedMeanwhile = this.rev !== revAtStart;
      this.setMeta({ dirty: changedMeanwhile, syncedAt: updated });
      if (changedMeanwhile) this.schedulePush(500);
    })().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** Reprend la copie du serveur si elle est plus récente (ou la fusionne la première fois) ; envoie les modifications en attente. */
  async sync(): Promise<void> {
    await this.load();
    const remote = await this.deps.remote.fetch();
    const run = async () => {
      const plan = planSync(this.state, this.meta, remote, this.deps.now());
      if (plan.action === 'adopt' || plan.action === 'merge') {
        const previous = this.state;
        this.state = plan.state;
        try {
          await saveChunked(this.deps.storage, STORAGE_KEY, JSON.stringify(this.state));
        } catch {
          this.state = previous;
          return;
        }
        this.rev += 1;
        this.setMeta({ dirty: plan.action === 'merge', syncedAt: remote?.updated ?? 0 });
        this.notify();
        if (plan.action === 'merge') this.schedulePush(0);
      } else if (plan.action === 'push') {
        if (!this.meta.dirty) this.setMeta({ ...this.meta, dirty: true });
        this.schedulePush(0);
      }
    };
    const next = this.queue.then(run, run);
    this.queue = next.catch(() => undefined);
    await next;
  }

  /** Avant « Effacer mes données » : plus aucun envoi en attente ni en cours (sinon il recréerait la copie effacée). */
  async quiesceSync(): Promise<void> {
    if (this.pushTimer) {
      this.deps.clearTimer(this.pushTimer);
      this.pushTimer = null;
    }
    await this.inFlight?.catch(() => undefined);
  }

  /** « Effacer mes données » : les listes repartent de zéro (la copie serveur est effacée par delete_my_data). */
  async resetLocal(): Promise<void> {
    await this.quiesceSync();
    await this.queue.catch(() => undefined);
    await clearChunked(this.deps.storage, STORAGE_KEY);
    this.state = initialState(this.deps.now());
    this.rev += 1;
    this.meta = INITIAL_META;
    this.lastFailureAt = 0;
    await this.deps.storage.removeItem(SYNC_KEY).catch(() => {});
    this.loadPromise = Promise.resolve(this.state);
    this.notify();
  }
}

