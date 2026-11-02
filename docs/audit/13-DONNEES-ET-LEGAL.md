# Mission D — Données personnelles, fonctionnement « sans compte » et conformité légale

- **Date** : 2 novembre 2026. **Dépôt** : `le-petit-tou`, branche `integration/audit-plus-claude`, `HEAD` = `add426f`.
- **Nature** : dossier de faits préparé pour validation par un juriste ou un DPO. **Ce n'est pas un avis juridique.** « Conforme » n'est écrit nulle part sans preuve lue ou exécutée.
- **Aucun fichier de l'application modifié** ; ce rapport est le seul fichier créé dans le dépôt. Aucun commit, aucun push, ni simulateur ni navigateur.
- **Production** : une seule lecture `GET` anonyme (table `addresses`, colonnes publiques `id, rating, is_recommended`, lecture de la distribution des notes). Aucune écriture, aucun appel de RPC, aucun secret recopié. Les identifiants de connexion lus dans `.env` ne figurent pas ici.
- Je m'appuie sur `docs/audit/03` (ids `J-xx`, `A-xx`, `Q-xx`, `AS-xx`, `PS-xx`) sans le refaire. Les constats nouveaux ou corrigés portent l'id **D2-xx**.

Statuts de preuve : `VÉRIFIÉ` (commande + sortie, ou `fichier:ligne` lu), `DÉDUIT` (raisonnement, non exécuté), `NON TESTÉ` / `NON VÉRIFIÉ`.

---

## 1. Résumé pour le commanditaire

**Verdict : non publiable en l'état, publiable sous conditions** une fois les points ci-dessous traités. Aucun constat nouveau de gravité P0, mais les blocages P0 déjà connus de `03` (champs `[À COMPLÉTER]` des pages légales, qualification de l'exposition de la base d'avant 006, pages non hébergées) restent ouverts.

**Réponse à votre question** : oui, la base et le code enregistrent les données de chaque installation **sans compte**, rattachées à un identifiant aléatoire créé sur le téléphone. **Non, la désinstallation ne supprime pas les données** : elle n'efface jamais rien sur nos serveurs, et sur iPhone elle n'efface même pas l'identifiant sur le téléphone (détail § 3).

Les 5 points les plus importants :
1. Le texte de l'appli et la page « Supprimer mes données » disent qu'à la désinstallation « un nouveau profil est créé » : **faux sur iPhone**, où l'identifiant et toutes les données locales survivent à la réinstallation (D2-01).
2. Sur Android (et en cas de changement de téléphone), les données serveur de l'ancienne installation deviennent **orphelines** pendant jusqu'à 24 mois ; personne, y compris l'utilisateur, ne peut plus les effacer, puisque l'identifiant est perdu et n'est affiché nulle part (D2-02).
3. Les **suggestions d'adresses** (texte libre de 1000 caractères) ne sont **jamais purgées** : démontré par exécution (D2-03), contrairement à la politique (« 24 mois »).
4. Les **notes** (3,0 à 5,0) sont toujours dans la base, affichées sur la fiche et la carte, et présentes dans l'**historique public** du dépôt GitHub, alors que l'interrupteur `externalRatings` les déclare retirées (D2-04).
5. La carte est désormais **Mapbox sur tous les téléphones** (Google Maps et Apple Plans retirés), mais la politique, les déclarations boutiques et le rapport `03` décrivent encore l'ancien montage (D2-05).

---

## 2. Ce qui a été testé et ce qui ne l'a pas été

