# 05a — Revue du démarrage et de l'écran d'accueil (Android / Hermes) — 22 octobre 2026

Analyse en **lecture seule** : aucun fichier de code modifié, aucun `npm install`, aucun serveur lancé. Seuls ce rapport et trois micro-mesures Node (copies de fonctions dans un répertoire temporaire hors dépôt) ont été produits.

**Environnement lu** : Expo SDK 57.0.31, React Native 0.86.3 (Hermes, nouvelle architecture), expo-router 57.0.29, Reanimated 4.5.1 + react-native-worklets 0.10.1, react-native-svg 15.15.4, lucide-react-native 1.22.0, expo-image 57.0.5 (versions réellement installées dans `node_modules`).

**Fichiers relus intégralement, ligne à ligne** : `src/app/_layout.tsx`, `src/app/index.tsx`, `src/components/views/HomeView.tsx` (2 580 l.), `src/components/views/home/{HomeHeader,ProgressionBanner}.tsx`, `src/components/views/CardsView.tsx`, `src/components/views/AgendaView.tsx`, `src/components/views/agenda/DayStrip.tsx`, `src/components/{FloatingDock,IntroScreen,DiscountCard,AppleWalletCard,ErrorBoundary,Stars}.tsx`, `src/hooks/*`, `src/constants/{brand,config,placeholder,theme}.ts`.
**`homeStyles.ts` (2 049 l.)** : lu par inventaire complet des propriétés/valeurs (aucune valeur propre au web) et lecture détaillée des styles de positionnement, de dimension d'images et d'incrustation ; les 1 600 autres lignes sont des déclarations de style ordinaires.
**`dataset.json`** : taille et structure seulement (1 988 316 octets ; 3 clés `categories` (19), `addresses` (790), `total` ; 22 champs par adresse ; 788 images hébergées sur le stockage Supabase, 2 sur Unsplash ; 790/790 adresses ont un `category_id` « spécifique »).
**Fichiers hors liste mais sur le chemin de démarrage, lus pour comprendre** : `lib/{typography,storage,supabase,fetchWithTimeout,dataCache,appEvents,partnersStore,likesStore,deviceIdentity,authService,discoveryStore,discountCardsStore,pushNotifications,categoryResolver,categoryIcons,placesRepository,searchIndex,dataStore,agendaOccurrences,agendaErrors,partnerEventsStore,imageOptimizer,formatRating,safeLinks,upcomingEvents}.ts`, extraits de `MapView`, `SearchView`, `AddressDetailModal`, `AdminPortalModal`, `NotificationSettingsModal`, `app.json`, `app.config.js`, `eas.json`, `metro.config.js`, et le code de `node_modules` quand une affirmation en dépendait.

## 0. Légende

- **[V]** vérifié dans le code du dépôt (fichier:ligne) ou dans `node_modules` (chemin cité).
- **[M]** mesuré (Node/V8 avec JIT, **pas** Hermes) — sert d'ordre de grandeur relatif.
- **[S]** suspecté : dépend du réseau, de l'appareil, d'un contenu de base de données non visible ici, ou de Hermes que je n'ai pas pu exécuter.
- **P0** : peut empêcher l'appli de démarrer ou de répondre. **P1** : gel / lenteur forte / appui perdu fréquent. **P2** : dégradation nette. **P3** : hygiène.

Aucun secret n'est reproduit. La clé publique (anon) de repli codée en dur dans `supabase.ts:14-16` et présente dans `eas.json` est publique par conception ; sa valeur n'est pas répétée ici.

---

## 1. Synthèse

| Id | Gravité | Constat | Où | Statut |
|---|---|---|---|---|
| P0-1 | **P0** | Tout l'affichage dépend de `useFonts` sans chemin d'erreur ni délai ; écran blanc définitif si les polices échouent ou tardent. Sur natif ces polices ne servent à rien (voir P2-1). | `app/_layout.tsx:40,85,90` | [V] code, [S] déclenchement |
| P0-2 | **P0** | Accueil en squelettes tant que le réseau n'a pas tout répondu, sans issue si le corps d'une réponse se fige (minuteur effacé dès les en-têtes ; OkHttp RN sans délai) ; requêtes en série ; le catalogue embarqué (790 adresses) n'est pas utilisé comme état initial. | `HomeView.tsx:525-530,618-725` ; `lib/fetchWithTimeout.ts:15` ; `lib/supabase.ts:53` | [V] code, [S] scénario réseau |
| P0-3 | **P0** | L'écran d'intro (opaque, 100 % de l'écran) ne disparaît que si un rappel exécuté sur le fil d'interface se déclenche ; aucun filet côté JS. Reproduit exactement « chargement continu + dock muet » si les animations ne tournent pas. | `components/IntroScreen.tsx:25-35` ; `app/_layout.tsx:90` | [V] code, [S] déclenchement |
| P1-1 | **P1** | Travail synchrone lourd à l'évaluation des modules, avant la première image : index de recherche construit 2 fois (+ table de jetons jamais lue), 790 × `formatRawAddress`, marqueurs de carte, 1 744 modules lucide, portail admin de 2 680 lignes. | `app/index.tsx:4-9` ; `lib/searchIndex.ts:37-39,208` ; `lib/dataStore.ts:58-63` ; `lib/placesRepository.ts:62-64` ; `views/MapView.tsx:82-92` | [V] code, [M] 145 ms V8, [S] ×10-30 sur Hermes |
| P1-2 | **P1** | Aucun `keyboardShouldPersistTaps` : après une saisie, le premier appui sur un résultat ne fait que fermer le clavier (« les boutons ne répondent pas »). | `HomeView.tsx:1060` ; `SearchView.tsx:107` | [V] |
| P1-3 | **P1** (hors liste) | Carte native : 790 `Marker` avec vue personnalisée, sans regroupement ; ouverture de la carte probablement gelante sur 2-3 Go. | `views/MapView.tsx:1132-1157` | [V] code, [S] effet |
| P2-1 | P2 | `applyBrandTypography` est sans effet sur natif (RN 0.86 : `Text` est une fonction, pas un `forwardRef`). Les polices de marque ne s'appliquent qu'au web. | `lib/typography.ts:18-33` | [V] |
| P2-2 | P2 | Filtres/tri de l'accueil : texte normalisé recalculé à chaque filtre ; recherche dans la catégorie sans anti-rebond ; tri de catégories qui recalcule les comptes à chaque comparaison ; pire cas lourd si des adresses ont une catégorie « parente ». | `HomeView.tsx:481,823-1015` ; `lib/categoryResolver.ts:229-267` | [V] code, [M] |
| P2-3 | P2 | Tout l'accueil (≈ 2 500 lignes) se re-rend à chaque frappe de la recherche ; listes sans virtualisation (jusqu'à 790 cartes avec 3 icônes SVG chacune après « Afficher plus »). | `HomeView.tsx:406,1068,1355,1437` | [V] code, [S] ressenti |
| P2-4 | P2 | Pas de `BackHandler` : le bouton retour Android quitte l'appli au lieu de fermer fiche/superposition/onglet. | tout `src/` (aucune occurrence) | [V] |
| P2-5 | P2 | Dock : hauteur fixe sans marge de la barre système ; clavier non fermé au changement d'onglet. | `FloatingDock.tsx:152` ; `app/index.tsx:23-29` | [V] |
| P2-6 | P2 | Cartes pivotantes : `interpolate` sans `Extrapolation.CLAMP` → opacité 23 et −22 au repos. | `AppleWalletCard.tsx:93-94,107-108` | [V] code, [S] rendu Android |
| P2-7 | P2 | `Dimensions.get('window')` figé à l'import (rotation, dépliage, multi-fenêtre). | `HomeView.tsx:296`, `homeStyles.ts:4`, `AppleWalletCard.tsx:31`, etc. | [V] code, [S] cas d'usage |
| P2-8 | P2 | Images : originaux non redimensionnés servis tels quels ; repli `PLACEHOLDER_PHOTO` obtenu par `Asset.uri`. | `lib/imageOptimizer.ts:16-18` ; `constants/placeholder.ts:4-6` | [V] code, [S] poids/rendu |
| P3-x | P3 | Dépendances natives inutilisées, code mort, animations sans effet, `runOnJS` déprécié, etc. (§ 6). | divers | [V] |

