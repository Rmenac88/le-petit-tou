# 05b — Revue de code : carte, recherche, fiches, portail admin (Android / Hermes)

Date : 22 octobre 2026. Dépôt : `le-petit-tou` (Expo SDK 57.0.31, React Native 0.86.3, Hermes, expo-router, Supabase).
Nature : analyse en **lecture seule**. Aucun fichier de code modifié, aucun `npm install`, aucun serveur lancé, rien exécuté sur un téléphone. Ce fichier est le seul fichier créé.

## 1. Périmètre, méthode, limites

**Fichiers relus ligne par ligne** : `src/components/views/MapView.tsx` (2 782 l.), `src/components/views/map/mapboxHtmlTemplate.ts` (873 l., seul fichier du dossier `map/`), `src/components/views/SearchView.tsx`, `src/components/AddressDetailModal.tsx`, `src/components/PlaceDetailSheet.tsx`, `src/components/NotificationSettingsModal.tsx`, `src/components/PrivacyPolicyModal.tsx`, `src/components/AdminPasswordModal.tsx`, `src/components/AdminPortalModal.tsx` (2 680 l.), `src/components/admin/AgendaAdminPanel.tsx`, `src/components/admin/PushAdminPanel.tsx`. Pour comprendre leurs effets, j'ai aussi lu (sans les auditer en entier) : `src/app/index.tsx`, `src/app/_layout.tsx`, `app.json`, `app.config.js`, `eas.json`, `src/lib/{appEvents,fetchWithTimeout,supabase,placesRepository,searchIndex,dataStore,pushNotifications,pushAdmin,adminApi,safeLinks,storage}.ts`, `src/scripts/006_security_lockdown.sql`, et le passage de `HomeView.tsx` qui branche le portail admin (l. 535-560, 2534-2566).

**Comment les statuts sont posés**
- **Vérifié (code)** : lu dans le fichier cité (fichier:ligne).
- **Vérifié (bibliothèque)** : lu dans `node_modules` (code source de React Native 0.86.3, Expo 57, react-native-maps 1.27.2, expo-location, expo-image-picker). Ce n'est pas une exécution, mais c'est le code réellement embarqué.
- **Vérifié (données)** : mesuré sur `src/constants/dataset.json` par un script de lecture (790 adresses).
- **Suspecté** : déduit du code mais dépendant d'un appareil, d'une version d'Android ou d'un réglage non visible ici. À confirmer sur téléphone (voir §9).

**Limites** : aucun test sur appareil Android ; aucun accès à la base de production ni aux variables EAS (je ne sais donc pas si `GOOGLE_MAPS_ANDROID_API_KEY` et `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` sont renseignées pour le profil `preview`). Aucun secret n'est reproduit dans ce rapport.

## 2. Synthèse

| Gravité | Nombre | Constats |
|---|---|---|
| **P0** | 1 | R-01 |
| **P1** | 7 | R-02 à R-08 |
| **P2** | 15 | R-09 à R-23 |
| **P3** | 1 tableau | R-24 (liste groupée) |

Le constat R-01 est la cause la plus probable de « l'onglet Carte ne fonctionne pas sur Android » (écran d'erreur dès l'ouverture de l'onglet). Il n'explique pas à lui seul « chargement continu et dock inerte » de l'ancien APK (cette cause-là visait l'écran d'accueil, déjà corrigée et documentée dans `src/lib/appEvents.ts`), mais c'est exactement le même défaut resté dans la carte.

---

## 3. P0