| Élément | Méthode | Résultat | Preuve |
|---|---|---|---|
| Création, stockage et survie de l'identifiant | Lecture `src/lib/deviceIdentity.ts`, `authService.ts`, `storage.ts`, `supabase.ts` ; doc Expo SecureStore (consultée le 02/11/2026) | Identifiant en Keychain/Keystore ; **tout** le stockage local natif passe aussi par SecureStore | `VÉRIFIÉ` (code) ; comportement iOS réel `NON TESTÉ` (pas d'appareil) |
| Effacement côté téléphone | Lecture `PrivacyPolicyModal.tsx:41-52`, `dataDeletion.ts` ; `node --test src/lib/__tests__/dataDeletion.test.ts` | 7 tests sur 7 passent ; l'identifiant n'est pas supprimé | `VÉRIFIÉ` |
| Effacement et purge côté serveur | Simulation locale PostgreSQL (PGlite) jouant 006, 007 et 015 ; script ci-dessous | Résultats en § 3.3 | `VÉRIFIÉ` (local, pas la production) |
| Suite SQL (listes, push) | `node --test tests/sql/user-lists.test.mjs tests/sql/push-notifications.test.mjs` | 72 réussis, 0 échec | `VÉRIFIÉ` |
| Notes dans la production | `GET` anonyme `addresses` (789 lignes) | 21 valeurs distinctes de 3,0 à 5,0 | `VÉRIFIÉ` |
| Notes dans l'historique Git | `git show b6b20e5:src/constants/dataset.json` ; dépôt public (`gh repo view` : `PUBLIC`) | 790 notes sur 790 dans `b6b20e5` et `3bd7017` ; 0 dans `d8fc4ff` | `VÉRIFIÉ` |
| Pages légales | Lecture des trois pages et de la modale | Écarts en § 4 | `VÉRIFIÉ` |
| Sources officielles : Expo SecureStore | WebFetch `https://docs.expo.dev/versions/latest/sdk/securestore/`, consulté le 02/11/2026 | iOS : persiste après réinstallation mais « non garanti » ; Android : non conservé, sauvegarde non déchiffrable | `VÉRIFIÉ` (résumé d'outil) |
| Mapbox (télémétrie de Mapbox GL JS) | `https://docs.mapbox.com/help/dive-deeper/mobile-web-telemetry/` : HTTP 404 le 02/11/2026 | | **NON VÉRIFIÉ** |
| CNIL, Légifrance, EUR-Lex, Apple, Google Play | Non consultés dans cette mission ; je reprends `03` (sources S1 à S29) | | **NON VÉRIFIÉ** par moi aujourd'hui |
| Appareils réels (iPhone, Android), `prebuild`, journaux Supabase, plan Supabase | hors de portée | | `NON TESTÉ` |

---

## 3. Question centrale : désinstallation, réinstallation, changement de téléphone, effacement

### 3.1 Où est stockée chaque donnée

| Donnée | Téléphone (natif) | Web | Serveur (table, identifiant) |
|---|---|---|---|
| Identifiant d'appareil (UUID) | SecureStore `LPT_SECURE_DEVICE_ID` (`deviceIdentity.ts:5, 31-38`), copie `LPT_AUTHENTICATED_USER_ID_V1` (`authService.ts:5`) | `localStorage` | sert de clé partout |
| Découvertes et points | SecureStore (cache + file d'attente) (`discoveryStore.ts:47, 106`) | `localStorage` | `user_place_discoveries`, par identifiant |
| Cartes de réduction utilisées | SecureStore en morceaux de 1500 caractères (`discountCardsStore.ts:38`) | idem | `user_discount_cards`, `discount_card_uses` |
| Likes | SecureStore `LPT_DEVICE_LIKED_SPOTS` (`likesStore.ts`) | idem | `spot_user_likes` ; total public dans `spot_likes` |
| Listes personnelles | SecureStore (`userListsStore.ts:15`) | idem | `user_lists` (015), par identifiant |
| Suggestions | rien en local | | `place_suggestions`, par identifiant |
| Notifications : drapeau, préférences, « déjà proposé » | SecureStore (`pushNotifications.ts:106-107, 173-174`, `HomeView.tsx:662`) | idem | `push_devices` (jeton, plateforme, préférences, identifiant) |
| Écran d'ouverture « déjà vu », thèmes, fonds d'accueil, partenaires | SecureStore (`_layout.tsx:33`, `homeThemeStore.ts`) | `localStorage` | |
| Session Supabase éventuelle | SecureStore (`supabase.ts:31-60`) | `localStorage` | La connexion anonyme Supabase est désactivée (`authService.ts:12`) : l'identifiant d'appareil sert de clé |

Il n'y a **pas d'AsyncStorage** dans le projet : tout le stockage local natif est du SecureStore, donc du Trousseau iOS / Keystore Android. `VÉRIFIÉ` : `grep -rnE "AsyncStorage|SecureStore|appStorage" src`.

### 3.2 Réponses courtes par scénario

| Scénario | Téléphone | Serveur | Ce que voit l'utilisateur | Preuve |
|---|---|---|---|---|
| **Désinstaller (iPhone)** | L'identifiant et **toutes** les valeurs SecureStore **restent dans le Trousseau** (non garanti par Apple/Expo) | Rien n'est effacé | Si Apple conserve le Trousseau : après réinstallation, **même identifiant**, progression et cartes **restaurées** depuis le serveur (`get_my_discoveries` reçoit le même identifiant) | doc Expo (02/11/2026) ; simulation § 3.3 (« même ID : 1 ligne ») ; `DÉDUIT` pour le comportement réel de l'appareil |
| **Désinstaller (Android)** | Données de l'appli supprimées ; identifiant perdu ; la sauvegarde automatique ne peut pas restaurer SecureStore ; `allowBackup: false` (`app.json:22`) | Rien n'est effacé ; lignes **orphelines** jusqu'à 24 mois (jetons : 270 jours) | Réinstallation = **nouveau profil vide** | doc Expo ; simulation § 3.3 (« nouvel ID : 0 ligne », ancien ID : 5 tables intactes) |
| **Réinstaller** | iPhone : voir ci-dessus. Android : nouvel identifiant | iPhone : mêmes lignes réutilisées. Android : nouvelles lignes, anciennes orphelines | Android : quotas de cartes remis à zéro, **like possible de nouveau** (D2-08) | `VÉRIFIÉ` (code, simulation) |
| **Changer de téléphone** | Android : rien ne suit. iPhone : la restauration d'une sauvegarde chiffrée ou d'un transfert direct emporte en général les éléments du Trousseau (accessibilité `AFTER_FIRST_UNLOCK`, `deviceIdentity.ts:36`, non « ce téléphone seulement ») | Idem ci-dessus | Aucun texte de l'appli n'en parle (D2-12) | `DÉDUIT` pour iPhone, `NON TESTÉ` |
| **« Effacer mes données »** | Efface caches, likes, listes, état des notifications ; **conserve l'identifiant** (`PrivacyPolicyModal.tsx:45-50`, `dataDeletion.ts`) | `delete_my_data` supprime découvertes, cartes, utilisations, suggestions, likes individuels, listes, jeton et journaux d'envoi de cet identifiant | Message : « effacées de nos serveurs et de cet appareil » | `VÉRIFIÉ` (code + simulation) |
| **Demande par e-mail après désinstallation** | | Impossible de retrouver les lignes : l'identifiant n'est affiché nulle part et n'est lié à aucune donnée de contact | `public/suppression-donnees.html` renvoie vers l'e-mail et la purge à 24 mois | `VÉRIFIÉ` (code, page) |
| **Web** | `localStorage` : persiste jusqu'à effacement des données du site par le navigateur | idem | | `DÉDUIT` |

**Conclusion** : « quand une personne désinstalle, ça supprime les données » est **inexact** dans tous les cas : la désinstallation n'efface jamais rien sur nos serveurs, et sur iPhone elle n'efface pas non plus l'identifiant ni les copies locales. Les données ne disparaissent que par « Effacer mes données », par la purge de 24 mois d'inactivité (incomplète, D2-03), ou par la purge des jetons à 270 jours.

### 3.3 Simulation exécutée (sans la production)

Script : `/private/tmp/claude-501/-Users-sohel-Documents-petittou/0d1e6b53-1229-4fdf-ac7c-d6ba1de20540/scratchpad/cycle.mjs` (PostgreSQL en mémoire PGlite, migrations 006, 007, 015 rejouées sur `tests/sql/baseline.sql`). Sortie obtenue :

```
avant purge A {"user_place_discoveries":1,"spot_user_likes":1,"place_suggestions":1,"push_devices":1,"user_lists":1}
purge -> {... "push_devices":1, ... "inactive_devices":1}
après purge A {"user_place_discoveries":0,"spot_user_likes":0,"place_suggestions":1,"push_devices":0,"user_lists":0}
delete_my_data B -> {"deleted":{"cards":0,"likes":1,"card_uses":0,"discoveries":1,"suggestions":1},"success":true}
après effacement B {... tout à 0 ...}
total public likes s1 après effacement: 5        (le total n'a pas bougé)
get_my_discoveries même ID (iOS réinstall): 1 | nouvel ID (Android réinstall): 0
orphelin Android: lignes de l'ancien ID toujours là: 5 tables à 1
```

Lecture : la purge d'un appareil abandonné depuis 30 mois supprime découvertes, likes, jeton et listes, mais **laisse la suggestion**. L'effacement à la demande est complet pour les tables de l'appareil et laisse intact le total public de likes.

---

## 4. Tableau « dit / fait »

| # | Ce qui est dit (source) | Ce qui est fait | Écart |
|---|---|---|---|
| 1 | « si vous désinstallez l'application, un nouveau profil est créé » (`PrivacyPolicyModal.tsx:130`) | Vrai sur Android ; **faux sur iPhone** (Trousseau) | D2-01 |
| 2 | « Si vous avez désinstallé… supprimées automatiquement après 24 mois sans activité » (`suppression-donnees.html`) | Vrai pour découvertes, cartes, likes, listes, jeton à 270 j ; **faux pour les suggestions** | D2-01, D2-03 |
| 3 | « Conservation : … ou 24 mois sans aucune activité » pour les suggestions (tableau `confidentialite.html` §1, « Idem ») | `purge_old_data` ne touche pas `place_suggestions` (`007:736-787`) ; démontré § 3.3 | D2-03 (confirme A18) |
| 4 | « Effacé immédiatement de nos serveurs et de cet appareil… définitive » (`PrivacyPolicyModal.tsx` §5) | Vrai pour les tables listées ; l'identifiant reste ; sauvegardes et journaux de l'hébergeur non maîtrisés | D2-09, D2-15 |
| 5 | « La carte est fournie par Mapbox, Apple Plans ou Google Maps selon votre appareil » (modale et page §2) | Plus de Google Maps ni d'Apple Plans : `react-native-maps` absent de `package.json` (commits `87a58df`, `bf4cf4e`) ; Mapbox GL JS (v3.9.4) est chargé depuis `api.mapbox.com` dans la WebView (`mapboxHtmlTemplate.ts:561-562`) | D2-05 |
| 6 | « Votre position n'est pas enregistrée sur nos serveurs ; transmise à Mapbox pour un itinéraire » | Vrai pour la position (requête `directions` `MapView.tsx:978`). Mais l'adresse IP et le jeton partent chez Mapbox à **chaque ouverture de carte** | D2-05 |
| 7 | Page web § 1 : liste des données (identifiant, découvertes, cartes, likes, suggestions, consultations, jeton) | **Les listes personnelles (`user_lists`) n'y figurent pas** ; la modale les cite | D2-06 |
| 8 | « au plus 2 notifications par jour » (`PrivacyPolicyModal.tsx:167`, `confidentialite.html` §3) | Les annonces manuelles contournent le plafond (`007:399`, `o.kind = 'announcement'`). L'écran de réglage a été corrigé (« Peu de messages, jamais la nuit ») mais pas la politique | D2-07 (A17 partiellement corrigé) |
| 9 | « Likes : seul le total par adresse est public » ; page suppression : « compteurs agrégés » | Le total n'est pas décrémenté à l'effacement ; la modale ne le dit pas | D2-08 |
| 10 | « Consultations de fiche : sans identifiant » | Insertion sans identifiant (`006:736-749`), mais adresse IP vue par l'hébergeur | à qualifier (J-02) |
| 11 | Mentions légales : « les photographies appartiennent à leurs auteurs ou aux établissements » | Les images viennent d'un moissonnage de `lepetittou.com` (`scraper_images_supabase.py:6, 50`) ; aucune licence documentée | D2-11 |
| 12 | `features.ts` : les notes externes « ne sont ni affichées, ni triables, ni embarquées » | Affichées sur la fiche (`AddressDetailModal.tsx:281`) et la carte (`MapView.tsx:1252`) ; seule la recherche respecte l'interrupteur (`SearchView.tsx:196`) ; stockées en base | D2-04 |
| 13 | Dates « 19 octobre 2026 » sur les 3 pages et la modale | Le code a changé depuis (listes 015, Mapbox, `allowBackup`) | à mettre à jour |
| 14 | Champs `[À COMPLÉTER]` : `mentions-legales.html:20, 22, 24, 25` ; `confidentialite.html:41, 44` | présents | reprise `J-04`, `J-20` (P0 pour les boutiques) |

---

## 5. Registre des traitements provisoire (à valider)

Colonnes : finalité ; base légale **proposée, à valider** ; stockage ; durée **réelle** (code) / annoncée ; destinataires ; région ; droits et exercice.

| # | Donnée | Finalité | Base proposée | Stockage | Durée réelle (annoncée) | Destinataires, région | Droits, exercice |
|---|---|---|---|---|---|---|---|
| R1 | Identifiant d'appareil (UUID) | Clé de rattachement des données ci-dessous | Exécution du service demandé ; exemption art. 82 LIL à documenter (J-14) | SecureStore / `localStorage` ; clé de chaque table serveur | Téléphone : jusqu'à désinstallation (Android) ou **sans fin sur iPhone** ; serveur : suit les tables ci-dessous | Supabase (région **inconnue**, Q-05) | Effacement via le bouton ; accès/portabilité : aucun export, identifiant invisible (D2-02) |
| R2 | Découvertes, points, dates | Progression | Exécution du service | `user_place_discoveries` | 24 mois sans activité (annoncé : idem) | Supabase | Bouton ; e-mail impossible à traiter sans identifiant |
| R3 | Cartes utilisées | Quotas par carte | Exécution / intérêt légitime | `user_discount_cards`, `discount_card_uses` | idem | Supabase | idem |
| R4 | Likes | Popularité | Exécution du service | `spot_user_likes` ; total `spot_likes` | 24 mois ; **total jamais rectifié** | Supabase ; total public | Bouton (ligne seulement) |
| R5 | Listes personnelles | Sauvegarde serveur des listes | Exécution du service | `user_lists` (120 Ko max, 20 listes) | 24 mois sans modification **et** sans autre activité (`015:182-188`) ; non mentionnées sur la page web | Supabase | Bouton |
| R6 | Suggestions (texte libre 1000 car.) | Enrichir le guide | À trancher : consentement ou demande de l'utilisateur | `place_suggestions` | **Illimitée** (annoncé : 24 mois) | Supabase ; équipe | Bouton uniquement ; la purge automatique ne les touche pas |
| R7 | Consultations de fiche | Statistiques | Intérêt légitime | `address_views` (sans identifiant) | 13 mois (`007:763`) | Supabase | Non applicable sans identifiant |
| R8 | Jeton Expo Push, plateforme, 3 préférences | Notifications opt-in | Consentement (permission système + interrupteur) | `push_devices` | Jusqu'à désactivation ; invalide + 30 j ; **270 j** sans mise à jour ; non annoncé | Supabase ; **Expo** ; Apple (APNs) ; Google (FCM) | Interrupteur ; bouton |
| R9 | Journaux d'envoi | Fiabilité des envois | Intérêt légitime | `push_deliveries`, `push_outbox`, `push_requests` | 30 j / 7 j | Supabase ; Expo | |
| R10 | Position précise (au premier plan) | Centrage, distances, itinéraire | Service demandé (à écrire) | **Pas enregistrée** ; envoyée à Mapbox pour l'itinéraire | Non conservée par nous ; durée Mapbox `NON VÉRIFIÉ` | Mapbox (États-Unis, `NON VÉRIFIÉ`) | Refus possible, sans blocage (`MapView.tsx:705-740`) |
| R11 | Adresse IP, jeton Mapbox, métadonnées | Chargement de la carte, des images, des API | Intérêt légitime (sécurité, fonctionnement) | Journaux chez Supabase, Mapbox, Expo, Apple/Google, hébergeurs d'images | **Non maîtrisée, non vérifiée** | idem | |
| R12 | Tentatives de connexion admin | Anti-force brute | Intérêt légitime | `admin_login_attempts` | 1 jour (`006:45-65`) | Supabase | |
| R13 | Photos de la bibliothèque (portail admin seulement) | Ajout de visuels | Exécution (équipe) | bucket `etablissements` | — | Supabase | Hors utilisateurs |

---

## 6. Points légaux à instruire (faits du code, questions au juriste)

Je renvoie à `03` pour le détail de J-01 à J-27 et ne reprends que ce que j'ai vérifié autrement ou ce qui est nouveau.

| Point | Faits observés (preuve) | Texte à produire ou corriger | Qui valide | Échéance |
|---|---|---|---|---|
| **RGPD : information et durées** | Écarts du § 4 (lignes 1 à 9) | Une seule politique, alignée sur le code réel (projet § 9) | Juriste / DPO | Avant soumission |
| **ePrivacy / art. 82 LIL** | Identifiant écrit au 1er lancement et lu au démarrage (`discoveryStore.ts:33-40`) ; persistance **sur iPhone après désinstallation** : le stockage dépasse la vie de l'installation, ce qui pèse sur l'exemption « strictement nécessaire » | Analyse écrite de l'exemption, finalité par finalité (J-14) | Juriste | Avant soumission |
| **Notifications** | Opt-in, désactivées par défaut, canal Android avant permission (03) ; pas de plafond pour les annonces | Promesse alignée (D2-07) | Association + juriste | Avant soumission |
| **Publicité et contenus sponsorisés** | Section d'accueil « Nos partenaires » avec pastille **SPONSORISÉ** (`HomeView.tsx:1765-1771`), `OFFICIEL` retiré de ce bandeau (commit `beee922`) ; `price_paid` interne (016) ; reste `AdminPortalModal.tsx:918` (`PARTENAIRE OFFICIEL`, côté admin) | Valider le libellé ; notes et classement : voir D2-04 (les points dépendent de la note) | Juriste (DGCCRF, L. 121-1, textes `NON VÉRIFIÉ`) | Avant soumission |
| **Loi Évin** | Aucun contrôle dans le code ; guide de bars et caves | Règle éditoriale pour fiches et annonces ; mention éventuelle | Juriste (texte `NON VÉRIFIÉ`) | Avant soumission |
| **Mineurs** | Aucune vérification d'âge ; public étudiant | Âge minimal dans la politique ; questionnaires d'âge boutiques (alcool « peu fréquent » = 13+ selon `03`) | Association | Avant soumission |
| **Mentions légales** | 4 champs vides (`mentions-legales.html`) | RNA/SIREN, directeur de la publication, hébergeurs | Association | Avant soumission |
| **Photos et textes** | Images moissonnées de `lepetittou.com` ; textes issus de « L'avis du Petit Tou » ; `dataset.json` (790 fiches) et `etablissements_images.json` (16 378 lignes) **dans un dépôt public** (`gh repo view` : `PUBLIC`) | Établir qui détient les droits (association ? établissements ? photographes ?), licence, droit du producteur de base de données | Juriste | Avant soumission |
| **Notes Google/TripAdvisor** | **Encore là** (D2-04) : base de production, affichage fiche et carte, historique public Git. Plus de `reviews` ni de `tripadvisor` dans le jeu de données courant (`grep` : 0) | Retirer ou documenter l'origine ; réécrire l'historique si nécessaire (décision de l'association) | Association + juriste | **Avant soumission** |
| **Apple App Privacy / Google Data safety** | Brouillons § 8 | Valider, remplir dans les consoles | Association | À la soumission |
| **Apple 5.1.1(v) / Google suppression** | Pas de compte ; bouton in-app présent ; page web existe | Corriger le texte « désinstallé » | Association | Avant soumission |
| **Accessibilité (RGAA / EAA)** | Applicabilité à confirmer (J-25) | — | Juriste | Après publication |
| **Violation de données (72 h)** | État inconnu depuis `03` J-10 ; question Q-09 sans réponse dans le dépôt | Analyse écrite « violation / pas de violation » | Association + DPO | **Urgent, déjà dépassé si retenu** |

---

## 7. Constats

Gravité : P0 bloque ou expose maintenant ; P1 à corriger avant publication ; P2 juste après ; P3 amélioration. Effort : S, M, L. Aucun correctif n'a été appliqué.

### P1

**D2-01 — Le texte « désinstaller = nouveau profil » est faux sur iPhone** — `VÉRIFIÉ` (code, doc Expo), comportement appareil `DÉDUIT`
- Preuve : `PrivacyPolicyModal.tsx:130` et `suppression-donnees.html` (section « Si vous avez désinstallé ») ; `deviceIdentity.ts:31-38` ; **tout** l'état local est en SecureStore (§ 3.1) ; doc Expo (02/11/2026) : sur iOS les données persistent après réinstallation, « non garanti ».
- Impact : une personne qui désinstalle sur iPhone pour « repartir à zéro » retrouve identifiant, progression et listes ; le quota de ses cartes ne se remet pas à zéro (reprend A4/S-16). Information inexacte (art. 13) et décalage avec la déclaration boutique.
- Correctif : dire la vérité (« sur iPhone, l'identifiant peut survivre à la désinstallation ; utilisez Effacer mes données avant de désinstaller ») ; ou supprimer l'identifiant au moment de l'effacement et préférer un stockage supprimé à la désinstallation pour les caches. Décision de l'association (Q-20 de `03`). Effort S (texte), M (technique).

**D2-02 — Données orphelines après désinstallation Android ou changement de téléphone, droits non exerçables** — `VÉRIFIÉ` (simulation § 3.3)
- Preuve : les lignes de l'ancien identifiant restent dans 5 tables ; `suppression-donnees.html` renvoie à un e-mail alors que l'identifiant n'est affiché nulle part ; aucune fonction d'export (J-05).
- Impact : conservation jusqu'à 24 mois de données de personnes qui ont quitté l'appli, sans moyen de les effacer ni de les récupérer ; le texte ne le dit pas clairement.
- Correctif : afficher l'identifiant (copiable) dans l'écran de confidentialité, expliquer qu'il est nécessaire pour une demande ; proposer un export (accès, portabilité) ; décider si 24 mois est la bonne durée pour des données sans compte (Q-16). Effort M.

**D2-03 — Les suggestions ne sont jamais purgées** — `VÉRIFIÉ` (exécution)
- Preuve : sortie § 3.3 (`place_suggestions` : 1 avant, 1 après purge) ; `007:736-787` ; politique : « Idem » (24 mois). Le champ `comment` accepte 1000 caractères libres (`006:775-785` : borne), p. ex. un numéro de téléphone.
- Impact : texte libre, possiblement personnel (ou concernant un tiers), conservé sans limite et sans lien avec l'utilisateur qui l'a écrit ; aucune lecture par l'utilisateur.
- Correctif : ajouter `place_suggestions` à la purge (durée à décider, Q-16/Q-17) ; avertir dans le formulaire de ne saisir aucune donnée de tiers ; décider de la suppression après traitement. Effort S.

**D2-04 — Notes externes : encore stockées, affichées et dans l'historique public** — `VÉRIFIÉ`
- Preuve : (a) `GET` anonyme sur `addresses` (789 lignes) : notes de **3,0 à 5,0**, 21 valeurs distinctes ; le script de départ génère des valeurs fictives de 4,3 à 5,0 (`seed_supabase_db.py:283`), donc les valeurs plus basses ne viennent pas de lui ; origine non documentée. (b) `AddressDetailModal.tsx:281` et `MapView.tsx:1252` affichent `formatRating(spot.rating)` sans condition ; seul `SearchView.tsx:196` lit `Features.externalRatings` ; le commentaire de `features.ts` annonce le contraire. (c) Valeur de repli **4,8 inventée** quand la note manque (`placesRepository.ts:123, 205, 254, 296` ; `MapView.tsx:1456`). (d) La note fixe le barème de points (≥ 4,8 → 20 points : `006:509`). (e) Le commit `b6b20e5` (12/08/2026, « 790/790 ratings ») met 790 notes dans `dataset.json`, **présent sur `origin/main`, dépôt GitHub public**. Le commit `d8fc4ff` les retire du fichier ; l'historique les garde.
- Impact : si l'origine est Google ou TripAdvisor, republication contraire à leurs conditions (non lues ici) ; si elle est inconnue, note inventée présentée comme avis ; le bloc « Avis & Retours » existe aussi (`AddressDetailModal.tsx:445-465`, vide aujourd'hui, 0 `reviews` dans le jeu de données).
- Correctif : décider du sort des notes ; si retrait : colonne `rating` à neutraliser en base, affichages à conditionner à `Features.externalRatings`, barème des points à découpler de la note, repli 4,8 à supprimer ; nettoyage de l'historique public à évaluer avec l'association. Origine à établir par ceux qui ont lancé l'enrichissement (scripts absents du dépôt). Effort M. Escalade en **P0** si l'origine est confirmée comme Google ou TripAdvisor.

**D2-05 — La carte passe par Mapbox pour tous : politique et déclarations obsolètes** — `VÉRIFIÉ` (code), télémétrie `NON VÉRIFIÉ`
- Preuve : `package.json` sans `react-native-maps` ; `mapboxHtmlTemplate.ts:561-562` charge `mapbox-gl.js`/`.css` v3.9.4 depuis `api.mapbox.com` ; jeton Mapbox dans l'URL d'itinéraire (`MapView.tsx:978`). Mapbox reçoit donc adresse IP, agent et jeton à chaque ouverture de carte, pas seulement pour l'itinéraire. Les rapports `03` (§ 1.2, AS-18, PS-09, § 5.1, § 6.1) décrivent encore Google Maps SDK et Apple Plans.
- Impact : politique inexacte (modale §2, page §2) ; déclarations Apple/Google à bâtir sur la réalité ; transfert vers un prestataire américain sur toute l'utilisation de la carte, hors UE (contrat non lu, J-13).
- Correctif : réécrire la section carte ; refaire § 8 (déclarations) ; lire le DPA Mapbox et la télémétrie de Mapbox GL JS (`NON VÉRIFIÉ`) ; décider si une carte intermédiaire (tuiles via un hébergeur UE) est souhaitée. Effort S (texte), M (contrat).

**D2-06 — La page web de confidentialité omet les listes personnelles** — `VÉRIFIÉ`
- Preuve : `public/confidentialite.html` §1 ne cite pas `user_lists` ; la modale (`PrivacyPolicyModal.tsx:130`) les cite ; la page est celle qu'on donne aux boutiques.
- Impact : information incomplète sur le document que lisent Apple, Google et les utilisateurs.
- Correctif : une seule source de vérité (C-2 de `03`). Effort S.

### P2

**D2-07 — Promesse « au plus 2 notifications par jour » toujours dans la politique** — `VÉRIFIÉ`
- Preuve : `PrivacyPolicyModal.tsx:167`, `confidentialite.html` §3 ; `007:399` : les annonces passent le plafond. L'écran de réglage a été corrigé (`NotificationSettingsModal.tsx:114` : « Peu de messages, jamais la nuit »). Heures calmes aux relances : non revérifié (`03` J-15).
- Correctif : aligner la politique. Effort S.

**D2-08 — Likes : double comptage possible après réinstallation Android, total non rectifié** — `DÉDUIT` (+ simulation pour le total)
- Preuve : un nouvel identifiant peut liker à nouveau la même adresse (`increment_spot_like`, `006:668+`) ; le total n'est pas décrémenté à l'effacement (simulation : 5 avant, 5 après). La modale ne dit pas que le total reste.
- Impact : compteur public gonflable par réinstallation ; mention manquante.
- Correctif : texte ; décision sur la tolérance du compteur. Effort S.

**D2-09 — « Définitif » : sauvegardes et journaux de l'hébergeur non maîtrisés** — `NON VÉRIFIÉ`
- Preuve : aucune donnée sur le plan Supabase, la durée des sauvegardes ou des journaux (Q-06 de `03`).
- Impact : l'affirmation « effacé immédiatement… définitive » ne tient peut-être pas pour les sauvegardes.
- Correctif : relever plan et durées ; ajouter une phrase « les sauvegardes sont écrasées sous X jours ». Effort S.

**D2-10 — L'identifiant est un secret porteur, et son tirage peut ne pas être cryptographique** — `DÉDUIT`
- Preuve : `_lpt_identity` accepte tout UUID bien formé (`006:393-410`) : qui connaît l'identifiant peut lire et effacer ses données. `deviceIdentity.ts:7-13` utilise `crypto.randomUUID` s'il existe, sinon `Math.random`. Aucun polyfill dans le dépôt (`grep` : aucun `expo-crypto` ni `get-random-values`) et RN ne l'embarque pas dans les sources lues ; le chemin réellement pris sur appareil est `NON TESTÉ`.
- Impact : faible aujourd'hui (données peu sensibles) ; l'écart se creuse si l'on affiche l'identifiant (D2-02) ou si l'on y rattache plus de données.
- Correctif : ajouter `expo-crypto` (ou équivalent) pour le tirage ; ne jamais rattacher de données sensibles à cette clé seule. Effort S.

**D2-11 — Origine des photos et textes (moissonnage) et dépôt public** — `VÉRIFIÉ` (faits), droits `NON VÉRIFIÉ`
- Preuve : `scraper_images_supabase.py:6, 50-51` (images de `lepetittou.com`) ; `etablissements_images.json` (16 378 lignes) et `dataset.json` versionnés ; remote `Rmenac88/le-petit-tou` public ; la clé publique `anon` et l'URL du projet figurent dans `eas.json` et `supabase.ts` (par construction publiques, rôle `anon` ; la protection repose sur 006, voir `03`).
- Question : `lepetittou.com` appartient-il à l'association ? Qui a pris les photos ?
- Correctif : inventaire des droits ; décider de la visibilité du dépôt ; retrait des fichiers qui n'ont pas à être publics. Effort M.

**D2-12 — Changement de téléphone : rien n'est dit, aucun transfert** — `VÉRIFIÉ` (texte absent) / iPhone `DÉDUIT`
- Impact : un utilisateur Android perd progression, quotas, listes ; sur iPhone la restauration peut tout ramener. Aucun texte ne l'annonce.
- Correctif : phrase dans la politique et l'écran des réglages ; décider d'un mécanisme de transfert (code de récupération) ou d'assumer la perte. Effort S (texte).

**D2-13 — La « dernière activité » de 24 mois est trop étroite** — `DÉDUIT` (lecture de `007:768-775`)
- Preuve : l'activité n'est calculée que sur découvertes, utilisations de cartes et likes ; les listes enregistrées ne comptent pas pour protéger le reste, et ouvrir l'appli ne compte pas.
- Impact : un utilisateur qui ne fait que gérer ses listes pendant 24 mois perd sa progression ; à l'inverse, un appareil qui n'a fait que des suggestions n'est jamais purgé (A18).
- Correctif : définir « activité » (Q-16) et l'écrire. Effort S.

### P3

**D2-14 — Tout le stockage local est du SecureStore** — `VÉRIFIÉ`
- Effet : les drapeaux « notifications activées », « déjà proposé » et « intro vue » survivent aussi à la réinstallation iPhone (`HomeView.tsx:662-667`, `_layout.tsx:33`) ; l'interrupteur apparaît « désactivé » (permission système réinitialisée) alors que le serveur peut garder l'ancien jeton jusqu'à sa purge. Les caches non sensibles n'ont pas besoin du Trousseau. Effort M.

**D2-15 — « Effacer mes données » conserve l'identifiant** — `VÉRIFIÉ`
- Preuve : `clearLocal` (`PrivacyPolicyModal.tsx:45-50`) ne retire pas `LPT_SECURE_DEVICE_ID`. Le message « de cet appareil » est correct pour les données, pas pour l'identifiant. Décision liée à D2-01. Effort S.

**D2-16 — Télémétrie de Mapbox GL JS et durée de conservation chez Mapbox non vérifiées** — `NON VÉRIFIÉ`
- Page d'aide Mapbox : HTTP 404 le 02/11/2026. À lire dans le DPA et la documentation (D2-05). Effort S.

### Reprises de `03`, non recomptées

Champs `[À COMPLÉTER]` et pages non hébergées (J-04, J-20, AS-05, PS-05) ; qualification de l'exposition d'avant 006 et délai de 72 h (J-10, Q-09) ; création de l'identifiant au premier lancement (J-06) ; promesse de notifications (A17) ; contrats Supabase/Expo/Mapbox (J-07, J-13) ; statut de trader, classe d'âge, D-U-N-S, test fermé Google (AS-02, AS-04, PS-02).

**Nombre de constats D2 : P0 = 0, P1 = 6, P2 = 7, P3 = 3 (total 16).**

---

## 8. Brouillons prêts à relire

### 8.a Déclarations boutiques (pré-remplies d'après le code ; **à valider**)

**Apple, App Privacy** (définitions d'Apple reprises de `03` S18 ; `NON VÉRIFIÉ` aujourd'hui)

| Type Apple | Donnée | Finalité | Liée à l'utilisateur | Suivi |
|---|---|---|---|---|
| Identifiants → ID de l'appareil | UUID applicatif ; jeton de notification | Fonctionnalités de l'app | **Oui** | Non |
| Données d'utilisation → Interaction avec le produit | découvertes, cartes, likes, listes | Fonctionnalités | **Oui** | Non |
| Données d'utilisation → Interaction | consultations de fiches | Analytique interne | Non (IP journalisée : **à trancher**) | Non |
| Contenu utilisateur → Autre contenu | suggestions, noms de listes (texte libre) | Fonctionnalités | **Oui** | Non |
| Localisation → Position précise | position envoyée à Mapbox pour l'itinéraire | Fonctionnalités | **Incertain** (dépend de la rétention par Mapbox, non lue) | Non |
| Autres données | adresse IP vue par Mapbox à chaque carte | Fonctionnalités | **Incertain** | Non |

Cases incertaines : position précise (liée ou non), IP via Mapbox, consultations (liées par l'IP ou non).

**Google Play, Sécurité des données**

| Catégorie | Collectée | Partagée | Finalité | Optionnelle |
|---|---|---|---|---|
| Identifiants de l'appareil ou autres | Oui (UUID, jeton, identifiant d'installation Firebase via FCM) | Non (prestataires) — **à valider** | Fonctionnalités, communications | Jeton : oui ; UUID : requis |
| Activité dans l'appli | Oui | Non | Fonctionnalités | Oui |
| Contenu généré | Oui (suggestions, noms de listes) | Non | Fonctionnalités | Oui |
| Position approximative/précise | **À décider** (envoi à Mapbox ; exemption « traitement éphémère » non établie) | **À qualifier** (Mapbox) | Fonctionnalités | Oui |
| Données de l'appareil ou autres | Adresse IP par les services cartographiques | À qualifier | Fonctionnalités | Non |
| Chiffrement en transit | Oui (HTTPS) | | | |
| Suppression à la demande | Oui (bouton + page web) | | | |

À retirer de `03` : Google Maps SDK, Apple Plans (D2-05). À conserver : FCM (notifications Android).

### 8.b Projet de politique de confidentialité (français courant, cohérent avec le code **tel qu'il est** ; les crochets sont des décisions à prendre)

> **Politique de confidentialité — Le Petit Tou**
> Dernière mise à jour : [date]. Responsable du traitement : l'association Le Petit Tou, association loi 1901, [adresse], [RNA/SIREN]. Contact : contact@lepetittou.net. [Référent données personnelles : à désigner ou « aucun »].
>
> **1. Pas de compte, mais un identifiant.** Vous n'avez ni nom, ni e-mail, ni mot de passe à donner. L'appli crée toutefois un identifiant aléatoire propre à votre téléphone [dès le premier lancement / à votre première action]. Il est enregistré sur votre téléphone et envoyé à nos serveurs pour retrouver votre progression, vos cartes, vos likes et vos listes. Cet identifiant est une donnée personnelle.
>
> **2. Ce qui est enregistré, pourquoi, combien de temps.** (a) Adresses découvertes et points ; (b) utilisations des cartes privilège ; (c) likes ; (d) vos listes ; (e) les suggestions d'adresses que vous envoyez, dont le texte est libre : n'y mettez aucune information personnelle ; (f) le jeton de notification et vos choix, si vous activez les notifications. Durées : jusqu'à ce que vous les effaciez, ou [24] mois sans aucune activité ; jetons de notification : [270 jours] sans mise à jour ; suggestions : [durée à décider] ; consultations de fiches (sans identifiant, mais l'hébergeur voit l'adresse IP) : 13 mois ; journaux d'envoi des notifications : 30 jours. Base légale : le service que vous demandez (a, b, c, d), votre consentement (f), [à préciser pour e], notre intérêt légitime pour la sécurité et les statistiques.
>
> **3. Désinstaller, réinstaller, changer de téléphone.** Désinstaller l'appli **n'efface pas** vos données sur nos serveurs. Sur Android, l'identifiant est perdu : une réinstallation repart de zéro, et les anciennes données sont supprimées automatiquement après [24] mois. Sur iPhone, l'identifiant peut rester sur le téléphone après désinstallation (c'est le comportement du Trousseau d'Apple, qui n'est pas garanti) : vous retrouverez alors vos données. Changer de téléphone : sur Android, vos données ne suivent pas ; sur iPhone, une restauration de sauvegarde peut les ramener. Pour effacer vos données, utilisez le bouton « Effacer mes données » **avant** de désinstaller.
>
> **4. Position.** Facultative, demandée à l'ouverture de la carte et seulement appli ouverte. Elle n'est pas enregistrée par nous. Si vous demandez un itinéraire à pied, votre position et la destination sont envoyées à Mapbox (États-Unis), qui calcule le trajet. [Base légale et garanties de transfert : à préciser.]
>
> **5. Carte et réseaux tiers.** La carte est fournie par Mapbox sur tous les appareils : Mapbox reçoit votre adresse IP et un jeton technique chaque fois que la carte s'affiche. Les photos de certaines fiches viennent d'hébergeurs d'images qui voient votre adresse IP.
>
> **6. Notifications.** Désactivées par défaut. Si vous les activez, vous choisissez les types de messages. Nous envoyons peu de messages [au plus 2 par jour, hors annonces importantes], jamais entre 21 h et 8 h, sans donnée personnelle. Vous pouvez les arrêter dans l'appli ou dans les réglages du téléphone. Elles passent par Expo (États-Unis), puis par Apple (APNs) ou Google (FCM).
>
> **7. Destinataires et transferts.** Supabase (hébergement, région [à compléter]), Expo, Mapbox, Apple, Google. Mécanisme de transfert par destinataire : [à compléter après lecture des contrats]. Aucune revente, aucune publicité ciblée, aucun outil de mesure d'audience.
>
> **8. Vos droits.** Accès, rectification, effacement, limitation, opposition, portabilité, retrait du consentement, réclamation à la CNIL. Le bouton « Effacer mes données » supprime sur nos serveurs et sur votre téléphone votre progression, vos cartes, vos suggestions, vos likes, vos listes et vos réglages de notifications. Le total public de likes d'une adresse n'est pas recalculé. Les sauvegardes de l'hébergeur sont écrasées sous [X jours]. Pour une demande par e-mail, joignez votre identifiant (Accueil, Politique de confidentialité, « Mon identifiant ») : sans lui nous ne pouvons pas retrouver vos données. Réponse sous un mois.
>
> **9. Mineurs.** L'application n'est pas destinée aux moins de [15] ans. [À valider.]
>
> **10. Partenaires et contenus sponsorisés.** Les partenaires affichés comme « sponsorisés » sont des contenus promotionnels. [À valider.]

### 8.c Les 15 questions à poser au responsable du traitement

(La liste complète de 24 questions est dans `03` § 7 ; voici les 15 qui conditionnent ce dossier.)

1. Q-09 — À quelle date l'association a-t-elle eu connaissance de l'exposition de la base d'avant 006, et existe-t-il une analyse écrite « violation / pas de violation » ?
2. D'où viennent les **notes** (3,0 à 5,0) de la base ? Qui les a collectées, avec quel outil, depuis quelle source ?
3. Voulez-vous retirer les notes (base, affichage, barème de points) et nettoyer l'historique public du dépôt GitHub ?
4. Le dépôt GitHub doit-il rester public ? Qui en est propriétaire ?
5. `lepetittou.com` appartient-il à l'association ? Qui détient les droits sur les photos et les textes des 790 fiches ?
6. Q-05 — Quelle est la région du projet Supabase, quel plan, quelles durées de sauvegarde et de journaux ?
7. Q-20 — Souhaitez-vous que l'identifiant survive à la réinstallation sur iPhone (comportement actuel) ou qu'il soit supprimé avec l'appli ?
8. Q-16 — Durées voulues : suggestions (aujourd'hui illimitée), jetons (270 jours), inactivité (24 mois) ?
9. Que signifie « activité » : action sur l'appli, ou simple ouverture ?
10. Q-19 — Acceptez-vous d'afficher l'identifiant et de proposer un export des données ?
11. Souhaitez-vous un mécanisme de transfert vers un nouveau téléphone (code de récupération) ou assumez-vous la perte ?
12. Q-18 — L'identifiant doit-il naître à la première action plutôt qu'au premier lancement ? Un écran d'information au premier lancement ?
13. Q-11 / Q-14 — Les partenaires paient-ils ? Quel statut de « trader » déclarez-vous ? Quel libellé sponsorisé retenez-vous ?
14. Q-04 — Y a-t-il un référent ou un DPO, et qui répond aux demandes de droits, dans quel délai ?
15. Q-13 — L'appli vise-t-elle des moins de 15 ans ? Quelle classe d'âge ? Faut-il garder la carte Mapbox pour tous, sachant qu'elle envoie adresse IP et jeton hors de l'UE à chaque ouverture ?

---

## 9. Décisions que seule l'association peut prendre

1. Sort des notes externes (retrait, origine, nettoyage de l'historique public) et visibilité du dépôt GitHub (D2-04, D2-11).
2. L'identifiant survit-il à la désinstallation sur iPhone ? Création au premier lancement ou à la première action ? (D2-01, D2-15, J-06)
3. Durées de conservation : suggestions, jetons, inactivité, définition de l'« activité » (D2-03, D2-13).
4. Affichage de l'identifiant, export des données, transfert vers un nouveau téléphone (D2-02, D2-12).
5. Qualification de l'exposition d'avant 006 et notification éventuelle à la CNIL (J-10).
6. Libellé et statut des partenaires payants, statut de « trader », classe d'âge, âge minimal (J-18, AS-02, AS-04).
7. Compte propriétaire Expo, compte boutiques (organisation, D-U-N-S), publication ou non de la version web (Q-02, Q-21, Q-07).
8. Maintien de Mapbox comme fournisseur unique de carte, et validation du transfert hors UE (D2-05).
9. Désignation d'un référent données et rédaction finale des pages avec un juriste.

---

## 10. Rejouer les vérifications

```
cd /Users/sohel/Documents/petittou/le-petit-tou
node --experimental-strip-types --test src/lib/__tests__/dataDeletion.test.ts
node --test tests/sql/user-lists.test.mjs tests/sql/push-notifications.test.mjs
node /private/tmp/claude-501/-Users-sohel-Documents-petittou/0d1e6b53-1229-4fdf-ac7c-d6ba1de20540/scratchpad/cycle.mjs
grep -rnE "AsyncStorage|SecureStore|appStorage" src | grep -v __tests__
grep -n "Features.externalRatings" -r src
git show b6b20e5:src/constants/dataset.json | python3 -I -c "import json,sys;a=json.load(sys.stdin)['addresses'];print(len(a),sum(1 for e in a if e.get('rating')))"
gh repo view Rmenac88/le-petit-tou --json visibility
# production, lecture seule : GET anonyme sur addresses (select=id,rating) avec EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY lus dans .env
```

Le script `cycle.mjs` est dans le dossier temporaire de la session ; il charge les migrations du dépôt dans une base en mémoire, sans réseau.