---

## 2. Chaîne de démarrage telle que lue

1. **Évaluation des modules** (synchrone, avant toute image). `expo-router/entry` charge `src/app/_layout.tsx` puis `src/app/index.tsx`. `index.tsx:4-9` importe statiquement les 5 onglets, donc tout ce qu'ils importent : `AddressDetailModal`, `AdminPortalModal` (2 680 l. + `expo-image-picker`), `PrivacyPolicyModal` (→ `discountCardsStore`), `MapView` (→ `placesRepository`, `react-native-maps` via `require`), `SearchView` (→ `searchIndex`), `AgendaView`, `dataset.json` (instance unique, importé par 8 modules), et le fût complet `lucide-react-native`.
2. **Singletons créés à l'import** : `authService` (`authService.ts:149`), `discoveryStore` (`:289`), `discountCardsStore` (`:304`), `placesRepository` (`:319`), `searchIndex` (`:208`), `dataStore` (`:134`, importé via `AdminPortalModal.tsx:58`), client `supabase`.
3. **`RootLayout`** : `applyBrandTypography()` (sans effet sur natif), lecture SecureStore de `pt_intro_seen_v1`, `useFonts` de 7 polices ; la `Stack` et l'intro ne sont rendues qu'une fois les polices prêtes (`_layout.tsx:85,90`). Le splash natif, lui, est masqué dès que le routeur est prêt (`node_modules/expo-router/build/global-state/store.js:90-99`, `onReady()` → `requestAnimationFrame` → `SplashScreen._internal_maybeHideAsync` ; l'appli n'appelle jamais `preventAutoHideAsync`), **sans attendre les polices**.
4. **`HomeScreen`** (`index.tsx`) : `HomeView` toujours monté ; les autres onglets sont montés à la première visite puis restent montés, masqués par `opacity: 0` + `zIndex: 0` + `pointerEvents="none"` (`index.tsx:177-187`).
5. **`HomeView`** (montage) : `loadSupabaseData()` (3 requêtes en série + partenaires), likes, favoris, abonnement `discoveryStore`, 5 abonnements `onAppEvent`.

---

## 3. Constats P0

### P0-1 — Écran blanc définitif si les polices échouent ou tardent — [V] code, [S] déclenchement

**Preuve.**
- `app/_layout.tsx:40` : `const [fontsLoaded] = useFonts({...})` ne lit que le premier élément.
- `node_modules/expo-font/src/FontHooks.ts` (`useRuntimeFonts`) : en cas d'échec, `.catch` appelle `setError` ; `loaded` reste `false` pour toujours. Sur Hermes `window` existe, donc c'est bien `useRuntimeFonts` qui est utilisé.
- `_layout.tsx:85` : `{fontsLoaded && (<ErrorBoundary><Stack/></ErrorBoundary>)}` ; `_layout.tsx:90` : l'intro n'apparaît qu'avec `fontsLoaded`. Aucun délai maximal.
- Le splash natif disparaît quand le routeur est prêt (cf. § 2.3) : l'utilisateur voit alors une vue vide, sans indicateur, indéfiniment.
- **Sur natif, ces polices ne servent à rien** (P2-1) : le seul usage explicite est `fontFamily: 'BricolageGrotesque_800ExtraBold'` dans `homeStyles.ts:1852` (numéro du classement partenaires), qui retombe proprement sur la police système si elle manque. L'appli bloque donc son premier affichage sur des ressources sans bénéfice.

**Correction minimale** (`_layout.tsx`) :

