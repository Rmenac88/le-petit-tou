# Revue de la couche données du client — 22 octobre 2026

Complète `01` à `04`. Analyse en **lecture seule** : aucun fichier de code modifié, ni `npm install`, ni serveur, ni appel réseau (production non interrogée).

## 0. Comment lire ce rapport

- **[V] vérifié dans le code** : j'ai lu la ligne citée (fichier:ligne). Pour le comportement des bibliothèques, j'ai lu leur code dans `node_modules` (supabase-js / postgrest-js 2.108.2, expo 57.0.31, expo-secure-store 57.0.4, expo-notifications 57.0.23). Quelques chiffres viennent de petits scripts Node jetables lancés sur `dataset.json` (rien n'est écrit dans le dépôt).
- **[S] suspecté** : déduit du code mais non démontré sans téléphone, sans mesure ou sans accès à la production. Je ne les présente jamais comme des faits.
- **Gravité** : P0 = fuite de données ou application inutilisable pour tous ; P1 = fonction majeure fausse, chargement sans fin, perte de données probable ; P2 = défaut réel mais contournable ou limité ; P3 = hygiène, dette, amélioration.
- Périmètre lu intégralement : `src/lib/*.ts` (29 fichiers) et leurs 11 fichiers de tests, `src/constants/config.ts`, `app.config.js`, `app.json`, `eas.json`, `package.json`, `tsconfig.json`, `metro.config.js`, les migrations `006`, `007`, `008` (et le schéma des tables dans `002` et `tests/sql/baseline.sql`), ainsi que tous les endroits de `src/app` et `src/components` qui appellent Supabase, les magasins ou le stockage local.
- Aucun secret n'est reproduit ici. La seule clé trouvée dans le dépôt est la clé **publique** (rôle `anon`, vérifié en décodant sa charge) : 3 occurrences (`eas.json` ×2, `src/lib/supabase.ts`). Aucune clé `service_role`, aucune clé privée.

## 1. Verdict

| Gravité | Nombre | Constats |
|---|---|---|
| P0 | **0** | Aucune fuite ni écriture non autorisée trouvée côté client (voir §6.9). |
| P1 | **6** | CL-01 à CL-06 |
| P2 | **16** | CL-07 à CL-22 |
| P3 | **11** | CL-23 à CL-33 |

**Pourquoi « chargement continu » peut encore arriver malgré le délai de 10 s** (CL-01, CL-02, CL-03). Le correctif `fetchWithTimeout.ts` est bon sur le web, mais sur téléphone la combinaison *fetch d'Expo + relance automatique de supabase-js* le transforme en attentes bien plus longues. Chronologie déduite du code :

| Situation (téléphone) | Ce qu'on croit avoir (doc 04) | Ce que le code donne |
|---|---|---|
| Hors ligne, échec immédiat, lecture (GET : `select`) | échec rapide | **7 s** (relances à +1 s, +2 s, +4 s) |
| Réseau muet, lecture (GET) | 10 s | **47 s** (4 essais × 10 s + 1+2+4 s) |
| Réseau muet, écriture (`rpc`, `insert` = POST) | 10 s | 10 s (les POST ne sont pas relancés) |
| Réponse dont les en-têtes arrivent puis qui se fige | 10 s | **illimité** |
| Serveur qui répond 503/520 avec `Retry-After: N` | — | N s × 3, **hors délai** |
| Accueil : 4 requêtes l'une après l'autre avec squelette tant que tout n'est pas fini | — | de 7 s à plusieurs dizaines de secondes (CL-03) |

Je n'ai trouvé dans la couche données **aucune cause directe de « boutons inertes »** ; les seules pistes côté données sont les attentes non bornées ci-dessus et le travail synchrone au démarrage (CL-20, [S]). À mesurer sur l'ancien appareil.

## 2. Contrat application ↔ base (fonction, paramètres, types, champs lus)

Méthode : chaque appel `supabase.rpc/from/storage` de `src/` comparé à la définition SQL de `006`/`007` (noms de paramètres exacts, types, valeurs par défaut, colonnes). Un nom de paramètre différent donnerait PGRST202 (404) : **aucun décalage de ce type trouvé**.

| Appel (fichier:ligne) | Paramètres envoyés | Définition SQL | Champs lus | Verdict |
|---|---|---|---|---|
| `get_my_discoveries` — `discoveryStore.ts:85` | `p_device_id` | `006:431` `(p_device_id text default null)` | `place_id`, `points_awarded` | OK |
| `discover_place` — `discoveryStore.ts:116, 179` | `p_place_id`, `p_device_id`, `p_source` | `006:471` mêmes noms | `points_earned` (0 si déjà découverte) ; **`success:false` jamais lu** | Noms OK ; retour mal exploité (CL-09) |
| `get_my_card_usage` — `discountCardsStore.ts:163` | `p_device_id` | `006:451` | `discount_card_id`, `uses_count` | OK |
| `use_discount_card` — `discountCardsStore.ts:241` | `p_card_id` (uuid), `p_device_id` | `006:535` | `success`, `uses_count`, `remaining_uses`, `error` (`QUOTA_MAX_ATTEINT` géré) | OK |
| `from('discount_cards').select('*').eq('is_active', true)` — `discountCardsStore.ts:157` | — | politique `006:378`, colonnes `002:23-40` | toutes présentes | OK |
| `increment_spot_like` — `likesStore.ts:130` | `p_spot_id`, `p_delta` (±1), `p_device_id` | `006:668` | entier ignoré | OK |
| `from('spot_likes').select('spot_id, likes_count')` — `likesStore.ts:66` ; repli `addresses(id, likes_count)` `:80` | — | politique `006:663` ; colonne `setup_global_likes.sql:25` | OK | OK |
| `register_push_token` — `pushNotifications.ts:92` | 6 paramètres `p_*` | `007:129` | `success` | OK |
| `update_push_preferences` — `pushNotifications.ts:136` | 4 paramètres, aucun défaut | `007:174` | `success` (`NON_ENREGISTRE` non distingué, CL-24) | OK |
| `unregister_push_token` — `pushNotifications.ts:153` | `p_device_id` | `007:229` | `success` | OK |
| `get_push_preferences` | **jamais appelée** par l'appli | `007:206` | — | Les préférences locales font foi (voir CL-24) |
| `delete_my_data` — `dataDeletion.ts:30` (via `PrivacyPolicyModal.tsx:42`) | `p_device_id` | `007:683` (version finale) | `success` | OK |
| `verify_admin_access` — `AdminPasswordModal.tsx:48` | `access_code` | `006:90` | booléen | OK |
| `admin_write` — `adminApi.ts:65` | `p_code`, `p_table`, `p_op`, `p_id`, `p_record` | `006:139` | `ok`, `rows`, `error` | OK ; **colonnes inconnues ignorées sans erreur** (CL-06) |
| `admin_list_partner_events` / `admin_save_partner_event` / `admin_delete_partner_event` — `partnerEventsStore.ts:44, 57, 76` | `p_code`, `p_event`, `p_id` (uuid) | `006:220, 234, 325` | tableau ; ligne (ou vide si refus : `!data.id` géré) ; entier (`-1` = refus) | OK |
| `admin_send_push` / `admin_push_stats` — `pushAdmin.ts:25, 48` | `p_code`, `p_title`, `p_body` | `007:633, 657` | `ok`, `recipients`, `devices`, `ios`, `android`, `pending_messages`, `deliveries_7d` | OK |
| `place_suggestions.insert` — `discoveryStore.ts:252` | `device_id`, `title`, `address`, `category_name`, `comment` | droits `006:766`, politique `:767-774` | `error.message` brut renvoyé à l'écran | Noms OK ; longueurs non bornées côté client ; **fonction jamais appelée par l'interface** |
| `address_views.insert` — `AddressDetailModal.tsx:126` | `spot_id`, `source` | droits `006:742`, politique `:743-747` (`user_id` nul) | — | OK |
| `partner_events.select` — `partnerEventsStore.ts:30` | filtre `or(...)` | politique `004` (actives) | `*` | OK |
| `addresses`, `categories`, `sponsored_partners` `.select(...)` — `HomeView.tsx:650-661`, `MapView.tsx:363`, `SearchView.tsx:67`, `partnersStore.ts:75` | colonnes listées | lecture publique `006:109-120` | colonnes présentes dans `fix_admin_and_database_schema.sql`, `alter_supabase_schema.py`, `002` | OK |
| **`events.select('…, booking_url, max_places')` — `HomeView.tsx:686`** | `booking_url`, `max_places` | **aucune migration du dépôt ne crée ces colonnes** (`git grep` : 0 résultat dans `src/scripts`, `scripts`, `tests`) | — | **Écart probable (CL-06)** |
| `storage.from('etablissements').upload` — `AdminPortalModal.tsx:128-135` (appels `:498, :523`) | dossiers `covers`, `gallery` | politique `006:803-805` (mêmes dossiers) | URL publique | Noms OK ; non testé (CL-15) |
| Champ `a.category` lu par `searchIndex.ts:48, 75, 101, 126` | — | **n'existe pas** : 0 adresse sur 790 dans `dataset.json`, la table a `category_id` | — | **Champ lu inexistant (CL-04)** |

Gestion d'erreurs : supabase-js **ne rejette pas** sur erreur réseau (il renvoie `{ data:null, error }`) ; tous les appels de `src/lib` testent `error` et/ou sont dans un `try/catch`. Je n'ai trouvé aucune promesse flottante pouvant rejeter dans `src/lib` ; hors `lib`, seuls des `Linking.openURL` sans `catch` (CL-28).

---

## 3. Constats P1

### CL-01 [V] — Les expirations sont relancées jusqu'à 3 fois : 47 s au lieu de 10 s sur téléphone

- Preuves : `fetchWithTimeout.ts:9` (`controller.abort()` sans motif) ; `supabase.ts:53` ; sur mobile, Expo remplace le `fetch` global (`node_modules/expo/src/winter/runtime.native.ts:52`) et toute annulation est relevée en `FetchError` dont le nom reste « Error » (`.../fetch/FetchErrors.ts:1-12`, `.../fetch/fetch.ts:77-91`). postgrest-js ne renonce à relancer que si `name === "AbortError"` ou `code === "ABORT_ERR"` (`node_modules/@supabase/postgrest-js/dist/index.cjs:305`) ; sinon, pour GET/HEAD/OPTIONS, **3 relances** avec attentes 1, 2, 4 s (`:7, :15, :306-311`). Le `retry` ne peut pas être coupé globalement (`createClient` ne le transmet pas, `supabase-js/dist/index.mjs:680-686`), et `Retry-After` est obéi sans plafond (`index.cjs:318`).
- Sur le web, le navigateur lève un vrai `AbortError` : pas de relance, d'où « sur le web tout marche ».
- Effet : tout `select` (accueil, catégories, événements, partenaires, likes, agenda, recherche) peut rester jusqu'à 47 s en chargement, et 7 s même **hors ligne**.
- Non reproduit sur appareil. Test à ajouter : un `fetch` qui rejette `new Error('x')` doit produire une erreur de nom `AbortError`.
- Correction minimale (avec CL-02, `src/lib/fetchWithTimeout.ts`) :

```ts
export function withTimeout(fetchImpl: typeof fetch, ms: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, ms);
    const upstream = init?.signal;
    if (upstream) {
      if (upstream.aborted) controller.abort();
      else upstream.addEventListener('abort', () => controller.abort(), { once: true });
    }
    try {
      const res = await fetchImpl(input, { ...init, signal: controller.signal });
      // CL-02 : le corps est lu DANS le délai, puis rendu tel quel
      const body = [101, 204, 205, 304].includes(res.status) ? null : await res.arrayBuffer();
      return new Response(body, { status: res.status, statusText: res.statusText, headers: res.headers });
    } catch (e) {
      // CL-01 : un nom « AbortError » empêche postgrest-js de relancer 3 fois
      const err = new Error(timedOut ? 'Délai dépassé' : String((e as Error)?.message ?? e));
      err.name = 'AbortError';
      throw err;
    } finally {
      clearTimeout(timer);
    }
  };
}
```

À valider sur Android et iOS (construction de `Response` avec un `ArrayBuffer`, statuts sans corps). Si l'on veut garder une relance, la faire soi-même, une seule fois, dans le magasin concerné.

### CL-02 [V] — Le délai ne couvre que l'arrivée des en-têtes

- Preuves : `fetchWithTimeout.ts:15` efface le minuteur dès que `fetch` se résout. Avec le `fetch` d'Expo (flux), `start()` se résout à la réception de la réponse, le corps arrive ensuite (`node_modules/expo/src/winter/fetch/NativeRequest.ts:5-11`). Une réponse qui démarre puis se fige (réseau instable, gros `select('*')` d'environ 1,7 Mo comme `SearchView.tsx:67`) n'est plus bornée : `await res.text()` dans postgrest-js attend sans fin.
- Le test `fetchWithTimeout.test.ts` ne couvre que « aucune réponse » : cette phase n'est pas testée.
- Correction : voir le code de CL-01 (lecture du corps avant `clearTimeout`). Test : un faux `fetch` qui renvoie une réponse dont `arrayBuffer()` ne se termine jamais doit échouer après le délai.

