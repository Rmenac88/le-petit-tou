import test from 'node:test';
import assert from 'node:assert/strict';
import { UserListsEngine, type ListsEngineDeps } from '../userListsEngine.ts';
import { initialState, type ListsState } from '../userListsLogic.ts';
import type { RemoteLists } from '../userListsSyncLogic.ts';

// Comportement du moteur des listes avec un téléphone et un serveur SIMULÉS : envoi différé, hors connexion,
// adoption de la copie serveur, effacement. Les délais sont pilotés à la main (pas d'attente réelle).

const NOW = 1_790_000_000_000;

function makeEnv(opts: { remote?: RemoteLists | null; pushResult?: () => Promise<number | null> } = {}) {
  const mem = new Map<string, string>();
  const storage = {
    getItem: async (k: string) => mem.get(k) ?? null,
    setItem: async (k: string, v: string) => void mem.set(k, v),
    removeItem: async (k: string) => void mem.delete(k),
  };
  let remote: RemoteLists | null = opts.remote === undefined ? { data: null, updated: 0 } : opts.remote;
  const pushes: ListsState[] = [];
  let serverClock = NOW + 1000;
  const timers: { fn: () => void; ms: number; id: number; live: boolean }[] = [];
  let tid = 0;
  const env = {
    mem, pushes, timers,
    setRemote: (r: RemoteLists | null) => { remote = r; },
    deps: {
      storage,
      remote: {
        fetch: async () => remote,
        push: async (state: ListsState) => {
          const r = opts.pushResult ? await opts.pushResult() : (serverClock += 10);
          if (r !== null) {
            pushes.push(JSON.parse(JSON.stringify(state)));
            remote = { data: state, updated: r };
          }
          return r;
        },
      },
      emit: () => {},
      now: () => NOW,
      setTimer: (fn: () => void, ms: number) => {
        const t = { fn, ms, id: ++tid, live: true };
        timers.push(t);
        return t.id;
      },
      clearTimer: (h: unknown) => {
        const t = timers.find((x) => x.id === h);
        if (t) t.live = false;
      },
      makeId: (() => { let n = 0; return () => `id${++n}`; })(),
    } as ListsEngineDeps,
    /** Déclenche les minuteries en attente (dans l'ordre) puis laisse les promesses se résoudre. */
    async flush() {
      for (let guard = 0; guard < 20; guard++) {
        const t = timers.find((x) => x.live);
        if (!t) break;
        t.live = false;
        t.fn();
        await new Promise((r) => setImmediate(r));
        await new Promise((r) => setImmediate(r));
      }
    },
  };
  return env;
}
const syncMeta = (env: ReturnType<typeof makeEnv>) => JSON.parse(env.mem.get('LPT_USER_LISTS_SYNC_V1') ?? 'null');

test('une modification est enregistrée sur le téléphone tout de suite et envoyée au serveur après le délai', async () => {
  const env = makeEnv();
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush(); // rapprochement initial : rien à faire (téléphone vierge, aucune copie)
  assert.equal(env.pushes.length, 0, 'un téléphone vierge n’envoie rien');

  const r = await e.addSpot('later', 'spot1');
  assert.equal(r.ok, true);
  assert.ok(env.mem.get('LPT_USER_LISTS_V1__n'), 'enregistré en local avant tout envoi');
  assert.equal(syncMeta(env).dirty, true, 'marqué « à envoyer »');
  assert.equal(env.pushes.length, 0, 'pas d’envoi immédiat');

  await env.flush();
  assert.equal(env.pushes.length, 1);
  assert.deepEqual(env.pushes[0].lists.find((l) => l.id === 'later')?.spotIds, ['spot1']);
  assert.equal(syncMeta(env).dirty, false);
  assert.ok(syncMeta(env).syncedAt > NOW);
});

test('plusieurs modifications rapprochées partent en un seul envoi', async () => {
  const env = makeEnv();
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  await e.addSpot('later', 'a');
  await e.addSpot('later', 'b');
  await e.addSpot('return', 'c');
  await env.flush();
  assert.equal(env.pushes.length, 1);
  assert.deepEqual(env.pushes[0].lists.find((l) => l.id === 'later')?.spotIds, ['b', 'a']);
});