```tsx
const [fontsLoaded, fontError] = useFonts({ /* inchangé */ });
const [fontsLate, setFontsLate] = useState(false);
useEffect(() => { const t = setTimeout(() => setFontsLate(true), 3000); return () => clearTimeout(t); }, []);
// Natif : les polices de marque ne sont pas appliquées (P2-1) ; on n'attend donc jamais.
const appReady = Platform.OS !== 'web' || fontsLoaded || !!fontError || fontsLate;
// ...
{appReady && (<ErrorBoundary scope="racine"><Stack screenOptions={{ headerShown: false }} /></ErrorBoundary>)}
{appReady && introChecked && !introFinished && <IntroScreen onFinish={handleIntroFinish} />}
```

### P0-2 — Accueil en squelettes sans issue garantie — [V] code, [S] scénario réseau

**Preuve.**
- `HomeView.tsx:529` : `const [loading, setLoading] = useState(true)` ; `categories` et `addresses` démarrent à `[]` (`:525-526`). Le jeu de données embarqué (`dataset`, 790 adresses, importé en `:107`) n'est utilisé qu'**après** un échec réseau (`:663,667,719-720`). Tant que `loading` est vrai, l'accueil affiche des squelettes (`:1620,1764,1860,1951`).
- Les requêtes sont **en série** : catégories (`:650`), puis adresses (`:657`), puis événements (`:684`), puis `await syncPartnersWithSupabase()` (`:702`) **avant** `setLoading(false)` (`:715`), alors que le commentaire dit « in background ». Pire cas théorique : 4 délais de 10 s cumulés avant la fin des squelettes, même quand les adresses sont déjà arrivées (`setAddresses` en `:678`).
- **Le minuteur de 10 s est effacé dès réception des en-têtes** : `lib/fetchWithTimeout.ts:15` → `.finally(() => clearTimeout(timer))`. `fetch` se résout à l'arrivée des en-têtes ; si le corps (≈ 1 Mo pour les adresses) se fige ensuite, rien n'annule la lecture.
- **Côté Android, aucun délai natif non plus** : `node_modules/react-native/ReactAndroid/src/main/java/com/facebook/react/modules/network/OkHttpClientProvider.kt:52-54` fixe `connectTimeout(0)`, `readTimeout(0)`, `writeTimeout(0)` (0 = infini). Un réseau qui accepte la connexion puis ralentit à l'extrême (portail captif, 2G saturée, VPN de filtrage) laisse `await supabase...` suspendu : squelettes pour toujours, pas de bouton « réessayer », et `loadSupabaseData` n'a ni garde de réentrée ni délai global.
- La branche « cache chaud » est inopérante : `:633` met `setLoading(false)` puis `:638` remet `setLoading(true)`.

**Correction minimale** (`HomeView.tsx`) :

```tsx
// 1) État initial = catalogue embarqué (ou cache) ; les squelettes ne concernent plus que les événements
const [categories, setCategories] = useState<Category[]>(
  () => appCache.get<Category[]>('categories') ?? (dataset.categories as any));
const [addresses, setAddresses] = useState<Address[]>(
  () => appCache.get<Address[]>('addresses') ?? (dataset.addresses as any));
const [loading, setLoading] = useState(false);          // « chargement bloquant » supprimé
const [eventsLoading, setEventsLoading] = useState(true); // à utiliser pour la section Événements

// 2) Requêtes en parallèle, partenaires hors du chemin critique, échéance globale
const deadline = <T,>(p: Promise<T>, ms = 12000) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('délai dépassé')), ms))]);
const [catRes, addrRes, evtRes] = await deadline(Promise.all([
  supabase.from('categories').select('*').order('name', { ascending: true }),
  supabase.from('addresses').select('id, title, /* … inchangé … */').order('created_at', { ascending: false }),
  supabase.from('events').select('id, title, /* … */').order('event_date', { ascending: true }),
]));
/* … fusion et setters inchangés … */
setEventsLoading(false);
syncPartnersWithSupabase().then((p) => p.length && setSponsoredPartners(p)).catch(() => {}); // sans await
```

Et dans `lib/fetchWithTimeout.ts`, garder l'échéance active pendant la lecture du corps :

```ts
return fetchImpl(input, { ...init, signal: controller.signal })
  .catch((e) => { clearTimeout(timer); throw e; });
// Pas de clearTimeout en cas de succès : un abort() après coup est sans effet, et l'échéance couvre le corps.
// (Tests Node : ajouter (timer as any).unref?.() pour ne pas retenir le processus.)
```

### P0-3 — L'intro peut rester à l'écran pour toujours — [V] code, [S] déclenchement

**Preuve.**
- `IntroScreen.tsx:23` : `containerOpacity` vaut 1 au départ ; son seul chemin vers 0 puis vers `onFinish` est `withDelay(… withTiming(0, …, (finished) => { if (finished) runOnJS(onFinish)(); }))` (`:29-34`), exécuté sur le fil d'interface.
- L'intro est un plein écran opaque (`:45` fond `Brand.night`, `zIndex: 9999`, `:64`) rendu **après** la `Stack` (`_layout.tsx:90`). Elle ressemble à un écran de chargement (logo, étoiles, slogan). Si le moteur d'animation ne s'exécute pas (module natif désaccordé, première frame perdue, `finished` à `false` à cause d'une annulation), elle masque tout. Comme `pointerEvents="none"` (`:44`), les appuis traversent : **l'appli répond en dessous mais l'utilisateur ne voit rien** — « chargement continu + dock muet ».
- Aggravant : `_layout.tsx:36` recrée `handleIntroFinish` à chaque rendu du layout, et `IntroScreen.tsx:35` met `onFinish` dans les dépendances de l'effet → toute relance du layout (changement de thème système, par exemple) relance les trois animations.
- `IntroScreen` est **hors** de l'`ErrorBoundary` (`_layout.tsx:86-90`) : une erreur dans l'intro n'est pas rattrapée.

**Correction minimale** (`IntroScreen.tsx`) :