### CL-03 [V] — L'accueil affiche un squelette tant que 4 requêtes séquentielles ne sont pas finies, alors que les 790 adresses sont déjà dans l'appli

- Preuves : `HomeView.tsx:525-530` (états initiaux vides, `loading` vrai) ; `:618-725` (catégories, puis adresses, puis événements, puis partenaires, **chacun attendu avant le suivant**, `setLoading(false)` seulement à `:715` ou dans le `catch` `:723`) ; `:633` puis `:638` : après un « cache trouvé », `setLoading(true)` est rappelé aussitôt, donc le cache mémoire n'évite jamais le squelette (et il est vide à chaque démarrage à froid). Le repli sur `dataset.json` n'arrive qu'**après** l'échec de la première requête (`:654`, `:716-724`), donc après 7 s à 47 s (CL-01).
- À l'inverse `MapView.tsx:218` (`useState(PT_SPOTS)`) et `SearchView.tsx:50` démarrent déjà avec le jeu embarqué : seule la page d'accueil est bloquée.
- Correction minimale (`HomeView.tsx`) :

```tsx
const [categories, setCategories] = useState<Category[]>(dataset.categories as any);
const [addresses, setAddresses] = useState<Address[]>(dataset.addresses as any);
const [loading, setLoading] = useState(false);      // le contenu embarqué s'affiche tout de suite
// dans loadSupabaseData : lancer catégories + adresses + événements ENSEMBLE (Promise.all)
// et ne plus attendre les partenaires :
syncPartnersWithSupabase().then((p) => p.length && setSponsoredPartners(p)).catch(() => {});
```

