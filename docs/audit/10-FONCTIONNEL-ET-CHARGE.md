# Audit fonctionnel et capacité de charge (mission F) - 2 novembre 2026

Auditeur indépendant. Branche `integration/audit-plus-claude`, arbre propre au départ. Aucun fichier de l'application modifié, aucun commit. Production : uniquement des `GET` et trois RPC de lecture avec un faux identifiant d'appareil (`get_my_discoveries`, `get_my_card_usage`, `get_my_lists`). Aucun code admin utilisé, aucune écriture, aucune charge (au plus 5 requêtes répétées). Aucun secret dans ce rapport.

Statuts : `VÉRIFIÉ` (commande ou `fichier:ligne`), `DÉDUIT` (lecture du code, non exécuté), `NON TESTÉ` (hors portée), `NON VÉRIFIÉ` (source indisponible).

## 1. Résumé pour le commanditaire

**Verdict : publiable sous conditions.** Le code se comporte correctement sur les parcours lus et les 500 tests passent. L'architecture tient 5 000 utilisateurs sur le plan payant (Pro), pas sur le plan gratuit.

Les 5 points les plus importants :
1. **Plan gratuit Supabase insuffisant** (F-01) : 5 Go de sortie mensuelle suffisent pour environ 900 utilisateurs actifs par mois si les photos ne comptent pas, et environ 130 si chaque session charge 40 photos non mises en cache. Passer en Pro avant la publication.
2. **Un lancement à froid télécharge 347 Ko compressés** mesurés (jusqu'à 746 Ko avec la Recherche), sans aucun cache serveur (F-03). C'est 31 % de plus que l'estimation du rapport 05d (268 Ko).
3. **Le montant payé par les partenaires est toujours lisible avec la clé publique en production** (F-02) : la migration 016 n'est pas appliquée. Vérifié aujourd'hui.
4. **« Réservation confirmée » s'affiche avant toute réservation**, et un événement sans lien renvoie vers un site tiers codé en dur (F-04).
5. **Points d'adresses incohérents** (F-05, F-06) : pour 460 adresses sur 789, les points calculés dans l'appli diffèrent de ceux que le serveur enregistre. 131 adresses valent 35 points, hors du barème documenté.

Le pic de 500 connexions simultanées n'est pas un problème de débit (voir §5) : le goulot est le quota de sortie, pas la base de données.

## 2. Ce qui a été testé

| Élément | Méthode | Résultat | Preuve |
|---|---|---|---|
| Tests unitaires (`test:agenda`) | `npm run test:all` | **282 / 282** réussis | VÉRIFIÉ |
| Tests SQL (`test:sql`, PGlite) | idem | **218 / 218** réussis | VÉRIFIÉ |
| Données Python (`test:data`) | idem | 790 adresses embarquées, 19 catégories, filtres OK | VÉRIFIÉ |
| Types (`typecheck`) | idem | aucune erreur, code retour 0 | VÉRIFIÉ |
| Réponses production du lancement à froid | `curl` GET, avec et sans `--compressed` | tableau §5.1 | VÉRIFIÉ |
| Poids des photos | 60 requêtes `HEAD` (40 couvertures, 20 galeries), échantillon aléatoire | moyenne 81 Ko, médiane 93, max 176 | VÉRIFIÉ (échantillon) |
| Cache HTTP des photos | `GET` d'une photo, requête conditionnelle | `cache-control: no-cache`, ETag présent, `304` sans octets | VÉRIFIÉ |
| Qualité des 789 adresses en production | analyse du JSON | pas de valeur nulle sur rating, lat, lng, tags ; `horaires` vide partout ; 5 points hors Toulouse | VÉRIFIÉ |
| Migrations 013 à 016 en production | requêtes ciblées | 015 absente (`PGRST202`), 016 absente (prix lisible), 013 et 014 non distinguables de l'extérieur | VÉRIFIÉ (015, 016) |
| Limites Supabase | pages `supabase.com/pricing` et `docs/guides/platform/compute-and-disk`, lues le 02/11/2026 via un outil qui résume les pages | chiffres §5.4 | VÉRIFIÉ (à relire sur la page d'origine avant décision financière) |
| Parcours par lecture de code | voir §3 | voir §6 | DÉDUIT |

**Tests (en bref)** : les tests unitaires couvrent la logique pure (accueil, offres, listes, agenda, thème, carte, notifications, liens, effacement). Les tests SQL prouvent la logique serveur, pas l'interface. Aucun test n'ouvre un écran, aucun ne tourne sur appareil.

**Non testé** : appareil réel iOS ou Android (Hermes, WebView, notifications reçues, GPS, mémoire), tableau de bord Supabase (taille de base, taille du stockage, `pg_stat_activity`), vrai test de charge (interdit sur la production, aucun projet de préproduction fourni), limites de débit Expo (page non consultée), Mapbox, portail admin en conditions réelles (code admin interdit).

## 3. Inventaire des fonctionnalités

Légende des tests : U = test unitaire existant, S = test SQL, rien = aucun test automatisé.

| # | Fonctionnalité | Fichier source | Tests |
|---|---|---|---|
| 1 | Écran d'ouverture (une seule fois), polices avec repli à 4 s | `app/_layout.tsx`, `IntroScreen.tsx` | U (structure) |
| 2 | Accueil : en-tête, thème de l'année, fond personnalisé, étoiles | `views/HomeView.tsx`, `home/HomeHeader.tsx`, `homeThemeLogic.ts`, `homeBackgroundLogic.ts` | U |
| 3 | Accueil : catégories, « Voir tout », chouchous du moment (likes), chouchous du Petit Tou | `HomeView.tsx`, `homeLogic.ts`, `featuredStore.ts` | U |
| 4 | Accueil : partenaires sponsorisés, étiquette « SPONSORISÉ » | `partnersStore.ts`, `HomeView.tsx` | U (garde-fou), S (016) |
| 5 | Accueil : événements association, « Réserver », redirection | `HomeView.tsx:337-359, 709-730` | U partiel (`upcomingEvents`) |
| 6 | Accueil : agenda des partenaires (section) | `home/HomeAgendaSection.tsx` | U (occurrences) |
| 7 | Chargement données : embarqué puis base, repli hors ligne, cache 10 min | `HomeView.tsx:780-890`, `dataCache.ts` | U partiel |
| 8 | Recherche : saisie, accents, catégories, filtres rapides, budget, « Afficher plus » | `views/SearchView.tsx`, `searchIndex.ts`, `searchCategory.ts`, `spotSearch.ts` | U |
| 9 | Filtres : catégorie, budget, tags (fenêtre de filtres) | `HomeView.tsx`, `SearchView.tsx` | U partiel |
| 10 | Carte : marqueurs, groupes, 3D, recentrage, position, refus de position | `views/MapView.tsx`, `map/mapboxHtmlTemplate.ts` | U (`mapBridge`, `mapPage`, `mapQuickBudget`) |
| 11 | Carte : itinéraire à pied (Mapbox), ouverture de l'appli de navigation | `MapView.tsx:978-1090` | rien |
| 12 | Carte : puces de budget 10/20/30 € | `MapView.tsx` | U |
| 13 | Fiche d'adresse : photos, description, appel, site, itinéraire, partage, « découvrir » | `AddressDetailModal.tsx`, `PlaceDetailSheet.tsx`, `safeLinks.ts` | U (`safeLinks`), le reste rien |
| 14 | Likes : bascule optimiste, compteur global, RPC | `likesStore.ts` | S (like) |
| 15 | Découvertes et points, file hors ligne | `discoveryStore.ts` | S |
| 16 | Statistique de vue de fiche (insertion `address_views`) | `AddressDetailModal.tsx:133-142` | S (006) |
| 17 | Offres : liste, filtres, fiche, validation avec confirmation, quota | `views/OffersView.tsx`, `offers/*`, `offersLogic.ts`, `discountCardsStore.ts` | U, S (013, `use_discount_card`) |
| 18 | Agenda : bandeau de 14 jours, catégories, répétition hebdomadaire, retour au premier plan | `views/AgendaView.tsx`, `agendaOccurrences.ts`, `partnerEventsStore.ts` | U |
| 19 | Profil : niveau, carte « Pass privilège », points, progression | `views/ProfileView.tsx`, `MemberCard.tsx` | rien |
| 20 | Listes personnelles (créer, renommer, supprimer, ajouter) et copie serveur | `lists/*`, `userListsEngine.ts`, `userListsLogic.ts`, `userListsRemote.ts` | U, S (015) |
| 21 | Effacement des données | `dataDeletion.ts`, `ProfileView.tsx` | U, S |
| 22 | Notifications : fenêtre de bienvenue, réglages, refus système, canaux Android, ouverture au toucher | `pushNotifications.ts`, `NotificationWelcomeModal.tsx`, `NotificationSettingsModal.tsx`, `pushLogic.ts` | U, S (007) ; réception réelle non prouvée |
| 23 | Politique de confidentialité intégrée | `PrivacyPolicyModal.tsx` | rien |
| 24 | Portail admin : code, 7 appuis sur le logo, verrouillage d'inactivité | `HomeView.tsx`, `AdminPasswordModal.tsx`, `adminApi.ts` | U, S |
| 25 | Portail : adresses (liste virtualisée, création, modification, suppression, photos) | `AdminPortalModal.tsx` | U (`adminSpotsLogic`, performance), interface rien |
| 26 | Portail : catégories, événements, partenaires | `AdminPortalModal.tsx` | S (`admin_write`), interface rien |
| 27 | Portail : agenda partenaires, chouchous, fond, thème, offres, notifications | `admin/*` | U, S |
| 28 | Navigation : dock, onglets conservés montés, bouton profil, ErrorBoundary | `app/index.tsx`, `FloatingDock.tsx`, `ErrorBoundary.tsx` | U (structure, `layoutGuards`) |
| 29 | Liens sortants (tel, web, réservation, navigation) | `safeLinks.ts`, `AddressDetailModal.tsx`, `MapView.tsx` | U (`safeLinks`) |
| 30 | Deep links : schéma `lepetittou`, une seule route `index` | `app.json:8`, `src/app` | rien ; aucune route de lien profond n'existe |
| 31 | Identité d'appareil (UUID), stockage sécurisé | `deviceIdentity.ts`, `authService.ts`, `storage.ts` | rien |
| 32 | Code sans écran branché : `suggestNewPlace` (proposer une adresse) | `discoveryStore.ts:246` | S (table), aucun appelant |

Cas limites relus pour les lignes 5, 7, 10, 13 à 15, 17 à 22 : données vides, réseau coupé (délai de 10 s, repli embarqué), valeurs nulles (`telephone` vide : 278 adresses en production ; `site_web` vide : 3), double appui (offres : bouton désactivé pendant l'envoi, `OfferDetailSheet.tsx:149`), retour au premier plan (agenda, accueil), passage de minuit (agenda : date calendaire en UTC, pas d'effet du changement d'heure, `agendaOccurrences.ts` en-tête). Statut : DÉDUIT.

## 4. Scénarios de test manuels (à jouer sur un téléphone réel)

| # | Étapes | Résultat attendu |
|---|---|---|
| S1 | Installer, mode avion, ouvrir l'appli | Accueil affiché avec les 790 adresses embarquées en moins de 3 s, aucune bannière « .env », aucun écran blanc |
| S2 | Réseau coupé en plein chargement (mode avion pendant l'accueil) | L'accueil garde les données embarquées, pas de squelette infini (limite 10 s) |
| S3 | Premier lancement : refuser les notifications dans la fenêtre de bienvenue, puis relancer | Fenêtre non reproposée, réglages montrent « désactivées » |
| S4 | Activer les notifications, refuser l'autorisation système, puis la rétablir dans les réglages du téléphone | Message clair, puis activation possible sans réinstaller |
| S5 | Fiche d'une adresse sans téléphone (278 en production) | Bouton « Appeler » absent ou désactivé, aucun plantage |
| S6 | Fiche d'une adresse : appuyer 5 fois vite sur « Découvrir » | Un seul gain de points, total cohérent après relance de l'appli |
| S7 | Hors ligne : découvrir 3 adresses, puis reconnecter et relancer | Points du serveur repris ; noter l'écart entre points affichés avant et après (F-05) |
| S8 | Offres : onglet vide au lancement (offres de démonstration masquées) | État vide explicite, pas de spinner infini |
| S9 | Offre réelle : valider, quitter, revenir, valider jusqu'au quota | Compteur décrémenté une fois par validation, refus au quota, aucune double validation sur double appui |
| S10 | Événement avec « Réserver » : appuyer, observer le message | Vérifier si « Réservation confirmée » apparaît avant la réservation (F-04) |
| S11 | Agenda : changer l'heure du téléphone au lendemain (ou attendre minuit), revenir au premier plan | Le jour sélectionné repasse à aujourd'hui, aucune date décalée |
| S12 | Carte : refuser la position, demander un itinéraire, puis accepter dans les réglages | Message de refus, pas de plantage, itinéraire possible après acceptation |
| S13 | Carte : tourner l'écran, mettre l'appli en arrière-plan 10 min, revenir | Carte récupérée (relance de la WebView), marqueurs présents |
| S14 | Android : appuyer sur Retour depuis une fiche, la carte, le profil | Retour à l'écran précédent ; noter si l'appli se ferme (F-11) |
| S15 | Listes : créer 21 listes, ajouter 101 adresses à une liste, nom de 31 caractères | Refus propre aux limites (20 listes, 100 adresses, 30 caractères) |
| S16 | « Effacer mes données » hors ligne puis en ligne | Hors ligne : message d'échec, données conservées ; en ligne : tout repart à zéro, notifications arrêtées |
| S17 | Recherche « cafe », « Café », « CAFÉ », « ecole » | Mêmes résultats avec ou sans accent ni majuscule |
| S18 | Ouvrir un lien `lepetittou://` arbitraire | Ouvre l'accueil sans erreur (aucune route dédiée) |

## 5. Capacité de charge

### 5.1 Lancement à froid mesuré en production (02/11/2026, un seul client, France)

`curl -s --compressed` et sans compression. 789 adresses en base. VÉRIFIÉ.

| Requête | Lignes | Brut | gzip | Temps |
|---|---|---|---|---|
| `categories` | 19 | 3,5 Ko | 1,4 Ko | 0,17 s |
| `addresses` (17 colonnes, accueil) | 789 | **1 006 Ko** | **343 Ko** | 0,32 à 0,39 s (5 essais) |
| `events` | 1 | 0,3 Ko | 0,2 Ko | 0,09 s |
| `sponsored_partners_public` | 2 | 1,1 Ko | 0,6 Ko | 0,15 s |
| `spot_likes` | 9 | 0,6 Ko | 0,3 Ko | 0,15 s |
| `discount_cards` actives | 5 | 3,3 Ko | 1,2 Ko | 0,09 s |
| `featured_spots`, `app_settings` x2, `partner_events` | 1, 0, 0, 0 | < 1 Ko | < 1 Ko | 0,09 à 0,16 s |
| 2 RPC de lecture (découvertes, usage offres) | 0 | < 1 Ko | < 1 Ko | 0,09 s |
| **Total lancement** | | **≈ 1,02 Mo** | **≈ 347 Ko** | 9 à 11 requêtes |
| Recherche, `select *` (1re visite) | 789 | 1 640 Ko | 390 Ko | 0,29 s |
| Carte (si cache vide) | 789 | 1 554 Ko | 395 Ko | 0,26 à 0,75 s |

- Sans `Accept-Encoding`, le serveur renvoie le brut (3 fois plus). Les clients natifs envoient gzip : DÉDUIT.
- **Aucun `Cache-Control`, aucun `ETag`** sur ces réponses (`cc=[] etag=0` sur les 12 requêtes) : chaque lancement retélécharge tout. VÉRIFIÉ.
- Le rapport 05d estimait 268 Ko gzip pour l'accueil : la mesure réelle est de 343 Ko, soit +28 %.
- Photos : 789 couvertures et 525 images de galerie, toutes sauf une sur le stockage Supabase. Moyenne 95 Ko (couvertures) et 52 Ko (galeries). Stockage total estimé : (789 x 95 + 525 x 52) / 1024 = 100 Mo (estimation sur échantillon de 60), donc 10 % du Go gratuit.
- Cache des photos : `cache-control: no-cache` avec `ETag`, `cf-cache-status: MISS`. Le client peut revalider (`304`, 0 octet) mais le CDN ne garde pas l'image. DÉDUIT : un `expo-image` en `memory-disk` limite les retéléchargements, non mesuré sur appareil.

### 5.2 Hypothèses (modifiables)

H1 : 10 sessions par utilisateur actif par mois, chaque session = un lancement à froid. H2 : 50 % des sessions ouvrent la Recherche. H3 : photos neuves par session : 0 (borne basse) ou 40 (borne haute, 81 Ko chacune) ; la valeur réelle est NON TESTÉE sur appareil. H4 : poids d'une session API = 347 Ko + 0,5 x 399 Ko = 542 Ko. H5 : pic de soirée = 500 lancements à froid en 60 s (cas modéré) ou en 10 s (cas extrême), 9 requêtes chacun.

### 5.3 Résultats (calcul, estimation)

| Scénario | Sortie mensuelle |
|---|---|
| 5 000 actifs / mois (50 000 sessions), API seule | 27 Go |
| idem, avec 40 photos neuves par session | 27 + 162 = **189 Go** |
| 20 000 actifs / mois (200 000 sessions), API seule | 108 Go |
| idem, avec 40 photos neuves par session | 108 + 648 = **756 Go** |
| (si 5 000 installations = 2 000 actifs, H1 du rapport 05d) | 11 Go, ou 78 Go avec photos |

Pic de 500 lancements :

| Pic | Requêtes/s | Téléchargements du catalogue/s | Sortie |
|---|---|---|---|
| 500 en 60 s | 75 | 8 | 3 Mo/s |
| 500 en 10 s | 450 | 50 | 18 Mo/s (142 Mbit/s) |

Lecture : 450 requêtes/s tiennent largement sur PostgREST pour de petites lectures (05d a mesuré 8 à 11 ms par requête catalogue sur banc local : estimation, 50 x 10 ms = 0,5 cœur), mais la capacité réseau de Micro/Small n'est pas documentée (NON VÉRIFIÉ). La base ne sature pas par les connexions (pooleur 200 sur Micro, 400 sur Small) : le trafic passe par PostgREST.

### 5.4 Limites officielles (supabase.com/pricing et compute-and-disk, 02/11/2026)

| | Gratuit | Pro (25 $/mois) |
|---|---|---|
| Sortie | 5 Go | 250 Go, puis 0,09 $/Go |
| Sortie en cache | 5 Go | 250 Go, puis 0,03 $/Go |
| Base | 500 Mo | 8 Go, puis 0,125 $/Go |
| Fichiers | 1 Go | 100 Go |
| Utilisateurs actifs (Auth) | 50 000 | 100 000 ; l'appli n'en crée aucun (connexion anonyme désactivée, `authService.ts`, 05d §3.3) |
| Pause d'inactivité | après 1 semaine | jamais |
| Sauvegardes | aucune | quotidiennes, 7 jours |
| Plafond de dépense | non précisé | activé par défaut (coupe le service au quota) |
| Calcul inclus | CPU partagé, 500 Mo | crédit 10 $ = 1 Micro (1 Go) |

Connexions : Nano et Micro 60 directes / 200 pooleur ; Small 90 / 400 ; Medium 120 / 600 ; Large 160 / 800.

### 5.5 Verdict chiffré

| Palier (actifs / mois) | Plan gratuit | Pro, code actuel | Pro, après correctifs |
|---|---|---|---|
| 900 | sortie 5 Go atteinte (API seule) | OK | OK |
| 130 | sortie atteinte si 40 photos neuves par session | OK | OK |
| **5 000** | **dépassé (x5 à x38)** | **27 à 189 Go : OK sous 250 Go** | OK |
| 20 000 | dépassé | 108 à 756 Go : OK si photos en cache, sinon surcoût ≈ 46 $ (756 - 250 = 506 Go x 0,09) | OK |

Composants qui saturent, dans l'ordre : (1) le quota de sortie du plan gratuit, bien avant tout débit ; (2) le quota de sortie Pro vers 20 000 actifs si les photos ne sont pas redimensionnées ni mises en cache ; (3) la file de notifications (1 000 messages/min, `lpt-push-tick`, 05d E-05 : 5 000 appareils = 5 minutes, sans problème ; 25 000 = 25 minutes) ; (4) la taille de `push_deliveries` et `address_views` (05d §4.3) à partir de dizaines de milliers d'appareils. Aucun de ces points n'est un obstacle à 5 000.

Pour atteindre 5 000 : passer en Pro, désactiver ou régler le plafond de dépense, mettre des alertes de facturation. Pour 20 000 : version de catalogue (une ligne de 60 octets, 05d E-02), photos redimensionnées (Pro : transformations d'images, 05d E-10), `Cache-Control` long sur le catalogue statique.

Déjà couverts par 05d et non refaits : verrou anti force brute global (N-09), écritures publiques sans limite (E-03), purge des tables (E-07), `address_views` (E-08), relance des GET (E-09).

## 6. Constats

### F-01 - P0 - Le plan gratuit ne tient pas l'objectif de 5 000 utilisateurs
- Preuve : §5.1 et §5.3 (347 Ko gzip mesurés par lancement, 5 Go gratuits ; calcul à partir des hypothèses H1 à H5). VÉRIFIÉ pour les limites et les tailles, estimation pour le trafic.
- Impact : au-delà du quota, la documentation Supabase annonce des restrictions ; le comportement exact n'a pas été consulté (NON VÉRIFIÉ, 05d E-01). L'appli retombe sur ses données embarquées mais photos et mises à jour s'arrêtent. Une pause après une semaine sans activité est possible en gratuit.
- Correctif : passer en Pro avant la publication, alertes de facturation, décider du plafond de dépense. Effort : S.

### F-02 - P1 - Le prix payé par les partenaires est lisible en production (016 non appliquée)
- Preuve : `GET sponsored_partners?select=price_paid&price_paid=not.is.null` avec la clé publique renvoie `200` et `content-range: 0-1/2` : 2 lignes lisibles. La vue `sponsored_partners_public` existe pourtant et ne contient pas le prix. VÉRIFIÉ le 02/11/2026. Valeurs non reproduites.
- Impact : confirme R-07 (05b) toujours ouvert. Le montant payé doit rester interne (00-contexte). À traiter aussi par la mission cybersécurité.
- Correctif : appliquer `016_hide_partner_price.sql` ; relancer `scripts/audit-prod-check.sh`. Effort : S.

### F-03 - P1 - Le catalogue est retéléchargé à chaque lancement, sans validateur de cache
- Preuve : §5.1, 12 requêtes sans `ETag` ni `Cache-Control` ; cache applicatif en mémoire seulement (`dataCache.ts`) ; `SearchView.tsx:72` et `MapView.tsx:417` refont un `select` complet. VÉRIFIÉ.
- Impact : 347 Ko par lancement, jusqu'à 746 Ko avec la Recherche, en réseau mobile faible : quelques secondes avant les mises à jour ; coût de sortie (F-01).
- Correctif : version de catalogue (05d E-02), réutiliser les données de l'accueil dans la Recherche. Effort : M.

### F-04 - P1 - « Réservation confirmée » avant toute réservation ; lien tiers codé en dur
- Preuve : `HomeView.tsx:2227` (titre « Réservation confirmée ») affiché après `setSuccessEvent` (`:713`) alors que le même geste ouvre seulement le lien (`:712`) ; `DEFAULT_BOOKING_URL = 'https://www.phoenix-egalite-des-chances.com'` (`:335`) utilisé quand `booking_url` est vide (`:342`). VÉRIFIÉ (lecture).
- Impact : une personne peut croire sa place réservée alors qu'elle quitte l'appli vers un site externe ; un événement sans lien envoie vers un site non lié à l'événement. L'événement actuel en base est passé et masqué.
- Correctif : texte neutre (« Ouverture du site de réservation »), pas de lien par défaut : bouton masqué sans `booking_url`. Effort : S.

### F-05 - P2 - Points affichés différents de ceux enregistrés pour 460 adresses sur 789
- Preuve : `discoverSpot(spot.id, !!spot.is_recommended)` sans la note (`AddressDetailModal.tsx:127`, `PlaceDetailSheet.tsx:153`) donc `rating` vaut 4,8 par défaut (`discoveryStore.ts:150`) : toute adresse non recommandée vaut 20 localement. Le serveur utilise `points_reward` (`006_security_lockdown.sql:505-513`). Données de production : écarts (client, serveur) = (20, 10) pour 329 adresses, (25, 35) pour 131. VÉRIFIÉ (calcul sur les 789 lignes).
- Impact : en ligne, la valeur du serveur remplace la valeur locale dès la réponse (`discoveryStore.ts:181-184`) ; hors ligne, les points affichés sont faux jusqu'à la prochaine synchronisation (total local 17 940 contre 15 960 côté serveur si tout était découvert).
- Correctif : lire `points_reward` des données chargées. Effort : S.

### F-06 - P2 - 131 adresses valent 35 points, hors du barème documenté
- Preuve : `points_reward` en production : 10 (329), 25 (301), **35 (131)**, 20 (28). Le barème dans le code et le rapport 09 est 10 / 20 / 25. VÉRIFIÉ.
- Impact : barème incohérent avec le texte du produit ; lié à la décision en attente « 25 points par adresse » (09).
- Correctif : trancher le barème, aligner la base et l'appli. Effort : S.

### F-07 - P2 - Jeu embarqué et production divergent : 790 contre 789, découvertes silencieusement rejetées
- Preuve : l'adresse « keep cool » (`b4e09a12-…`) est dans `dataset.json` mais absente de la base. `TOTAL_PLACES_COUNT` vaut 790 (`discoveryStore.ts:6`). Le serveur répond `success:false, ADRESSE_INTROUVABLE` (`006:491-494`) ; le client ne regarde que `res.error` (`discoveryStore.ts:181-187`) : points conservés localement, jamais envoyés ni réessayés (CL-09 reste vrai). Hors ligne, l'adresse reste visible. VÉRIFIÉ.
- Impact : progression à 100 % impossible (789 sur 790) ; points locaux non enregistrés ; adresse fantôme hors ligne.
- Correctif : compter les adresses chargées (pas l'embarqué), traiter `success:false`. Effort : S.

### F-08 - P2 - Photos : poids moyen faible mais ni redimensionnées ni cachées par le CDN
- Preuve : §5.1 (81 Ko en moyenne, `no-cache`, `MISS`) ; `imageOptimizer.ts:15-18` renvoie l'original. VÉRIFIÉ (échantillon de 60).
- Impact : coût de sortie principal à partir de 20 000 actifs (§5.5) ; revalidation à chaque affichage hors cache disque.
- Correctif : transformations d'images Pro, en-tête de cache long à l'envoi des photos. Effort : M.

### F-09 - P2 - L'onglet Offres est vide à la publication
- Preuve : les 5 offres actives de production ont les identifiants de démonstration `a1111111…` à `a5555555…` (`discount_cards`, 5 lignes) ; `DEMO_OFFER_IDS` les masque (`offersLogic.ts:34-40`, `:111`). VÉRIFIÉ. L'état vide existe (`OffersView.tsx:96`).
- Impact : une des cinq entrées de navigation est vide au premier jour tant que l'association n'a pas créé de vraies offres ; les lignes de démonstration restent lisibles par l'API.
- Correctif : créer les vraies offres, supprimer les 5 lignes (portail, après 013). Effort : S.

### F-10 - P2 - Migrations 013, 014, 015, 016 non appliquées : dégradation propre, mais à appliquer dans l'ordre
- Preuve : `get_my_lists` répond `PGRST202` (015 absente) ; 016 absente (F-02) ; `userListsRemote.ts:15-22` ignore l'erreur et la synchronisation est retentée avec délai (`shouldPush`) ; thème absent = thème d'origine ; offres lues sans la fonction admin (09). L'en-tête de `016_hide_partner_price.sql` porte le titre « 009 » (erreur de commentaire, P3). VÉRIFIÉ (015, 016), DÉDUIT (reste).
- Impact utilisateur : aucun message d'erreur ; les listes restent sur le téléphone ; le portail dit « pas encore activée ».
- Correctif : appliquer 013, 014, 015, 016 puis `scripts/audit-prod-readonly.sql`. Effort : S.

### F-11 - P2 - Bouton Retour d'Android sans gestion
- Preuve : `grep -rn BackHandler src` ne renvoie rien (VÉRIFIÉ ; R-09 reste vrai). Navigation par état local dans `app/index.tsx`, sans pile.
- Impact : Retour ferme l'appli depuis la carte, le profil, une fiche, au lieu de revenir en arrière.
- Correctif : `BackHandler` fermant d'abord les fenêtres, puis revenant à l'accueil. Effort : S.

### F-12 - P3 - Valeurs par défaut inventées si la base est incomplète
- Preuve : `rating || 4.8` (`placesRepository.ts:123,205,254`, `MapView.tsx:1456`, `mapboxHtmlTemplate.ts:84`), `|| 4.5` et `price_level || '€€'` (`searchIndex.ts:80,131`). En production aucune note n'est nulle aujourd'hui (min 3,0, VÉRIFIÉ) : risque latent pour une adresse ajoutée sans note.
- Correctif : afficher « sans note ». Effort : S.

### F-13 - P3 - Deux adresses hors Toulouse à vérifier
- Preuve : « Comptoir du rêve » (lat 48,85, Paris 16e) et « Font-Romeu Pyrénées 2000 » (lat 42,50) ; trois autres adresses hors rectangle strict sont en périphérie (Buzet-sur-Tarn, Fronton, Zoo African Safari à Plaisance). VÉRIFIÉ.
- Impact : distances et groupes de carte incohérents si ce sont des erreurs de géocodage. Question 3.
- Effort : S.

### F-14 - P3 - Fonction « proposer une adresse » sans écran
- Preuve : `suggestNewPlace` (`discoveryStore.ts:246`) n'a aucun appelant (`grep`) ; elle renverrait en outre `error.message` brut. VÉRIFIÉ.
- Impact : la table `place_suggestions` et sa politique d'insertion publique existent sans usage ; à retirer de la surface d'attaque ou à brancher.
- Effort : S.

### F-15 - P3 - « Aujourd'hui » suit le fuseau du téléphone
- Preuve : `todayIso` (`upcomingEvents.ts:2-6`) utilise la date locale, l'agenda aussi (`localTodayIso`). DÉDUIT.
- Impact : une personne à l'étranger voit un décalage d'un jour sur les événements ; sans effet à Toulouse, ni le 25 octobre (dates calendaires en UTC).
- Effort : S.

### F-16 - P3 - Horaires seulement dans le jeu embarqué
- Preuve : `horaires` est vide dans les 789 lignes de production (VÉRIFIÉ) ; l'accueil prend `local.horaires` (`HomeView.tsx:824`). Une adresse ajoutée par le portail n'aura pas d'horaires, une modification d'horaires en base n'apparaîtra pas.
- Effort : S (renseigner la colonne, 05c).

Constats déjà connus, vérifiés encore ouverts dans le code actuel : R-09 (F-11), CL-09 (F-07), R-07 (F-02). Non revérifiés ici : les autres R-xx et CL-xx.

## 7. Questions ouvertes pour l'association

1. Quel est l'objectif exact : 5 000 installations ou 5 000 utilisateurs actifs par mois ? (le tableau §5 donne les deux).
2. Passage en Pro : quand, et plafond de dépense activé ou non ?
3. « Comptoir du rêve » (Paris) et « Font-Romeu » sont-ils volontaires ? « keep cool » a-t-elle été supprimée volontairement ?
4. Quel barème de points : 10 / 20 / 25, ou 25 partout, ou conserver les 35 ?
5. Quel texte après « Réserver », et quel lien pour un événement sans réservation ?
6. Quand seront créées les vraies offres ?

## 8. Bilan et rejeu

**Nombre de constats : P0 : 1, P1 : 3, P2 : 7, P3 : 5, total 16.**

Rejouer (depuis `le-petit-tou`, `.env` présent) :
```bash
npm run test:all                                   # 282 + 218 tests, données, types
set -a; . ./.env; set +a
# taille et cache d'une requête du lancement (lecture seule)
curl -s --compressed -o /dev/null -D - -w '%{size_download} %{time_total}\n' \
  -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/addresses?select=id,title,category_id,location,address,image_url,rating,price_level,is_recommended,is_new,lat,lng,tags,telephone,site_web,horaires,description&order=created_at.desc"
# 016 appliquée ? (doit répondre 401 ou 403 après correction ; 200 aujourd'hui)
curl -s -I -o /dev/null -w '%{http_code}\n' -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" \
  "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/sponsored_partners?select=price_paid"
```
Les autres mesures (12 requêtes, 60 photos, comparaison embarqué/production) sont des boucles de `curl` du même type sur les tables `categories`, `events`, `sponsored_partners_public`, `spot_likes`, `discount_cards`, `featured_spots`, `partner_events`, et sur les URL `image_url` / `gallery_urls` ; elles ne sont pas conservées dans le dépôt.