test('hors connexion : les listes restent sur le téléphone, à envoyer plus tard (jamais perdues, jamais d’erreur)', async () => {
  const env = makeEnv({ pushResult: async () => null });
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  const r = await e.addSpot('later', 'a');
  assert.equal(r.ok, true);
  await env.flush();
  assert.equal(syncMeta(env).dirty, true, 'toujours à envoyer');
  assert.deepEqual(e.getState().lists.find((l) => l.id === 'later')?.spotIds, ['a']);
});

test('nouveau lancement avec des modifications non envoyées : elles sont envoyées (le téléphone gagne)', async () => {
  const env = makeEnv({ pushResult: async () => null });
  const e1 = new UserListsEngine(env.deps);
  await e1.load();
  await env.flush();
  await e1.addSpot('later', 'a');
  await env.flush();
  assert.equal(env.pushes.length, 0);

  // le réseau revient ; l'appli est relancée (même stockage)
  const env2 = makeEnv({ remote: { data: initialState(NOW), updated: NOW + 5000 } });
  env2.mem.clear();
  for (const [k, v] of env.mem) env2.mem.set(k, v);
  const e2 = new UserListsEngine(env2.deps);
  await e2.load();
  await env2.flush();
  assert.equal(env2.pushes.length, 1, 'envoyé malgré une copie serveur plus récente');
  assert.deepEqual(env2.pushes[0].lists.find((l) => l.id === 'later')?.spotIds, ['a']);
  assert.equal(syncMeta({ mem: env2.mem } as any).dirty, false);
});

test('téléphone vierge (réinstallation avec la même identité, ou données locales effacées) : la copie serveur est reprise', async () => {
  const server = initialState(NOW);
  server.lists = server.lists.map((l) => (l.id === 'later' ? { ...l, spotIds: ['x1', 'x2'] } : l));
  const env = makeEnv({ remote: { data: server, updated: NOW + 7 } });
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  assert.deepEqual(e.getState().lists.find((l) => l.id === 'later')?.spotIds, ['x1', 'x2']);
  assert.equal(syncMeta(env).dirty, false);
  assert.equal(syncMeta(env).syncedAt, NOW + 7);
  assert.equal(env.pushes.length, 0, 'rien à renvoyer');
  // et c'est enregistré en local pour le prochain lancement
  const e2 = new UserListsEngine({ ...env.deps });
  await e2.load();
  assert.deepEqual(e2.getState().lists.find((l) => l.id === 'later')?.spotIds, ['x1', 'x2']);
});

test('ancienne version (listes seulement locales) puis mise à jour : les listes existantes sont envoyées une fois', async () => {
  const env = makeEnv({ remote: { data: null, updated: 0 } });
  // simule le stockage de l'ancienne version : listes enregistrées, aucune méta de synchronisation
  const seed = new UserListsEngine({ ...env.deps, storage: env.deps.storage });
  await seed.load();
  await env.flush();
  await seed.addSpot('return', 'k1');
  env.timers.forEach((t) => { t.live = false; }); // l'ancienne version n'envoyait rien
  env.pushes.length = 0;
  env.mem.delete('LPT_USER_LISTS_SYNC_V1');
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  assert.equal(env.pushes.length, 1);
  assert.deepEqual(env.pushes[0].lists.find((l) => l.id === 'return')?.spotIds, ['k1']);
});

test('serveur sans la fonction (migration pas appliquée) : tout continue en local, sans erreur ni envoi', async () => {
  const env = makeEnv({ remote: null, pushResult: async () => null });
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  const created = await e.createList('Brunchs', '⭐');
  assert.equal(created.ok, true);
  await env.flush();
  assert.equal(e.getState().lists.some((l) => l.name === 'Brunchs'), true);
  assert.equal(env.pushes.length, 0);
});

test('modification pendant un envoi : elle repart aussitôt, rien n’est marqué « à jour » à tort', async () => {
  let release: (v: number) => void = () => {};
  let first = true;
  const env = makeEnv({
    pushResult: () => {
      if (first) {
        first = false;
        return new Promise<number | null>((res) => { release = res; });
      }
      return Promise.resolve(NOW + 99_999);
    },
  });
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  await e.addSpot('later', 'a');
  // déclenche l'envoi, qui reste en attente
  const t = env.timers.find((x) => x.live)!;
  t.live = false;
  t.fn();
  await new Promise((r) => setImmediate(r));
  await e.addSpot('later', 'b'); // pendant l'envoi
  release(NOW + 2000);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  assert.equal(syncMeta(env).dirty, true, 'la seconde modification n’a pas été confirmée');
  await env.flush();
  assert.equal(syncMeta(env).dirty, false);
  assert.deepEqual(env.pushes[env.pushes.length - 1].lists.find((l) => l.id === 'later')?.spotIds, ['b', 'a']);
});