```tsx
const finishRef = useRef(onFinish); finishRef.current = onFinish;       // identité stable
useEffect(() => {
  const total = (reduceMotion ? 400 + 150 : 700 + 400) + 600;
  const safety = setTimeout(() => finishRef.current(), total);          // filet côté JS (idempotent)
  opacity.value = withTiming(1, { duration: reduceMotion ? 0 : 450, easing: Easing.out(Easing.ease) });
  scale.value = withTiming(1, { duration: reduceMotion ? 0 : 600, easing: Easing.out(Easing.back(1.4)) });
  containerOpacity.value = withDelay(reduceMotion ? 400 : 700,
    withTiming(0, { duration: reduceMotion ? 150 : 400, easing: Easing.inOut(Easing.ease) }));
  return () => clearTimeout(safety);
}, [reduceMotion]);   // opacity/scale/containerOpacity sont stables
```

(La disparition visuelle reste animée ; le démontage est garanti par le minuteur JS. Retirer `runOnJS` règle aussi le point P3-1.)

---

## 4. Constats P1

### P1-1 — Travail synchrone à l'import des modules (avant la première image) — [V] code, [M] V8, [S] Hermes

**Preuve.**
- `index.tsx:4-9` : imports statiques des 5 onglets ; `inlineRequires: false` dans `node_modules/@expo/metro-config/build/ExpoMetroConfig.js:346` → tout est évalué au lancement. `node_modules/babel-preset-expo/build/configs/module-transforms.js:30-53` ne rend « paresseux » que `react-native` et sa liste interne (`rn-lazy-imports`), jamais un paquet tiers comme lucide.
- `lib/searchIndex.ts:37-39` + `:208` : le constructeur construit l'index complet (normalisation NFD + découpage + 1 à 3 préfixes par jeton) pour 790 adresses. `lib/dataStore.ts:58-63` (constructeur, importé via `AdminPortalModal.tsx:58`) rappelle `searchIndex.updateSpots(dataset.addresses)` : **deuxième construction identique**. La table `tokenMap` (11 348 clés, 141 089 entrées de `Set`) est écrite (`searchIndex.ts:65-68,116-119`) mais **jamais lue** : `search()` (`:146-200`) parcourt `indexedSpots` linéairement. Mémoire et temps perdus ×2.
- `lib/placesRepository.ts:62-64,144-163,319` : le constructeur exécute `formatRawAddress` sur les 790 adresses (`getBudgetInfo` : regex + ≈ 25 `includes` ; `classifySpot` : jusqu'à ≈ 290 `includes`) alors que `getAllSpotsBaseline()` (`:168-173`) sait déjà initialiser à la demande. `views/MapView.tsx:82-92` rappelle `getAllSpotsBaseline()` et fabrique `LEAN_MAP_MARKERS` au niveau du module, donc au lancement, même si la carte n'est jamais ouverte.
- `lucide-react-native` : l'import nommé passe par le fût `dist/esm/lucide-react-native.mjs` (1 744 modules d'icônes ré-exportés ; `sideEffects: false` mais Metro ne secoue pas les arbres avec `inlineRequires: false`). Le code utilise 88 icônes distinctes (vérifiées existantes) sur 1 744 chargées. [S] coût : plusieurs dizaines de ms et quelques Mo de tas sur Hermes.
- `discountCardsStore.ts:121-123,304` (importé via `PrivacyPolicyModal.tsx:21`) lance au lancement 2 requêtes réseau (`discount_cards`, RPC `get_my_card_usage`) pour une interface (`DiscountCard.tsx`) qui n'est plus montée nulle part.
- `AdminPortalModal.tsx` (2 680 l., `expo-image-picker`, `dataStore`) est évalué à froid alors qu'il n'est montré qu'après 7 appuis (`HomeView.tsx:2545`). Un module natif absent d'un binaire plus ancien (cas déjà vécu avec `react-native-svg`) tuerait toute l'appli à l'import.

**Mesures [M]** (Node 24 / V8, copies fidèles des fonctions, voir annexe A) :

| Travail | V8 |
|---|---|
| `placesRepository` : 790 × `formatRawAddress` | 50,0 ms |
| `searchIndex` : construction n°1 | 52,8 ms |
| `searchIndex` : construction n°2 (via `dataStore`) | 39,7 ms |
| Total mesuré (hors lucide, hors `LEAN_MAP_MARKERS`) | ≈ 143 ms |

[S] Hermes n'a pas de JIT et, sur Android, délègue très probablement `String.prototype.normalize` à une API de la plateforme (appel natif par chaîne) : prévoir un facteur 10 à 30, soit **≈ 1,5 à 4 s de fil JS bloqué** sur un téléphone d'entrée de gamme avant le premier affichage. À confirmer au profileur Hermes.

**Correction minimale.**

```ts
// searchIndex.ts : supprimer tokenMap (jamais lu) et le constructeur → index construit à la première recherche
class FastSearchIndex { /* …sans tokenMap… */  /* constructor() { this.init(); }  ← à retirer */ }
// dataStore.ts : retirer le corps du constructeur (init() de searchIndex lit déjà dataset)
// placesRepository.ts : retirer constructor() { this.initOfflineBaseline(); } (getAllSpotsBaseline() est déjà paresseux)
// MapView.tsx : déplacer PT_SPOTS / LEAN_MAP_MARKERS dans un useMemo du composant
const PT_SPOTS = useMemo(() => placesRepository.getAllSpotsBaseline(), []);
// discountCardsStore.ts : ne pas appeler this.init() au constructeur ; l'appeler depuis getCards()/useCard()/resetLocal()
// HomeView.tsx : portail admin chargé à la demande
const AdminPortalModal = React.lazy(() => import('../AdminPortalModal'));
{showAdminModal && <Suspense fallback={null}>…</Suspense>}
```

Option plus profonde pour lucide : exposer un fichier `src/lib/icons.ts` qui n'importe que les 88 icônes utilisées par chemin (`lucide-react-native/dist/esm/icons/<nom>.mjs`) ; à valider (le sous-chemin n'est pas dans `exports`, Metro retombe sur la résolution de fichier avec avertissement).

### P1-2 — Premier appui avalé après une saisie — [V]