### CL-04 [V] — Les 9 puces de filtre de la recherche ne renvoient jamais rien

- Preuves : `searchIndex.ts:48, 75, 101, 126` lisent `a.category`, champ qui n'existe ni dans `dataset.json` (0/790) ni dans la table (`category_id`). `normalizedCategory` vaut donc toujours `''`. `search()` écarte tout ce dont `normalizedCategory` ne contient pas le filtre (`:153-155, :165-169`). `SearchView.tsx:23-33` envoie « Restaurants », « Bars », « Brunch »… comme filtre (`:102`).
- Reproduit sur le jeu de données : 0 résultat pour chacune des 9 puces.
- Correction minimale : comparer aux **tags**, qui contiennent bien ces libellés (« Restaurants », « Terrasse ☀️ », « Culture & Loisirs »…).

```ts
// searchIndex.ts : ajouter normalizedTags à IndexedSpot et aux deux map(...)
normalizedTags: normalizedTags,
// :154  .filter((s) => s.normalizedTags.includes(normCat))
// :169  if (normCat && !spot.normalizedTags.includes(normCat)) continue;
```

Résultat mesuré sur le jeu embarqué : Restaurants 286, Bars 221, Brunch 154, Shopping 534, Beauté 375, Culture 661, Sport 10, Terrasse 118, Bio 413. « Culture », « Shopping » et « Bio » sont larges : décision produit. Ajouter un test qui impose au moins 1 résultat par puce.

### CL-05 [V code, S occurrence] — Identité instable quand le stockage sécurisé échoue : chaque like peut compter comme un nouvel appareil

