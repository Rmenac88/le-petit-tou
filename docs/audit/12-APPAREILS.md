# 12 — Compatibilité appareils et formats d'écran (iPhone, iPad, Android) — 2 novembre 2026

Mission A, préfixe A-xx. Aucun fichier de l'application modifié, aucun commit. Aucun secret reproduit.

## 1. Résumé pour le commanditaire

**Verdict : publiable sous conditions.** Sur tous les formats essayés (320 à 768 px de large) rien ne déborde ni ne casse, mais la tenue avec le texte agrandi, sur Android (barre de navigation, bouton retour) et sur iPad n'a pas pu être prouvée, et trois points sont à traiter avant l'envoi aux boutiques.

Points les plus importants :
1. **Les essais sur simulateur iOS ont été très limités** : un seul appareil (iPhone 17e) a pu être essayé, puis le runtime iOS 27 du Mac a disparu en cours de mission (voir §2). Les autres formats ont été essayés dans le navigateur du Mac, ce qui n'est pas Safari iOS.
2. **A-01** : aucun réglage de texte agrandi (`allowFontScaling` / `maxFontSizeMultiplier` : 0 occurrence) alors que des hauteurs sont fixes (barre de recherche 54, dock 64) : risque réel à 150–200 % sur Android et iOS. Non prouvé.
3. **A-02** : le dock flottant est posé à 34 px du bas, sans tenir compte de la barre système Android (3 boutons ou gestes) : chevauchement probable.
4. **A-03** : `supportsTablet: true` avec `orientation: portrait` : l'envoi à App Store Connect peut donner un avertissement iPad (multitâche) ; décision à prendre.
5. **A-04** : aucun `BackHandler` : le bouton retour d'Android quitte l'appli au lieu de fermer fiches et fenêtres (déjà connu : 05a P2-4).

Android : un émulateur **Pixel 6 (API 35, 411×914 dp, navigation par gestes)** a finalement été disponible ; il a servi pour **l'accueil seulement** (version web dans Chrome, pas l'application native). Le reste de l'analyse Android est DÉDUIT du code. Ensuite Chrome a affiché « Chrome isn't responding » (voir §2) : l'émulateur n'a plus permis d'autres essais.

## 2. Ce qui a été testé, et ce qui ne l'a pas été