**Preuve.** `HomeView.tsx:1060` (`<ScrollView showsVerticalScrollIndicator={false} contentContainerStyle=…>`) porte le champ de recherche (`HomeHeader.tsx:49`) **et** toutes les cartes. Aucun `keyboardShouldPersistTaps` dans `HomeView`, `AgendaView`, `SearchView` (`grep` : seuls `MapView`, `AdminPortalModal`, `AgendaAdminPanel` l'ont). Avec la valeur par défaut `'never'`, l'appui qui suit une saisie ferme le clavier et **n'est pas transmis** à la carte ou au bouton touché. `TextInput` ne perd pas le focus au changement d'onglet non plus (P2-5).

**Correction minimale** :

```tsx
<ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
```
(à appliquer à `HomeView.tsx:1060` et au `ScrollView` principal de `SearchView.tsx:107`).

### P1-3 — (hors liste, signalé) 790 marqueurs natifs — [V] code, [S] effet

`views/MapView.tsx:1132-1157` : `filteredSpots.map` rend un `<Marker>` avec un `<View>` enfant par adresse (790), sans regroupement, avec `visitedSpotIds.includes(s.id)` (O(n·m)) dans le rendu. Les marqueurs à vue personnalisée sont rastérisés un par un côté Android ; `tracksViewChanges={isSelected}` (`:1140`) est faux dès le départ, ce qui peut aussi donner des marqueurs vides. [S] gel de plusieurs secondes à la première ouverture de la carte sur 2-3 Go (donc dock muet pendant ce temps). À confirmer par l'agent chargé de la carte ; piste : n'afficher que les marqueurs de la zone visible / regrouper, et passer `visitedSpotIds` en `Set`.

---

## 5. Constats P2

### P2-1 — Les polices de marque ne s'appliquent pas sur natif — [V]
`lib/typography.ts:18-33` suppose que `Text.render` existe (ancien `forwardRef`). RN 0.86 : `Libraries/Text/Text.js:44-47` déclare `const TextImpl: component(ref?: …, ...props: TextProps) = ({ ref: forwardedRef, … }) =>` (fonction à `ref` en prop) et `:556` `export default TextImpl` ; idem `TextInput.js:901`. `Component.render` est donc `undefined` → `patch` retourne sans rien faire (ligne 20). Sur le web, `react-native-web` fournit un `forwardRef`, d'où l'écart observé. Conséquences : charte typographique (`DESIGN_SYSTEM.md`) non respectée sur Android/iOS, 7 polices chargées pour rien (cf. P0-1), `letterSpacing` et `fontWeight` rendus avec la police système.
**Correction** : soit assumer la police système sur natif (supprimer `applyBrandTypography()` côté natif et le `useFonts`), soit un composant maison `AppText` appliqué par recherche/remplacement (`Text`/`TextInput` importés depuis `@/components/AppText`). Ne pas réutiliser le patch tel quel.

### P2-2 — Recalculs de filtres et de tri — [V] code, [M] V8, [S] Hermes
- `HomeView.tsx:823-860` (`categoryBaseAddresses`) : pour chaque adresse hors catégorie, reconstruit et normalise (NFD + regex + `toLowerCase`) un texte de ≈ 1,3 Ko (titre + description + `full_description` + tags + fil d'Ariane) puis `normalizeText(kw)` pour **chaque mot-clé et chaque adresse**.
- `:871-945` (`availableSubTags`) : pour chaque préréglage (jusqu'à 8) × chaque adresse du résultat, recalcule ce même texte normalisé. Mesure [M] pour « Restauration » (401 adresses × 8 préréglages) : 3 208 normalisations, 38,9 ms V8.
- `:947-959` : la recherche « dans la catégorie » (`inCategorySearch`, `:481`, saisie `:1237-1238`) **n'a pas d'anti-rebond** (contrairement à la recherche principale, `:469-474`) ; chaque frappe renormalise tous les textes (≈ 7 ms V8 pour 400 adresses ; ×10-30 sur Hermes → saccades).
- `lib/categoryResolver.ts:247-267` (`getOrderedPopularCategories`) : le comparateur de tri rappelle `getCategorySpotCount` **deux fois par comparaison** (N adresses chaque) ; appelé deux fois (`HomeView.tsx:798,1045`), plus `categorySpotCounts` (`:1048-1054`). Avec le jeu actuel (tous les `category_id` spécifiques) : 9,5 ms V8 [M]. Mais `classifyAddress` (`:69-194`) retombe sur 4 normalisations + ≈ 25 regex pour toute adresse dont le `category_id` n'est pas l'un des 14 identifiants « spécifiques » : pire cas [M] (toutes adresses « parentes ») **350,7 ms V8** avec seulement 3 familles de regex copiées (le vrai code en teste ≈ 12) → plusieurs secondes sur Hermes. Les adresses créées par le portail admin avec une catégorie parente héritent de ce chemin lent [S].

**Correction minimale** : mémoïser une fois par adresse (`WeakMap`) le texte normalisé et la catégorie résolue, et calculer les comptes en un seul passage :

```ts
const blobCache = new WeakMap<object, string>();
export const searchBlob = (a: any) => {
  let b = blobCache.get(a);
  if (b === undefined) {
    b = normalizeText(`${a.title} ${a.description} ${a.full_description || ''} ${a.location || ''} ${(a.tags || []).join(' ')} ${(a.breadcrumbs || []).join(' ')}`);
    blobCache.set(a, b);
  }
  return b;
};
// HomeView : blob.includes(q) partout ; mots-clés normalisés une fois en dehors des boucles ;
// getOrderedPopularCategories : calculer counts[cat.id] une fois, puis trier sur counts ;
// inCategorySearch : useDeferredValue ou anti-rebond de 200 ms comme searchQuery.
```

### P2-3 — Re-rendus et absence de virtualisation — [V] code, [S] ressenti
- `searchQuery` (`HomeView.tsx:406`) est l'état racine d'un composant de 2 500 lignes sans sous-composants mémoïsés : chaque frappe re-rend en-têtes, bannière, catégories, partenaires, 12 + 12 cartes (`:1068`). `(selectedCategoryFilter || searchQuery.trim().length > 0)` (`:1090`) bascule dès le premier caractère (non anti-rebondi) vers la vue « résultats » (hero + 24 cartes).
- `:1355` rend `slice(0, displayLimit)` par pas de 24 (`:1443`) dans un `ScrollView` : jusqu'à 790 cartes contenant chacune une `Image`, 3 icônes SVG (`Star`, `MapPin`, `Heart`) et ≈ 6 `Text`. Pas de `FlatList` ni de recyclage ; mémoire et gel croissants si l'utilisateur insiste sur « Afficher plus ».
- `typography.ts` (P2-1) n'a pas ce coût sur natif ; sur le web il ajoute un `StyleSheet.flatten` à chaque `Text`.
**Correction** : extraire `HomeSearch` (état + `TextInput`) dans un composant enfant qui ne remonte que la valeur anti-rebondie ; mémoïser `AddressCard` (`React.memo`) ; remplacer le grand `map` des résultats par `FlatList` (`getItemLayout`, `initialNumToRender={8}`) avec le reste de la page en `ListHeaderComponent`.

### P2-4 — Bouton retour Android — [V]
Aucune occurrence de `BackHandler` dans `src/`. Les superpositions « maison » (`bookingEvent`, `successEvent`, `infoAlert` : `HomeView.tsx:2049-2212` ; `AddressDetailModal` rendu en `View` absolue) ne sont pas des `Modal` et n'ont pas de `onRequestClose` ; le retour système quitte donc l'appli, tout comme depuis les onglets Carte/Recherche/Agenda/Cartes. **Correction** : dans `index.tsx`, `BackHandler.addEventListener('hardwareBackPress', …)` : fermer d'abord la superposition ouverte, sinon revenir à l'onglet `home`, sinon laisser quitter.

### P2-5 — Dock et clavier — [V]
- `FloatingDock.tsx:152` : `bottom: 34` fixe. Avec le plein écran de bord à bord d'Android récent et la navigation 3 boutons (≈ 48 dp), ≈ 14 dp du bas du dock passent sous la barre système (zone non tactile). **Correction** : `const { bottom } = useSafeAreaInsets();` → `bottom: Math.max(16, bottom + 12)`.
- `app/index.tsx:23-29` : au changement d'onglet le `TextInput` de l'accueil garde le focus (la vue est seulement rendue transparente) → le clavier reste ouvert sur l'onglet suivant. **Correction** : `Keyboard.dismiss()` dans l'effet `[activeTab]`.

### P2-6 — `interpolate` sans plafond — [V] code, [S] Android
`AppleWalletCard.tsx:93-94,107-108` (et `DiscountCard.tsx:123-124,133-134`, composant non utilisé) : `interpolate(rotateY, [88, 92], [1, 0])` prolonge linéairement hors bornes (extrapolation par défaut `EXTEND`) : à `rotateY = 0`, face avant ≈ 23 et face arrière ≈ −22 pour `opacity`. Le web plafonne ; Android/Skia ne documente pas ce cas. **Correction** : `interpolate(rotateY.value, [88, 92], [1, 0], Extrapolation.CLAMP)` (importer `Extrapolation` de Reanimated).

### P2-7 — Dimensions figées à l'import — [V] code, [S]
`HomeView.tsx:296` (variables `width`/`height` inutilisées), `homeStyles.ts:4` (utilisées pour `instantModalContent.height`, `filterModalContent.maxHeight`), `AppleWalletCard.tsx:31-34` (largeur de la carte), `AddressDetailModal.tsx:39`, `PlaceDetailSheet.tsx:39`, `MapView.tsx:77`. `app.json` fixe `portrait` mais les grands écrans Android récents (pliables, tablettes, multi-fenêtre) peuvent ignorer cette contrainte. **Correction** : `useWindowDimensions()` dans les composants concernés.

### P2-8 — Images et repli — [V] code, [S]
`lib/imageOptimizer.ts:16-18` renvoie l'URL Supabase d'origine (pas de redimensionnement serveur) ; le script de collecte (`scripts/scraper_images_supabase.py`) ne redimensionne pas non plus. Les 12 + 12 cartes de l'accueil et la liste de recherche téléchargent donc des originaux pour des vignettes de 200-280 px. `expo-image` décode à la taille de la vue mais le réseau et le disque payent l'original. Le repli `PLACEHOLDER_PHOTO` (`constants/placeholder.ts:4-6`) vient de `Asset.fromModule(...).uri` : en APK de production, `resolveAssetSource` renvoie un nom de ressource (`assets_images_…`) plutôt qu'un fichier, ce qu'`expo-image` ne résout pas forcément pour un `{ uri }` [S]. **Correction** : donner `source={require('…placeholder-photo.png')}` directement à `Image` quand l'URL est vide ; pré-redimensionner (≤ 800 px, WebP) à l'import des images.

---

## 6. Constats P3 (hygiène)

1. **`runOnJS` déprécié** : `IntroScreen.tsx:8,32` (`@deprecated Use scheduleOnRN`, `react-native-worklets/src/threads.native.ts:278-290`). Il **fonctionne encore** (simple enveloppe de `scheduleOnRN`). Remplacer par `import { scheduleOnRN } from 'react-native-worklets'` ; le correctif P0-3 le supprime déjà.
2. **Animations sans effet** : `HomeView.tsx:413-450` — `searchPulse` (répétition infinie à la prise de focus, `:420-427`), `labelStyle` (`:435`) et `borderStyle` (`:448`, retourne `{}`) ne sont rattachés à aucune vue ; `HomeHeader.tsx:16-22` reçoit `labelStyle` sans le destructurer. Coût : une animation continue sur le fil UI pendant la saisie. À supprimer.
3. **Dépendances natives déclarées mais jamais importées** (vérifié par recherche dans `src/`) : `expo-glass-effect`, `expo-symbols`, `@expo/ui` (Jetpack Compose côté Android), `expo-linear-gradient`. Elles alourdissent l'APK et le temps de compilation sans usage ; aucun risque de compatibilité à l'exécution puisqu'elles ne sont pas appelées.
4. **Code mort** : `components/DiscountCard.tsx` (640 l.), `animated-icon.{tsx,web.tsx}`, `themed-text/view`, `hint-row`, `web-badge`, `external-link`, `hooks/use-theme.ts`, `constants/theme.ts`, `src/global.css` — aucun n'est importé depuis `src/app`. `AppleWalletCard.tsx:143,154` embarque deux JPEG (1,5 Mo) pour des finitions jamais proposées (`CardsView.tsx:33-36` n'expose que `sidereal`).
5. **Package.json vs Expo** : `expo-asset ~57.0.18`, `expo-constants ~57.0.3`, `expo-font ~57.0.0`, `@expo/vector-icons ^15.1.1` sont en dessous des versions attendues par SDK 57 (`bundledNativeModules.json`), mais le verrou installe `57.0.20`, `57.0.22`, `57.0.4` : aucun impact aujourd'hui ; lancer `npx expo install --check` au prochain passage.
6. **Imports de polices** : `@expo-google-fonts/*` importés depuis la racine du paquet → toutes les graisses/italiques sont enregistrées comme ressources (≈ 2-3 Mo d'APK en trop). Importer `@expo-google-fonts/plus-jakarta-sans/400Regular` etc. si les polices sont conservées.
7. **`SecureStore` du client Supabase** : `supabase.ts:39,48` n'attendent ni ne rattrapent `setItemAsync`/`deleteItemAsync` (rejets non gérés possibles, sans plantage).
8. **Repli de redirection** : `HomeView.tsx:339-343` — si `Linking.openURL` échoue sur natif, `window.location.href = …` lève (`window.location` est `undefined` sous Hermes) dans un `.catch`. Remplacer par un `Alert`.
9. **Prix invalide** : `HomeView.tsx:2068` — `parseFloat(undefined).toFixed(2)` affiche « NaN € » (contrairement à `:1974-1975` qui garde).
10. **`Map` de lucide masque le `Map` global** dans `FloatingDock.tsx:10` : sans conséquence tant que le fichier n'utilise pas `new Map()`.
11. **`SafeAreaView` de `react-native`** dans `NotificationSettingsModal.tsx:9` et `AddressDetailModal.tsx:11` : ne gère pas les marges sur Android (déprécié) ; préférer `react-native-safe-area-context`.
12. **Données** : `HomeView.tsx:1081` — la bannière « configurez votre `.env` » est inatteignable car `isSupabaseConfigured` vaut toujours `true` grâce aux valeurs de repli (`supabase.ts:10-19`).

---

## 7. Ce qui a été vérifié et n'appelle pas de correction

- **Boucles de rendu / effets** : tous les effets de `index.tsx:23-34`, `HomeView.tsx:417-432,458-463,469-474,577-593,598-615,727-793,801-805`, `AgendaView.tsx:57-104`, `FloatingDock.tsx:38-47,94-103`, `AppleWalletCard.tsx:62-75` ont des dépendances finies, sans `setState` inconditionnel en boucle. `onToggleDock` est le setter d'état `setIsDockVisible` (stable). `AgendaView.load` ne change que si `today` change.
- **Chargements qui se terminent** : `AgendaView.tsx:61-84` (`try/catch/finally`), `loadSupabaseData` (tous les chemins appellent `setLoading(false)` : `:633,643,715,723`), `useNotificationNavigation` (`.catch`, `pushNotifications.ts:200`), `configurePush`/`resyncPushRegistration` (`try/catch`).
- **API web** : toutes protégées par `Platform.OS === 'web'` ou `typeof` (`HomeView.tsx:37-53`, `storage.ts`, `partnersStore.ts:36,60`, `deviceIdentity.ts:24-34`, `crypto.randomUUID` gardé). Sous Hermes `window` existe mais `window.localStorage` est `undefined` → branche web ignorée. Les événements internes passent par `appEvents.ts` (plus de `CustomEvent`).
- **Superpositions et appuis** : le dock est le dernier enfant du conteneur racine, `zIndex: 1000` (`FloatingDock.tsx:156`), `pointerEvents` géré par style et valide en RN 0.86 (`BaseViewConfig.android.js:369`, `ReactNativeStyleAttributes.js:250`) ; les onglets masqués portent `pointerEvents="none"` (`index.tsx:55,73,88,106,121`) ; l'intro est `pointerEvents="none"` ; `modalBackdrop` (z-index 9999, plein écran) n'est rendu que conditionnellement (`HomeView.tsx:2049,2117,2177`) et le dock est alors masqué (`:795-805`) puis réaffiché au changement d'onglet (`index.tsx:23-29`). Aucun calque absolu plein écran toujours monté n'intercepte les appuis.
- **Clés SecureStore** : les 10 clés utilisées respectent `/^[\w.-]+$/` (`expo-secure-store/src/SecureStore.ts:237-239`) ; plus de limite de 2 048 octets dans cette version.
- **Icônes lucide** : les 88 noms importés dans `src/` existent dans lucide-react-native 1.22.0 (contrôle automatisé sur le fût ESM et les types) — y compris les alias `Home`, `Filter`, `CheckCircle`, `AlertTriangle`, `Trophy`.
- **react-native-svg** : présent (15.15.4, version attendue par Expo SDK 57). Reanimated 4.5.1 + worklets 0.10.1 + RN 0.86 : combinaison déclarée compatible (`react-native-reanimated/compatibility.json`) ; le plugin Babel worklets est ajouté automatiquement par `babel-preset-expo` (`configs/expo.js:96-100`), donc l'absence de `babel.config.js` est sans conséquence.
- **`createAnimatedComponent(Pressable)`** (`FloatingDock.tsx:13`) : accepté (Pressable est un `memo`), `style` en tableau, pas de fonction.
- **Clés de liste** : présentes partout (`key={addr.id}`, `partner.id || idx`, `iso`, `c.id ?? 'all'`, squelettes par index).
- **Valeurs nulles** : `normalizeText('')`, `formatRating`, `(addr.tags || [])`, `categories.find(...)?.name`, `getOptimizedImageUrl` (renvoie `''`) sont tous sûrs ; `discoveryStore.getStats()` ne divise jamais par zéro (`:232-234`), donc `width: "NaN%"` est impossible dans `ProgressionBanner.tsx:60`.
- **Mémoire** : `appCache` (5 clés fixes), `memoryDetailsCache` (≤ 790), écouteurs tous désabonnés (`HomeView.tsx:790-792`, `SearchView`, `MapView`, `discoveryStore.subscribe`, `AppState` en `AgendaView.tsx:103`). Pas de cache non borné.
- **Notifications au démarrage** : tout est sous `try/catch` ; l'absence de configuration FCM fait échouer `getExpoPushTokenAsync` en promesse rejetée rattrapée (`pushNotifications.ts:116-120,171-173`), sans plantage.
- **Imports `.ts` explicites** (`AgendaView.tsx:19`, `DayStrip.tsx:4`, `partnerEventsStore.ts:2-3`) : résolus par Metro (le fichier existe) ; `allowImportingTsExtensions` est activé.
- **`marginVertical: 'auto'`** (`CardsView.tsx:170`) : géré par Yoga.

### Imports natifs : compatibilité Android

| Paquet | Déclaré | Importé | Android |
|---|---|---|---|
| react-native-reanimated 4.5.1 / react-native-worklets 0.10.1 | oui | IntroScreen, FloatingDock, HomeView, AppleWalletCard | OK (voir P0-3 pour le filet) |
| react-native-svg 15.15.4 | oui | via lucide | OK |
| lucide-react-native 1.22.0 | oui | partout | OK, mais chargement du fût complet (P1-1) |
| expo-image 57.0.5 | oui | HomeView, AgendaView, SearchView, … | OK |
| expo-secure-store | oui | storage, supabase, likes, deviceIdentity | OK (Keystore) |
| expo-notifications / expo-device / expo-constants | oui | pushNotifications | OK ; push exige `google-services.json` (EAS) — erreurs rattrapées |
| expo-location, expo-image-picker | oui + plugins | MapView, AdminPortalModal | OK |
| react-native-maps 1.27.2 | oui (version exacte) | MapView (`require` gardé) | Exige une clé Google Maps : valeur factice hors production (`app.config.js`) |
| react-native-safe-area-context, expo-router, expo-status-bar, expo-asset, @expo-google-fonts/* | oui | oui | OK |
| **expo-glass-effect, expo-symbols, @expo/ui, expo-linear-gradient** | oui | **non** | Inutilisés (P3-3) |

---

## 8. Plan d'action proposé (ordre de rentabilité)

1. **P0-1** et **P0-3** : une dizaine de lignes chacune, risque nul, suppriment les deux « écrans morts » possibles.
2. **P0-2** : état initial = catalogue embarqué + échéance qui couvre le corps de la réponse + requêtes en parallèle. C'est le changement qui supprime le plus sûrement l'impression de « chargement continu ».
3. **P1-2** : une ligne par `ScrollView`.
4. **P1-1** : retirer `tokenMap` et les constructeurs paresseux (gain immédiat de plusieurs centaines de ms à quelques secondes au lancement), `React.lazy` pour le portail admin.
5. **P2-1** : décider « police système sur natif » ou « composant Text maison ».
6. Reste des P2 par lots (BackHandler + marges + clavier ; mémoïsation des filtres ; clamp des `interpolate`).

## 9. Vérifications à faire sur appareil (non réalisables en lecture seule)

- `adb logcat -s ReactNativeJS:V ReactNative:V AndroidRuntime:E` pendant un lancement à froid ; ajouter temporairement `console.log(performance.now())` en tête de `index.tsx` et dans `RootLayout` pour mesurer le fil JS bloqué (P1-1).
- Profileur d'échantillonnage Hermes (menu développeur) du lancement à froid sur un 2-3 Go ; `adb shell dumpsys meminfo fr.lepetittou.app` avant/après ouverture de la carte (P1-3).
- Réseau dégradé volontairement (proxy qui livre les en-têtes puis fige le corps) : doit afficher le catalogue embarqué sans squelette (P0-2).
- Désactiver / saturer le moteur d'animation (mode économie d'énergie, réglages développeur) au premier lancement : l'intro doit disparaître seule (P0-3).
- Taper dans la recherche d'accueil puis appuyer sur une carte : un seul appui doit suffire (P1-2).

---

## Annexe A — Mesures Node (V8, JIT, cold) — pas Hermes

Scripts de mesure dans le répertoire temporaire de session (hors dépôt) ; fonctions copiées fidèlement depuis `categoryResolver.ts`, `placesRepository.ts`, `searchIndex.ts` et `HomeView.tsx`.

| Mesure | Résultat |
|---|---|
| Comptes + 2 tris de catégories (`getOrderedPopularCategories` ×2 + `categorySpotCounts`), jeu actuel (790 `category_id` spécifiques) | 9,5 ms |
| Même calcul si toutes les adresses ont une catégorie « parente » (copie partielle de `classifyAddress`) | 350,7 ms |
| `categoryBaseAddresses` « Restauration » (401 adresses) | 6,8 ms |
| `availableSubTags` pour ce résultat (8 préréglages, 3 208 normalisations) | 38,9 ms |
| Recherche texte globale (790 × 6 normalisations) | 5,9 ms |
| `placesRepository` : 790 × `formatRawAddress` | 50,0 ms |
| `searchIndex` : construction 1 / construction 2 | 52,8 ms / 39,7 ms ; 11 348 jetons, 141 089 entrées de `Set` |

Lecture : tous ces ordres de grandeur sont **inférieurs à 60 ms** en V8, mais s'additionnent au lancement et sur chaque frappe ; sur Hermes (interpréteur, normalisation Unicode via la plateforme), un facteur 10-30 est plausible mais **non mesuré** ici.

## Annexe B — Fichiers créés ou modifiés

Un seul fichier créé : ce rapport (`docs/audit/05a-REVUE-ACCUEIL-DEMARRAGE-2026-10-22.md`). Aucun fichier de code modifié.
