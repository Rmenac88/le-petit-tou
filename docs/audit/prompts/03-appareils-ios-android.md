# Mission A — Compatibilité iPhone, iPad et Android, tous formats d'écran

Préfixe des constats : **A-xx**. Rapport : `docs/audit/12-APPAREILS.md`.
Lis d'abord `00-contexte-commun.md`.

## Objectif
Vérifier que l'application est utilisable et lisible sur **tous les appareils réalistes** : petits iPhone (SE / 17e), grands iPhone (Pro Max), iPad (mini → 13"),
Android compact (320–360 dp) à grand (412+ dp), tablettes, pliables, avec réglages d'accessibilité (texte agrandi jusqu'à 200 %, gras, mouvement réduit, mode sombre/clair, zoom d'affichage).

## Méthode

### 1. Analyse statique du code (tout `src/`)
- Dimensions codées en dur (`width:`/`height:` en nombres, `Dimensions.get`, `useWindowDimensions`, `Platform.OS`), zones sûres (`SafeAreaView`/`useSafeAreaInsets`) : encoche, Dynamic Island, barre de gestes Android, barre de navigation à trois boutons.
- **Dock flottant** et feuilles modales : chevauchement avec le contenu, hauteur minimale d'écran, clavier (`KeyboardAvoidingView`, champs du portail admin), `windowSoftInputMode` Android.
- Texte : `allowFontScaling` / `maxFontSizeMultiplier`, textes tronqués (`numberOfLines`), débordements avec police agrandie, langue française longue (« Restaurants & Gastronomie »), boutons à largeur fixe.
- Zones de toucher ≥ 44 pt (iOS) / 48 dp (Android), contrastes (calcule le rapport pour les couples de couleurs de `src/constants/brand.ts` : texte secondaire sur fond, blanc sur rose brique, jaune sur blanc), cibles sans libellé d'accessibilité.
- Orientation (`orientation` dans `app.json`), thème (`userInterfaceStyle`), tablette (`supportsTablet`), pliables, retour système Android (bouton retour dans les modales/feuilles), plein écran, barre d'état.
- Performance sur appareils modestes : listes (`FlatList`/`ScrollView` avec centaines d'éléments), images (taille, `expo-image` cache), nombre de re-rendus, animations Reanimated sur le fil JS, WebView de la carte (mémoire), temps de démarrage mesuré par `startupTrace`.
- Différences iOS/Android/web : composants ou API non disponibles sur une plateforme, comportements `Platform.select`.

### 2. Essais réels sur simulateurs iOS (tu en disposes)
- Appareils disponibles : `xcrun simctl list devices available` (par exemple iPhone 17e, iPhone 18 Pro Max, iPad mini, iPad Pro 11"/13"). Démarre-en un seul à la fois (`xcrun simctl boot`), ouvre la version web servie en local (`http://localhost:8081`, lance `npx expo start --web --port 8081` en arrière-plan s'il ne tourne pas) et fais des captures (`xcrun simctl io <udid> screenshot <fichier>`).
- Pour chaque appareil : accueil, recherche, carte, offres, agenda, profil, une fiche d'adresse, la feuille de notifications ; en mode texte agrandi (`xcrun simctl ui <udid> content_size accessibility-extra-large`) et en mode sombre (`xcrun simctl ui <udid> appearance dark`), puis remets les réglages par défaut.
- Enregistre les captures **hors du dépôt** : dans le dossier temporaire de session (`$TMPDIR`) ; cite leur chemin dans le rapport. Ne conserve aucun simulateur démarré à la fin (`xcrun simctl shutdown all`).
- **Limite à écrire noir sur blanc** : ces essais portent sur la version **web** de l'application dans Safari du simulateur, pas sur l'application native (WebView de la carte, notifications, polices natives non couverts).

### 3. Android
Aucun émulateur Android n'est installé sur cette machine (`adb`/`emulator` absents) : l'analyse Android est **DÉDUITE du code et de la configuration** (`app.json`, `app.config.js`, `eas.json`, permissions, icônes adaptatives, `android.package`, FCM, `allowBackup`).
Liste précisément ce qu'il faudrait tester sur un vrai Android et fournis une **checklist de recette** de 15 à 25 étapes (appareil bas de gamme inclus), à jouer par l'équipe.

### 4. Matrice de compatibilité
Tableau appareil × fonctionnalité (accueil, recherche, carte, fiche, profil, offres, agenda, notifications, portail admin) avec : `OK vérifié` / `OK déduit` / `problème` / `non testé`.

## Définition de « terminé »
Au moins 4 formats d'écran iOS réellement essayés (petit, standard, grand, iPad) avec captures référencées, chaque problème visuel décrit avec son fichier source, la matrice remplie, la checklist Android, les constats A-xx classés.
