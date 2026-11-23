# Audit de sécurité — contre-vérification du 23/11/2026

Version auditée : branche `integration/audit-plus-claude` de Sohel (commit `77417d1`, 3 novembre 2026), qui contient déjà
`main` et `audit/pre-publication`. Les corrections de cet audit sont sur la branche locale `audit/securite-2026-11-23`
(non poussée). Point de départ : le rapport de Sohel `11-CYBERSECURITE.md` (constats S2-01 à S2-16), revérifié sur le code.

**Rien n'a été modifié en production, rien n'a été poussé.** Les contrôles directs sur la base de production (même en lecture
seule) n'ont pas été autorisés dans cette session : l'état de la production vient des requêtes lancées par Ryadh dans le
SQL Editor et des relevés de Sohel.

## 1. Résumé

| | |
|---|---|
| Tests | 310 tests unitaires (294 avant, +16), 237 tests SQL (233 avant, +4), typage sans erreur : tout passe |
| Secrets dans l'historique Git (dépôt public) | Balayage complet de Sohel (02/11, toutes branches) : aucun secret de service, seulement des clés `anon` ; l'ancien code admin y figure mais n'est plus accepté. Mon propre balayage n'a pas pu se terminer (disque trop lent) |
| Corrigé dans le code (cette branche) | S2-11 identifiant d'appareil, S2-12 messages et navigation de la carte, S2-05 (jetons géants) et S2-14 (`admin_users`) par la migration 021, portail admin absent de l'APK de test, message d'erreur des offres |
| Déjà corrigé par Sohel (vérifié) | S2-01 portail admin derrière `EXPO_PUBLIC_ENABLE_ADMIN`, S2-08 image de la carte sans HTML |
| À faire en production (Ryadh) | migrations 016 à 021 dans l'ordre ci-dessous, cache de l'API, offres de démonstration, jeton Mapbox |
| Reste ouvert, accepté pour la publication | S2-04/S2-05 identité gratuite et absence de limites de fréquence, S2-06 lien profond lent (Expo SDK 58), S2-09 code admin partagé, S2-16 catalogue copiable |

## 2. Offres impossibles à publier depuis le portail

Symptôme : « La gestion des offres n'est pas encore activée sur le serveur ». Ce message apparaît quand l'API Supabase répond
qu'elle ne trouve pas la fonction (`PGRST202`).

Vérifié dans le SQL Editor de production (capture de Ryadh) : les trois fonctions existent, dans `public`, avec les bons
paramètres (`admin_list_offers(p_code text)`, `admin_save_offer(p_code text, p_offer jsonb)`,
`admin_delete_offer(p_code text, p_id text)`) et la clé publique peut les exécuter. **La migration 013 est donc appliquée ;
c'est le cache de l'API qui ne les voyait pas.** `notify pgrst, 'reload schema';` a été lancé (« Success »).

Si le message persiste :
1. Vérifier que le projet ouvert dans le tableau de bord est bien `ckesvawakxblsuhmzaeo` (l'adresse de la page doit contenir
   `/project/ckesvawakxblsuhmzaeo/`) : c'est la base qu'utilise l'appli (`src/lib/supabase.ts`, `eas.json`).
