# Passage à l'échelle : ce qui tient, ce qui casse, à partir de quelle taille — 22 octobre 2026

Complète `01` à `05c`. Question posée : l'application peut-elle être téléchargée par « des millions » d'utilisateurs, sur un projet Supabase en plan gratuit ? Ce rapport répond honnêtement, avec des ordres de grandeur chiffrés, des hypothèses écrites, et un plan proportionné.

## 0. Comment lire ce rapport

- **[V] vérifié** : dans le code du dépôt (`fichier:ligne`) ou dans une documentation officielle citée (URL en §14). **[C] calculé** : issu d'hypothèses numérotées H1 à H14 (§2) ; les mesures du *banc local* (annexe A) sont rangées ici. **[N] non vérifié** : non lu, non mesuré, ou dépendant du tableau de bord Supabase auquel je n'ai pas accès.
- **P0** : rend l'appli inutilisable pour tous, ou expose à une perte ou une facture non maîtrisée, dès l'ouverture au public. **P1** : rupture entre 10 000 et 100 000 installations, ou exposition réelle mais conditionnelle. **P2** : défaut réel, contournable ou limité. **P3** : hygiène.
- **Périmètre** : lecture seule du dépôt. Aucune requête vers la production n'a été faite, aucun fichier de code modifié, aucun paquet installé. État du dépôt : `HEAD d90189f` **plus** des modifications non commitées d'autres passes (`HomeView.tsx`, `supabase.ts`, `fetchWithTimeout.ts`, `deviceIdentity.ts`) ; les numéros de ligne cités sont ceux de l'arbre de travail du 22/10/2026 et peuvent bouger.
- **Banc local** : PGlite 0.5.10 (PostgreSQL 18.6 compilé en WebAssembly, en mémoire, un seul client, sans `fsync`). Il donne de vrais **plans d'exécution** et des **écarts relatifs** fiables ; il ne donne **pas** les temps absolus d'une production Supabase (version de PostgreSQL de production : [N]). Les scripts du banc sont dans le dossier temporaire de session (annexe A), pas dans le dépôt.
- **Sources de tarifs et de limites** : pages officielles lues le 22/10/2026 (§14). Plusieurs pages ont été lues via un outil qui les résume : **relire la page d'origine avant toute décision financière**. Ce que je n'ai pas pu lire est dit en §13.
- **Aucun secret** n'est reproduit ici (ni clé, ni identifiant de projet).

## 1. Verdict