test('« Effacer mes données » : plus d’envoi en attente, état vierge, rien n’est recréé sur le serveur', async () => {
  const env = makeEnv();
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  await e.addSpot('later', 'a');
  await e.resetLocal();
  await env.flush();
  assert.equal(env.pushes.length, 0, 'l’envoi en attente a été annulé');
  assert.equal(env.mem.has('LPT_USER_LISTS_SYNC_V1'), false);
  assert.deepEqual(e.getState().lists.find((l) => l.id === 'later')?.spotIds, []);
});

test('une opération sans effet (ex. nettoyage qui ne retire rien) ne déclenche aucun envoi', async () => {
  const env = makeEnv();
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  await e.purge(new Set(['rien']));
  await env.flush();
  assert.equal(env.pushes.length, 0);
  assert.equal(syncMeta(env), null);
});

test('un seul envoi à la fois', async () => {
  let running = 0;
  let maxRunning = 0;
  const env = makeEnv({
    pushResult: async () => {
      running++;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setImmediate(r));
      running--;
      return NOW + 5000;
    },
  });
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  await e.addSpot('later', 'a');
  await env.flush();
  await e.addSpot('later', 'b');
  await e.addSpot('later', 'c');
  await env.flush();
  assert.equal(maxRunning, 1);
});

function heldPushEnv() {
  let calls = 0;
  let release: (v: number | null) => void = () => {};
  const env = makeEnv({
    pushResult: () => {
      calls += 1;
      if (calls === 1) return new Promise<number | null>((res) => { release = res; });
      return Promise.resolve(NOW + 99_999);
    },
  });
  return { env, calls: () => calls, release: (v: number | null) => release(v) };
}
const tick = async () => { await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r)); };

test('avant « Effacer mes données », l’arrêt des envois attend la fin de celui qui est en cours', async () => {
  const { env, release } = heldPushEnv();
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  await e.addSpot('later', 'a');
  const t = env.timers.find((x) => x.live)!;
  t.live = false;
  t.fn(); // envoi en cours, en attente de réponse
  await tick();

  let done = false;
  const q = e.quiesceSync().then(() => { done = true; });
  await tick();
  assert.equal(done, false, 'tant que l’envoi n’est pas terminé, on attend');
  release(NOW + 3000);
  await q;
  assert.equal(done, true);
  assert.equal(env.timers.some((x) => x.live), false, 'aucun envoi ne reste planifié');
});

test('l’effacement local attend aussi l’envoi en cours, puis repart d’un état vierge sans trace de synchronisation', async () => {
  const { env, release } = heldPushEnv();
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  await e.addSpot('later', 'a');
  const t = env.timers.find((x) => x.live)!;
  t.live = false;
  t.fn();
  await tick();

  let done = false;
  const r = e.resetLocal().then(() => { done = true; });
  await tick();
  assert.equal(done, false, 'pas de remise à zéro pendant qu’un envoi est en cours');
  release(NOW + 3000);
  await r;
  assert.equal(env.mem.has('LPT_USER_LISTS_SYNC_V1'), false, 'la fin de l’envoi ne laisse pas d’état de synchronisation');
  assert.deepEqual(e.getState().lists.find((l) => l.id === 'later')?.spotIds, []);
});

test('jamais deux envois en même temps, même si une seconde minuterie arrive pendant le premier', async () => {
  const { env, calls, release } = heldPushEnv();
  const e = new UserListsEngine(env.deps);
  await e.load();
  await env.flush();
  await e.addSpot('later', 'a');
  let t = env.timers.find((x) => x.live)!;
  t.live = false;
  t.fn();
  await tick();
  assert.equal(calls(), 1);

  await e.addSpot('later', 'b'); // planifie un nouvel envoi pendant le premier
  t = env.timers.find((x) => x.live)!;
  t.live = false;
  t.fn(); // …qui arrive alors que le premier n'est pas fini
  await tick();
  assert.equal(calls(), 1, 'toujours un seul envoi à la fois');

  release(NOW + 4000);
  await tick();
  await env.flush();
  assert.equal(calls(), 2, 'la modification faite entre-temps est envoyée ensuite');
  assert.equal(syncMeta(env).dirty, false);
});