2. Un incident Supabase était en cours au moment du test : relancer `notify pgrst, 'reload schema';` après l'incident.
3. En dernier recours : Project Settings → General → Restart project (coupure d'une à deux minutes).

Correction côté appli (`src/lib/offersAdmin.ts`) : le message donne désormais le code renvoyé par le serveur
(ex. `[PGRST202]`), et une vraie erreur de la base n'est plus présentée comme « Connexion impossible ». Testé
(`offersAdmin.test.ts`).

## 3. Revérification des constats de Sohel

| Constat | Statut au 23/11 | Preuve |
|---|---|---|
| S2-01 portail admin dans les builds des boutiques | **Corrigé** | `HomeView.tsx:708` sort tout de suite si `Features.adminPortal` est faux ; `AdminPortalModal` n'est monté que là |
| — portail admin absent de l'APK de test | **Corrigé ici** | le profil `preview` d'`eas.json` n'avait pas `EXPO_PUBLIC_ENABLE_ADMIN=1` : le prochain APK de test n'aurait plus eu de portail. Ajouté ; `production` n'en a pas (test `buildProfiles.test.ts`) |
| S2-02 prix payé par les partenaires lisible | Ouvert tant que 016 n'est pas appliquée | l'appli lit déjà `sponsored_partners_public` (`partnersStore.ts:76`) |
| S2-03 production en retard sur le dépôt | En partie résolu : 013 appliquée (vérifié) | lancer `scripts/etat-migrations-prod.sql` pour le reste |
| S2-04 identité choisie par l'appareil | Ouvert (accepté) | inhérent à l'absence de compte |
| S2-05 aucune limite, tables sans plafond | **Jetons géants : corrigé par 021** ; débit : ouvert | `tests/sql/hardening.test.mjs` |
| S2-06 lien profond qui fige l'appli | Ouvert | `decode-uri-component@0.2.2` via `expo-router@57` ; seul correctif sûr : Expo SDK 58 (`expo-router@58.0.32`). Les versions 0.4+ du paquet ne sont plus compatibles avec `query-string@7` |
| S2-07 jeton Mapbox sans restriction | Ouvert (réglage Mapbox, pas de code) | restreindre le jeton web par URL dans le compte Mapbox |
| S2-08 HTML injecté par `image_url` | **Corrigé** | `mapboxHtmlTemplate.ts:194-203` crée l'image par le DOM ; le reste du HTML est constant |
| S2-09 code admin partagé, verrouillage global | Ouvert | changer le code (il figure dans le PDF de la réunion du 22/10) |
| S2-10 dépôt anonyme dans le bucket `etablissements` | Non revérifié (production) | — |
| S2-11 identifiant d'appareil par `Math.random` | **Corrigé ici** | `secureUuid.ts` : `crypto.randomUUID`, sinon `expo-crypto`, jamais `Math.random` ; les identifiants existants ne changent pas (`secureUuid.test.ts`) |
| S2-12 messages de la carte sans contrôle, WebView ouverte | **Corrigé ici** | web : seuls les messages de l'iframe de la carte sont lus, et la carte n'écoute que la page de l'appli ; téléphone : la WebView ne quitte plus la page de carte, un lien https externe s'ouvre dans le navigateur (`mapGuards.ts`, `mapGuards.test.ts`). Vérifié dans le navigateur : carte, groupes, appui sur une adresse, fiche |
| S2-13 pas d'intégration continue | Ouvert | `docs/ci.workflow.yml` existe maintenant ; il faut un jeton GitHub avec le droit `workflow` pour l'activer |
| S2-14 `admin_users` lisible | **Corrigé par 021** | `hardening.test.mjs` |
| S2-15 erreurs PostgREST bavardes | Accepté | inhérent à PostgREST |
| S2-16 catalogue copiable | Accepté (voulu) | — |

### Revue des nouvelles migrations de Sohel (016 à 020)

- **016** : vue publique sans le prix, table fermée, `admin_read` limitée à `sponsored_partners` après le code. Correct.
  ⚠️ À appliquer **en même temps** que la sortie de la nouvelle version : les anciennes versions lisent la table
  directement et n'afficheront plus de partenaires ; inversement, la nouvelle version sans 016 tombe sur sa copie locale
  (aucun partenaire sur une nouvelle installation).
- **017** : **efface définitivement** les notes externes de toutes les adresses (`update … set rating = null`). Voulu
  (droits de republication), mais irréversible : **faire une sauvegarde avant** (Database → Backups, ou export de la
  colonne `rating`).
- **018** : purge des suggestions de plus de 24 mois, fonction non exécutable par la clé publique. Correct.
- **019** : ferme les anciennes tables et fonctions, sans supprimer de données. Correct ; `admin_users` gardait le droit
  de lecture : fermé par 021.
- **020** : bannière Office de tourisme. Lecture publique du seul réglage, écriture après le code admin, adresse https
  stricte côté serveur **et** côté appli (`safeWebUrl` avant `Linking.openURL`). Correct.

### Autres contrôles

- Clé présente dans le dépôt et dans `eas.json` : rôle `anon` (clé publique, attendue), jamais `service_role` (test ajouté).
- `.env`, `google-services.json`, `GoogleService-Info.plist` : ignorés par Git.
- Android : `allowBackup: false` ; permissions limitées à la position ; micro, caméra et stockage bloqués.
- Code admin : jamais écrit dans le stockage ni dans les journaux (`grep` sur `setItem`, `SecureStore`, `console.*`).
- Dépendances (`npm audit --omit=dev`) : 17 alertes, presque toutes dans l'outillage de build (`@expo/cli`, `shell-quote`,
  `node-forge`, `glob`…) qui n'est pas livré dans l'appli. Seule alerte dans le code livré : `decode-uri-component`
  (S2-06).
- Jeton de notification : un autre appareil qui connaît le jeton exact d'un téléphone peut le rattacher à son
  identifiant (`register_push_token` supprime l'ancienne ligne). Impact faible : le jeton n'est jamais public et les
  notifications continuent d'arriver sur le téléphone.

## 4. Production : ce qu'il reste à faire (par Ryadh, dans l'ordre)

1. **Voir l'état réel** : coller `scripts/etat-migrations-prod.sql` dans le SQL Editor (lecture seule, une ligne de
   `true`/`false`).
2. **Sauvegarde** de la base (indispensable avant 017).
3. Appliquer, une par une, celles qui sont à `false` : `014`, `015`, `016`*, `017`, `018`, `019`, `020`, `021`
   (*016 au moment de la sortie de la nouvelle version). Après chacune : « Success ».
4. `notify pgrst, 'reload schema';` (déjà dans chaque script, à relancer si l'API ne voit pas une fonction).
5. Relancer `scripts/etat-migrations-prod.sql` (tout doit être `true`) puis `scripts/audit-prod-readonly.sql` (aucun FAIL).
6. Créer les vraies offres, puis supprimer les 5 offres de démonstration depuis le portail.
7. Changer le code admin (il figure dans le PDF de la réunion), puis restreindre le jeton Mapbox web par URL.

## 5. Ce qui demande un nouveau build

`expo-crypto` est un module natif : il faut un nouvel APK (`eas build --profile preview`) pour l'identifiant d'appareil et
le portail admin dans l'APK. Les garde-fous de la carte et le message des offres partent aussi avec ce build.

## 6. Non testé

- Sur téléphone réel : la carte dans la WebView avec le nouveau contrôle de navigation (Android et iOS), l'ouverture du lien
  « © Mapbox » dans le navigateur, la génération de l'identifiant par `expo-crypto`, les notifications.
- En production : les migrations 016 à 021 (testées uniquement sur PostgreSQL en mémoire, PGlite) ; la publication d'une
  offre après le rechargement du cache.