**Sur le mot « millions ».** La Métropole de Toulouse compte 841 524 habitants en 2023 (832 348 selon l'Insee 2022) **[V : §14, sources 21-22]**. Un million d'installations d'un guide d'adresses *toulousain* dépasse la population entière de la métropole. Je propose de **dimensionner pour 100 000 installations** (cible haute réaliste, **hypothèse à valider avec l'association**) et de **savoir comment** passer à 1 million, sans le construire d'avance.

**Le goulot n'est pas le nombre de requêtes par seconde.** Même à 1 million d'installations, on reste autour de 18 requêtes/s en moyenne et ~470 au pic du jour de lancement **[C]**. Ce qui casse, dans l'ordre :

1. les **quotas du plan gratuit** (5 Go de sortie ≈ 350 à 1 100 utilisateurs actifs par mois **[C]** ; base limitée à 500 Mo puis passage en lecture seule **[V]** ; aucune sauvegarde ; mise en pause après 1 semaine d'inactivité **[V]**) ;
2. le **catalogue de 790 adresses retéléchargé à chaque lancement** (≈ 0,3 Mo compressé ou ≈ 1,1 Mo brut, plus 0,3 à 1,7 Mo à la première visite de la Recherche) alors que 1,9 Mo sont déjà embarqués dans l'appli **[V]** ;
3. des **écritures publiques sans aucune limite** (jetons de notification, vues, suggestions, découvertes, photos) : un seul script peut remplir la base ou la file de notifications **[C]** ;
4. la **file de notifications à 1 000 messages/minute** : 100 000 appareils = 1 h 40, 1 million = 16 h 40 **[C]**, avec un envoi qui ignore les heures calmes et la péremption **[V]** ;
5. des **tables qui grossissent sans purge adaptée** (`push_deliveries`, `address_views`) et un coût de diffusion **quadratique** dans un cas mesuré **[C]**.

| Palier | Ce qui tient sans changement | Premier point de rupture |
|---|---|---|
| Aujourd'hui (≈ 100 appareils de test ; 106 jetons dans l'ancienne file, `04-SUIVI` N-13) | Tout, sur le plan gratuit | Pause après 1 semaine sans activité **[V]** (l'appli retombe sur ses données embarquées) |
| **Plan gratuit, ouverture publique** | ≈ 350 à 1 100 MAU (≈ 900 à 2 800 installations) **[C]** | Sortie 5 Go en quelques semaines ; une attaque d'écriture remplit 500 Mo en moins d'1 h (suggestions) à 5 h (vues) **[C]** |
| **Plan Pro, code inchangé** | ≈ 8 000 à 17 000 MAU (20 000 à 43 000 installations) avant surcoût de sortie **[C]** ; notifications jusqu'à ≈ 25 000 appareils (25 min) | Diffusion : coût quadratique du plafond si deux messages partent dans la même passe ; `push_deliveries` 439 Mo à 25 000 appareils ; `address_views` 4,3 Go à 100 000 installations |
| **Pro + correctifs P0/P1** (§5) | 100 000 installations sur Pro + Small/Medium, ~35 à 90 $/mois **[C]** | Charge de lancement en rafale sur Micro/Small partagé **[N]** |
| 1 million d'installations | Faisable seulement avec catalogue versionné/CDN, images redimensionnées, envoi 6 000 à 30 000 msg/min, purge par lots, Medium/Large | Débit sortant brut ~0,6 Gbit/s au pic si le catalogue n'est pas mis en cache **[C]** ; population locale **[V]** |

## 2. Hypothèses (toutes modifiables)

| # | Hypothèse | Valeur | Sensibilité |
|---|---|---|---|
| H1 | MAU / installations | 40 % | ×0,5 : tous les volumes mensuels divisés par 2 |
| H2 | Sessions par MAU et par mois (chaque session = un lancement à froid, donc un téléchargement du catalogue) | 10 | linéaire |
| H3 | Part des sessions ouvrant l'onglet Recherche (`select *`) | 50 % | +0,15 Mio brut par session par tranche de 10 % |
| H4 | Compression des réponses de l'API | gzip pour le calcul « compressé », aucune pour « brut » ; Supabase compresse-t-il ? **[N]** | facteur 4,6 à 5,5 mesuré sur le jeu de données |
| H5 | Octets d'images « neuves » par session (originaux non redimensionnés, cache disque ensuite) | 1,0 Mo **[N : poids réel des 1 313 images non mesuré]** | plage 0,3 à 3 Mo |
| H6 | Avec transformations d'image 400 px WebP | 0,18 Mo/session | ÷ 5,5 **[N]** |
| H7 | Jour de lancement | 10 % des installations dans la journée, 70 % d'entre elles sur 3 h, 2 sessions chacune, 12 requêtes par session, rafale ×3 | ×2 si campagne virale |
| H8 | Appareils avec notifications activées (action volontaire dans les réglages : `pushNotifications.ts:104-131`) | 25 % des installations | 10 % à 100 % |
| H9 | Notifications par appareil et par jour (plafond serveur : 2, `007:351`) | 1,5 | 0,3 à 2 |
| H10 | Vues de fiche par session (`AddressDetailModal.tsx:121-132`) | 3 | linéaire |
| H11 | Rétention : 30 jours (code), 13 mois (`address_views`, code) | `007:751`, `007:763` | cible proposée 7 jours / 90 jours |
| H12 | Attaquant : débit soutenu | 100 requêtes/s depuis une seule machine | Supabase « applique des garde-fous contre les rafales » sans chiffre **[V]** |
| H13 | Part des sessions demandant un itinéraire Mapbox | 3 % | linéaire |
| H14 | Poids de ligne PostgreSQL (table + index), mesuré | voir §4.3 | index construits en bloc : minimum |

## 3. État des lieux vérifié

### 3.1 Requêtes au démarrage (chaque lancement à froid)

| # | Requête | Source | Volume (jeu embarqué) |
|---|---|---|---|
| 1 | `categories` `select *` (19 lignes) | `HomeView.tsx:662-666` | 3 Kio |
| 2 | `addresses` 17 colonnes, 790 lignes, tri `created_at desc` | `HomeView.tsx:669-673` | 1 036 Kio brut / 268 Kio gzip |
| 3 | `events` | `HomeView.tsx:696-700` | petit |
| 4 | `sponsored_partners` `select *` | `partnersStore.ts:75-79`, appelé en `HomeView.tsx:715` | petit |
| 5 | `spot_likes` (790 lignes) | `likesStore.ts:66-69`, appelé en `HomeView.tsx:744` | 52 Kio / 18 Kio gzip |
| 6 | RPC `get_my_discoveries` | `discoveryStore.ts:85` (constructeur du singleton, `:36-38`) | ≤ 790 lignes |
| 7 | `discount_cards` `select *` | `discountCardsStore.ts:158-161` | petit |
| 8 | RPC `get_my_card_usage` | `discountCardsStore.ts:163` | petit |
| 9 | RPC `register_push_token` (si notifications activées) | `app/index.tsx:33`, `pushNotifications.ts:92,163-174` | 1 écriture |

**8 à 9 requêtes par lancement** **[V]**, dont 2 lourdes. Les requêtes 1 à 4 sont attendues **l'une après l'autre** (`HomeView.tsx:662-715`). `HomeView` est toujours monté (`app/index.tsx:54-68`). Aucun polling périodique n'existe dans `src/` (recherche de `setInterval` : aucun résultat) **[V]**.

À la demande : **Recherche**, première visite : `select *` complet, 1 704 Kio brut / 309 Kio gzip (`SearchView.tsx:67`). **Carte** : 19 colonnes (1 583 / 299 Kio) si le cache est vide ; or le cache n'est écrit qu'à la **fin** du chargement de l'accueil (`HomeView.tsx:724-726`), donc un utilisateur rapide déclenche un troisième téléchargement (`MapView.tsx:369-392`). **Agenda** : `partner_events` à chaque retour au premier plan une fois l'onglet visité (`AgendaView.tsx:93-101`), plus un `select *` sur les adresses absentes du jeu embarqué (`:71`). **Fiche** : une insertion `address_views` à chaque ouverture (`AddressDetailModal.tsx:121-132`). **Like** : un RPC (`likesStore.ts:130`).

Le cache du catalogue est une simple `Map` en mémoire (`dataCache.ts:11-30`) : il disparaît à chaque fermeture de l'appli ; aucune requête conditionnelle (ETag, version) n'existe **[V]**. Code mort qui téléchargerait aussi `*` si quelqu'un le branchait : `dataStore.fetchAndSyncAll` (`dataStore.ts:111-131`), `placesRepository.getMapSpots/getSpotDetail` (aucun appelant) **[V]**.

### 3.2 Poids réels du catalogue (calculés sur `dataset.json`, 22 colonnes, JSON minifié)

| Requête | Lignes | Brut | gzip | brotli |
|---|---|---|---|---|
| Accueil, 17 colonnes | 790 | 1 036 Kio | 268 Kio | 221 Kio |
| Recherche, `select *` | 790 | 1 704 Kio | 309 Kio | 248 Kio |
| Carte, 19 colonnes | 790 | 1 583 Kio | 299 Kio | 239 Kio |
| Liste légère proposée (12 colonnes, §5 E-02) | 790 | 427 Kio | 63 Kio | 58 Kio |
| `spot_likes` | 790 | 52 Kio | 18 Kio | 18 Kio |

**[C]** : mesuré sur le fichier embarqué (1 988 316 octets, `src/constants/dataset.json`) ; la vraie table a quelques colonnes de plus (`likes_count`, `points_reward`…), soit +3 % environ. Une session moyenne (accueil + 50 % de Recherche) télécharge **0,44 Mio compressé ou 1,91 Mio brut**.

### 3.3 Ce que l'application ne sollicite pas (bonne nouvelle)

- **Supabase Auth** : la connexion anonyme est désactivée (`authService.ts:12`) ; aucun utilisateur n'est créé, donc **0 MAU facturable** **[V]**. Si on l'activait un jour : limite de 30 inscriptions anonymes/heure/IP **[V]** et, au-delà de 100 000 MAU, 0,00325 $/MAU, soit ≈ 975 $/mois à 400 000 MAU **[C]**. À ne pas faire.
- **Realtime** (aucune souscription), **Edge Functions** (aucune), `expo-updates` (absent de `package.json`), SDK Firebase (absent : FCM n'est utilisé que via les identifiants déposés chez Expo), crash reporting (absent) **[V]**.
- **Résilience** : 790 adresses embarquées servent de repli (`HomeView.tsx`, bloc `catch`) ; chaque requête est coupée à 10 s (`supabase.ts:8-13`). Un projet en pause donne donc une appli dégradée, pas vide. Réserve : la bibliothèque relance les `GET` (§5 E-09).

## 4. Chiffres

### 4.1 Bande passante (sortie Supabase, par mois) **[C]**

Session = lancement à froid. Sessions/mois = 4 × installations (H1, H2).

| Installations | MAU | Sessions/mois | API seule (gzip) | API + images (gzip) | API + images (brut) | Après correctifs (§5 E-02, E-10) |
|---|---|---|---|---|---|---|
| 10 000 | 4 000 | 40 000 | 18 Go | 58 Go | 120 Go | 8 Go |
| 100 000 | 40 000 | 400 000 | 183 Go | 583 Go | 1,2 To | 84 Go |
| 1 000 000 | 400 000 | 4 000 000 | 1,8 To | 5,8 To | 12 To | 840 Go |

Quotas **[V : pricing]** : Gratuit 5 Go ; Pro 250 Go inclus puis 0,09 $/Go ; sortie « mise en cache » (Storage via Smart CDN) 5 Go gratuit / 250 Go Pro puis 0,03 $/Go. **Sessions couvertes par le quota** :

| Hypothèse | Gratuit (5 Go) | Pro (250 Go) |
|---|---|---|
| API gzip + images 1 Mo | 3 400 sessions = 340 MAU | 171 000 sessions = 17 000 MAU |
| API brut + images 1 Mo | 1 700 sessions = 170 MAU | 83 000 sessions = 8 300 MAU |
| API gzip seule | 10 900 sessions = 1 100 MAU | 546 000 sessions = 55 000 MAU |
| Après correctifs | 23 800 sessions = 2 400 MAU | 1,19 M sessions = 119 000 MAU |

**Surcoût Pro au tarif public** : sans correctif, ≈ 30 $ (gzip) à 86 $ (brut) à 100 000 installations ; ≈ 500 $ à 1 060 $ à 1 million. Après correctifs : 0 $ et ≈ 53 $. **L'argent n'est donc pas le blocage ; ce sont les quotas du plan gratuit, et le « Spend Cap »** (§8).

### 4.2 Débit de requêtes et charge **[C]**

| Installations | Jour de lancement : sessions/s | requêtes/s (pic ×3) | GET catalogue/s (pic ×3) | Régime moyen | Pointe du soir (×5) |
|---|---|---|---|---|---|
| 10 000 | 0,13 | 2 (5) | 0,2 (1) | 0,2 req/s | 1 req/s |
| 100 000 | 1,3 | 16 (47) | 1,9 (6) | 1,9 req/s | 9 req/s |
| 1 000 000 | 13 | 156 (467) | 19 (58) | 18,5 req/s | 93 req/s |

- **CPU de base de données** : une requête catalogue (tri + agrégation JSON de 790 lignes de ~2 Ko) coûte 7,7 ms (17 colonnes) à 11 ms (`*`) sur le banc WebAssembly ; en natif ce sera plutôt moins, mais PostgREST ajoute sa propre sérialisation (non mesurée). À 58 GET catalogue/s au pic : ≈ 0,5 cœur-seconde par seconde au pire **[C]** → Micro/Small partagé à la limite, Medium/Large à l'aise **[N : non mesuré en production]**.
- **Débit sortant au pic de 1 million** : 58 GET × 1,27 Mio brut ≈ 74 Mo/s ≈ **0,6 Gbit/s** si l'API ne compresse pas ; ≈ 17 Mo/s (0,14 Gbit/s) si elle compresse **[C ; compression N]**. Capacité réseau de chaque taille d'instance : non documentée dans les pages lues **[N]**.
- **Connexions** : Nano = 60 connexions directes / 200 clients du pooleur ; Micro 60 / 200 ; Small 90 / 400 ; Medium 120 / 600 ; Large 160 / 800 **[V : compute-and-disk]**. L'appli passe par l'API REST (PostgREST), pas par des connexions directes. Loi de Little : 58 requêtes/s × ~10 ms ≈ 0,6 connexion occupée en moyenne **[C]** : **les connexions ne sont pas le goulot**. La taille du pool interne de PostgREST n'est pas documentée dans les pages lues **[N]** (à mesurer : `select count(*) from pg_stat_activity where usename = 'authenticator'`).

### 4.3 Poids de ligne mesuré (table + tous les index) et croissance **[C : banc local]**

| Table | Octets/ligne | Remarque |
|---|---|---|
| `push_deliveries` | **389** | table 165 + 4 index (clé, `(outbox_id, device_id)`, `status`, `(device_id, created_at)`) |
| `push_devices` | 363 | 3 index |
| `address_views` | 275 | 3 index (`merchant_system.sql`) |
| `spot_user_likes` | 252 | clé `(spot_id, device_id)` seule |
| `user_place_discoveries` | **431** | **7 index** dont 3 identiques (§5 E-13) |
| `place_suggestions` | 753 pour 560 caractères utiles ; ≈ 1,9 Ko au maximum autorisé | |
| `addresses` | ligne moyenne 2 014 octets | 790 lignes = 1,5 Mo de table |

Croissance sur 12 mois (hypothèses §2) :

| Installations | `address_views` (par mois / 13 mois) | `push_deliveries` 30 j / 7 j | `push_devices` | découvertes (avec / sans index en double) | likes |
|---|---|---|---|---|---|
| 10 000 | 33 Mo / 430 Mo | 44 / 10 Mo | 1 Mo | 10 / 6 Mo | 2 Mo |
| 100 000 | 330 Mo / **4,3 Go** | **439 Mo (à 25 000 appareils)** → 1,76 Go (à 100 000 appareils) / 102 Mo | 9 Mo | 103 / 63 Mo | 23 Mo |
| 1 000 000 | 3,3 Go / **43 Go** | 4,4 Go (250 000 appareils) → 17,6 Go (1 M appareils) / 1,0 → 4,1 Go | 91 Mo | 1,0 Go / 629 Mo | 227 Mo |

Lecture : sur le plan gratuit (500 Mo), `push_deliveries` à 25 000 appareils **ou** `address_views` à 100 000 installations suffisent à eux seuls à déclencher la lecture seule.

### 4.4 Temps pour notifier N appareils **[C]**

Débit actuel : 10 lots × 100 = **1 000 messages/min** (`push_send`, `007:429,433`). Durée = ⌈N / 1 000⌉ minutes **+ 1 à 2 min** (la collecte des tickets a lieu à la passe suivante) **+ temps de diffusion** (§7).

| N appareils | Actuel (1 000/min) | 60 lots/passe (6 000/min) | 300 lots/passe (30 000/min) | Plafond Expo (600/s) |
|---|---|---|---|---|
| 10 000 | 10 min | 2 min | < 1 min | < 1 min |
| 25 000 | 25 min | 4 min | 1 min | 1 min |
| **100 000** | **1 h 40** | 17 min | 3 min | 3 min |
| 250 000 | 4 h 10 | 42 min | 8 min | 7 min |
| **1 000 000** | **16 h 40** | 2 h 47 | 33 min | 28 min |

Capacité quotidienne actuelle : 780 000 messages si l'envoi respectait 8 h-21 h, 1 440 000 sur 24 h. À 2 messages/jour/appareil, la file **sature à 390 000 appareils (fenêtre de jour) ou 720 000 (24 h)** ; au-delà, le retard s'accumule sans limite **[C]**.

### 4.5 Coûts mensuels indicatifs **[C, tarifs publics de §14, hors taxes]**

Pro = 25 $ ; inclut un crédit de 10 $ (une instance Micro). Calcul : Small ≈ 15 $, Medium ≈ 60 $, Large ≈ 110 $ (valeurs « ≈ » de la page) donc coût net = 25 + (prix − 10). Disque : 8 Go inclus puis 0,125 $/Go. Sauvegarde à un instant précis (PITR) : 100 $ par tranche de 7 jours de rétention ; la documentation recommande de l'activer si la base doit dépasser 4 Go **[V]**. Transformations d'images : 100 images d'origine incluses puis 5 $ pour 1 000 : 1 313 images d'origine ⇒ ≈ 6 $/mois **[C]**.

| Installations | Configuration | Estimation |
|---|---|---|
| 10 000 | Pro + Micro, correctifs, transformations d'images | ≈ 31 $ |
| 100 000 | Pro + Small ou Medium, correctifs ; PITR facultatif | ≈ 36 à 86 $ (+100 $ avec PITR) |
| 1 000 000 | Pro + Large, correctifs (sortie ≈ 53 $, disque 20 à 60 Go ≈ 2 à 7 $), PITR | ≈ 290 à 350 $ |
| 1 000 000 **sans** correctifs | idem + sortie 500 à 1 060 $ | ≈ 800 à 1 400 $ |

Mapbox (§9) : 120 000 itinéraires/mois à 1 million d'installations ⇒ ≈ 40 $. Google Maps SDK pour Android : usage mobile « illimité » **[V]**.

## 5. Registre des risques et corrections

Chaque ligne : preuve, effet chiffré, correction. Les extraits SQL marqués « testé sur le banc » ont été exécutés sur le schéma réel du dépôt (migrations 006 et 007 rejouées) ; **aucun n'a été appliqué en production**.

### P0 — avant toute ouverture au public

**E-01 [P0] Le plan gratuit n'est pas compatible avec une ouverture publique.**
- **Preuve [V]** : plan gratuit = 5 Go de sortie, 500 Mo de base, 1 Go de fichiers, mise en pause après 1 semaine d'inactivité, pas de sauvegarde automatique (`pricing`, `billing-on-supabase`). Au-delà de 500 Mo : *lecture seule*, écritures en erreur `25006`, et « les tâches de fond cessent aussi d'écrire » (`database-size`) : `push_tick`, `discover_place`, `increment_spot_like` s'arrêtent. Comportement exact au-delà du quota de sortie sur le plan gratuit : non précisé (notifications et « période de grâce » selon la page `egress`) **[N]**.
- **Effet [C]** : le plan gratuit couvre ≈ 340 à 1 100 MAU (§4.1) ; une attaque d'écriture ou 25 000 appareils notifiés le font passer en lecture seule (§4.3, §10).
- **Correction** : passer en **Pro avant la publication** (25 $/mois, Micro inclus par le crédit). Décider du **Spend Cap** : *activé par défaut*, il **bloque** l'usage au-delà du quota (coupure de service, `spend-cap`) ; désactivé, il facture. Recommandation : le désactiver **et** poser une alerte de facturation à 60 % et 80 % du quota de sortie (§11). Garder un second projet gratuit comme *staging* (limite : 2 projets actifs, `pricing`). Sauvegardes quotidiennes 7 jours incluses en Pro ; PITR à partir de 4 Go.

**E-02 [P0] Le catalogue complet est retéléchargé à chaque lancement, et 1,7 Mo supplémentaires à la Recherche, alors que 1,9 Mo sont déjà dans l'appli.**
- **Preuve [V]** : §3.1 ; `HomeView.tsx:662-720`, `SearchView.tsx:67`, `MapView.tsx:369-392`, `dataCache.ts:11-30`. Le merge avec le jeu embarqué (`HomeView.tsx`, `localMap`) montre que le réseau n'apporte que des *mises à jour*.
- **Effet [C]** : 0,44 Mio compressé / 1,91 Mio brut par session (§3.2) ; 18 à 1 833 Go/mois pour la seule API selon le palier (§4.1).
- **Correction (architecture)** : 1) une ligne de version, incrémentée par l'unique chemin d'écriture du catalogue (`admin_write`) ; 2) le client lit 60 octets et ne télécharge le catalogue que si la version diffère de celle mémorisée ; 3) ne pas utiliser `select *` côté Recherche (réutiliser le catalogue de l'accueil) ; 4) option : publier un `catalogue.json` (≈ 58 Kio brotli en 12 colonnes) dans un bucket public derrière le CDN (Smart CDN, Pro).
```sql
-- 010_catalog_version.sql (proposition, non appliquée)
create table if not exists public.catalog_meta (
  id int primary key default 1 check (id = 1),
  version bigint not null default 1, updated_at timestamptz not null default now());
insert into public.catalog_meta (id) values (1) on conflict do nothing;
alter table public.catalog_meta enable row level security;
create policy "Lecture publique" on public.catalog_meta for select to anon, authenticated using (true);
grant select on public.catalog_meta to anon, authenticated;
-- dans admin_write (006:208), juste avant le return :  update public.catalog_meta set version = version + 1, updated_at = now();
```
  Côté appli : `select('version').single()` ; mémoriser la version et le catalogue sur disque. **Attention** : `expo-file-system` n'est pas dans `package.json` et `appStorage` repose sur SecureStore (inadapté à 1 Mo, voir `05c` CL-12) ; il faut donc ajouter un stockage fichier. Sans cela, comparer seulement à la version du jeu embarqué (une constante par version de l'appli) supprime déjà le téléchargement tant que l'admin ne modifie rien. Ne **pas** supprimer `update addresses … likes_count` sans lire E-12 : il ne doit pas incrémenter la version (il ne le fait pas : il ne passe pas par `admin_write`).

**E-03 [P0] Aucune limite sur les écritures publiques : un script suffit à remplir la base, la file push ou le stockage.**
- **Preuve [V]** : `register_push_token` exécutable par `anon` (`007:811`), jeton validé par format seul (`007:148`) ; insertion directe dans `address_views` (`006:741-747`) et `place_suggestions` (`006:764-774`, jusqu'à ~1,4 Ko de texte) ; `discover_place` / `increment_spot_like` acceptent n'importe quel identifiant de 32 à 40 caractères hexadécimaux (`006:406`), donc des identités illimitées ; dépôt de photos de 5 Mo par n'importe quel visiteur (`006:803-805`). Supabase ne limite pas le débit de l'API de données par défaut ; l'exemple officiel est une fonction de pré-requête qui ne limite que les écritures (`securing-your-api`) **[V]**. Déjà signalé en `01` S-17 ; **non traité** (`04-SUIVI` N-10).
- **Effet [C, H12]** : à 100 requêtes/s, 500 Mo remplis en 0,7 h (suggestions), 3,2 h (découvertes), 3,8 h (jetons), 5,1 h (vues) ; 8 Go (Pro) en 12 à 81 h. Stockage : 1 Go en 20 s à 50 Mo/s. Un million de faux jetons = 363 Mo **et** 16 h 40 de file bloquée (E-05).
- **Correction** : (a) limitation par IP des écritures par une fonction de pré-requête (testée sur le banc : 20 appels acceptés, les suivants refusés ; les `GET` ne sont jamais limités) ; (b) retirer les insertions directes au profit de RPC bornés (E-08) ; (c) téléversement de photos par URL signée après contrôle du code admin (fonction Edge) ; (d) plafond d'alerte sur le nombre d'appareils (§11).
```sql
create schema if not exists private;
create table if not exists private.rate_hits (ip text not null, scope text not null, bucket timestamptz not null,
  n int not null default 1, primary key (ip, scope, bucket));
create or replace function public.check_request() returns void language plpgsql security definer set search_path = private, public as $$
declare
  v_method text := current_setting('request.method', true);
  v_path   text := coalesce(current_setting('request.path', true), '');
  v_ip     text := split_part(coalesce(nullif(current_setting('request.headers', true), '')::json ->> 'x-forwarded-for', ''), ',', 1);
  v_scope  text; v_limit int; v_n int;
begin
  if v_method is null or v_method not in ('POST','PUT','PATCH','DELETE') or v_ip = '' then return; end if;
  v_scope := case when v_path like '%/rpc/register_push_token' then 'push'
                  when v_path like '%/rpc/admin\_%' or v_path like '%/rpc/verify_admin_access' then 'admin' else 'write' end;
  v_limit := case v_scope when 'push' then 60 when 'admin' then 30 else 600 end;   -- par IP et par 10 minutes : À CALIBRER
  insert into private.rate_hits as r (ip, scope, bucket, n) values (btrim(v_ip), v_scope, date_bin('10 minutes', now(), timestamptz 'epoch'), 1)
  on conflict (ip, scope, bucket) do update set n = r.n + 1 returning r.n into v_n;
  if v_n > v_limit then
    raise sqlstate 'PGRST' using message = json_build_object('message','Trop de requêtes')::text,
      detail = json_build_object('status', 429, 'headers', json_build_object('Retry-After','600'))::text;
  end if;
end $$;
-- puis : grant execute on function public.check_request() to anon, authenticated;
--        alter role authenticator set pgrst.db_pre_request = 'public.check_request';  notify pgrst, 'reload config';
```
  Réserves : **plusieurs étudiants partagent la même IP** (Wi-Fi de campus, 4G en CGNAT) : calibrer large, surveiller les 429. Un 429 n'est pas relancé par `postgrest-js` (seuls 503 et 520 le sont, §E-09). Ajouter `check_request` à la liste blanche des fonctions exécutables par `anon` (`scripts/audit-prod-readonly.sql`, `tests/sql/backend-audit.test.mjs`), sinon le contrôle de surface d'attaque échouera. Purger `private.rate_hits` (tâche planifiée). Cela ajoute une écriture par écriture : acceptable (< 1 000/s).

### P1 — rupture entre 10 000 et 100 000 installations, ou exposition conditionnelle

**E-04 [P1] Épuisement du quota de sortie ou facture par simple lecture (`GET` en boucle).**
- **Preuve [V]** : la clé publique est dans l'appli ; la limitation de pré-requête ne peut pas couvrir les `GET` (`securing-your-api`). `select=*` sur `addresses` renvoie 1,7 Mo brut.
- **Effet [C, H12]** : 100 req/s ⇒ 174 Mo/s brut (628 Go/h) ; **5 Go épuisés en 29 s** (gratuit), **250 Go en 0,4 h** (Pro) ; 24 h ≈ 1,4 k$ au tarif public si le Spend Cap est désactivé, ou coupure du service s'il est activé. Hypothèse de compression : [N].
- **Correction** : servir le catalogue par un fichier statique (CDN, E-02) : une lecture abusive coûte alors de la sortie *mise en cache* (0,03 $/Go) ; réduire `max_rows` si possible [N] ; alertes de facturation (§11) ; envisager un nom de domaine propre derrière un service de filtrage devant l'API (option payante : disponibilité et prix de la fonction « domaine personnalisé » **[N]**, non lus).

**E-05 [P1] Diffusion : 1 000 messages/min, envoi sans heures calmes ni péremption, file strictement FIFO.**
- **Preuve [V]** : `push_send` boucle 10 fois sur 100 livraisons (`007:429,433`) ; la vérification des heures calmes n'est que dans `push_fanout` (`007:366`), pas dans `push_send` (`007:416-455`) ; aucune péremption des livraisons (seul `push_outbox` périme à 24 h, `007:362-363`) ; ordre `order by d.id` (`007:433`) ; `ttl` fixe de 86 400 s (`007:438`).
- **Effet [C]** : §4.4. Un message fanné-out à 20 h 59 vers 1 million d'appareils est envoyé jusqu'à 13 h 39 le lendemain, **nuit comprise** ; une annonce de 1 million de lignes retarde tout message plus récent (pas de priorité) ; avec de faux jetons (E-03) la file est occupée à notifier du vide.
- **Limites externes [V]** : Expo accepte 100 messages/requête et **600 notifications/s par projet** (`sending-notifications`) ; `pg_net` est conçu pour **200 requêtes/s au plus** (`pg_net` doc) ; `pg_cron` : une seule instance d'un même job à la fois, la suivante attend (`pg_cron` README). À 6 000 msg/min on émet 1 requête/s : bien en dessous des deux plafonds. **Ce n'est ni Expo ni pg_net qui limitent ; c'est la boucle de 10 lots.**
- **Correction** : paramétrer le nombre de lots, refuser l'envoi la nuit, périmer les livraisons trop anciennes, raccourcir le `ttl` des événements.
```sql
create or replace function public.push_send(p_batches integer default 60) returns integer ... as $$
  -- au début :
  if extract(hour from now() at time zone 'Europe/Paris') not between 8 and 20 then return 0; end if;
  update public.push_deliveries set status = 'failed', error = 'expired'
   where status = 'pending' and created_at < now() - interval '3 hours';
  for i in 1..p_batches loop ... (corps inchangé, 'ttl' => 3600) ... end loop;
$$;
```
  À lier : les **reçus** ne traitent que 1 000 identifiants par minute (`007:594`) : à 6 000 envois/min il faut 6 requêtes de reçus/min (Expo en accepte 1 000 par requête, conserve les reçus 24 h) **[V]**. Et `net._http_response` (conservée 6 h par défaut, `pg_net` doc) contiendrait ≈ 1,2 Go de réponses à 30 000 msg/min : supprimer chaque réponse après lecture ou raccourcir `pg_net.ttl` (réglage réservé : demande au support) **[N pour les droits]**.

**E-06 [P1] Le calcul du plafond « 2 pushs / 24 h » est quadratique quand les statistiques sont périmées (mesuré).**
- **Preuve [V + C]** : sous-requête corrélée par appareil (`007:399-403`) sur `push_deliveries`, dont l'index `status` (`007:105`) est très peu sélectif. Plusieurs messages à plafond dans **la même passe** (un événement et une date d'agenda, ou deux événements en moins de 2 minutes) s'exécutent dans une seule transaction : après l'insertion massive du premier, le planificateur n'a pas de statistiques à jour. **Banc local** (annonce de 100 000 lignes, puis un événement) : **8,4 s pour 20 000 appareils, 225 s pour 100 000**, contre **0,34 s** si les statistiques sont fraîches et **0,27 s** avec la requête ensembliste ci-dessous (**1,4 s pour 100 000, 21,9 s pour 1 million**). Extrapolation quadratique à 1 million : ≈ 6 h 15 **[C]**. Pendant ce temps le job bloque les passes suivantes (pg_cron ne les lance pas en parallèle).
- **Correction (testée sur le banc)** : remplacer la sous-requête par un décompte groupé, et découper la diffusion en tranches.
```sql
insert into public.push_deliveries (outbox_id, device_id, token)
select o.id, d.device_id, d.token
  from public.push_devices d
  left join (select device_id, count(*) n from public.push_deliveries
              where created_at > p_now - interval '24 hours' and status in ('pending','queued','sent','receipt_ok')
              group by device_id) c using (device_id)
 where d.invalid_at is null
   and case o.kind when 'event' then d.notify_events when 'agenda' then d.notify_agenda
                    when 'new_spot' then d.notify_new_spots else d.notify_events end
   and (o.kind = 'announcement' or coalesce(c.n, 0) < c_cap)
on conflict (outbox_id, device_id) do nothing;
```
  Ajouter une colonne de reprise (`push_outbox.fanout_cursor`) et ne traiter que ~20 000 appareils par passe, ne passant le message à `fanned_out` qu'à la fin. Index partiels à créer **maintenant, tant que les tables sont vides** (sans `concurrently`, qui ne passe pas dans l'éditeur SQL) : voir E-13.