- Preuves : `deviceIdentity.ts:45-48` renvoie un **nouvel UUID à chaque appel** si `SecureStore` lève une erreur (rien n'est mémorisé) ; `likesStore.ts:129` appelle `getOrCreateDeviceId()` à **chaque** like, au lieu de `authService.getUserId()` utilisé partout ailleurs ; `authService.ts:68-71` fait de même au démarrage et écrase `LPT_AUTHENTICATED_USER_ID_V1` avec cet identifiant jetable. Conséquences : gonflement des compteurs de likes (la base croit à un appareil de plus à chaque fois, `006:668-711`), progression qui « disparaît » à chaque lancement.
- Occurrence [S] : erreurs Keystore/Keychain constatées sur certains Android, c'est précisément le profil « ancien APK ». Course de première exécution aussi possible : deux appels simultanés de `getOrCreateDeviceId` avant la première écriture produisent deux identifiants différents.
- Correction minimale :

```ts
// deviceIdentity.ts — une seule résolution par processus, même en cas d'échec
let pending: Promise<string> | null = null;
export const getOrCreateDeviceId = (): Promise<string> => (pending ??= resolveDeviceId());
// resolveDeviceId = corps actuel (le catch renvoie l'UUID généré, désormais mémorisé par `pending`)

// likesStore.ts:129
const deviceId = await authService.getUserId();
```

### CL-06 [S, à vérifier en production] — `events.booking_url` et `events.max_places` : colonnes demandées mais créées par aucune migration

- Preuves : `HomeView.tsx:686` les sélectionne ; `AdminPortalModal.tsx:714-715` les écrit ; aucune des migrations/scripts/tests du dépôt ne les définit (`git grep` : 0). Si elles manquent en production : (1) la requête d'accueil échoue en 400 et `eventsError` est ignoré, donc **la liste d'événements est silencieusement vide** (`HomeView.tsx:689-695`), même quand la table contient des lignes ; (2) l'admin croit enregistrer un lien de réservation et un nombre de places, mais `admin_write` **ignore sans erreur** les colonnes inconnues (`006:172-183`), tout en renvoyant `ok:true`.
- Vérification immédiate (lecture seule, clé publique) : `GET /rest/v1/events?select=booking_url,max_places&limit=1` doit répondre 200 (400 = colonne absente).
- Correction minimale (nouvelle migration `009`, et sonde dans `scripts/audit-prod-check.sh`) :

```sql
alter table public.events
  add column if not exists booking_url text,
  add column if not exists max_places integer;
notify pgrst, 'reload schema';
```

---

## 4. Constats P2

### CL-07 [V] — Une panne isolée de la requête « événements » efface les événements affichés et met la liste vide en cache

`HomeView.tsx:682-698` : `finalEvents` démarre à `[]` et `setEvents(finalEvents)` est appelé même si `eventsError` est renseigné ; `:713` met ce vide en cache 10 min. Correction : `if (eventsError) { /* garder l'état et le cache */ } else { setEvents(...); appCache.set('events', ...) }`.

### CL-08 [V] — Hors ligne, l'utilisateur voit « Veuillez configurer votre fichier `.env` »

`HomeView.tsx:722` (`setIsConfigured(false)` dans le `catch` réseau) et `:1081-1087` (bannière de développeur). Comme `supabase.ts:10-19` contient des valeurs de repli, `isSupabaseConfigured` est toujours vrai : la bannière n'apparaît donc que par ce chemin d'erreur réseau. Correction : retirer la bannière (ou la réserver à `__DEV__`) et afficher un message de connexion.

### CL-09 [V] — Découvertes : réponses `success:false` ignorées, file hors ligne rejouée seulement au lancement, file écrasable

- `discoveryStore.ts:185-195` : seul `res.error` met en file ; une réponse `{success:false, error:'ADRESSE_INTROUVABLE' | 'IDENTITE_INVALIDE'}` (`006:490-503`) laisse la découverte **affichée mais jamais enregistrée**, sans retour arrière. `:121-123` : au rejeu, seule `error` conserve l'élément ; un `success:false` est jugé réussi et **supprimé de la file**.
- `:76-82` : la file n'est rejouée que dans `syncWithSupabase()`, appelée au lancement (`:41`) : une découverte faite hors ligne n'est envoyée qu'au prochain démarrage de l'appli.
- `:112-129` et `:135-145` : lecture-puis-écriture de la file sans verrou ; `:129` réécrit la file entière, donc un élément ajouté pendant le rejeu **est perdu**. Deux découvertes rapprochées hors ligne peuvent aussi s'écraser.
- Correction minimale :

```ts
// après l'appel (discoveryStore.ts:185)
if (res.error) await this.pushToPendingQueue(pId, points);
else if (res.data?.success === false && res.data.error === 'ADRESSE_INTROUVABLE') {
  this.discoveredIds.delete(pId); this.pointsMap.delete(pId); await this.saveLocalCache(); this.notify();
}
// verrou simple pour les accès à la file
private queueLock: Promise<unknown> = Promise.resolve();
private withQueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = this.queueLock.then(fn); this.queueLock = run.catch(() => {}); return run;
}
// et rappeler syncWithSupabase() quand l'appli repasse au premier plan (AppState 'active')
```

### CL-10 [V] — Likes : perte silencieuse hors ligne, liste écrasée entre vues, compteurs faux hors ligne

- `likesStore.ts:127-139` : envoi une seule fois, sans file ni retour arrière ; un échec laisse le cœur plein localement et rien côté base. Aucune fonction serveur ne rend à l'appareil sa liste de likes : après réinstallation ou changement d'appareil les cœurs sont perdus et un nouveau clic ajoute +1 localement (`:109`) alors que la base ne bouge pas (idempotent).
- `likesStore.ts:62-95` : hors ligne `fetchGlobalLikesMap()` renvoie `{}` ; `:108-109` calcule alors `0 + 1`, et l'événement `pt_likes_updated` (`:124`) affiche « 1 » pour une adresse qui en a des dizaines.
- Course entre vues : `HomeView.tsx:773-780` n'applique que le compteur (pas la liste) quand la carte envoie un like ; `HomeView.tsx:812-821` bascule à partir de `favorites` périmé ; `likesStore.ts:121` réécrit le tableau **complet** → un like fait sur la carte peut être effacé du stockage local par un like fait ensuite sur l'accueil (`MapView.tsx:204-211` gère bien l'événement dans l'autre sens).
- Correction minimale : `HomeView` doit mettre à jour `favorites` dans `onLikesUpdated` comme `MapView.tsx:204-211` ; relire `loadDeviceLikedSpotIds()` dans `toggleSpotLike` avant d'écrire ; ne pas écraser le compteur quand `fetchGlobalLikesMap` échoue (renvoyer `null` plutôt que `{}`).

### CL-11 [V] — « Effacer mes données » laisse l'identifiant d'appareil et des états à l'écran

- `PrivacyPolicyModal.tsx:43-49` et `authService.ts:102-109` ne suppriment ni `LPT_SECURE_DEVICE_ID` (`deviceIdentity.ts:4`) ni `LPT_AUTHENTICATED_USER_ID_V1` (`authService.ts:6`), et `cachedUserId` n'est pas réinitialisé : l'appareil garde le même identifiant pseudonyme, alors que `dataDeletion.ts:52` annonce « effacées de cet appareil ». Cet identifiant est une donnée personnelle selon la politique (`PrivacyPolicyModal.tsx:114`).
- `likesStore.ts:38-40` écrit `'[]'` mais l'état déjà chargé de `HomeView.tsx:408, 729` et `MapView.tsx:185, 190` n'est pas rafraîchi : les cœurs restent affichés et le prochain like **réécrit** l'ancienne liste.
- `dataDeletion.ts:49` conseille « désinstallez puis réinstallez » : sur iOS, les éléments du Trousseau (Keychain) survivent en principe à la désinstallation [S, comportement iOS connu, à tester sur iPhone] ; sur Android, `allowBackup:false` (`app.json:22`) fait repartir de zéro.
- Correction minimale : après l'effacement serveur réussi, supprimer les deux clés, vider `cachedUserId`/`initPromise` (un nouvel identifiant sera créé à la prochaine action), et émettre un événement `pt_local_data_cleared` que `HomeView` et `MapView` écoutent pour vider leurs états.

```ts
// authService.ts
public async resetIdentityAfterDeletion(): Promise<void> {
  await appStorage.removeItem(AUTH_USER_ID_KEY);
  await SecureStore.deleteItemAsync('LPT_SECURE_DEVICE_ID').catch(() => {});
  this.cachedUserId = null; this.initPromise = null;
}
```

### CL-12 [V code, S limites] — Lecture du stockage en échec = « vide », puis réécriture ; volumes dans le stockage sécurisé

- `storage.ts:12-25`, `likesStore.ts:19-23, 43-52`, `discoveryStore.ts:137-143` : une lecture qui échoue renvoie « vide », et l'écriture suivante remplace l'ancien contenu (likes perdus pour toujours ; file hors ligne perdue ; découvertes récupérables seulement en ligne). `storage.ts:36-39` avale les erreurs d'écriture (simple `console.warn`) : une écriture refusée n'est jamais signalée.
- Volumes écrits en entier à chaque action (mesure sur le jeu embarqué) : découvertes ≈ 46 Ko, likes ≈ 31 Ko, cartes ≈ 3 Ko — dans Keychain/Keystore, pensé pour de petits secrets. [S] La version installée ne documente aucune limite ; d'anciennes versions avertissaient au-delà de 2 048 octets sur iOS : à vérifier sur appareil.
- Correction minimale : ne garder dans SecureStore que l'identifiant ; mettre le reste dans un stockage fichier/clé-valeur non chiffré ; au minimum, distinguer « absent » de « illisible » et ne pas réécrire quand la lecture a échoué.

### CL-13 [V] — Cartes de réduction : code exécuté au démarrage sans aucun écran, compteurs écrasables, action non idempotente

- `DiscountCard.tsx` n'est importé nulle part (`git grep`) ; `discountCardsStore` n'est importé que par `PrivacyPolicyModal.tsx:21` (pour `resetLocal`) et l'écran Cartes n'affiche que la carte de progression (`CardsView.tsx:51`). Le singleton `discountCardsStore.ts:304` s'instancie pourtant au lancement et lance 2 requêtes + 1 écriture de stockage (`:125-130`).
- `:167-176, 178-201` : si `get_my_card_usage` échoue mais que la lecture des cartes a réussi (ou hors ligne), `usageMap` est vide : **les compteurs locaux sont remplacés par 0** et sauvegardés. Hors ligne, `DEFAULT_DISCOUNT_CARDS` (5 offres inventées, `:24-110`) remplacent les offres réelles ; `useCard` sur ces identifiants renverrait `CARTE_INTROUVABLE_OU_EXPIREE` (`006:561`). Même règle que pour les partenaires (`noMockData.test.ts`) : une offre affichée doit être réelle.
- `:117` : `cards = DEFAULT_DISCOUNT_CARDS` puis `useCard` modifie ces objets **en place** (`:226-227`) : mutation d'une constante partagée, et `notify()` repasse la même référence de tableau (pas de nouveau rendu React).
- Idempotence : aucune clé de requête ; si le serveur enregistre l'usage mais que la réponse est perdue (délai de 10 s), le client annule (`:269-271`) et l'utilisateur réessaie : **deux usages consommés**. Le garde `isUsing` de `DiscountCard.tsx:72` n'est que local.
- Correction minimale : retirer l'import de `PrivacyPolicyModal.tsx` (ou initialiser le magasin à la première utilisation) ; `if (userCardsError) return;` avant `:178` ; retirer le repli sur les cartes factices ; décider d'une clé d'idempotence (`p_request_id uuid`) avant de réactiver l'écran.

### CL-14 [V] — Une écriture « annulée par le délai » a pu réussir côté serveur

Seuls les GET sont relancés par la bibliothèque (donc pas de doublon automatique) ; mais `fetchWithTimeout.ts` abandonne aussi des POST déjà traités : `admin_send_push` (`pushAdmin.ts:25`) affiche « Connexion impossible » et l'admin renvoie l'annonce à tous (`007:650-651` : une ligne par envoi) ; `use_discount_card` (CL-13) ; `place_suggestions.insert` (`discoveryStore.ts:252`). Correction : paramètre facultatif `p_client_ref uuid` pour les annonces, utilisé comme `ref_id` (`unique (kind, ref_id)`, `007:85`), généré une fois par saisie.

### CL-15 [V] — Le délai de 10 s s'applique aussi aux téléversements de photos

`supabase.ts:53` s'applique à tout (Storage compris, `supabase-js/dist/index.mjs:687`) ; `AdminPortalModal.tsx:117-140` envoie jusqu'à 5 Mo (limite posée par `006:791`) : sur un réseau montant lent, l'envoi est coupé à 10 s. De plus `upsert: true` (`:128, :135`) n'est pas nécessaire (nom aléatoire) ; [S] il peut exiger des droits SELECT/UPDATE sur `storage.objects` que `006:803-805` n'accorde pas. Correction : `const ms = String(input).includes('/storage/v1/') ? 60_000 : 10_000` dans `supabase.ts` ; retirer `upsert`. Le chemin de téléversement n'est testé nulle part (PGlite n'a pas de schéma `storage`, `006:786`).

### CL-16 [V] — Itinéraire Mapbox natif sans délai

`MapView.tsx:919` utilise le `fetch` global sans `AbortController` : sur réseau muet, `setRouteLoading(false)` (`:953`) n'est jamais atteint. Correction : `AbortController` + `setTimeout(() => ac.abort(), 10_000)` autour de l'appel (le `catch` bascule déjà sur l'application de cartes `:951`).

### CL-17 [V] — Une erreur de chargement des polices laisse l'écran vide

`_layout.tsx:40` ignore le second élément de `useFonts` (l'erreur) et `:85-89` ne rend `Stack` que si `fontsLoaded`. Probabilité faible (polices embarquées), conséquence totale. Correction : `const [fontsLoaded, fontError] = useFonts(...)` puis `(fontsLoaded || fontError)`.

### CL-18 [V code, S effet] — Identifiant généré avec `Math.random()` sur téléphone, alors que la base le traite comme un secret

`deviceIdentity.ts:7-14` : `crypto.randomUUID` n'est pas fourni par React Native/Expo dans cette version (aucun polyfill dans `node_modules/expo/src/winter` ni `react-native/Libraries`, et `expo-crypto` n'est pas installé) ; le repli `Math.random()` n'est pas cryptographique. `006:391-392` précise pourtant que l'UUID « fait office de secret » pour lire et effacer les données. Risque réel faible (il faudrait observer des sorties), mais le principe est faux. Correction : `npx expo install expo-crypto` puis `Crypto.randomUUID()` (nouveau module natif : nouveau build).

### CL-19 [V] — Partenaires sponsorisés : aucune vérification de période, aucune persistance native

`partnersStore.ts:75-79` ne filtre que `is_active` ; `starts_at`/`ends_at` existent (`fix_admin_and_database_schema.sql:117-119`) mais aucun code ni aucune tâche planifiée ne désactive un partenaire expiré (seul `manage_partnerships.py` le fait, à la main). `HomeView.tsx:1660` affiche donc « OFFICIEL » jusqu'à ce qu'on lance ce script. `:36` : `window.localStorage` n'existe pas sur téléphone, donc aucune persistance native. `HomeView.tsx:703` ignore une réponse vide, ce qui laisse à l'écran la liste périmée. Correction : `.lte('starts_at', nowIso).gte('ends_at', nowIso)` côté requête ; appliquer aussi une réponse vide.

### CL-20 [S] — Travail synchrone dupliqué au démarrage (risque de gel sur ancien téléphone)

À l'import : `searchIndex.ts:37-39` indexe 790 adresses (texte complet), puis `dataStore.ts:58-63` **réindexe** les mêmes données (`dataStore` est importé via `AdminPortalModal` → `HomeView`) ; `placesRepository.ts:62-64, 144-163` formate et classe 790 adresses ; `MapView.tsx:82-95` en refait une copie ; `dataset.json` (1,99 Mo) est analysé une fois. Non mesuré. Correction : ajouter des `performance.now()` autour de ces constructeurs sur l'ancien appareil ; supprimer la réindexation de `dataStore.ts:58-63` et rendre `searchIndex.init()` paresseux.

### CL-21 [V code, S effet] — Configuration EAS : profils `preview`/`development` sans garde-fou

- `app.config.js:14-25` ne vérifie que `EAS_BUILD_PROFILE === 'production'`. `eas.json:11-23` (preview) ne déclare ni Google Maps, ni Mapbox, ni `GOOGLE_SERVICES_JSON` : si ces variables ne sont pas aussi définies dans l'environnement EAS « preview » (non vérifiable depuis le dépôt), l'APK de test reçoit la clé factice (`app.config.js:43`, carte vide), pas de jeton Mapbox (itinéraires en repli, `MapView.tsx:920`) et pas de notifications Android (`getExpoPushTokenAsync` échoue → `token_error`). Correction : afficher un avertissement visible pendant la construction preview (ou refuser) plutôt que de construire en silence.
- `app.config.js:28-32` : `mode: 'development'` pour tout profil non production, y compris `preview` (ad hoc iOS, `eas.json:16-18`). [S] Les builds ad hoc/TestFlight/App Store utilisent l'environnement APNs de production : un build `preview` avec `mode: 'development'` risque d'échouer à la signature ou de ne recevoir aucune notification. À tester avant la soumission iOS ; correction probable : `mode = EAS_BUILD_PROFILE === 'development' ? 'development' : 'production'`.
- `app.json:93` : `"owner": "ryadhhshshhs"` — à confirmer (compte personnel ou compte de l'association) avant la publication.
- Cohérents et vérifiés : identifiants `fr.lepetittou.app` (iOS, Android), schéma `lepetittou`, `allowBackup:false`, permissions Android limitées à la position (`app.json:29-40`) avec `RECORD_AUDIO`, `CAMERA`, stockage et `SYSTEM_ALERT_WINDOW` bloquées, `POST_NOTIFICATIONS` apportée par `expo-notifications`, images des icônes présentes, `.gitignore` couvre `.env` et `google-services.json`.

### CL-22 [V] — Le contrat appli ↔ base n'est testé nulle part avec les vrais noms d'arguments

Les tests SQL appellent les fonctions **par position** (`select public.discover_place($1, $2, 'manual_checkin')`, `security-lockdown.test.mjs:188-197` et suivants) ; PostgREST les appelle **par nom**. Un renommage d'un `p_*` côté SQL ou côté appli (404 PGRST202 en production) passerait donc 76/76. La sonde de production `scripts/audit-prod-check.sh` n'exerce que 6 fonctions, dont 4 (`get_my_discoveries`, `get_my_card_usage`, `delete_my_data`, `get_push_preferences`) appelées avec un corps vide `{}` : les noms de paramètres n'y sont pas vérifiés. Correction : un test qui lit les `rpc('…', {…})` de `src/` et appelle chaque fonction en notation nommée, par exemple :

```sql
select public.discover_place(p_device_id => $1, p_place_id => $2, p_source => 'manual_checkin');
select public.increment_spot_like(p_spot_id => $1, p_delta => 1, p_device_id => $2);
```

et étendre la sonde de production aux 16 fonctions appelées par l'appli (matrice §2), avec leurs vrais noms d'arguments (réponse attendue ≠ 404).

---

## 5. Constats P3

| Id | Statut | Constat (fichier:ligne) | Correction minimale |
|---|---|---|---|
| CL-23 | [V] | `authService` : la connexion Supabase n'est pas utilisée (`authService.ts:12`) mais `autoRefreshToken: true` et `persistSession: true` font tourner un cycle toutes les 30 s (`supabase.ts:54-59`) ; `:35-38` rend l'identifiant enregistré avant que `init` ait fini (il peut différer de l'identifiant final) ; `getSession()` (`:41`) n'a pas de garde de temps ; `supabase.ts:39, 48` appellent `SecureStore.*Async` sans attendre ni attraper (rejet non géré). | `autoRefreshToken:false`, `persistSession:false` tant qu'il n'y a pas de comptes ; ajouter `await`/`.catch` dans l'adaptateur ; borner `getSession()` par `Promise.race`. |
| CL-24 | [V] | Notifications : (a) `update_push_preferences` renvoie `NON_ENREGISTRE` si la ligne a été purgée/invalidée (`007:199-200`), le client affiche « erreur serveur » au lieu de se réinscrire (`pushNotifications.ts:142`) ; (b) permission retirée dans les réglages : `resyncPushRegistration` s'arrête (`:166`) sans appeler `unregister_push_token` ; (c) API dépréciée `getLastNotificationResponseAsync` et réponse jamais effacée (`:200`, `clearLastNotificationResponse` existe) ; (d) pas d'icône de notification Android (`app.json:77-82`). | (a) relancer `registerWithServer` sur `NON_ENREGISTRE` ; (b) désinscrire si `permission !== 'granted'` ; (c) `getLastNotificationResponse()` puis `clearLastNotificationResponse()`. |
| CL-25 | [V] | Fuite d'abonnement : `MapView.tsx:194-196` crée `unsubDiscovery` mais l'effet ne renvoie que l'autre désabonnement (`:214`). L'écouteur reste après un remontage (`ErrorBoundary` « Réessayer »). | `return () => { unsubDiscovery(); offLikes(); }`. |
| CL-26 | [V] | Code mort : événement `eventsChanged` sans écouteur (`AdminPortalModal.tsx:743`) ; `dataStore.fetchAndSyncAll` (`dataStore.ts:111`), `placesRepository.getMapSpots/getSpotDetail` (`:176, :227`), `discoveryStore.suggestNewPlace` (`:246`), `authService.getUserIdSync/subscribe/getSession` jamais appelés. | Supprimer ou marquer. |
| CL-27 | [V] | Code modèle Expo jamais importé : `external-link.tsx`, `hint-row.tsx`, `web-badge.tsx`, `animated-icon*.tsx`, `themed-*.tsx`, `src/hooks/use-theme.ts`, `use-color-scheme*.ts`. Dépendances sans aucun import dans `src/` : `@expo/ui`, `@expo/vector-icons`, `expo-glass-effect`, `expo-linear-gradient`, `expo-symbols` (modules natifs embarqués pour rien). À conserver : `react-native-svg` (pair de lucide), `react-native-screens`/`expo-linking`/`react-native-gesture-handler` (pairs d'expo-router), `react-dom`/`react-native-web` (web), `expo-font`, `expo-system-ui` (configuration). Bornes basses de `package.json` en retard sur le SDK : `expo-constants ~57.0.3` (attendu `~57.0.22`), `expo-asset ~57.0.18`, `expo-font ~57.0.0`. | `npx expo install --fix`, retirer les 5 dépendances, supprimer les fichiers modèles. |
| CL-28 | [V] | `Linking.openURL` sans `catch` : `AddressDetailModal.tsx:373` (numéro construit à la main au lieu de `safeTelUrl`), `MapView.tsx:982-1016`. URL de réservation par défaut tierce codée en dur : `HomeView.tsx:320`, `AdminPortalModal.tsx:714`. | `safeTelUrl` + `.catch(() => {})` ; décider si une URL par défaut est acceptable. |
| CL-29 | [V] | Trois `select('*')` complets de `addresses` (≈ 1,7 Mo chacun) : `SearchView.tsx:67`, `MapView.tsx:363` (colonnes étendues), `AdminPortalModal.tsx:285`, en plus de l'accueil `HomeView.tsx:657`. | Réutiliser `appCache`, une seule source. |
| CL-30 | [V] | Chiffres et valeurs par défaut : `TOTAL_PLACES_COUNT` figé sur le jeu embarqué (`discoveryStore.ts:6`) alors que l'admin peut ajouter des adresses ; points calculés côté client (`discoveryStore.ts:168`, `placesRepository.ts:136`) différents du barème serveur quand `points_reward` > 0 (`006:505-513` ; `002:15` pose 35) : la valeur est corrigée seulement quand `points_earned` est lu ; adresses sans coordonnées placées au centre-ville (`placesRepository.ts:91-94`) ; `AppleWalletCard.tsx:63-67` affiche 8 caractères de l'identifiant (qui sert de secret). | Compter depuis la base ; afficher un code dérivé (haché) plutôt que l'identifiant. |
| CL-31 | [V] | `npm run lint` : `eslint` absent des dépendances ; `tsconfig.json:21-24` exclut `src/lib/__tests__` du typage ; `react-native-url-polyfill` (`supabase.ts:1`) doublonne le `URL` d'Expo (`winter/url.ts`). | Ajouter eslint ou retirer le script ; typer les tests ; retirer le polyfill après test. |
| CL-32 | [S] | Si Reanimated ne rappelle jamais `onFinish` (`IntroScreen.tsx:31-33`), l'écran d'ouverture (`zIndex 9999`) reste affiché à chaque lancement : `INTRO_SEEN_KEY` n'est écrit qu'à la fin (`_layout.tsx:36-39`). Il a `pointerEvents="none"` mais recouvre tout. | Filet JS (minuterie). **Note** : au moment de cette revue, `git status` montre `IntroScreen.tsx` modifié par un autre intervenant avec exactement ce filet (minuterie de 2,2 s) ; CL-32 devient sans objet une fois cette modification validée. Les numéros de ligne ci-contre sont ceux de la version commitée. |
| CL-33 | [S, juridique] | Droits d'accès et de portabilité annoncés (`PrivacyPolicyModal.tsx:195`) sans outil dans l'appli (seul l'effacement existe) ; une réinstallation Android rend les données serveur orphelines et non effaçables par l'utilisateur (purge à 24 mois, `007:768-775`). | À faire valider par le volet juridique (03). |

---

## 6. Réponses aux axes demandés

### 6.1 Mode hors ligne : cache, file, écrasement

| Donnée | Hors ligne | Écrasée par du vide ? |
|---|---|---|
| Adresses, catégories (accueil) | squelette 7 à 47 s puis jeu embarqué (CL-01, CL-03) ; aucun cache persistant | non (repli sur le jeu embarqué) |
| Carte, recherche | jeu embarqué immédiat (`MapView.tsx:218`, `SearchView.tsx:50`) | non |
| Événements | liste vide | **oui** (CL-07) |
| Partenaires | mémoire seulement sur téléphone (`partnersStore.ts:36`) ; vide après redémarrage | non (`:88` rend l'ancien) |
| Compteurs de likes | `{}` | **oui** (CL-10) |
| Likes de l'appareil | local | perte possible (CL-10, CL-12) |
| Découvertes | local, file d'attente, additif (`discoveryStore.ts:87-95` n'enlève jamais) | non ; file écrasable (CL-09) |
| Cartes de réduction | cartes factices + 0 usage | **oui** (CL-13) |
| Agenda | message d'erreur, liste précédente conservée (`AgendaView.tsx:79-83`) | non |
| Notifications | indicateur local ; réinscription au démarrage (`pushNotifications.ts:163`) | non |

Cache SWR (`dataCache.ts`) : mémoire seulement, TTL 10 min, invalidation par préfixe. Correct en soi ; inefficace pour l'accueil à cause de `HomeView.tsx:638` (CL-03). `MapView.tsx:354` lit la clé `addresses` remplie par l'accueil (forme fusionnée) ou par lui-même (forme brute) : les deux passent par `formatRawAddress`, pas de conflit.

### 6.2 Conditions de course

- `authService` : `initPromise` unique (`:29-31`), un seul abonnement `onAuthStateChange` (`:81`). Les appelants simultanés attendent la même promesse ; seul le raccourci `savedId` (`:35-38`) peut donner un identifiant différent de l'identifiant final (CL-23).
- Génération de l'identifiant : deux appels simultanés de `getOrCreateDeviceId` avant la première écriture donnent deux identifiants (CL-05).
- Magasins : `discoveryStore` et `discountCardsStore` démarrent à l'import et se synchronisent immédiatement ; file de découvertes (CL-09) ; `HomeView.loadSupabaseData` sans jeton de requête (deux appels chevauchés peuvent écrire dans le désordre, P3) ; `likesStore` (CL-10).
- Envois de likes non ordonnés : chaque appel est une IIFE indépendante (`likesStore.ts:127`) ; un like suivi vite d'un unlike peut arriver dans l'ordre inverse. Le serveur étant idempotent par appareil, l'effet reste borné.

### 6.3 Idempotence (double appui, réessai réseau)

| Action | Garde local | Garde serveur | Verdict |
|---|---|---|---|
| Like / unlike | aucun (état périmé possible) | clé `(spot, appareil)`, delta ±1 (`006:668-711`) | Sûr côté serveur ; compteur local faux (CL-10) |
| Découverte | ensemble local (`discoveryStore.ts:156-162`) | index unique + `on conflict do nothing` (`006:386, 518`) | Idempotente ; file fragile (CL-09) |
| Utilisation de carte | `isUsing` + confirmation (`DiscountCard.tsx:72`) | quota atomique (`006:568-573`) | **Pas idempotente** sur réessai (CL-13) ; écran non branché |
| Suggestion d'adresse | aucun | aucun | Doublon possible ; inutilisée |
| Annonce admin | état `sending` + confirmation (`PushAdminPanel.tsx:45, 65-75`) | une ligne par envoi | Doublon après délai (CL-14) |
| Inscription / préférences push | `busy` (`NotificationSettingsModal.tsx:59, 71`) | `upsert` / `update` | Idempotent |
| Effacement | `isDeleting` (`PrivacyPolicyModal.tsx:35, 203`) | suppression répétable | Idempotent ; local après serveur seulement (bon ordre) |
| Code admin (saisie) | rien contre un double envoi (`AdminPasswordModal.tsx:112` et bouton) | 10 échecs / 15 min global (`006:66-69`) | Un double envoi d'un mauvais code consomme 2 essais (P3) |

### 6.4 Stockage local

Voir CL-12. Clés vérifiées valides pour SecureStore (caractères autorisés) : `LPT_*`, `pt_intro_seen_v1`, clé de session Supabase. `pt_sponsored_partners_v1` n'est écrite que sur le web. `LPT_PENDING_DISCOVERIES_QUEUE_V2` n'a pas de borne mais ne peut dépasser 790 éléments.

### 6.5 Identité (changement d'appareil, réinstallation)

- Android : `allowBackup:false` (`app.json:22`) → réinstallation = nouvel identifiant, progression et likes perdus côté appareil (données serveur orphelines, purgées à 24 mois) ; l'utilisateur ne peut plus les effacer (CL-33).
- iOS : [S] le Trousseau peut conserver l'identifiant après désinstallation et le restituer avec une sauvegarde chiffrée sur un nouvel iPhone (`AFTER_FIRST_UNLOCK` sans « THIS_DEVICE_ONLY », `deviceIdentity.ts:40`) : continuité utile, mais deux appareils restaurés depuis la même sauvegarde partagent l'identité.
- Les quotas par appareil (cartes) sont contournables en changeant d'identifiant : `_lpt_identity` accepte tout texte hexadécimal de 32 à 40 caractères (`006:406`). Limite déjà reconnue dans `04-SUIVI` ; à garder en tête avant de réactiver les cartes.

### 6.6 RGPD côté client

Voir CL-11, CL-12, CL-18, CL-33. Points conformes : l'effacement serveur précède le nettoyage local (`dataDeletion.ts:29-45`) et le résultat `success` est vérifié (`:31`) ; message honnête si le nettoyage local échoue (`:46-50`) ; `address_views` n'envoie aucun identifiant (`AddressDetailModal.tsx:126-128`, `user_id` nul imposé `006:746`) ; jetons push supprimés avec `delete_my_data` (`007:718-719`).

### 6.7 Jetons de notification

Séquence correcte : permission → canal Android créé avant la demande (`index.tsx:33`, `pushNotifications.ts:43-48`) → jeton → validation du format (`pushLogic.ts:20`) → enregistrement serveur → seulement ensuite drapeau local (`pushNotifications.ts:123-125`). Jeton rafraîchi à chaque démarrage (`:163-174`) ; `register_push_token` remet `invalid_at` à nul (`007:168`) ; la purge à 270 jours ne touche donc que les appareils sans lancement. Permission refusée : message dédié et bouton vers les réglages (`NotificationSettingsModal.tsx:125-137`). Réserves : CL-24, et les écrans/notifications Android ne sont pas prouvés sur un vrai téléphone (déjà noté N-04).

### 6.8 Fuites mémoire

CL-25 (écouteur de découvertes de `MapView`) ; copies multiples des 790 adresses (jeu embarqué, index de recherche, baseline, états des vues) : mesurer avant d'agir (CL-20) ; `memoryDetailsCache` et `appCache` bornés par la taille des données. Les autres abonnements (`HomeView`, `AgendaView` `AppState`, `useNotificationNavigation`, fiches) sont bien nettoyés.

### 6.9 Journalisation et secrets

Aucune donnée sensible journalisée : pas de `console.*` sur le code admin, l'identifiant d'appareil, un jeton de notification ou des coordonnées (49 `console.*` examinés ; ils ne journalisent que des objets d'erreur). Le code admin reste en mémoire d'état React, verrouillé à 15 min (`AdminPortalModal.tsx:154-166`, `config.ts:7`). Aucun secret hors clé publique ; l'ancien `.env` suivi par Git (commits `38a7a28`, `3bd7017`) ne contenait que l'URL et la clé publique. Valeurs de repli de `supabase.ts:10-16` : pratique, mais une rotation de la clé publique casserait les appli déjà installées (à anticiper).

---

## 7. Couverture des tests existants et manques

Tests `src/lib/__tests__` : `adminApi`, `agendaErrors`, `agendaOccurrences`, `appEvents`, `dataDeletion`, `fetchWithTimeout`, `noMockData`, `pushAdmin`, `pushLogic`, `safeLinks`, `upcomingEvents` (74/74 selon `04-SUIVI`, non relancé ici). SQL : 76/76 (`security-lockdown`, `push-notifications`, `backend-audit`).

Non couverts : `authService`, `deviceIdentity`, `storage`, `dataCache`, `dataStore`, `discoveryStore`, `discountCardsStore`, `likesStore`, `partnersStore`, `placesRepository`, `searchIndex`, la partie non pure de `pushNotifications`, le montage de `supabase.ts`, et l'interaction `withTimeout` + postgrest-js.

Tests à ajouter, par ordre d'utilité :

1. `withTimeout` : (a) erreur réseau → erreur de nom `AbortError` ; (b) corps qui ne se termine pas → échec au délai ; (c) 204 sans corps passe.
2. Contrat : appeler les 16 fonctions en notation nommée (CL-22).
3. `searchIndex` : chaque puce de `QUICK_TAGS` renvoie au moins 1 résultat (CL-04).
4. `deviceIdentity` : deux appels avec `SecureStore` qui échoue renvoient le même identifiant (CL-05).
5. `discoveryStore` : file non écrasée par un rejeu concurrent ; `success:false` géré (CL-09).
6. Sonde de production : `events?select=booking_url,max_places` (CL-06).

## 8. Ordre de correction conseillé

1. CL-06 (vérifier en production, 5 minutes) puis CL-01/02 (un seul fichier, `fetchWithTimeout.ts`, avec ses tests).
2. CL-03 (accueil immédiat) et CL-04 (puces de recherche).
3. CL-05, puis CL-11 (identité unique, effacement complet).
4. CL-07, CL-08, CL-09, CL-10 (hors ligne et données locales).
5. CL-13 (retirer le démarrage inutile des cartes), CL-21, CL-22, puis le reste.

## 9. Ce qui n'a pas pu être vérifié

Comportement sur un vrai téléphone (durées réelles, gel au démarrage, SecureStore sur appareils défaillants, persistance du Trousseau iOS, notifications) ; schéma réel de la production (colonnes d'`events`, politiques de `storage.objects`) ; variables EAS réellement définies par environnement ; entitlement APNs des builds `preview`. Les comportements de bibliothèques sont déduits de leur code source installé, pas d'exécutions.

## 10. Résumé

P0 : aucun côté client. P1 (6) :
1. CL-01 `fetchWithTimeout.ts:9-16` + `supabase.ts:53` : les timeouts sont relancés 3× par postgrest-js sur mobile (47 s ; 7 s hors ligne).
2. CL-02 `fetchWithTimeout.ts:15` : le délai ne couvre pas le corps de la réponse (attente infinie possible).
3. CL-03 `HomeView.tsx:525-530, 618-725, 638` : squelette tant que 4 requêtes séquentielles ne sont pas finies, jeu embarqué inutilisé.
4. CL-04 `searchIndex.ts:48, 101` + `SearchView.tsx:23-33, 102` : champ `category` inexistant, les 9 puces ne donnent aucun résultat.
5. CL-05 `deviceIdentity.ts:45-48` + `likesStore.ts:129` : un UUID neuf à chaque appel si SecureStore échoue (likes gonflés, progression perdue).
6. CL-06 `HomeView.tsx:686` + `AdminPortalModal.tsx:714-715` : colonnes `events.booking_url`/`max_places` absentes des migrations (liste vide, saisie admin ignorée) [à vérifier en production].
Contrat appli ↔ base : aucun décalage de nom de paramètre sur les 16 fonctions et 9 tables appelées ; 2 écarts de champ/colonne (CL-04, CL-06).