### R-01 · P0 · `window.addEventListener` non gardé : l'onglet Carte plante sur Android
- **Où** : `src/components/views/MapView.tsx:301` (`window.addEventListener('message', …)`) et `:304` (`removeEventListener`), dans l'effet qui commence à la ligne 247 et se ferme à la ligne 306.
- **Statut** : **Vérifié (code)** pour l'absence de garde `Platform.OS`. **Vérifié (bibliothèque)** pour l'absence de la fonction : sous Hermes, `window` existe (`global.window = global`, `react-native/Libraries/Core/setUpGlobals.js`) mais ni React Native, ni Expo, ni les paquets du projet ne définissent `window.addEventListener` (recherche faite dans `react-native`, `expo`, `expo-modules-core`, `expo-router`, `react-native-url-polyfill`, `@supabase`, etc.). Le commentaire de `src/lib/appEvents.ts:1-4` décrit le même plantage constaté sur téléphone pour l'accueil. Non exécuté sur appareil.
- **Constat** : l'effet est lancé pour toutes les plateformes. Sur Android/iOS, `window.addEventListener` est `undefined` : `TypeError`. L'erreur remonte à l'`ErrorBoundary scope="MapView"` (`src/app/index.tsx:94`) : l'utilisateur voit « Oups, quelque chose s'est mal passé », « Réessayer » remonte le composant et reproduit l'erreur. La carte native n'est jamais utilisable. C'est le seul usage restant de `window.addEventListener` / `dispatchEvent` / `CustomEvent` dans `src/` (hors template HTML de l'iframe web ; `AppState` et `AbortSignal` sont des API React Native valides).
- **Correction minimale** (sépare aussi la permission, ce qui règle R-02) :
```tsx
// MapView.tsx
useEffect(() => { checkPermission(); }, []);               // une seule fois (mobile et web)

useEffect(() => {
  if (Platform.OS !== 'web') return;                        // window.addEventListener n'existe pas sous Hermes
  const handleWebMessage = (event: MessageEvent) => {
    if (event.source !== iframeRef.current?.contentWindow) return;   // bonus : ignorer les autres fenêtres
    /* corps inchangé */
  };
  window.addEventListener('message', handleWebMessage);
  return () => window.removeEventListener('message', handleWebMessage);
}, [spots]);
```

---

## 4. P1

### R-02 · P1 · Le mur de permission « Activer la carte ? » réapparaît après « Continuer sans géolocalisation »
- **Où** : `MapView.tsx:247-248` (`checkPermission()` dans l'effet) et `:306` (`}, [spots]`) ; `:700-719` ; bouton `:1075-1083`.
- **Statut** : **Vérifié (code)** (enchaînement de logique) ; le délai exact dépend du réseau.
- **Constat** : `checkPermission()` est relancé à chaque changement de `spots`. Si la permission n'est pas accordée (cas normal au premier lancement Android), il remet `locationPermission` à `'denied'` (l. 713). Or `spots` change quand la base répond (`initSpots`, `MapView.tsx:351-393`, jusqu'à 10 s si le réseau est lent ou coupé), quand le portail admin synchronise (`pt_addresses_changed`) ou quand le cache se remplit. Résultat : l'utilisateur appuie sur « Continuer sans géolocalisation » (l. 1076-1079), la carte s'affiche, puis le mur revient par-dessus.
- **Effet secondaire** : après un refus définitif Android (« Ne plus demander »), `requestForegroundPermissionsAsync` répond tout de suite `denied` sans boîte de dialogue ; le bouton « Géolocalisez-moi » ne fait rien de visible et aucun lien vers les réglages n'est proposé (cf. R-17).
- **Correction** : l'effet séparé du R-01 (`useEffect(() => { checkPermission(); }, [])`). Ajouter dans le mur, quand `canAskAgain === false` : `Linking.openSettings().catch(() => {})`.

### R-03 · P1 · Position GPS native sans délai maximal : spinner d'itinéraire infini, bouton « Ma position » muet
- **Où** : `MapView.tsx:611` (paramètre `timeoutMs` jamais utilisé hors web), `:674-676` (`Location.getCurrentPositionAsync({ accuracy: High })` sans borne), `:748-769`, `:790-820`, `:840-882` (`setRouteLoading(true)` puis `await getPreciseUserLocation(6000)`).
- **Statut** : **Vérifié (code)** pour l'absence de délai ; **Vérifié (bibliothèque)** : `expo-location/build/Location.js:34-46` ne pose aucun délai et prévient que l'obtention d'un fix « may take some time, especially when you're inside a building ». L'attente réellement infinie dépend de l'appareil (**suspecté**).
- **Constat** : sur Android, une mesure en précision haute dans un bâtiment ou sur certains constructeurs peut ne jamais aboutir. `handleCalculateRoute` met `routeLoading` à `true` (le bouton « itinéraire » de `PlaceDetailSheet` affiche alors un `ActivityIndicator`, `PlaceDetailSheet.tsx:297`) et ne le remet à `false` que si la promesse se termine : spinner permanent. `handleCenterOnMe` attend sans retour visuel, et chaque appui relance une mesure de plus.
- **Correction minimale** :
```ts
const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | null> =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

// natif, à la place de getCurrentPositionAsync nu :
const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000 });
const pos = last ?? (await withTimeout(
  Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }), timeoutMs));
if (!pos) return null;
```
et dans `handleCalculateRoute` : `try { … } finally { setRouteLoading(false); }`.

### R-04 · P1 · Appel Mapbox Directions natif sans délai maximal
- **Où** : `MapView.tsx:919-921` (`fetch('https://api.mapbox.com/directions/…')`), `finally { setRouteLoading(false) }` en `:952-954`.
- **Statut** : **Vérifié (code)** ; **Vérifié (bibliothèque)** : `react-native/ReactAndroid/.../OkHttpClientProvider.kt:49-54` (« No timeouts by default », connexion/lecture/écriture à 0) et `expo/android/.../fetch/ExpoFetchModule.kt:26-27` utilise ce même client. Le commit `f814813` (délai de 10 s sur Supabase) corrige exactement ce défaut ailleurs ; ici il reste.
- **Constat** : réseau coupé, filtré ou très lent : la requête reste suspendue, `routeLoading` reste `true`. Le repli prévu vers Google Maps externe (`handleOpenItinerary`, l. 951) n'est atteint qu'en cas d'erreur, jamais en cas d'attente.
- **Correction** :
```ts
import { withTimeout } from '../../lib/fetchWithTimeout';
const fetchWithLimit = withTimeout(fetch, 10_000);
const res = await fetchWithLimit(url);          // l. 919 ; l'échec déclenche déjà handleOpenItinerary
```
- **À noter** : `eas.json` ne définit pas `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` dans le profil `preview`, et `app.config.js:14-24` ne l'exige qu'en `production`. Si la variable n'est pas fournie par EAS, le jeton est vide (`MapView.tsx:76`) et chaque itinéraire part en 401 puis bascule sur l'appli Maps externe (comportement acceptable mais à connaître).

### R-05 · P1 · 790 marqueurs à vues personnalisées sur la carte native, sans clustering ni mémoïsation
- **Où** : `MapView.tsx:1132-1157` (`filteredSpots.map(… <NativeMarker …><View>{icône lucide}</View></NativeMarker>)`), état initial `:218-219` (les 790 adresses du jeu local sont affichées dès le premier rendu), `:1146` (`visitedSpotIds.includes(s.id)` dans la boucle), `:1137-1138` (objet `coordinate` et fonction `onPress` recréés à chaque rendu).
- **Statut** : mécanisme **Vérifié (code et bibliothèque)** ; effet réel (gel, ANR, mémoire) **suspecté**, à mesurer sur un téléphone d'entrée de gamme.
- **Constat** :
  1. Chaque marqueur est un arbre de vues natives (conteneur + `Svg` lucide + tracés + pastille éventuelle) : de l'ordre de 4 000 à 5 000 vues natives (estimation) créées d'un coup à la première ouverture de la carte (le seul clustering existant, Supercluster, est dans le HTML web).
  2. Sur Android, react-native-maps rasterise chaque vue en bitmap (`MapMarker.java:641-680`, `createDrawable()` ; un bitmap conservé par marqueur) : plusieurs dizaines de Mo de mémoire (estimation, non mesurée).
  3. Tout changement d'état de `MapView` (frappe dans la recherche, filtre, sélection) re-rend les 790 éléments avec de nouveaux objets/fonctions ; la saisie dans la barre de recherche provoque deux rendus par lettre (`searchQuery` puis `filteredSpots`, voir R-21).
  4. `tracksViewChanges={isSelected}` (l. 1140) vaut `false` dès le montage : l'icône SVG peut être photographiée avant d'être dessinée (marqueurs sans pictogramme). **Suspecté** (la bibliothèque ne redessine qu'une fois, `MapMarker.java:353-356, 641-655`).
- **Correction minimale** (à adapter) : limiter ce qui est monté à la zone visible et mémoïser.
```tsx
const SpotMarker = React.memo(({ s, selected, visited, onSelect }: any) => {
  const [track, setTrack] = useState(true);
  useEffect(() => { const t = setTimeout(() => setTrack(false), 500); return () => clearTimeout(t); }, []);
  return (
    <NativeMarker coordinate={{ latitude: s.lat, longitude: s.lng }}
      onPress={() => onSelect(s)} zIndex={selected ? 99 : 1} tracksViewChanges={track || selected}>
      {/* vue actuelle */}
    </NativeMarker>
  );
});
// dans MapView : onRegionChangeComplete={setRegion}, puis
const visibleSpots = useMemo(() => inBounds(filteredSpots, region).slice(0, 150), [filteredSpots, region]);
```
Alternative plus légère : six images PNG de marqueur (une par catégorie) via la prop `image` des marqueurs non sélectionnés (pas de vues enfants, pas de `tracksViewChanges`).

### R-06 · P1 · Sans clé Google Maps valide, la carte Android n'affiche pas de fond de carte
- **Où** : `app.config.js:10-11, 43` (clé factice `CLE_GOOGLE_MAPS_MANQUANTE` hors `production`), `MapView.tsx:1116-1130` (aucun `provider`, aucune gestion d'échec).
- **Statut** : configuration **Vérifiée (code)** ; rendu exact (tuiles grises, marqueurs flottants) **suspecté**, déjà évoqué par le commentaire d'`app.config.js`. Les variables EAS ne sont pas visibles ici.
- **Constat** : l'application ne plante plus (c'est le but de la clé factice), mais la carte du build `preview` (APK de test) n'a pas de tuiles. Rien dans l'écran ne l'explique à l'utilisateur. Le build `production` est refusé tant que la clé manque (bon garde-fou, `app.config.js:14-24`).
- **Correction** : fournir `GOOGLE_MAPS_ANDROID_API_KEY` aussi au profil `preview`, **restreinte** au paquet `fr.lepetittou.app` et aux empreintes SHA-1 de signature (clé de débogage, clé EAS, clé Play App Signing). Palliatif à valider (conditions Mapbox à relire) : `mapType="none"` + `UrlTile` de tuiles raster Mapbox avec le jeton public déjà présent, tant que la clé Google manque.
- **À noter** : sur iOS, sans `provider`, la carte est Apple Plans et `customMapStyle` (l. 95-104, 1120) est ignoré. Cosmétique.

### R-07 · P1 · Le montant payé par les partenaires (`price_paid`) est lisible avec la clé publique
- **Où** : politique « Lecture publique » `using (true)` + `grant select … to anon, authenticated` sur `sponsored_partners` (`src/scripts/006_security_lockdown.sql:109-121`) ; lecture `select('*')` avec la clé publique et affichage du montant dans `AdminPortalModal.tsx:773-776, 1904`, libellé « interne, jamais affiché » en `:1827`.
- **Statut** : **Vérifié (code et SQL du dépôt)**. Non vérifié en production (accès non disponible), mais `docs/audit/04-SUIVI-2026-10-21.md` (N-02) indique que la lecture publique de cette table est active et vérifiée en production.
- **Constat** : toute personne disposant de la clé publique (embarquée dans l'appli) peut lire tout `sponsored_partners`, y compris ce que chaque commerce a payé et la fréquence de notification. Ce sont des données commerciales confidentielles, pas des données personnelles. À traiter en **P0 si l'association les juge confidentielles**.
- **Correction minimale** (à adapter aux colonnes réelles de la table) :
```sql
revoke select on public.sponsored_partners from anon, authenticated;
grant  select (id, title, subtitle, image_url, rank_position, is_active, starts_at, ends_at,
               spot_id, badge_text, sponsorship_tier)
  on public.sponsored_partners to anon, authenticated;     -- sans price_paid
-- et le portail lit la liste complète par une RPC admin (code vérifié), comme admin_list_partner_events
```
Attention : `src/lib/partnersStore.ts:76` et `AdminPortalModal.tsx:773` font aujourd'hui `select('*')` ; il faut lister les colonnes côté appli avant de retirer le droit.

### R-08 · P1 · Recherche : les 9 « Filtres rapides » ne renvoient jamais rien, et « Afficher plus » est inatteignable
- **Où** : `src/lib/searchIndex.ts:48, 101` (`normalizedCat = normalize(a.category || "")`), `:152-155, 169` (filtre `normalizedCategory.includes(normCat)`), `:157, 161, 199` (`slice(0, limit)`) ; `SearchView.tsx:101-103` (`search(query, selectedTag, searchLimit)`), `:180`, `:215`.
- **Statut** : **Vérifié (code et données)** : dans `dataset.json`, `category` est absent des 790 lignes (seul `category_id` existe ; la table `addresses` n'a pas de colonne `category` dans `tests/sql/baseline.sql:20-24`). Je n'ai pas exécuté l'appli.
- **Constat** : (a) `normalizedCategory` vaut toujours `""` donc `"".includes("restaurants")` est faux : dès qu'un filtre rapide est sélectionné (`SearchView.tsx:151`), toutes les adresses sont écartées et l'écran affiche « Rien de ce côté-là ». Valable sur web et mobile. (b) `search()` renvoie au plus `limit` éléments ; `filteredSpots.length > searchLimit` (l. 215) n'est donc jamais vrai : le bouton « Afficher plus de résultats » n'apparaît jamais et la liste est coupée à 24.
- **Correction minimale** :
```ts
// searchIndex.ts:169 — chercher le mot dans le texte indexé (titre, lieu, tags, description)
if (normCat && !spot.normalizedText.includes(normCat)) continue;      // et :154 de même
// SearchView.tsx:102 — récupérer tout, l'affichage est déjà borné par slice(0, searchLimit) (l. 180)
return searchIndex.search(debouncedQuery, selectedTag, 1000);
```
(Plus robuste à terme : filtrer sur `category_id` avec les constantes de `categoryResolver.ts`.)

---

## 5. P2

### R-09 · P2 · Bouton Retour Android : aucune gestion (`BackHandler` absent de tout `src/`)
- **Où** : tiroir de filtres (`MapView.tsx:1511`), fiche `PlaceDetailSheet`, `AddressDetailModal.tsx:159-160` (simple `View` en `position: absolute`, pas un `Modal`), `AdminPasswordModal.tsx:75` (idem). **Vérifié (code)** : aucune occurrence de `BackHandler` dans `src/`.
- **Constat** : Retour ferme l'application au lieu de fermer la fiche, le tiroir ou la saisie du code admin. Les `Modal` natifs (`NotificationSettingsModal.tsx:88`, `PrivacyPolicyModal.tsx:70`, `AdminPortalModal.tsx:986`) ont bien `onRequestClose`. La confirmation de suppression de l'admin (`AdminPortalModal.tsx:1958`) n'en a pas : Retour n'y fait rien (P3).
- **Correction** (même schéma pour chaque overlay, actif seulement s'il est ouvert et visible) :
```tsx
useEffect(() => {
  if (Platform.OS !== 'android' || !isOpen) return;
  const sub = BackHandler.addEventListener('hardwareBackPress', () => { close(); return true; });
  return () => sub.remove();
}, [isOpen]);
```
Pour `MapView`, ne l'activer que si l'onglet Carte est l'onglet actif (passer `isActive` depuis `index.tsx`).

### R-10 · P2 · Plein écran (edge-to-edge) obligatoire avec targetSdk 36 et aucune marge de sécurité utilisée
- **Où** : `MapView.tsx:1846` (barre de recherche `top: 36`), `:2004`, `:2124` ; `AddressDetailModal.tsx:560` (bouton Retour `top: 20` sur Android) et `:506` (`paddingBottom: 26`) ; `PlaceDetailSheet.tsx:478-480` (`bottom: 0`) ; `PrivacyPolicyModal.tsx:9, 77`, `NotificationSettingsModal.tsx:9, 90` (`SafeAreaView` de `react-native`).
- **Statut** : plein écran obligatoire **Vérifié (bibliothèque)** : `@expo/prebuild-config/.../withEdgeToEdge.js` (« Android 16 makes edge-to-edge mandatory »), `targetSdk = 36` (`react-native/gradle/libs.versions.toml`). `SafeAreaView` de React Native est un simple `View` sur Android (`SafeAreaView.js`: `default: View`) et est déprécié. Aucun composant de la liste n'importe `react-native-safe-area-context` (seul `AdminPortalModal` le fait). Chevauchements réels **suspectés** (dépend de la hauteur de barre d'état et de la barre de navigation de l'appareil).
- **Constat** : barre de recherche, bouton Retour de la fiche et boutons du bas peuvent passer sous la barre d'état ou la barre de navigation. Le bouton Retour est le seul moyen de sortir de la fiche (R-09).
- **Correction** : `const insets = useSafeAreaInsets();` puis `top: insets.top + 8` / `paddingBottom: insets.bottom + 16`, et remplacer `SafeAreaView` de `react-native` par celui de `react-native-safe-area-context`.

### R-11 · P2 · Portail admin : verrouillage après inactivité repoussé par des rendus sans rapport, et absent en arrière-plan
- **Où** : `AdminPortalModal.tsx:154-166` (minuteur, dépendances `[onLogout, onClose]`), `:987` (`onTouchStart={resetIdleLock}`) ; fonctions fournies en ligne à chaque rendu de l'accueil : `HomeView.tsx:2557-2566`. `AppState` n'est utilisé nulle part dans ces fichiers.
- **Statut** : **Vérifié (code)** pour la dépendance instable et l'absence d'`AppState` ; effet en arrière-plan **suspecté**.
- **Constat** : (1) `onClose`/`onLogout` sont de nouvelles fonctions à chaque rendu de `HomeView` : `resetIdleLock` change, l'effet se relance et **le minuteur de 15 min repart de zéro** à chaque re-rendu de l'accueil (likes, événements, synchronisations…), même sans action de l'utilisateur. (2) Le minuteur JS n'est pas lié au cycle de vie : appli en arrière-plan, le code reste en mémoire jusqu'au réveil du minuteur. (3) Les touches dans la `Modal` de confirmation (`:1958`) ne remontent pas à la vue racine du portail.
- **Bon point** : le code est bien effacé à la fermeture, à la déconnexion et à la réinitialisation de l'`ErrorBoundary` (`HomeView.tsx:2550, 2558, 2563`).
- **Correction** :
```tsx
const cbRef = useRef(onLogout ?? onClose); cbRef.current = onLogout ?? onClose;
const resetIdleLock = useCallback(() => {
  if (idleTimer.current) clearTimeout(idleTimer.current);
  idleTimer.current = setTimeout(() => cbRef.current(), ADMIN_IDLE_LOCK_MS);
}, []);                                            // identité stable
useEffect(() => {                                  // verrouiller au retour si absent trop longtemps
  let leftAt = 0;
  const sub = AppState.addEventListener('change', (s) => {
    if (s === 'background') leftAt = Date.now();
    else if (s === 'active' && leftAt && Date.now() - leftAt > 2 * 60_000) cbRef.current();
  });
  return () => sub.remove();
}, []);
```
(Ne pas verrouiller dès le passage en arrière-plan : le sélecteur de photos Android peut le déclencher pendant un téléversement.)

### R-12 · P2 · Portail admin : téléversement d'images
- **Où** : `AdminPortalModal.tsx:117-140, 484-532`, `app.json` (`blockedPermissions`), `src/lib/supabase.ts:8, 53`.
- **Statut** : **Vérifié (code et bibliothèque)** ; effet sur appareil non essayé.
- **Constat** :
  1. `requestMediaLibraryPermissionsAsync()` (l. 485, 510) demande `READ/WRITE_EXTERNAL_STORAGE` sur Android 12 et moins (`expo-image-picker/android/.../ImagePickerModule.kt:258-266`), or `app.json` **bloque** ces deux permissions : la réponse est « refusé » et l'admin ne peut jamais choisir une photo sur ces appareils (minSdk 24). Sur Android 13+ la liste est vide, donc pas de problème. Le sélecteur de photos du système n'exige aucune permission : supprimer l'appel.
  2. Aucune vérification de taille ni de type : le type est imposé à `image/jpeg` (l. 498, 523), l'extension en découle (l. 123). Un PNG recadré serait envoyé avec un mauvais type MIME.
  3. Le délai global de 10 s de Supabase (`supabase.ts:53`) s'applique aussi aux envois de fichiers : une photo de plusieurs Mo sur une connexion faible est annulée (« Erreur téléversement »).
  4. `MediaTypeOptions` est déprécié (`ImagePicker.types.d.ts:19`) ; il fonctionne encore.
  5. L'envoi se fait avec la clé publique (stockage anonyme, point N-10 déjà ouvert dans le suivi).
- **Correction** :
```ts
const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.8 });
const a = res.assets?.[0]; if (!a) return;
if ((a.fileSize ?? 0) > 5 * 1024 * 1024) { showAlert('Image trop lourde', '5 Mo maximum.'); return; }
const mime = ['image/jpeg', 'image/png', 'image/webp'].includes(a.mimeType ?? '') ? a.mimeType! : 'image/jpeg';
await uploadMediaToSupabase(a.uri, 'etablissements', 'covers', mime);
// supabase.ts : délai plus long pour le stockage
global: { fetch: (i, init) => withTimeout(fetch, String(i).includes('/storage/v1/') ? 60_000 : 10_000)(i, init) }
```

### R-13 · P2 · Portail admin : 790 fiches rendues d'un coup avec `Image` de React Native, calculs faits même fermé
- **Où** : `AdminPortalModal.tsx:1095-1143` (`filteredSpots.map` dans un `ScrollView`, `Image` de `react-native` avec l'URL brute, l. 1106), `:954-965` (filtre exécuté avant le `if (!visible) return null` de `:983`).
- **Statut** : **Vérifié (code)** ; impact mémoire **suspecté**.
- **Constat** : l'onglet par défaut monte 790 cartes avec 790 images distantes non redimensionnées (`imageOptimizer` n'est pas utilisé), sans virtualisation. Risque de lenteur ou de mémoire sur Android d'entrée de gamme.
- **Correction** : `FlatList` (`initialNumToRender={12}`, `windowSize={5}`) et `Image` d'`expo-image` avec `getOptimizedImageUrl`.

### R-14 · P2 · Onglet Notifications du portail : formulaire non défilable
- **Où** : `PushAdminPanel.tsx:77-138` (racine = `View`, pas de `ScrollView`), monté tel quel en `AdminPortalModal.tsx:1525`.
- **Statut** : **Vérifié (code)**.
- **Constat** : avec le clavier ouvert sur un petit écran, le champ « Message » et le bouton « Envoyer l'annonce » sortent de l'écran sans pouvoir défiler. (`AgendaAdminPanel` a son `ScrollView`.)
- **Correction** : envelopper le contenu dans `<ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.wrap}>`.

### R-15 · P2 · Premier appui avalé quand le clavier est ouvert (`keyboardShouldPersistTaps` absent)
- **Où** : `SearchView.tsx:107, 143` ; `AdminPortalModal.tsx:1095, 1150, 1281, 1396, 1531` (seul le sélecteur d'adresse en `:1646` l'a). **Vérifié (code)**.
- **Constat** : par défaut (`never`), le premier appui hors du champ actif ferme le clavier et n'est pas transmis aux boutons : il faut appuyer deux fois sur un résultat de recherche, un filtre rapide ou « Publier ».
- **Correction** : `keyboardShouldPersistTaps="handled"` sur ces `ScrollView`.

### R-16 · P2 · Fiche `PlaceDetailSheet` : glisser vers le bas quand elle est étendue la ferme au lieu de la réduire
- **Où** : `PlaceDetailSheet.tsx:161-177` (`useRef(PanResponder.create(...)).current`), test `isExpanded` en `:169`. **Vérifié (code)**.
- **Constat** : le `PanResponder` est créé au premier rendu et garde la valeur initiale `isExpanded === false` : un geste vers le bas, fiche étendue, appelle `onClose()` au lieu de `toggleExpand(false)`.
- **Correction** : `const expandedRef = useRef(false); expandedRef.current = isExpanded;` puis lire `expandedRef.current` dans le gestionnaire.

### R-17 · P2 · « Ma position » : position figée à la première mesure, sans réglages en cas de refus
- **Où** : `MapView.tsx:612-614` (retour immédiat de `userLocationRef.current`), `:792`, `:845`, `:1062-1073`. **Vérifié (code)** ; aucun `watchPositionAsync` n'est utilisé (donc pas de fuite d'abonnement).
- **Constat** : la première position obtenue est réutilisée indéfiniment pour recentrer et pour l'itinéraire (même après un déplacement de plusieurs kilomètres). Après un refus définitif, aucun lien « Ouvrir les réglages » (`NotificationSettingsModal.tsx:132` le fait pour les notifications, pas la carte).
- **Correction** : ne retourner le cache que s'il a moins de 60 s (`{ …coords, at: Date.now() }`), sinon refaire `getLastKnownPositionAsync` puis une mesure bornée (R-03).

### R-18 · P2 · Ouverture de la carte depuis une fiche : le recentrage peut être perdu
- **Où** : `MapView.tsx:309-337` (`animateToRegion` à la ligne 325, puis `clearFocusedSpot()` à la ligne 334), `index.tsx:43-47`. 
- **Statut** : **Vérifié (bibliothèque)** : `react-native-maps/.../MapView.java:1395-1396` ignore silencieusement la commande si `map == null` ; **suspecté** que ce soit le cas à la première ouverture (la carte Google s'initialise après le montage).
- **Constat** : « Sur la carte » depuis la recherche ou l'accueil monte `MapView` pour la première fois ; l'effet appelle `animateToRegion` avant que la carte native soit prête et efface aussitôt `focusedSpotId` : pas de seconde tentative.
- **Correction** : mémoriser la cible (`pendingFocus` en `useRef`) et l'exécuter dans `onMapReady` de `NativeMapView`.

### R-19 · P2 · Travail lourd au démarrage de l'application
- **Où** : `MapView.tsx:82-92` (790 `formatRawAddress` + copie `LEAN_MAP_MARKERS` inutilisée), `placesRepository.ts:62` (constructeur : déjà 790 `formatRawAddress`), `searchIndex.ts:35-37` (constructeur), `dataStore.ts:58-62` (constructeur : **second** `updateSpots` sur le même jeu), `dataset.json` (1,9 Mo). `index.tsx:5-9` importe ces écrans statiquement.
- **Statut** : **Vérifié (code)** ; durée sur téléphone **suspectée** (de l'ordre de centaines de ms sur un appareil lent, non mesurée).
- **Constat** : tout cela s'exécute sur le fil JS avant le premier écran, même si l'utilisateur n'ouvre jamais Carte ou Recherche. Plus trois téléchargements de la table complète (`select('*')`, environ 2 Mo) au fil des onglets (`SearchView.tsx:67`, `AdminPortalModal.tsx:285`, `dataStore.ts:114`).
- **Correction** : supprimer `LEAN_MAP_MARKERS`, ne pas ré-indexer dans `dataStore` si les données n'ont pas changé, charger `SearchView`/`MapView` en `require` différé à la première visite de l'onglet.

### R-20 · P2 (web uniquement) · Carte web : `image_url` injecté tel quel dans le HTML de l'iframe
- **Où** : `mapboxHtmlTemplate.ts:354` (`'<img src="' + s.image_url + '" …'` assigné via `innerHTML`, l. 358), `:349` (classe `cat-…`), `:521` et `:775` (jeton public interpolé dans une chaîne JS), `:646` (pas de contrôle de l'expéditeur des messages), `MapView.tsx:251` (idem côté parent).
- **Statut** : **Vérifié (code)**. L'`iframe srcDoc` (`MapView.tsx:1093-1095`) a la même origine que la page : un attribut piégé s'exécuterait avec accès à `localStorage` et à `window.parent`. Les `image_url` ne s'écrivent que par `admin_write` (code admin), donc risque faible aujourd'hui.
- **Correction** : créer l'image par le DOM (`var img = document.createElement('img'); img.src = …`) et n'accepter que `https://` ; vérifier `event.source` des deux côtés.

### R-21 · P2 · Filtrage de la carte par effet + état (double rendu) et abonnement non libéré
- **Où** : `MapView.tsx:399-445` (`useEffect` → `setFilteredSpots`), `:190-215` (`discoveryStore.subscribe` à `:194`, jamais désabonné : seul `onAppEvent` est retourné en `:214`). **Vérifié (code)**.
- **Constat** : chaque frappe provoque deux rendus complets de 790 marqueurs (R-05) ; l'abonnement à `discoveryStore` fuit à chaque remontage de `MapView` (bouton « Réessayer »).
- **Correction** : `const filteredSpots = useMemo(() => spots.filter(…), [spots, searchQuery, …]);` et retourner `() => { unsubDiscovery(); offLikes(); }`.

### R-22 · P2 · Bouton « Annuler » du code admin n'annule pas une validation déjà acceptée
- **Où** : `AdminPasswordModal.tsx:48-56, 67-72`. **Vérifié (code)**.
- **Constat** : après réponse « vrai », `setTimeout(…, 350)` appelle `onSuccess(code)` sans condition ; un appui sur « Annuler » pendant ces 350 ms ferme la saisie mais le portail s'ouvre quand même. Les champs de code n'ont pas `importantForAutofill="no"` / `autoComplete="off"` (l. 103-118) : le gestionnaire de mots de passe d'Android peut proposer d'enregistrer la clé admin dans le compte Google de l'utilisateur (**suspecté**).
- **Correction** : mémoriser le minuteur et l'annuler dans `handleClose` ; ajouter `importantForAutofill="no" autoComplete="off" textContentType="none"`.

### R-23 · P2 · Géocodage BAN du portail : requête sans délai ni contrôle de statut
- **Où** : `AdminPortalModal.tsx:325-326` (`fetch` puis `res.json()` sans `res.ok`, `finally { setIsGeocoding(false) }` en `:341`). **Vérifié (code)** + OkHttp sans délai (R-04).
- **Constat** : sur réseau muet, le bouton « BAN » reste en attente indéfiniment ; une réponse d'erreur HTML donne un message de syntaxe JSON peu clair.
- **Correction** : `withTimeout(fetch, 8000)` et `if (!res.ok) throw new Error('Service d\'adresses indisponible')`.

---

## 6. P3 (regroupés)

| Id | Où | Constat |
|---|---|---|
| R-24a | `MapView.tsx:1116-1130` | `toolbarEnabled` non désactivé (Android : boutons Google « itinéraire » qui apparaissent au toucher d'un marqueur, par-dessus l'interface) ; `moveOnMarkerPress` par défaut. Suspecté. |
| R-24b | `MapView.tsx:2232-2236` | La mise à l'échelle du marqueur sélectionné (`scale(1.35)`) dépasse les bornes de la vue : sur Android, le bitmap est rogné. Suspecté. |
| R-24c | `MapView.tsx:980-981, 997-998` | `Linking.canOpenURL('google.navigation:…')` renvoie faux sur Android 11+ sans entrée `<queries>` : le repli web Google Maps est toujours pris. Fonctionne, mais le schéma natif n'est jamais utilisé. Suspecté. |
| R-24d | `MapView.tsx:987, 991, 1004, 1008, 1016, 1032-1034` ; `AddressDetailModal.tsx:373` ; `HomeView.tsx:341` (hors liste) | `Linking.openURL(...)` sans `.catch` (rejet non géré si aucun lanceur) ; `window.location.href` dans un `catch` natif en `HomeView.tsx:341`. |
| R-24e | `MapView.tsx:814-818, 853-876` | `Alert.alert` est un **no-op** sur web (`react-native-web/.../Alert/index.js`) : aucun message sur le web pour « Position indisponible » et « Position GPS requise » (utiliser `showAlert`, déjà défini l. 107). |
| R-24f | `mapboxHtmlTemplate.ts:658-660`, `MapView.tsx:319` ; `:292-295` | Web : `FOCUS_SPOT` lit `data.id` que le parent n'envoie pas (marqueur désélectionné) ; `ROUTE_ERROR` n'a pas le repli annoncé en commentaire ; `fetch` du tracé sans délai (`:780`). |
| R-24g | `MapView.tsx:1371-1377` ; `SearchView.tsx:113` | Effectifs en dur (« Tous (790) », « Restos (286) »…) : faux dès qu'une adresse est ajoutée via le portail. |
| R-24h | `MapView.tsx:241, 470-475, 505-509, 1428-1459, 85-92` ; `AddressDetailModal.tsx:12-13` | Code mort : `slideAnim` (animation sans vue liée), `showFullAddressModal` jamais mis à `true`, `LEAN_MAP_MARKERS`, imports `SafeAreaView`/`FlatList` inutilisés, import placé en fin de ligne `:123`. |
| R-24i | `MapView.tsx:1603-1624` | Le curseur de budget « glissable » n'existe que sur le web (`<input type="range">`) ; sur mobile seuls les 5 boutons prédéfinis fonctionnent (le titre « Budget draggable » induit en erreur). |
| R-24j | `AdminPortalModal.tsx:457-458, 431, 713-714` | À la création, `is_recommended` et `is_new` sont forcés à `true` malgré les cases du formulaire (déclenche la notification « nouvelle adresse ») ; image Unsplash et lien de réservation par défaut injectés sans prévenir ; latitude/longitude vides remplacées par le centre de Toulouse (l. 398-399). Pas de validation du lien (`safeWebUrl`) à la saisie. |
| R-24k | `AdminPortalModal.tsx:196` | Un seul drapeau `isUploading` pour enregistrement d'adresse, catégorie, événement et photos : une opération pendante bloque les autres boutons. |
| R-24l | `NotificationSettingsModal.tsx:48-54, 103-104` | `refresh()` sans `try/catch` : si la lecture échoue, le spinner reste indéfiniment (peu probable : `getPushState` rattrape ses erreurs). |
| R-24m | `AdminPortalModal.tsx:1958` | `Modal` de confirmation sans `onRequestClose` : le bouton Retour d'Android n'y fait rien. |
| R-24n | `src/app/index.tsx:184-187` (hors liste) | Onglets masqués par `opacity: 0` : la carte native reste montée et continue de dessiner sous les autres onglets (batterie) ; sur Android la carte Google est une `SurfaceView` (comportement du masquage par opacité à vérifier). Envisager de démonter la carte ou de la mettre en pause quand l'onglet n'est pas actif. Suspecté. |
| R-24o | `AdminPortalModal.tsx:1037` ; `AgendaAdminPanel.tsx` | `Agenda (n)` n'est connu qu'après ouverture de l'onglet (le compteur vit dans le panneau). Cosmétique. |

### Accessibilité de base (vérifié dans le code)
- **Étiquettes** : `MapView` n'a de `accessibilityLabel` que sur 6 commandes (effacer, filtres, 3D, vue d'ensemble, ma position, fermer l'itinéraire) ; aucune `accessibilityRole` ni `accessibilityState` (pastilles de catégorie, interrupteur « Ouvert actuellement » `:1711`). `PlaceDetailSheet.tsx:279` garde « Ajouter aux favoris » même quand c'est un favori (`AddressDetailModal.tsx:209` le fait bien) ; le bouton de fermeture `:467` et la miniature `:221` n'ont pas d'étiquette. `AdminPasswordModal.tsx:85` (X de fermeture) et le champ du code n'ont pas d'étiquette. Les `TextInput` du portail n'ont que des libellés visuels.
- **Zones tactiles < 44 dp** : bouton fermer du tiroir de filtres **20 × 20** sans `hitSlop` (`MapView.tsx:1520, 2468-2472`) ; `searchClearBtn` et `itineraryCloseBtn` 28 × 28 (`:1882, 2112`) ; `itineraryExternalBtn` ≈ 27 dp de haut (`:2099`) ; puces de budget et sous-onglets ≈ 24-33 dp (`:2518, 2623`) ; boutons modifier/supprimer du portail 34 × 34 (`AdminPortalModal.tsx:2241, 2582`) et pastille de suppression de photo 20 × 20 (`:2386`) ; X de `AdminPasswordModal` ≈ 38 dp. `AgendaAdminPanel` et `PushAdminPanel` respectent 44 dp (`Touch.min`).

---

## 7. Ce qui est conforme (vérifié)

- **Gardes web** : `<iframe>`, `<input type="range">`, `navigator.vibrate`, `window.alert/confirm` sont tous derrière `Platform.OS === 'web'` (`MapView.tsx:107-122, 1092, 1603`, `PlaceDetailSheet.tsx:85-93`, `AdminPortalModal.tsx:109-115`, `NotificationSettingsModal.tsx:33-36`, `PrivacyPolicyModal.tsx:29-32, 59-62`, `PushAdminPanel.tsx:18-21, 67`). `crypto.randomUUID` est testé avant usage (`AdminPortalModal.tsx:68-77`). `localStorage` est toujours testé (`window.localStorage` est `undefined` sous Hermes, pas d'exception). Hors R-01, il n'y a plus d'écoute `window` dans `src/`.
- **`react-native-maps`** : chargé dans un `try/catch` (`MapView.tsx:59-71`) ; version `1.27.2` identique à celle de `expo/bundledNativeModules.json` ; clé Google injectée par `android.config.googleMaps` et refusée en `production` si absente (`app.config.js:14-24`) ; `showsUserLocation` sans permission est protégé par la bibliothèque (`MapView.java` `hasPermissions()`).
- **Hooks** : tous les `return` conditionnels viennent après le dernier hook (`MapView.tsx:1049`, `PlaceDetailSheet.tsx:179`, `AddressDetailModal.tsx:133`, `AdminPasswordModal.tsx:34`, `AdminPortalModal.tsx:983` : aucun hook après).
- **Boucles** : pas de boucle de rendu ni d'effet sans fin repérée ; aucun `watchPosition` (donc rien à nettoyer) ; les effets d'abonnement `appEvents` retournent leur désabonnement.
- **Réseau Supabase** : délai de 10 s sur toutes les requêtes (`supabase.ts:8, 53`), erreurs rattrapées dans le portail, `PushAdminPanel` (`pushAdmin.ts`) et `AgendaAdminPanel`.
- **Liens** : site web et téléphone passent par `safeWebUrl` / `safeTelUrl` (`PlaceDetailSheet.tsx:408-425`, `AddressDetailModal.tsx:394`) ; le numéro de `AddressDetailModal.tsx:372` est réduit aux chiffres et au `+` ; les URL d'itinéraire ne contiennent que des nombres ou du texte passé par `encodeURIComponent`.
- **Permission de localisation** : aucune demande au lancement ; lecture simple puis demande sur action de l'utilisateur ; pas de localisation en arrière-plan (`app.json`, plugin `expo-location`). La politique (`PrivacyPolicyModal.tsx:146-150`) correspond au comportement du code (position non envoyée aux serveurs, transmise à Mapbox pour l'itinéraire).
- **Code admin** : tenu en mémoire dans une `ref` (`HomeView.tsx:536, 2538`), jamais écrit dans `SecureStore` / `localStorage` / `AsyncStorage` (aucun accès au stockage dans les fichiers admin), jamais journalisé (aucun `console.*` n'inclut le code), effacé à la fermeture, à la déconnexion, au verrouillage et à la réinitialisation de l'`ErrorBoundary`, vérifié uniquement par le serveur (`verify_admin_access`, `admin_write`) et envoyé en corps de requête (jamais dans l'URL). Réserves : R-11, R-22.
- **Actions irréversibles** : confirmation avant suppression (portail, agenda, annonce push, effacement des données).
- **Cibles et styles** : `Touch.min = 44` respecté dans les panneaux d'agenda et de notifications.

## 8. Remarqué hors périmètre (à relayer)

- `src/app/index.tsx` monte tous les onglets déjà visités et les masque par `opacity: 0` (R-24n).
- `src/components/views/HomeView.tsx:341` : `window.location.href` dans un `catch` natif (provoque une erreur dans le `catch`).
- `eas.json` ne fournit ni clé Google Maps ni jeton Mapbox au profil `preview` (à confirmer dans les variables EAS).
- La clé publique Supabase figure en clair dans `eas.json` et comme valeur de repli dans `src/lib/supabase.ts` : c'est une clé publique (rôle `anon`), attendu, mais le repli en dur masquerait un oubli de variable en `production`.

## 9. Recette à jouer sur un téléphone Android (après correctifs R-01 à R-08)

1. Installer l'APK, aller à l'onglet **Carte** : plus d'écran « Oups ». Fond de carte visible (si clé fournie) ou conscient (tuiles grises, R-06).
2. Premier lancement, permission non accordée : le mur s'affiche ; « Continuer sans géolocalisation » ; **attendre 15 s** (le temps que la base réponde) : le mur ne revient pas (R-02).
3. Refuser deux fois la permission : le bouton « Géolocalisez-moi » ne reste pas muet (R-17).
4. Autoriser la localisation, GPS coupé puis intérieur sans GPS : « Ma position » et l'itinéraire n'attendent pas plus de ~8 s (R-03).
5. Mode avion, puis toucher « itinéraire » : bascule sur l'appli Maps externe en moins de ~12 s, spinner arrêté (R-04).
6. Ouvrir la carte avec les 790 adresses : durée d'ouverture, fluidité du zoom, taper « bar » dans la recherche (R-05). Mesurer avec `adb shell dumpsys meminfo fr.lepetittou.app` avant/après.
7. Recherche : « Restaurants », « Bars » (filtres rapides) renvoient des résultats ; « Afficher plus » apparaît au-delà de 24 résultats (R-08).
8. Appuyer sur Retour dans : fiche d'une adresse, tiroir de filtres, saisie du code admin, portail admin (R-09).
9. Téléphone à encoche et barre de navigation à 3 boutons : barre de recherche, bouton Retour de la fiche, boutons du bas non masqués (R-10).
10. Portail admin : laisser l'accueil se rafraîchir (changer d'onglet, aimer une adresse) puis vérifier le verrouillage à 15 min d'inactivité ; mettre l'appli 3 min en arrière-plan puis revenir (R-11). Importer une photo sur Android 12 et sur Android 14 (R-12). Ouvrir l'onglet Notifications avec le clavier (R-14).
11. Vérifier côté base qu'un appel anonyme `GET /rest/v1/sponsored_partners?select=price_paid` n'aboutit plus (R-07).

---

## 10. Résumé (≤ 15 lignes)

1. Périmètre relu intégralement (11 fichiers, dont MapView 2 782 l. et AdminPortalModal 2 680 l.) ; analyse statique, rien exécuté sur appareil.
2. **P0 R-01** — `MapView.tsx:301-304` : `window.addEventListener` sans garde `Platform.OS`, inexistant sous Hermes : l'onglet Carte tombe sur « Oups » sur Android. Garder l'effet par `Platform.OS === 'web'`.
3. **P1 R-02** — `MapView.tsx:248, 306` : `checkPermission()` relancé à chaque changement de `spots` : le mur de permission revient après « Continuer sans géolocalisation ».
4. **P1 R-03** — `MapView.tsx:611, 674-676, 840-882` : position native sans délai maximal : spinner d'itinéraire infini, « Ma position » muet.
5. **P1 R-04** — `MapView.tsx:919-921` : appel Mapbox Directions sans délai (RN Android n'a aucun délai par défaut).
6. **P1 R-05** — `MapView.tsx:1132-1157` : 790 marqueurs à vues personnalisées sans clustering ni `memo` ; `tracksViewChanges` à `false` dès le montage (gel/mémoire, icônes vides, suspecté).
7. **P1 R-06** — `app.config.js:43` : clé Google factice hors production : fond de carte absent sur l'APK `preview` ; fournir la clé (restreinte) à `preview`.
8. **P1 R-07** — `006_security_lockdown.sql:109-121` + `AdminPortalModal.tsx:773-776` : `sponsored_partners.price_paid` lisible avec la clé publique (P0 si jugé confidentiel).
9. **P1 R-08** — `searchIndex.ts:48, 169` + `SearchView.tsx:102, 215` : les 9 filtres rapides renvoient toujours 0 résultat (`category` absent des données) ; « Afficher plus » inatteignable.
10. P2 notables : Retour Android non géré (R-09), plein écran Android 16 sans marges de sécurité (R-10), verrouillage admin repoussé par les rendus de l'accueil et absent en arrière-plan (R-11, `AdminPortalModal.tsx:154-166`), import de photo bloqué sur Android ≤ 12 et sans contrôle taille/type (R-12), formulaire notifications non défilable (R-14), `keyboardShouldPersistTaps` absent (R-15).
11. Code admin : en mémoire seulement, non journalisé, effacé à la fermeture ; verrouillage 15 min présent mais perfectible.
12. Aucun secret n'est reproduit ; les corrections proposées sont des extraits courts à valider.