| Élément | Méthode | Résultat | Statut |
|---|---|---|---|
| iPhone 17e (390×844 pt), accueil, Safari du simulateur | `xcrun simctl boot`, `openurl http://localhost:8081`, capture `$TMPDIR/audit-appareils/iphone17e-accueil.png` (fichier réel : `/private/var/folders/1w/v6x4916j51jfrmbsydny319w0000gn/T/audit-appareils/iphone17e-accueil.png`) | Accueil complet, rien coupé ; le dock chevauche la photo du premier partenaire (design translucide) ; « Mode, Fr… » défile horizontalement (normal) ; la barre d'adresse de Safari reste sous le dock | VÉRIFIÉ |
| Autres écrans / formats sur simulateur (iPhone Pro Max, iPad, texte agrandi, mode sombre) | Prévu | **Impossible** : après la première capture, `xcrun simctl list runtimes` est devenu vide et tous les appareils « unavailable (runtime profile not found) » ; `boot` répond « cannot determine the runtime bundle ». Cause probable : runtime iOS 27 démonté par le système (hors de mon contrôle). Rien n'a été réglé sur l'appareil (aucune réinitialisation à faire) ; `simctl shutdown all` exécuté, 0 simulateur démarré. | NON TESTÉ |
| Remplacement : navigateur du Mac (volet Browser) émulant 320×568, 430×932, 768×1024, version web sur `localhost:8081` | Script JS : débordement horizontal (`scrollWidth`), éléments hors cadre non défilants, texte tronqué sans ellipse, pour les 5 onglets | **0 débordement, 0 texte coupé** aux 3 tailles ; 430 testé aussi après agrandissement sans rechargement : idem. Écart dock/bas : 33–35 px | VÉRIFIÉ (web, pas Safari iOS) |
| Observations à 320×568 (captures du volet Browser, non enregistrées) | Visuel | « VOTRE CITY-GUIDE GRATUIT » tronqué en « …», placeholder de recherche « Rechercher (789 adres » coupé, dock au-dessus du contenu | VÉRIFIÉ (web) |
| 768×1024 | Visuel | Colonne limitée à 720 px, centrée ; cartes de largeur fixe (280) : interface « téléphone » étirée, lisible | VÉRIFIÉ (web) |
| Onglet Carte, fiche d'adresse, profil, feuille de notifications, portail admin, texte 200 %, mode sombre, mouvement réduit, zoom d'affichage | — | Non rejoués (simulateur perdu ; les écrans dépendent de la géolocalisation ou d'un code admin interdit) | NON TESTÉ |
| Contrastes des couleurs de `src/constants/brand.ts` | Calcul WCAG en Python | voir A-05 | VÉRIFIÉ |
| Dimensions, zones sûres, texte, retour Android, configuration, icônes | Lecture de `src/`, `app.json`, `app.config.js`, `eas.json`, `assets/` | voir constats | VÉRIFIÉ ou DÉDUIT |
| Pixel 6 (API 35), accueil, Chrome de l'émulateur, `http://10.0.2.2:8081`, navigation par gestes | `adb shell am start`, capture `$TMPDIR/audit-appareils/pixel6-accueil.png` | Accueil complet à 411 dp : rien coupé ni débordant ; en-tête, recherche (« Rechercher (789 adresses)… » entier), carte de progression, catégories, partenaires « SPONSORISÉ » lisibles ; le dock (bas à ≈ 34 dp) est au-dessus de la barre de gestes (une fine barre, ≈ 24 dp) sans la toucher | VÉRIFIÉ (web dans Chrome) |
| Pixel 6, texte système à 200 % (`settings put system font_scale 2.0`) | capture `pixel6-texte200.png` (écran Chrome, voir remarque) | Chrome a agrandi sa propre interface (barre d'adresse) mais **pas le texte de la page web** : cet essai ne dit **rien** sur l'appli native (qui, elle, suit la taille de texte système). A-01 reste DÉDUIT. Réglage remis à 1.0 (vérifié) | NON TESTÉ (natif) |
| Pixel 6, onglets recherche / carte / offres / agenda | taps `adb shell input` sur le dock | Chrome affiche « Chrome isn't responding » (3 captures `pixel6-search.png`, `pixel6-carte.png`, `pixel6-agenda.png`, `pixel6-recharge.png`) après rechargement de la page ; deux « Wait » n'ont pas suffi. Cause non établie : émulateur lent (ARM émulé, un autre processus lourd sur le Mac) ou page lourde ; **ne pas conclure sur l'appli**. Émulateur éteint (`adb emu kill`, aucun appareil restant) | NON TESTÉ |
| Navigation 3 boutons, appareil bas de gamme, petit écran Android, tablette | Non essayés (émulateur bloqué ; pas d'autre AVD créé) | — | NON TESTÉ |

Limite : les essais d'écran portent sur la **version web**, pas sur l'application native (WebView de la carte, notifications, polices natives non couverts).

## 3. Déjà vérifié, à ne pas refaire (et mises à jour)

- 08 : audit 375×812 et 320×568 sur le web : confirmé par mes mesures (0 débordement).
- 05a P0-1 (écran blanc si polices) : **corrigé** : `src/app/_layout.tsx:44-60` (secours à 4 s). 05a P1-3 (790 `Marker` natifs) : **périmé**, la carte est maintenant une WebView Mapbox (`MapView.tsx:60-67`, plus de `react-native-maps`).
- 05a P2-4 (pas de `BackHandler`), P2-5 (dock sans marge système), P2-7 (`Dimensions.get` figé) : **toujours vrais** (repris en A-02, A-04, A-06).

## 4. Constats

### A-01 — P1 — Texte agrandi non géré — DÉDUIT
- Preuve : `grep -rnE "allowFontScaling|maxFontSizeMultiplier" src` → 0 ligne. Hauteurs fixes : barre de recherche `height: 54` (`src/components/views/home/homeStyles.ts:122,132`), dock `height: 64` (`FloatingDock.tsx:~171`), zones à 52/56 px (`homeStyles.ts:539,789`). 161 déclarations à `fontSize: 12`, 67 à 13.
- Impact : avec le réglage de taille de texte de l'iPhone (jusqu'à « Accessibilité XXXL ») ou de l'Android (200 %), le texte grossit partout ; les libellés en français longs (« Restaurants & Gastronomie ») et les champs à hauteur fixe peuvent se couper ou se chevaucher. Non testé (simulateur perdu).
- Correctif : essayer sur un vrai téléphone à 150 % et 200 % ; plafonner (`maxFontSizeMultiplier` ≈ 1.3) les éléments à hauteur fixe (dock, barre de recherche, puces) et laisser grandir le reste ; remplacer les hauteurs fixes par `minHeight`. Effort : M.

### A-02 — P1 — Dock flottant sans marge de la barre système Android — DÉDUIT (gestes : OK vérifié sur Pixel 6 web ; 3 boutons : non testé)
- Preuve : `FloatingDock.tsx:152` `bottom: 34` fixe, aucun `useSafeAreaInsets` ; contenu `paddingBottom` fixes (ex. `AddressDetailModal.tsx` 130). Expo SDK 57 / RN 0.86 impose l'affichage bord à bord sur Android.
- Impact : avec la navigation à 3 boutons (≈ 48 dp) ou la barre de gestes, le dock (64 px) peut être partiellement sous la barre système ; sur iPhone, 34 correspond à l'indicateur d'accueil (OK, vu sur la capture 17e côté web).
- Correctif : `bottom: Math.max(insets.bottom, 12) + 14` ; tester Android 3 boutons et gestes. Effort : S.

### A-03 — P1 — iPad : `supportsTablet: true` mais `orientation: "portrait"` — DÉDUIT
- Preuve : `app.json:5,13`.
- Impact : App Store Connect avertit (multitâche iPad exige toutes les orientations ou le plein écran obligatoire) ; sur iPad, l'appli est bloquée en portrait et le Split View n'est pas géré (A-05). Interface étirée en colonne 720 px (vérifié en 768 web).
- Correctif : choisir entre ne pas déclarer l'iPad (`supportsTablet: false`) pour la v1, ou `orientation: "default"` après essai sur iPad. Décision de l'association. Effort : S.

### A-04 — P2 — Pas de bouton retour système Android — VÉRIFIÉ
- Preuve : `grep -rn BackHandler src` → 0 ; 12 `Modal` ont `onRequestClose` (fermés par retour), mais fiches, filtres, profil, carte n'en ont pas (profil : retour = quitter l'appli).
- Impact : retour = fermeture de l'appli depuis un onglet ou la fiche (reprend 05a P2-4). Effort : S.

### A-05 — P2 — Dimensions de l'écran figées à l'import — VÉRIFIÉ (code)
- Preuve : `HomeView.tsx:311,1514,1564`, `homeStyles.ts:4`, `PlaceDetailSheet.tsx:39`, `MemberCard.tsx:31-32` (`CARD_WIDTH`), `AddressDetailModal.tsx:44,567-573` (image de la fiche = largeur figée), `MapView.tsx:82,259,566`.
- Impact : rotation d'iPad, dépliage d'un pliable, Split View, fenêtre redimensionnée : hauteurs de fenêtres et largeur de la carte Pass fausses. Faible sur téléphone portrait fixe. Remplacer par `useWindowDimensions`. Effort : M.

### A-06 — P2 — Contrastes insuffisants sur quelques couples — VÉRIFIÉ (calcul)
| Couple | Rapport | Où |
|---|---|---|
| `inkMute` #9A9AA8 sur blanc | 2,78:1 | textes 11-12 px : `NotificationWelcomeModal.tsx:163`, `ListEditorModal.tsx:119`, `MyListsSection.tsx:114` |
| blanc sur `primary` #E84A5F | 3,77:1 | boutons 15-16 px gras : `NotificationWelcomeModal.tsx:152-160`, `NotificationSettingsModal.tsx:214-215`, `ErrorBoundary.tsx` (seuil 4,5:1 pour du texte non « grand ») |
| `chouchou` #F2B835 sur blanc | 1,80:1 | non utilisé comme texte sur blanc (utilisé sur fond sombre, OK) |
| `inkSoft` sur `bg` / blanc | 5,05 / 5,32 | OK |
| blanc sur `primaryDeep` / `primaryInk` / `successDeep` | 5,25 / 6,99 / 4,92 | OK |
Correctif : `primaryDeep` pour les fonds de bouton, `inkSoft` pour les notes. Effort : S.

### A-07 — P2 — Libellés d'accessibilité du dock en jargon anglais — VÉRIFIÉ
- Preuve : `FloatingDock.tsx:141` `accessibilityLabel={\`tab-${tab.type}\`}` ; pas de `accessibilityRole`/`accessibilityState`.
- Impact : VoiceOver/TalkBack lisent « tab-home ». Remplacer par « Accueil, Recherche, Carte, Offres, Agenda » + `selected`. Effort : S.

### A-08 — P3 — Textes tronqués sur très petit écran — VÉRIFIÉ (web 320×568)
« VOTRE CITY-GUIDE GRATUIT » → « VOTRE CITY-GUIDE … », « Rechercher (789 adres ». Acceptable ; raccourcir sous 350 px. Effort : S.

### A-09 — P3 — Dock translucide sur les photos — VÉRIFIÉ (capture 17e)
Le dock (blanc 88 %) masque une partie de la première carte partenaire ; faire défiler suffit. Ajouter une marge basse suffisante en fin de liste.

### A-10 — P3 — Incohérences de fenêtres modales — VÉRIFIÉ (code)
`NotificationSettingsModal.tsx:83` sans `statusBarTranslucent` (les autres l'ont) ; `AdminPasswordModal` sans évitement du clavier (une seule saisie, faible risque) ; le clavier recouvrant des champs du portail est déjà connu (08).

### A-11 — P3 — Thème sombre — DÉDUIT
`userInterfaceStyle: "light"` (`app.json:7`) : les téléphones en mode sombre gardent l'interface claire (voulu). Sur le web, `_layout.tsx:27` choisit un thème sombre de navigation alors que tous les écrans sont clairs : sans effet visible connu, non testé.

### Configuration Android lue (DÉDUIT, rien d'alarmant)
`android.package` `fr.lepetittou.app` ; `allowBackup: false` ; permissions limitées à la localisation, et caméra/micro/stockage bloqués ; icône adaptative (1024 px, monochrome 432 px) ; icône de notification 96 px ; `predictiveBackGestureEnabled: false` ; build de production refusé sans `GOOGLE_SERVICES_JSON` et jeton Mapbox (`app.config.js`). `orientation: portrait` convient aux pliables ouverts mais sera letterboxé. `versionCode` géré à distance (`eas.json`, `appVersionSource: remote`).

## 5. Matrice de compatibilité

| Appareil | Accueil | Recherche | Carte | Fiche | Profil | Offres | Agenda | Notifications | Portail admin |
|---|---|---|---|---|---|---|---|---|---|
| iPhone 17e (390 pt), Safari sim. | OK vérifié | non testé | non testé | non testé | non testé | non testé | non testé | non testé | non testé |
| iPhone SE/petit (320 px web) | OK vérifié (A-08) | OK vérifié (pas de débordement) | non testé (écran de géolocalisation vu) | non testé | non testé | OK vérifié | OK vérifié | non testé | non testé |
| Grand iPhone (430 px web) | OK vérifié | OK vérifié | non testé | non testé | non testé | OK vérifié | OK vérifié | non testé | non testé |
| iPad (768 px web) | OK vérifié (A-03) | OK vérifié | non testé | non testé | non testé | OK vérifié | OK vérifié | non testé | non testé |
| Android Pixel 6 (411 dp, gestes) | OK vérifié (web dans Chrome) ; natif déduit (A-01, A-02) | OK déduit | OK déduit (WebView) | OK déduit | OK déduit | OK déduit | OK déduit | non testé | problème possible (clavier, 08) |
| Texte 200 % / sombre / mouvement réduit | non testé | non testé | non testé | non testé | non testé | non testé | non testé | non testé | non testé |

Mouvement réduit : `useReducedMotion` est utilisé dans `FloatingDock.tsx` et `IntroScreen.tsx` (DÉDUIT : OK pour ces deux composants).

## 6. Checklist de recette Android (à jouer par l'équipe)

Appareils : un Android bas de gamme (2-3 Go, ex. Galaxy S10e déjà utilisé, ou plus modeste), un grand écran (≥ 412 dp), une tablette si possible.
1. Installer l'APK `preview` puis la version de production (AAB) ; vérifier le nom, l'icône adaptative (ronde, carrée) et l'icône monochrome (Android 13+).
2. Premier lancement : intro, puis fenêtre « On reste en contact ? ». Accepter, puis refuser une autre fois (données effacées).
3. Navigation 3 boutons : le dock est-il entièrement au-dessus de la barre ? Idem navigation par gestes (A-02).
4. Bouton retour depuis : fiche, filtres, profil, carte, fenêtre de notifications (A-04).
5. Réglages > Affichage > Taille de la police au maximum, puis taille d'affichage au maximum : parcourir accueil, recherche, filtres, fiche, profil (A-01).
6. Mode sombre du système activé : l'appli doit rester lisible.
7. Rotation ; si pliable : plier/déplier pendant l'utilisation (A-05).
8. Accueil : défilement fluide jusqu'à « Afficher plus » (centaines de cartes) sur l'appareil bas de gamme.
9. Recherche : saisir au clavier, appuyer sur un résultat dès le premier toucher (05a P1-2 est corrigé côté code, à confirmer).
10. Carte : ouverture, déplacement, pincement, regroupements, sélection d'une adresse, mode 3D, itinéraire ; relever la fluidité et la mémoire.
11. Carte : mettre l'appli en arrière-plan 5 minutes puis revenir (WebView relancée ?).
12. Refuser la géolocalisation, puis l'accepter : les deux parcours.
13. Fiche d'adresse : photos, appel, itinéraire, partage ; clavier non nécessaire.
14. Profil : carte « Pass privilège », création d'une liste (clavier sur le champ du nom).
15. Offres et agenda : avec et sans données.
16. Notifications : recevoir un test de chaque catégorie, toucher la notification (ouvre la bonne fiche), changer les interrupteurs dans les réglages.
17. Mode avion : accueil, recherche, carte (messages d'erreur lisibles).
18. TalkBack activé : onglets du dock (libellé lisible ? A-07), boutons de la fiche.
19. Portail admin (équipe uniquement) : clavier sur les champs du bas de page (08).
20. Mettre l'appli en veille 30 min puis la rouvrir (reprise correcte, pas d'écran vide).
21. Réinstaller par-dessus : l'identité d'appareil et le choix de notifications sont conservés.
22. Mesurer le temps de démarrage à froid avec `startupTrace` sur l'appareil bas de gamme.

## 7. Questions ouvertes pour l'association
- L'iPad est-il visé dès la v1 (A-03) ?
- Le blocage de Chrome sur l'émulateur est-il reproductible sur un vrai téléphone modeste ? (à contrôler avec la checklist §6, étape 8 et 22)
- Quel est l'appareil Android le plus modeste à supporter ?
- Qui rejoue la checklist §6, et sur quels téléphones ?

## 8. Bilan

**Constats : 0 P0, 3 P1 (A-01, A-02, A-03), 4 P2 (A-04, A-05, A-06, A-07), 4 P3 (A-08 à A-11).**
Non vérifié : simulateurs iOS après le premier appareil, texte agrandi (natif), mode sombre, Android natif et tout Android hors accueil web (émulateur bloqué par un « Chrome isn't responding »), application native, onglet carte réel, fiche, profil, notifications, portail admin.

Rejouer :
```
xcrun simctl list runtimes && xcrun simctl list devices available   # le runtime iOS 27 doit réapparaître
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8081
grep -rnE "allowFontScaling|maxFontSizeMultiplier|BackHandler" src      # attendu : 0 ligne
grep -n "bottom: 34" src/components/FloatingDock.tsx
grep -nE "orientation|supportsTablet" app.json
# contrastes : formule WCAG sur les couleurs de src/constants/brand.ts
```