**E-07 [P1] Rétention de 30 jours et purge par balayage unique : `push_deliveries` devient la plus grosse table et la purge peut échouer en boucle.**
- **Preuve [V]** : 30 jours (`007:751`) ; aucun index sur `created_at` seul (`007:105-106`) : le plan est un balayage séquentiel (banc) ; tout est supprimé en une seule fonction/transaction (`007:736-787`) ; la détection d'inactivité agrège **quatre tables entières** chaque nuit (`007:768-775`, plan : `HashAggregate` sur des `Seq Scan`). Les reçus ne vivent que 24 h chez Expo **[V]** et le code abandonne après 24 h (`007:553`) : 30 jours dépassent le besoin technique (durée juridique : à valider, `03` D-04).
- **Effet [C]** : 439 Mo à 25 000 appareils, 4,4 Go à 250 000 (§4.3). Balayage du tas à 1 million d'appareils (7,4 Go) ≈ 11 min au débit de base d'un Micro (11 Mo/s) ; ≈ 25 min sur le plan gratuit (5 Mo/s) **[V : débits de `compute-and-disk`]**, au-dessus des 10 minutes recommandées par tâche (`cron` doc). Si la purge dépasse le délai ou échoue, **rien n'est purgé** et la table grossit : boucle.
- **Correction** : rétention 7 jours (durée à valider), index BRIN sur `created_at`, suppression par lots (testée sur le banc : 50 000 + 50 000 + 20 000 puis 0 ligne).
```sql
create index if not exists idx_pd_created_brin on public.push_deliveries using brin (created_at);
create or replace function public.purge_deliveries_batch(p_keep interval default '7 days', p_batch int default 50000)
returns integer language plpgsql as $$ declare v int; begin
  with doomed as (select id from public.push_deliveries where created_at < now() - p_keep order by created_at limit p_batch for update skip locked)
  delete from public.push_deliveries d using doomed where d.id = doomed.id;
  get diagnostics v = row_count; return v; end $$;
select cron.schedule('lpt-purge-deliveries', '*/5 3-5 * * *', 'select public.purge_deliveries_batch()');
```
  Conserver avant suppression un décompte par message (`push_outbox_stats`) pour l'observabilité. Pour l'inactivité : remplacer l'agrégation globale par une table `device_seen(device_id, last_seen)` mise à jour par les RPC, puis purger par lots — **seulement** quand une des tables dépasse ~1 million de lignes.

**E-08 [P1] `address_views` : une ligne de 275 octets par ouverture de fiche, 13 mois.**
- **Preuve [V]** : `AddressDetailModal.tsx:121-132`, `006:733-748`, `007:763` (13 mois), index `merchant_system.sql`. L'usage prévu (tableau de bord commerçant) n'a pas besoin de la ligne individuelle ; la politique de confidentialité dit « sans identifiant ».
- **Effet [C]** : 4,3 Go à 100 000 installations, 43 Go à 1 million ; en temps réel 3 écritures par session (≈ 5 à 280/s au pic).
- **Correction (testée sur le banc)** : un compteur par adresse et par jour (≈ 790 × 396 jours × ~60 octets ≈ 20 Mo, **indépendant** du nombre d'utilisateurs).
```sql
create table public.address_view_daily (spot_id text not null, day date not null, n integer not null default 0, primary key (spot_id, day));
create function public.track_view(p_spot text) returns void language sql security definer set search_path = public as $$
  insert into public.address_view_daily as v (spot_id, day, n)
  select left(p_spot, 64), (now() at time zone 'Europe/Paris')::date, 1 where char_length(p_spot) between 1 and 64
  on conflict (spot_id, day) do update set n = v.n + 1; $$;
-- client : supabase.rpc('track_view', { p_spot: spot.id }) ; puis : revoke insert on public.address_views from anon, authenticated;
```
  (`track_view` est une 18e fonction à ajouter à la liste blanche d'audit.) Vérifier que le tableau de bord commerçant n'utilise pas les lignes individuelles **[N]**.

**E-09 [P1] Les `GET` sont relancés jusqu'à 3 fois par la bibliothèque : une panne est multipliée par 4.**
- **Preuve [V]** : `node_modules/@supabase/postgrest-js` 2.108.2, `dist/index.cjs:5-27, 115-120, 305-320` : relances pour `GET/HEAD/OPTIONS` sur erreur réseau non « AbortError » **et** sur les statuts **520 et 503**, attentes 1, 2, 4 s, `Retry-After` obéi sans plafond ; désactivable par requête avec `.retry(false)` (`:273`). Les `POST` (RPC) ne sont pas relancés ; un 429 non plus. Le correctif de délai déjà dans l'arbre de travail (`fetchWithTimeout.ts`) règle le cas du délai (`05c` CL-01), **pas** celui des 503/520.
- **Effet [C]** : au pic de 1 million, 58 GET catalogue/s deviennent ≈ 230/s sur un serveur déjà en difficulté.
- **Correction** : `.retry(false)` sur les chargements du catalogue (le repli embarqué existe) ; si on veut une relance, une seule, avec gigue aléatoire, dans le magasin concerné.

**E-10 [P1] Les photos sont servies en originaux (788 couvertures + 525 images de galerie dans le stockage Supabase).**
- **Preuve [V]** : `dataset.json` : 788 `image_url` et 525 `gallery_urls` pointent vers `…/storage/v1/object/public/…` ; `imageOptimizer.ts:15-18` renvoie l'URL d'origine « car `render/image` exige l'offre Pro » ; largeurs demandées 200 à 800 px mais ignorées (`HomeView.tsx:1401,1510,1824,1920`). Le scraper a téléversé les images telles quelles (`scraper_images_supabase.py`). `expo-image` met en cache disque (`cachePolicy="memory-disk"`, `HomeView.tsx:1510…`), ce qui lisse la charge après les premières sessions.
- **Effet [N/C]** : **poids réel non mesuré** ; H5 = 1 Mo/session ⇒ 40 Go/mois à 10 000 installations, 4 To à 1 million (§4.1) ; c'est probablement le premier poste de sortie. Le stockage (1 Go gratuit) est peut-être déjà proche de la limite **[N]**.
- **Correction** : à partir du plan Pro, transformations d'image (WebP automatique, `width` 1 à 2 500, `quality` 20 à 100) **[V : image-transformations]** ; 5 $ pour 1 000 images d'origine au-delà de 100 ⇒ ≈ 6 $/mois. Adapter `getOptimizedImageUrl` :
```ts
if (trimmed.includes('.supabase.co/storage/v1/object/public/'))
  return trimmed.replace('/object/public/', '/render/image/public/') + `?width=${width}&quality=${quality}`;
```
  Mesure à lancer par le propriétaire (lecture seule) : `select count(*), pg_size_pretty(sum((metadata->>'size')::bigint)) from storage.objects where bucket_id = 'etablissements';`

**E-11 [P1] Aucun filet : pas de sauvegarde sur le plan gratuit, pas d'alerte, pas de test de charge, pas de remontée d'erreurs.**
- **Preuve [V]** : `pricing` (pas de sauvegarde en gratuit) ; aucune alerte ni sonde dans le dépôt ; pas de crash reporting dans `package.json` ; `02-PUBLICATION.md:24` le signale déjà. La documentation Supabase demande un test de charge avant lancement, de préférence sur un environnement de préproduction, avec par exemple k6 (`going-into-prod`).
- **Correction** : Pro (E-01) ; alertes et sondes (§11) ; un test k6 sur le second projet gratuit rejouant le démarrage (8 requêtes) et l'inscription de jetons, **jamais sur la production**.

### P2

**E-12 [P2] `increment_spot_like` : une écriture sur une ligne large + compteurs falsifiables.**
- **Preuve [V]** : `006:701-708` écrit `spot_likes` **puis** réécrit la ligne de `addresses` (2 014 octets en moyenne) à chaque like ; verrou de ligne tenu jusqu'à la validation sur chacune des deux lignes. Un like par couple (adresse, appareil) (`006:647-652`), mais les identités sont illimitées (E-03).
- **Banc [C]** : 2 000 likes sur la **même** adresse en 443 ms, répartis en 403 ms (0,2 ms/appel, un seul client, sans `fsync`) : le verrou n'est pas un problème à l'échelle réelle ; en production, le temps de validation (≈ 1 à 3 ms **[N]**) limiterait une adresse à quelques centaines de likes/s. Mises à jour toutes « HOT » (pas d'index sur `likes_count`) mais la table passe de 1,5 à 2,6 Mo en 4 000 likes sans nettoyage (autovacuum absent du banc).
- **Correction** : ne plus toucher `addresses` ; synchroniser en différé si l'affichage le demande (vérifier `formatRawAddress`, `placesRepository.ts:139` **[N]**).
```sql
-- retirer de increment_spot_like :  update public.addresses set likes_count = v_total where id::text = v_spot;
select cron.schedule('lpt-sync-likes', '*/10 * * * *', $$
  update public.addresses a set likes_count = s.likes_count from public.spot_likes s
   where s.spot_id = a.id::text and a.likes_count is distinct from s.likes_count $$);
```
  Les likes restent manipulables par n'importe quel script (identités gratuites) : limite connue, à traiter par E-03 (IP), pas par le schéma.

**E-13 [P2] Index en double ou manquants.**
- **Preuve [V + C]** : `user_place_discoveries` porte 7 index (banc, 800 000 lignes, 329 Mo au total) dont **3 strictement identiques** sur `(device_id, place_id)` (`setup_discoveries_schema.sql:20,40` et `006:386-387`) et un préfixe redondant `(device_id)` (`:38`) : **135 Mo sur 329 (41 %)** inutiles. Même chose sur `user_discount_cards` (`002:52,67` et `006:388-389`). À **vérifier en production** (`pg_indexes`) **[N]**. `spot_user_likes` n'a **pas** d'index sur `device_id` (clé `(spot_id, device_id)`) : `delete_my_data` (`007:713`) et la purge filtrent par appareil (banc : 32 ms contre 0,07 ms avec index, sur PostgreSQL 18 qui a un « skip scan » ; sur une version plus ancienne ce sera un balayage complet). Les 5 index de `create_performance_indexes.sql` ne sont utilisés par aucune requête du client (le filtrage est local) : sans effet nuisible à 790 lignes. Index de `push_deliveries` : `status` est peu sélectif ; le banc montre une sélection de `push_send` qui trie toutes les lignes en attente (**46 ms pour 36 000 en attente sur 200 000**, proportionnel au retard ; 0,48 ms avec un index partiel).
- **Correction** (rejouer ensuite 006 modifié, sinon il recrée les doublons) :
```sql
drop index if exists public.uq_discoveries_device_place, public.idx_discoveries_device_place, public.idx_discoveries_device;
drop index if exists public.uq_user_cards_device_card, public.idx_user_discount_cards_device;
create index if not exists idx_spot_user_likes_device on public.spot_user_likes (device_id);
create index if not exists idx_pd_pending on public.push_deliveries (id) where status = 'pending';
create index if not exists idx_pd_sent_receipt on public.push_deliveries (id) where status = 'sent' and receipt_checked_at is null;
create index if not exists idx_pr_open on public.push_requests (created_at) where collected_at is null;
drop index if exists public.idx_push_deliveries_status;
```
  (les contraintes `unique_device_place` et `unique_user_card` restent et servent aux `on conflict`.)

**E-14 [P2] `push_tick` enchaîne collecte, diffusion, envoi et reçus dans une seule transaction.**
- **Preuve [V]** : `007:610-628`. Une erreur dans l'une des quatre phases annule les autres et se répète chaque minute ; une phase lente retarde les trois autres (§E-06).
- **Correction** : un job `pg_cron` par phase, ou un bloc `begin … exception when others then …` par phase avec journal des erreurs. Planifier aussi le ménage de `cron.job_run_details` (E-21).

**E-15 [P2] Délais d'attente de `pg_net` et risque de doublons.**
- **Preuve [V]** : `net.http_post` sans `timeout_milliseconds` (`007:443-446`) ; défaut **5 000 ms** selon le README du projet, **2 000 ms** selon la page Supabase : la valeur dépend de la version installée **[N : `\df+ net.http_post`]**. Une réponse absente ou non 200 remet les livraisons en attente (`007:495-505, 513-518`) alors qu'Expo peut avoir accepté la requête ; Expo garantit « au moins une tentative » et reconnaît qu'un doublon est plus probable qu'une perte **[V]**.
- **Correction** : fixer `timeout_milliseconds := 15000` ; ne rejouer une livraison qu'après une réponse d'erreur explicite, pas après un simple délai ; accepter le doublon résiduel.

**E-16 [P2] Verrouillage d'administration global, vérifié avant la session admin ; aucune limite d'annonces.**
- **Preuve [V]** : `_admin_gate` refuse tout après 10 échecs en 15 min (`006:66-69`) **avant** de regarder si l'appelant est un administrateur authentifié (`006:72-74`) ; `admin_send_push` n'a aucun plafond (`007:633-655`) et les annonces ignorent le plafond de 2/jour (`007:399`). Un attaquant peut empêcher d'envoyer une annonce urgente (`04-SUIVI` N-09) ; le « spam d'annonces » ne peut venir que du code admin (le code est vérifié côté serveur, `007:644`).
- **Correction** : tester la session admin avant le verrou ; verrouiller par IP plutôt que globalement ; plafonner à 3 annonces/24 h dans `admin_send_push` ; ajouter la clé d'idempotence `p_client_ref` (déjà proposée en `05c` CL-14).

**E-17 [P2] Limite de lignes de l'API : troncature silencieuse au-delà de 1 000.**
- **Preuve [N]** : les références officielles du client indiquent 1 000 lignes par défaut, réglable dans les paramètres d'API (« Max rows »), sans erreur au-delà (§14, sources 17-18) ; non vérifié dans le tableau de bord. Aucun `.range()`/`.limit()` dans `src/` **[V]**. Le catalogue compte 790 adresses ; il croîtra.
- **Correction** : vérifier le réglage, paginer ou versionner (E-02), ajouter une alerte « nombre d'adresses > 900 ».

**E-18 [P2] Clés et jetons embarqués côté client : quotas des tiers.**
- **Preuve [V]** : `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` est inclus dans l'application (`MapView.tsx:76,928`, `app.config.js`) ; une clé Google Maps Android est dans l'APK (`app.config.js`). Restrictions de ces clés (package, empreinte, URL) : **[N]**.
- **Correction** : voir §9.

**E-19 [P2] `place_suggestions` jamais purgée, modération noyable.**
- **Preuve [V]** : `03` A18 ; 753 octets/ligne pour 560 caractères, ≈ 1,9 Ko au maximum ; insertion directe (E-03).
- **Correction** : passer par un RPC borné (3 suggestions/appareil/jour, limitation d'IP) et purger les suggestions traitées après 12 mois.

### P3

**E-20** `register_push_token` à chaque lancement réécrit la ligne même sans changement (`007:158-168`, `pushNotifications.ts:163-174`) : ~1 écriture par session pour les abonnés. Ajouter `where push_devices.token is distinct from excluded.token or push_devices.updated_at < now() - interval '1 day'`.
**E-21** `cron.job_run_details` n'est pas purgé automatiquement (README pg_cron) : 1 440 lignes/jour pour `lpt-push-tick` (`007:829`), soit ≈ 10 à 15 Mo/mois **[C, non mesuré]**. `select cron.schedule('lpt-cron-clean','0 4 * * *', $$delete from cron.job_run_details where end_time < now() - interval '7 days'$$);`
**E-22** Chargement de l'accueil en 4 requêtes séquentielles (latence, pas de charge ; `05a` P0-2 et `05c` CL-03 proposent `Promise.all`).
**E-23** `setup_global_likes.sql` rejoué restaurerait une version de `increment_spot_like` sans contrôle (delta arbitraire, accessible à `public`, `:53-58`) : l'en-tête d'avertissement existe, ajouter un garde (`raise exception` si `006` est détecté).
**E-24** Code mort à supprimer avant qu'il ne soit branché : `dataStore.fetchAndSyncAll`, `placesRepository.getMapSpots/getSpotDetail`.
**E-25** `sponsored_partners` lu en `select *` avec le montant payé (voir `05b` R-07) : alourdit aussi la réponse (sans effet d'échelle).

## 6. Analyse par table et par fonction

Légende : **Idx** = index vérifiés dans les scripts (fichier:ligne) ; **Verrous** = contention possible ; **Croissance** = §4.3 ; **Purge** = ce qui existe.

| Objet | Idx | Verrous | Croissance | Purge | Verdict |
|---|---|---|---|---|---|
| `addresses` (790 lignes, 2 Ko/ligne) | clé ; 5 index jamais utilisés par le client (`create_performance_indexes.sql:5-27`) ; aucun sur `created_at` (tri sur 790 lignes sans importance) | ligne réécrite à chaque like (`006:708`) | stable | — | sain ; retirer l'écriture du like (E-12) |
| `categories`, `events`, `sponsored_partners`, `partner_events` | `events(event_date)`, `partner_events(start_date)`, `(spot_id)` (`004:23-24`) ; filtre `repeat_weekly_until` non indexé (table minuscule) | — | quelques centaines de lignes | — | sain |
| `spot_likes` | clé `spot_id` | ligne chaude par adresse | 790 lignes | — | sain |
| `spot_user_likes` | clé `(spot_id, device_id)` ; **manque `(device_id)`** | — | 252 o/like | inactivité 24 mois (`007:773`) | E-13 |
| `user_place_discoveries` | **7 index dont 3 identiques** | insertion simple | 431 o/ligne ; ≤ 790 lignes/appareil | inactivité 24 mois par agrégation globale | E-07, E-13 |
| `user_discount_cards`, `discount_card_uses` | doublons (`002:52,67`, `006:388`) ; `discount_card_id` non indexé dans `discount_card_uses` (suppression en cascade rare) | `use_discount_card` : verrou sur la ligne de l'appareil seulement | borné par `max_uses` × cartes × appareils | idem | quota contournable par nouvel identifiant (`01` S-16) ; croissance maîtrisée |
| `address_views` | 3 index | insertions concurrentes sans conflit | 275 o/vue, illimité | 13 mois | **E-08** |
| `place_suggestions` | `status`, `device_id` (`setup_discoveries_schema.sql:41-42`) | — | ~1 Ko/ligne | **aucune** | E-19 |
| `push_devices` | clé, `unique(device_id)`, `unique(token)` | — | 363 o/appareil | jetons invalides 30 j ; 270 j d'inactivité (`007:757-759`) | E-03 (inondation) |
| `push_outbox` | clé, `unique(kind, ref_id)` | — | quelques lignes/jour | 30 j | sain |
| `push_deliveries` | clé ; `unique(outbox_id, device_id)` ; `status` ; `(device_id, created_at)` | `for update skip locked` (pas d'attente) | **389 o × appareils × msg/jour × rétention** | 30 j, balayage séquentiel | **E-06, E-07, E-13** |
| `push_requests` | clé `request_id` ; aucun index sur `collected_at` | — | 1 ligne par lot de 100 | 7 j | E-13 (index partiel) |
| `admin_login_attempts` | aucun (table minuscule) | suppression à chaque appel (`006:64`) | ≤ ~1 000 lignes/jour | 1 jour | sain |
| `cron.job_run_details`, `net._http_response` | — | — | 1 440 lignes/jour ; ≈ 40 Mo/6 h à 1 000 msg/min, ≈ 1,2 Go à 30 000 | TTL 6 h pour pg_net ; **rien** pour cron | E-05, E-21 |

| Fonction | Complexité | Appelée par | Verdict |
|---|---|---|---|
| `get_my_discoveries`, `get_my_card_usage` | recherche par index `device_id` | chaque lancement | sain |
| `discover_place` | 1 recherche + 1 insertion + 1 agrégat sur ≤ 790 lignes (`006:489-531`) | action utilisateur | sain ; illimité par identité (E-03) |
| `use_discount_card` | mise à jour conditionnelle atomique (`006:568-573`) | action utilisateur | sain |
| `delete_my_data` | `discount_card_uses`, `user_discount_cards`, `user_place_discoveries` : `BitmapOr` sur les index `device_id` et `user_id` (**vérifié par plan sur 800 000 lignes**) ; `spot_user_likes` : voir E-13 | action utilisateur | sain après E-13 |
| `increment_spot_like` | 2 écritures + 1 recherche | action utilisateur | E-12 |
| `register_push_token` | 1 suppression par `token` (index unique) + 1 upsert | lancement (si activé) | E-03, E-20 |
| `push_fanout` | **O(N) avec jointure, O(N²) avec la sous-requête actuelle** | cron | E-06 |
| `push_send` | O(retard) pour la sélection ; 1 insertion `push_requests` + 1 mise à jour par lot | cron | E-05, E-13 |
| `push_collect` | 1 mise à jour par ticket : 118 ms pour 1 000 tickets (banc) | cron | sain jusqu'à ~30 000/min (≈ 3,5 s) |
| `push_receipts` | 1 requête de ≤ 1 000 identifiants | cron | E-05 |
| `purge_old_data` | balayages séquentiels, une transaction | cron 3 h 15 | E-07 |

## 7. La chaîne de notifications en détail

| Étape | Coût mesuré sur le banc [C] | À 100 000 appareils | À 1 000 000 appareils |
|---|---|---|---|
| Inscription des jetons | 363 o/appareil ; upsert | 36 Mo | 363 Mo |
| `push_fanout` annonce (sans plafond) | 100 000 lignes en 1,3 s | ≈ 1,3 s | ≈ 13 à 20 s |
| `push_fanout` événement, code actuel, statistiques périmées | **225 s pour 100 000** (8,4 s pour 20 000) | 3 min 45 s | ≈ 6 h (extrapolé) |
| `push_fanout` événement, jointure groupée | 1,4 s pour 100 000 ; 21,9 s pour 1 million | 1,4 s | 22 s (tranches de 20 000 conseillées) |
| `push_send`, 1 passe de 1 000 messages | 28 à 467 ms selon le plan (46 ms/lot avec 36 000 en attente) | négligeable | ≈ 13 s/passe si 1 M en attente (extrapolé) |
| `push_collect`, 1 000 tickets | 118 ms | — | — |
| `push_receipts` + collecte des reçus | 19 ms + 29 ms | — | — |
| Écritures par message livré | 1 insertion + 3 mises à jour (≈ 1,6 Ko d'écritures) **[C]** | 160 Mo | 1,6 Go (≈ journal d'écriture) |
| Durée de diffusion | §4.4 | 1 h 40 | 16 h 40 |

Limites de l'écosystème **[V]** : Expo ≤ 100 messages/requête, 600 notifications/s/projet, 1 000 identifiants/requête de reçus, reçus conservés 24 h, charge utile ≤ 4 096 octets ; `pg_net` jusqu'à 200 requêtes/s, réponses conservées 6 h, `pg_cron` une instance par job et ≤ 8 jobs simultanés recommandés (nous en avons 2), 10 minutes recommandées par job. Un pic d'ouvertures déclenché par une notification est lissé par le débit actuel : à 1 000 msg/min et 8 % d'ouvertures **[C]**, ≈ 1,3 session/s, soit ≈ 12 requêtes/s ; **en accélérant l'envoi à 600/s, 8 % d'ouvertures donnent ≈ 48 sessions/s ≈ 430 requêtes/s dont ≈ 72 GET catalogue/s** : l'accélération de la diffusion (E-05) doit donc venir **avec** E-02.

## 8. Plans Supabase, instance, quotas

| | Gratuit | Pro | Source |
|---|---|---|---|
| Prix | 0 | à partir de 25 $/mois (crédit de 10 $ = une instance Micro) | `pricing` |
| Base | 500 Mo ; lecture seule au-delà | 8 Go de disque inclus, 0,125 $/Go ; agrandissement automatique à 90 % (+50 %) | `pricing`, `database-size` |
| Sortie | 5 Go / 5 Go mise en cache | 250 Go à 0,09 $/Go / 250 Go à 0,03 $/Go | `pricing`, `egress` |
| MAU Auth | 50 000 | 100 000 puis 0,00325 $ | `pricing` (0 utilisé) |
| Fichiers | 1 Go | 100 Go puis 0,0213 $/Go | `pricing` |
| Sauvegardes | aucune | quotidiennes 7 jours ; PITR 100 $/7 jours | `pricing` |
| Pause d'inactivité | après 1 semaine | non | `pricing` |
| Instance | Nano : CPU partagé, jusqu'à 0,5 Go, 60 connexions, 200 clients du pooleur, débit disque de base 5 Mo/s et 250 E/S par s | Micro 1 Go (60/200, 11 Mo/s, 500 E/S), Small 2 Go (90/400), Medium 4 Go (120/600), Large 8 Go dédié 2 vCPU (160/800), XL 16 Go (240/1 000) | `compute-and-disk` |
| Spend Cap | — | **activé par défaut : bloque l'usage au-delà du quota** | `spend-cap`, `pricing` |
| Smart CDN (Storage) | non précisé **[N]** | activé automatiquement | `smart-cdn` |
| Transformations d'images | non | oui, 100 images d'origine incluses puis 5 $/1 000 | `image-transformations` |

Choix d'instance : le jeu chaud (catalogue 2 Mo, appareils, livraisons du jour) tient en mémoire jusqu'à ≈ 100 000 installations ; à 1 million, les livraisons du jour (≈ 585 Mo à 1,5 msg/jour/appareil pour 1 million d'appareils, 390 o/ligne) dépassent la mémoire d'un Micro : prévoir Medium/Large et les débits disque associés **[C]**. Les débits de base du disque (5 à 11 Mo/s sur Nano/Micro) sont ceux qui s'effondrent quand la purge ou l'autovacuum lisent la table entière.

## 9. Dépendances tierces

| Service | Usage vérifié | Limite / coût | Risque |
|---|---|---|---|
| **Expo Push** | envoi serveur (`007:443`) ; jetons `ExponentPushToken` | 100/requête, **600 notifications/s/projet** **[V]** ; tarif du service push : non mentionné sur `expo.dev/pricing` ni sur la page de présentation **[N]** | sécurité renforcée (jeton d'accès) facultative, non activée ; nous envoyons sans authentification, comme le permet le service **[V]** |
| **EAS Update** | absent (`package.json`) | « 1 000 MAU » en gratuit, sans objet **[V]** | aucun |
| **Firebase / FCM** | uniquement le fichier de configuration et la clé déposée dans EAS ; aucun SDK Firebase **[V]** | la page de quotas consultée n'a pas pu être lue (404) ; la page « scale-fcm » cite 600 000 jetons/min **en exemple** ; coût : non lu **[N]** | nous sommes très loin de tout plafond (≤ 36 000 msg/min via Expo) |
| **APNs (Apple)** | via Expo | non lu **[N]** | — |
| **Mapbox** | web (Mapbox GL JS dans une iframe : `mapboxHtmlTemplate.ts:17-18`) et **itinéraires** natifs `directions/v5` (`MapView.tsx:928`) | 50 000 chargements de carte web/mois gratuits puis 5 $/1 000 ; **100 000 requêtes Directions/mois** gratuites puis 2 $/1 000 ; SDK mobile 25 000 MAU gratuits (non utilisé) **[V : mapbox.com/pricing]** | jeton public embarqué : quiconque l'extrait peut consommer le quota ; restrictions (URL…) à vérifier **[N]** ; 120 000 itinéraires/mois à 1 M d'installations ≈ 40 $ **[C]** |
| **Google Maps SDK** | Android (`react-native-maps`, clé injectée par `app.config.js`) ; fournisseur iOS non précisé dans le code (`MapView.tsx`, aucun `provider`) | « tout usage mobile du SDK Android est illimité » et la référence « Mobile Native Dynamic Maps » est à 0 $ **[V]** | clé dans l'APK : restreindre par nom de paquet et empreinte **[N]** |
| **Supabase Storage** | images (§E-10) | voir §8 | principal poste de sortie **[N : poids]** |

## 10. Abus et limitation de débit de la clé publique

La clé `anon` est dans l'application : tout utilisateur la lit. Supabase n'impose pas de limite par défaut sur les écritures de l'API de données ; seules les limites d'Auth sont documentées (par ex. 30 inscriptions anonymes/h/IP, non utilisées ici) **[V]**.

| Vecteur | Coût pour l'attaquant | Effet [C, H12] | Contre-mesure |
|---|---|---|---|
| Inscription massive de jetons (`register_push_token`) | 1 requête/jeton, format seul vérifié | 363 Mo par million ; file bloquée 16 h 40 ; Expo reçoit des jetons morts | E-03 (limite d'IP 60/10 min, à calibrer) + alerte de croissance ; les faux jetons sont invalidés au premier envoi (`DeviceNotRegistered`, `007:537-540`) puis purgés à 30 jours |
| Inondation `address_views` | 1 requête | 28 Ko/s ⇒ 500 Mo en 5 h | E-08 (compteur journalier) |
| Inondation `place_suggestions` | 1 requête, 1,4 Ko de texte | 190 Ko/s ⇒ 500 Mo en 0,7 h ; boîte de modération noyée | E-19 + E-03 |
| Découvertes / likes / cartes avec des identités fabriquées | 1 requête | 43 Ko/s ; compteurs faussés ; quotas de cartes contournés (`01` S-16) | E-03 ; limite connue de l'absence de compte |
| Téléversement de photos anonyme | 1 requête de 5 Mo | 1 Go en 20 s à 50 Mo/s ; bucket public servi à tous | URL signée après contrôle admin (`04-SUIVI` N-10) |
| Lecture en boucle du catalogue (scraping) | 1 `GET` | 5 Go en 29 s ; 1,4 k$/24 h (Pro sans Spend Cap) | E-02/E-04 (CDN, alertes, Spend Cap décidé) |
| Force brute du code admin | 1 appel | verrouille l'admin 15 min (global) | E-16 |
| Spam d'annonces | nécessite le code admin | n/a | plafond 3/24 h (E-16) |

Pré-requis officiel pour la limitation : fonction `pgrst.db_pre_request`, qui ne s'applique qu'aux méthodes d'écriture (`POST/PUT/PATCH/DELETE`) et lit l'IP dans `x-forwarded-for` **[V]**. Les adresses IP partagées (campus, opérateurs mobiles) imposent des seuils larges et une surveillance des refus.

## 11. Surveillance et alertes à prévoir

À mettre en place **avant** l'ouverture ; aucun de ces éléments n'existe aujourd'hui dans le dépôt **[V]**.

| Signal | Seuil proposé | Où | Remarque |
|---|---|---|---|
| Sortie du mois (tous services) | alerte à 60 % et 80 % du quota ; coupure possible à 100 % si Spend Cap | page d'usage Supabase / alerte de facturation | les journaux de la passerelle d'API n'ont **pas** les octets de réponse **[V]**, d'où la page d'usage |
| Taille de la base | > 70 % de 500 Mo (gratuit) ou 80 % du disque (Pro) | requête planifiée + page d'usage | lecture seule à 500 Mo / 95 % du disque **[V]** |
| Retard de la file push | plus ancienne livraison `pending` > 15 min, ou > 20 000 en attente | requête ci-dessous | |
| Taux d'échec push | > 5 % de `failed`/`receipt_error` sur 24 h ; pic de `invalid_token` | idem | signe d'inondation de faux jetons ou de clé FCM invalide |
| Inscriptions de jetons | > 5× la moyenne horaire | requête ci-dessous | |
| Tâches planifiées | échec, ou durée > 30 s pour `lpt-push-tick` | `cron.job_run_details` | |
| Réponses `pg_net` en erreur | > 1 % sur 1 h | `net._http_response` | |
| Disponibilité | sonde externe toutes les 5 min sur `GET /rest/v1/catalog_meta?select=version` | un service de sonde quelconque, hors Supabase | empêche de découvrir une pause par les utilisateurs |
| Erreurs de l'appli | taux de plantage | outil à choisir (aucun dans `package.json`) ; à défaut, consoles Apple/Google | |
| Compteurs 429 (limiteur) | > 1 % | `private.rate_hits` | faux positifs de campus |

Requêtes (exécutées avec succès sur le schéma du dépôt ; `cron` et `net` sont absents du banc, à contrôler en production) :
```sql
select count(*) filter (where status='pending') as en_attente,
       extract(epoch from now() - min(created_at) filter (where status='pending'))/60 as plus_ancien_min,
       count(*) filter (where status in ('failed','receipt_error'))::float / nullif(count(*),0) as taux_echec_24h
  from public.push_deliveries where created_at > now() - interval '24 hours';
select date_trunc('hour', created_at) h, count(*) from public.push_devices where created_at > now() - interval '48 hours' group by 1 order by 1 desc;
select jobname, d.status, d.end_time - d.start_time as duree from cron.job_run_details d join cron.job j using (jobid)
 where d.start_time > now() - interval '1 hour' and (d.status <> 'succeeded' or d.end_time - d.start_time > interval '30 seconds');
select status_code, timed_out, count(*) from net._http_response where created > now() - interval '1 hour' and (status_code is distinct from 200 or timed_out) group by 1,2;
select relname, pg_size_pretty(pg_total_relation_size(c.oid)) from pg_class c where relkind='r' and relnamespace='public'::regnamespace order by pg_total_relation_size(c.oid) desc limit 10;
```
Ces requêtes peuvent alimenter une tâche `pg_cron` qui écrit un résumé dans une table, et déclenche un `net.http_post` vers un webhook de messagerie ou d'e-mail au choix ; les fonctions d'alerte natives de Supabase n'ont pas été vérifiées **[N]**.

## 12. Plan de passage à l'échelle par paliers (proportionné)

| Palier | Déclencheur | À faire (dans l'ordre) | Coût |
|---|---|---|---|
| **0. Avant l'ouverture publique** (décision à ne pas reporter) | tout lancement | E-01 (Pro, Spend Cap décidé, sauvegardes) ; E-03 (limitation d'IP + retirer les insertions directes + photos signées) ; E-13 (index, **tant que les tables sont vides**) ; E-08 (compteur de vues) ; E-09 (`.retry(false)`) ; alertes et sonde (§11) | ≈ 25 à 31 $/mois ; quelques jours de travail **[estimation personnelle, C]** |
| **1. Jusqu'à ≈ 20 000 installations** | tests fermés puis ouverture locale | E-02 (version + stockage du catalogue), E-10 (transformations d'images), E-05 (envoi paramétré, heures calmes, péremption), E-06 (fanout ensembliste), E-07 (rétention 7 j, purge par lots), test k6 sur le projet de préproduction | ≈ 31 $/mois |
| **2. ≈ 20 000 à 200 000** | ≥ 25 000 appareils notifiés, ou sortie > 150 Go/mois | Small ou Medium ; PITR si la base approche 4 Go ; E-12 (likes), E-14 (jobs séparés), tranches de fanout de 20 000, 60 lots par passe ; restreindre les clés Mapbox/Google ; revue mensuelle des alertes | ≈ 36 à 186 $/mois |
| **3. ≈ 200 000 à 1 million** | > 250 000 appareils notifiés ou pic > 100 req/s | Large ; 300 lots par passe (≈ 500 msg/s, sous le plafond Expo de 600/s) avec suppression des réponses `pg_net` lues ; `device_seen` pour la purge d'inactivité ; un service de filtrage devant l'API pour les `GET` ; revoir avec le support Supabase (le préavis de 2 semaines pour pics est prévu pour les offres Team/Enterprise, `going-into-prod`) | ≈ 290 à 350 $/mois ; Team = 599 $/mois **[V]** |
| **4. « Millions »** | objectif hors métropole | hors périmètre ici : produit, population cible, offre Enterprise | non chiffré |

Principe : **ne rien construire pour le palier suivant avant d'avoir mesuré le palier courant** ; chaque palier a un seuil observable (§11).

## 13. Non vérifié (à mesurer ou à lire)

- **Production** : taille réelle de la base et du bucket `etablissements`, région, version de PostgreSQL, taille d'instance, réglage « Max rows », index réellement présents (`pg_indexes`), droits sur `net._http_response`, définition d'« inactivité » pour la pause, comportement au-delà du quota de sortie en gratuit, compression des réponses d'API, taille du pool PostgREST, valeur réelle de `timeout_milliseconds` de `pg_net`. Mesures de lecture seule proposées : tailles des tables et du bucket (E-10, §11), `select count(*) from pg_stat_activity group by usename`, `select indexname, indexdef from pg_indexes where schemaname='public'`.
- **Poids réel des images** (premier poste de sortie probable) : non mesuré faute d'accès au stockage.
- **Pages non lues ou illisibles** : documentation de PostgREST (réponse 429 de l'outil), page de quotas FCM (404), bande passante illimitée de Cloudflare Pages (non indiquée sur la page lue), prix du service Expo Push, prix et disponibilité du domaine personnalisé Supabase, disponibilité de Smart CDN en gratuit, comportement d'ETag de PostgREST.
- **Appareils réels** : aucune mesure sur téléphone (démarrage, mémoire, réseau lent) ; voir `05a` §9.
- **Test de charge** : non réalisé ; le banc local ne simule ni concurrence ni disque.

## 14. Sources consultées le 22/10/2026

1. Supabase, tarifs : https://supabase.com/pricing
2. Supabase, facturation et quotas : https://supabase.com/docs/guides/platform/billing-on-supabase
3. Supabase, calcul et disque : https://supabase.com/docs/guides/platform/compute-and-disk
4. Supabase, sortie (egress) : https://supabase.com/docs/guides/platform/manage-your-usage/egress
5. Supabase, taille de la base et lecture seule : https://supabase.com/docs/guides/platform/database-size
6. Supabase, Spend Cap : https://supabase.com/docs/guides/platform/spend-cap
7. Supabase, connexions : https://supabase.com/docs/guides/database/connection-management
8. Supabase, pg_net : https://supabase.com/docs/guides/database/extensions/pg_net
9. pg_net (dépôt) : https://github.com/supabase/pg_net
10. Supabase, pg_cron : https://supabase.com/docs/guides/cron
11. pg_cron (dépôt) : https://github.com/citusdata/pg_cron
12. Supabase, mise en production : https://supabase.com/docs/guides/platform/going-into-prod
13. Supabase, sécuriser l'API (fonction de pré-requête) : https://supabase.com/docs/guides/api/securing-your-api
14. Supabase, transformations d'images : https://supabase.com/docs/guides/storage/serving/image-transformations
15. Supabase, Smart CDN : https://supabase.com/docs/guides/storage/cdn/smart-cdn
16. Expo, envoi de notifications : https://docs.expo.dev/push-notifications/sending-notifications/
17. Supabase, référence client (limite de lignes) : https://supabase.com/docs/reference/csharp/select
18. Discussion Supabase sur la limite de lignes : https://github.com/orgs/supabase/discussions/3765
19. Mapbox, tarifs : https://www.mapbox.com/pricing
20. Google, Maps SDK pour Android, usage et facturation : https://developers.google.com/maps/documentation/android-sdk/usage-and-billing
21. Toulouse Métropole en chiffres 2025 (Insee 2022 : 832 348) : https://metropole.toulouse.fr/sites/toulouse-fr/files/2025-10/toulouse_m_tropole_en_chiffres_2025.pdf
22. Toulouse Métropole, bilan 2026 (2023 : 841 524) : https://metropole.toulouse.fr/sites/toulouse-fr/files/2026-01/2026_bilan_chiffres_de_population.pdf
23. Firebase, mise à l'échelle FCM : https://firebase.google.com/docs/cloud-messaging/scale-fcm
24. Expo, tarifs : https://expo.dev/pricing

## Annexe A. Banc local (reproductible)

Scripts écrits dans le dossier temporaire de la session : `/private/tmp/claude-501/-Users-ryadhabdelmalek-Documents-diambars-web/017ae70f-144f-4c84-9239-1edc3b922ef4/scratchpad/` (`catalog_size.mjs`, `bench_push.mjs`, `bench_cap.mjs`, `bench_fix.mjs`, `bench_collect.mjs`, `bench_misc.mjs`, `bench_sizes.mjs`, `bench_likes_idx.mjs`, `test_snippets.mjs`, `test_monitor.mjs`, `model.mjs`). Ils importent PGlite depuis `node_modules` du dépôt, rejouent `tests/sql/baseline.sql`, `006` et `007` **sans les modifier**, remplacent `net.http_post` par la même doublure que `tests/sql/push-notifications.test.mjs`, et n'écrivent rien dans le dépôt. Pour les conserver, les copier dans un dossier de travail ; pour les rejouer : `node bench_cap.mjs 20000 noanalyze`.

Résultats bruts retenus :

| Mesure | Résultat |
|---|---|
| Fanout d'une annonce à 100 000 appareils | 1 313 ms |
| Fanout d'un événement (plafond), code actuel, 100 000 appareils, statistiques périmées | 224 824 ms |
| Même insertion, 20 000 appareils : plan `BitmapAnd` avec l'index `status` | 8 392 ms (30 000 lignes lues par appareil) |
| Même insertion, 20 000 appareils, `analyze` fait | 258 ms (plan `Index Scan` sur `(device_id, created_at)`) |
| Version ensembliste, 20 000 / 100 000 / 1 000 000 appareils, statistiques périmées | 274 ms / 1 406 ms / 21 878 ms |
| `push_send`, 20 passes de 1 000 messages (200 000 lignes) | 467 ms par passe en moyenne |
| Sélection d'un lot, 36 000 en attente sur 200 000 | 46,7 ms ; avec index partiel `(id) where status='pending'` : 0,48 ms |
| Taille `push_deliveries` | 389 octets/ligne (74 Mo pour 200 000), index : 4,8 / 17 / 1,4 / 17 Mo |
| `push_collect` 1 000 tickets / `push_receipts` / reçus | 118 ms / 19 ms / 29 ms |
| Catalogue (JSON agrégé, 790 lignes) 17 colonnes / `*` | 7,7 ms / 11,0 ms ; 1 012 Kio / 1 688 Kio |
| Likes : 2 000 appels, même adresse / adresses réparties | 443 ms / 403 ms |
| `user_place_discoveries`, 800 000 lignes | 329 Mo, 431 octets/ligne ; index de 33, 62, 62, 11, 5, 62, 5 Mo |
| `delete_my_data` (`device_id = x or user_id = auth.uid()`) | `BitmapOr` des deux index |
| `spot_user_likes` suppression par appareil, 900 000 lignes | 32 ms sans index, 0,07 ms avec |
| Purge par lots | 50 000 + 50 000 + 20 000 + 0 lignes |
| Limiteur d'IP (`check_request`) | 20 acceptés puis 5 refusés (limite de test 20) ; `GET` jamais limité |

Limites : PostgreSQL 18.6 compilé en WebAssembly, mémoire seule, un seul client, aucun `fsync`, aucune concurrence ; les plans sont fiables, les durées absolues ne le sont pas.

---

## Résumé (15 lignes)

1. **Sans changement, sur le plan gratuit, l'appli tient ≈ 350 à 1 100 utilisateurs actifs/mois** : 5 Go de sortie, 500 Mo de base, pas de sauvegarde, pause après 1 semaine.
2. **Sur Pro, code inchangé : ≈ 8 000 à 17 000 MAU** avant surcoût de sortie, et ≈ 25 000 appareils notifiables en 25 min ; au-delà, la diffusion et les tables posent problème.
3. **Le nombre de requêtes/s n'est pas le goulot** (≈ 18/s en moyenne, ≈ 470 au pic à 1 M d'installations) ; les octets, les quotas, les écritures publiques et la file push le sont.
4. **Premier point de rupture** : le catalogue (≈ 0,3 à 1,1 Mo + 0,3 à 1,7 Mo) est retéléchargé à chaque lancement alors que 1,9 Mo sont embarqués ; images servies en originaux.
5. **Deuxième** : écritures publiques sans limite (jetons, vues, suggestions, photos) : 500 Mo remplis en 0,7 à 5 h à 100 req/s ; lecture seule en gratuit.
6. **Diffusion** : 1 000 msg/min ⇒ 100 000 appareils en 1 h 40, 1 million en 16 h 40, envoi nocturne possible ; Expo (600/s) et pg_net (200 req/s) ne sont pas les limites.
7. **Mesuré** : le calcul du plafond 2/24 h devient quadratique (225 s pour 100 000 appareils, ≈ 6 h extrapolées pour 1 M) ; la version ensembliste fait 1,4 s et 22 s.
8. **Croissance** : `push_deliveries` 439 Mo à 25 000 appareils (30 j), `address_views` 4,3 Go à 100 000 installations ; 41 % des index de `user_place_discoveries` sont des doublons.
9. **Un million d'installations dépasse la population de la métropole (841 524)** : viser 100 000 et savoir comment aller plus loin.
10. **Coût réaliste** : Pro ≈ 31 $/mois à 10 000 installations ; ≈ 36 à 86 $ à 100 000 ; ≈ 290 à 350 $ à 1 M (avec correctifs).
11. **Action 1** : passer en Pro avant l'ouverture, décider du Spend Cap, activer sauvegardes et alertes (E-01, E-11).
12. **Action 2** : limiter les écritures publiques par IP, retirer les insertions directes, signer les photos (E-03).
13. **Action 3** : catalogue versionné + stockage local, `.retry(false)`, images redimensionnées (E-02, E-09, E-10).
14. **Action 4** : diffusion paramétrée (60 lots, heures calmes, péremption), fanout ensembliste, index partiels, purge par lots à 7 jours (E-05 à E-07, E-13).
15. **Action 5** : compteur de vues journalier (E-08), puis test de charge k6 sur un projet de préproduction, jamais en production.
