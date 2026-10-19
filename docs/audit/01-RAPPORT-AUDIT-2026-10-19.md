# Rapport d'audit pré-publication — Le Petit Tou

- **Date** : 19 octobre 2026 — **Dépôt** : `Rmenac88/le-petit-tou`, commit de départ `64419c3` (branche `main`)
- **Pile réelle** : Expo SDK 57.0.2 / React Native 0.86.0 / React 19.2.3 / expo-router 57 / TypeScript 6 ; Supabase (`@supabase/supabase-js` 2.108.2) comme seul backend (PostgREST + fonctions SQL `SECURITY DEFINER` ; **aucune** Edge Function, aucun webhook, aucune tâche planifiée) ; cartes : react-native-maps (natif) et Mapbox GL dans une iframe (web) ; itinéraires : API Mapbox Directions.
- **Identifiants** : iOS `fr.lepetittou.app`, Android `fr.lepetittou.app`, version 1.0.0.
- Ce document ne délivre **aucune certification juridique** et ne présume pas de l'approbation d'Apple ou de Google.


> ## Addendum du 19/10/2026 (soir) — état après correctifs
>
> **Vérifié en production** (script `audit-prod-check.sh`, 19/10) : écriture directe du catalogue refusée (S-01), tables utilisateur illisibles (S-03/S-05/S-07), ancien code admin refusé après rotation (S-02), fonctions `admin_write`, `get_my_discoveries`, `get_my_card_usage`, `delete_my_data` déployées et testées de bout en bout avec un appareil fictif (découverte idempotente, quota des cartes, likes bornés, effacement).
> **Restent ouverts** : S-10 (inscriptions e-mail/Google à fermer dans Supabase), D-02/D-03 (pages web : créées dans `public/`, champs `[À COMPLÉTER]` à remplir et à héberger), C-01 (jeton Mapbox dans EAS).
>
> **Ajouté depuis** : notifications push complètes (migration `007`, module client, écran de réglages, onglet admin) ; garde-fous anti-plantage (`ErrorBoundary` sur chaque onglet et le portail admin) ; verrouillage du portail après 15 min d'inactivité ; `app.config.js` qui **refuse un build de production** sans clé Google Maps, jeton Mapbox ni fichier Firebase ; pages légales web ; purge automatique des données (24 mois d'inactivité, consultations 13 mois, journaux 30 jours) ; correctif de l'accueil sans fichier `.env`.
> **Tests** : 63 unitaires, 54 SQL (dont 25 pour les notifications), `tsc` propre, 3 bundles de production générés.
> **Reste non fait / non prouvé** : migration 007 non encore déployée ; **aucune notification réelle reçue sur un téléphone** ; carte native et localisation jamais vues tourner ; Expo Go plante sur l'iPhone de test (cause inconnue) ; accessibilité non testée avec VoiceOver/TalkBack ; clé Google Maps Android et fichier Firebase à créer ; comptes Apple/Google à ouvrir ; performances non mesurées.
> **Décision inchangée : NON PRÊTE POUR SOUMISSION.** Marche à suivre : `docs/audit/02-PUBLICATION.md`.

---

## A. Résumé exécutif

**Décision : NON PRÊTE POUR SOUMISSION.**

L'application elle-même est stable à la compilation (vérification de types propre, 3 bundles de production générés, 53 tests unitaires et 29 tests de base de données réussis), mais **la base de production est aujourd'hui ouverte** : n'importe qui possédant la clé publique de l'appli peut modifier ou supprimer les adresses, catégories, événements et partenaires, et lire des identifiants d'appareils. L'ancien code admin, présent dans l'historique d'un dépôt GitHub **public**, est **toujours accepté** par le serveur.

| | |
|---|---|
| Problèmes détectés | 33 (3 critiques P0, 11 élevés P1) |
| Corrigés dans le dépôt (code, migration, tests) | 17 |
| Parmi eux, **à déployer par toi** (005 + 006, réglages) | S-01 à S-10, D-01, C-01 |
| Restants / décisions humaines | 16 (voir registre, colonne « Reste ») |
| Non vérifiables ici | appareils réels, notifications push (inexistantes), builds EAS signés, comptes stores |

**Risques critiques** : S-01 (catalogue modifiable par tous), S-02 (code admin public et valide), S-03 (fuite des identifiants d'appareils). Les corrections sont écrites et testées sur une vraie base PostgreSQL locale, **mais pas encore appliquées à Supabase**. Tant que `docs/audit/00-LISEZ-MOI-ACTIONS-URGENTES.md` n'est pas déroulé, les trois failles sont ouvertes.

**Limites de l'audit** : pas d'accès administrateur Supabase (je n'ai pas pu lire les politiques RLS réelles ni les réglages du tableau de bord) ; pas d'appareil réel ni de simulateur lancé ; pas de compte App Store Connect / Play Console ; pas de test de charge. Les tests de base de données tournent sur PGlite (PostgreSQL réel en WebAssembly) avec les rôles Supabase reproduits, **pas** sur le projet Supabase lui-même. Pendant l'audit, j'ai effectué sur la production quelques réécritures neutres (identifiant d'une ligne remplacé par lui-même, sur 4 tables, répétées lors de deux passages du script de contrôle) pour prouver S-01, ainsi qu'une tentative d'inscription anonyme (refusée) ; aucun contenu n'a changé.

---

## B. Tableau de bord (nombres réellement observés)

| Domaine | Prévus | Réussis | Échoués | Bloqués | Non exécutés | Statut |
|---|---|---|---|---|---|---|
| Tests automatisés (code) | 53 unitaires + 29 SQL + tsc + 3 bundles | 53 + 29 + tsc + 3 | 0 | 0 | lint (ESLint non installé), UI/E2E | VERT sur l'existant, GRIS sur l'UI |
| Cybersécurité — production (`audit-prod-check.sh`, avant correctif) | 21 | 4 | 17 | 0 | 0 | **ROUGE** (en attente de 006) |
| Cybersécurité — après 006 (base locale) | 29 | 29 | 0 | 0 | 0 | VERT (local) / **non prouvé en prod** |
| Dépendances (`npm audit`) | 1 | 0 | 1 | 0 | 0 | ORANGE (45 : 1 critique, 31 hautes, 13 modérées ; presque toutes dans l'outillage de build) |
| RGPD / conformité (lignes de la matrice D) | 16 | 2 (art. 17 en local, transparence dans l'appli) | 2 (art. 32 en production, art. 33 à évaluer) | 0 | 12 (validation humaine) | ORANGE |
| Base de données | 29 tests locaux + 21 sondes de production | 29 + 4 | 0 + 17 | 0 | RLS réelle de production non lisible (pas d'accès admin) | ROUGE en production, VERT en local |
| Notifications | 5 événements types (section E) | 0 | 0 | 0 | 5 | GRIS : **aucune notification n'est implémentée** |
| Performances | 0 mesure | 0 | 0 | 0 | tout | GRIS |
| iOS | 7 (permissions, ATS, signature, étiquettes, appareil réel, captures, version cible) | 2 | 0 | 0 | 5 | ORANGE |
| Android | 7 (permissions, AAB, signature, targetSdk, Data safety, appareil réel, captures) | 1 | 0 | 0 | 6 | ORANGE |

Aucune couverture de code mesurée (aucun outil de couverture dans le projet) : **non exécuté**.

---

## C. Registre des problèmes

Gravité : P0 critique, P1 élevée, P2 modérée, P3 faible. « Corrigé » = changé dans le dépôt **et** testé ; « à déployer » = nécessite une action de ta part sur Supabase ou les stores.

| Id | Gravité | Problème / preuve | Cause racine | Correction | Tests exécutés | Reste |
|---|---|---|---|---|---|---|
| S-01 | P0 | Catalogue (`addresses`, `categories`, `events`, `sponsored_partners`) modifiable par la clé publique : réécriture neutre d'une ligne acceptée dans les 4 tables (`content-range 0-0/1`). | `fix_admin_and_database_schema.sql` désactive la RLS ; le portail admin écrit en direct avec la clé publique et en dépendait. | `006` : RLS activée, lecture publique seule, droits d'écriture retirés ; écritures via `admin_write` (code vérifié en base, tables et colonnes limitées). Portail réécrit (`src/lib/adminApi.ts`). Scripts à risque neutralisés. | SQL : avant/après (écriture refusée anon et authenticated, CRUD admin, injection via nom de table/clé, mauvais code) ; unitaires `adminApi` (9) | **Déployer 005 puis 006** ; relancer `audit-prod-check.sh` |
| S-02 | P0 | Ancien code admin (30 caractères) présent dans l'historique d'un dépôt public (commit `3bd7017` jusqu'à `a5ca45c^`) et **accepté** par `verify_admin_access` en production. | Code en clair dans un script SQL, jamais rotaté en base. | Code remplacé par une empreinte SHA-256 (005) ; 006 refuse de s'exécuter si l'empreinte est absente ; verrouillage 10 échecs/15 min. | SQL : verrouillage et déverrouillage, secrets illisibles, garde-fou 005 | **Choisir un nouveau code, rejouer 005, vérifier avec `OLD_ADMIN_CODE`.** L'historique Git restera public : seul le changement de code compte. |
| S-03 | P0 | `user_place_discoveries` lisible par tous (3 lignes, `device_id` visibles) ; insertion libre ; politiques `OR auth.uid() IS NULL`. | Politiques 003 et `setup_discoveries_schema.sql` ouvertes. | Plus aucun droit direct ; lecture/écriture par fonctions qui exigent l'identifiant de l'appelant (`get_my_discoveries`, `get_my_card_usage`, `discover_place`, `use_discount_card`). Unicité garantie en base. | SQL : 8 tests (accès direct refusé, isolation entre appareils, idempotence, quota) | À déployer |
| S-04 | P1 | `increment_spot_like` : delta arbitraire (+1000) et répétable, pour tous. | Fonction sans contrôle ; repli client en écriture directe. | Un like par appareil et par adresse, delta limité à ±1, existence de l'adresse vérifiée ; repli client supprimé. | SQL : 2 tests | À déployer |
| S-05 | P1 | `place_suggestions` : texte libre + identifiant d'appareil lisibles par tous. | Politique SELECT `true`. | Insertion seule, tailles bornées, statut forcé à `pending`, lecture interdite. | SQL : 1 test | À déployer ; modération via le tableau de bord Supabase |
| S-06 | P1 | Aucun moyen d'effacer ses données (RGPD art. 17) ; `delete_user_account` absent de la production et référençant une table inexistante. | Fonction jamais déployée / obsolète. | `delete_my_data` + bouton « Effacer mes données » (confirmation, échec propre sans effacement local partiel). | SQL : 2 ; unitaires `dataDeletion` (6) | À déployer ; test sur appareil |
| S-07 | P1 | `address_views`, `user_push_tokens` : RLS désactivée, `GRANT ALL` à anon. | Scripts de dépannage. | RLS activée ; `address_views` en insertion seule sans lecture ; `user_push_tokens` fermée. | SQL : 3 | À déployer |
| S-08 | P1 | La connexion anonyme est **désactivée** côté Supabase (réponse `anonymous_provider_disabled`) alors que le code « sécurisé » (003) suppose `auth.uid()`. La RLS « par utilisateur » n'a donc jamais été effective. | Écart entre conception et configuration. | Modèle assumé et sécurisé : l'identifiant d'appareil (UUID aléatoire, format contrôlé) est le secret ; la session Supabase prime si elle existe. | SQL : priorité session > p_device_id | Décision : laisser désactivé ou activer + captcha |
| S-09 | P1 | Force brute du code admin possible sans limite (25 essais enchaînés, aucun blocage). | Aucune limitation. | `_admin_gate` : 10 échecs/15 min ⇒ refus. Les refus ne lèvent plus d'exception (sinon le journal serait annulé). | SQL | Limite : verrouillage global (un attaquant peut bloquer l'admin 15 min) |
| S-10 | P1 | Inscription par e-mail et Google ouverte côté Supabase sans écran dans l'appli. | Réglage par défaut. | Aucune dans le code. | `audit-prod-check.sh` (échoue) | **À désactiver dans le tableau de bord** |
| S-11 | P2 | Stockage photos : upload anonyme avec `upsert`, sans limite de taille ni de type. | Politiques de stockage inconnues. | 006 : bucket limité à 5 Mo, JPEG/PNG/WebP, dossiers `covers`/`gallery`, plus de remplacement/suppression. | Non testé (schéma `storage` absent en local) | Écriture anonyme dans le bucket reste possible (pas de moyen de passer le code admin au stockage) : risque résiduel moyen ; envisager une Edge Function |
| S-12 | P2 | `sponsored_partners.price_paid` (montant payé par les partenaires) lisible publiquement. | `select('*')` + lecture publique. | Non corrigé. | — | Décision : vue sans cette colonne |
| S-13 | P2 | Utilisation d'une carte privilège : succès affiché même si le serveur refuse ou est injoignable (usages illimités hors ligne). | Repli optimiste. | `useCard` aligné sur le serveur, annulation de la déduction locale en cas de refus. | tsc + revue ; test UI non automatisé | Test manuel sur appareil |
| S-14 | P2 | Liens issus de la base (site, téléphone, réservation) ouverts sans contrôle de schéma. | `Linking.openURL` direct. | `safeWebUrl` / `safeTelUrl` (http/https et `tel:` seulement). | 5 tests unitaires | — |
| S-15 | P2 | Les achats de points ne vérifient pas la présence physique (découverte possible à distance de toutes les adresses). | Choix de conception. | Non corrigé. | — | Décision métier |
| S-16 | P2 | Un nouvel identifiant (réinstallation) remet à zéro les quotas des cartes privilège. | Identité = appareil. | Non corrigé. | — | Limite inhérente à l'absence de compte ; le commerçant garde la validation |
| S-17 | P2 | Aucune limite d'abus sur `address_views` / `place_suggestions` / likes (remplissage de la base). | Pas de rate limiting côté Supabase gratuit. | Tailles bornées et unicité ; pas de quota par minute. | — | Surveiller l'usage ; Cloudflare/Edge si besoin |
| S-18 | P2 | Jeton de session stocké dans SecureStore : valeurs > 2 048 octets non garanties sur Android. | Adaptateur SecureStore direct. | Non corrigé (sans effet ici : pas de session). | — | À traiter si l'authentification est activée |
| S-19 | P2 | Portail admin dans l'appli publique (7 appuis sur le logo). | Choix de conception. | Code serveur + verrouillage ; la permission photos n'est demandée qu'à l'usage. | — | Envisager de retirer l'accès admin du build public |
| D-01 | P1 | Politique de confidentialité inexacte : affirmait qu'aucune donnée n'est transmise et que la photothèque n'est jamais utilisée. | Texte non aligné sur le code. | Réécrite d'après les traitements observés (identifiant d'appareil, découvertes, cartes, likes, suggestions, statistiques, cartographie, destinataires, droits, CNIL). | Relecture du code | **Relecture juridique ; page web publique obligatoire** |
| D-02 | P1 | Aucune URL publique de politique de confidentialité (exigée par App Store Connect et Google Play). | Texte uniquement dans l'appli. | Non corrigé. | — | À héberger |
| D-03 | P1 | Mentions légales / CGU absentes. | — | Non corrigé. | — | À rédiger (association loi 1901 : éditeur, hébergeur) |
| D-04 | P2 | Aucune durée de conservation appliquée (pas de purge). | — | Politique indique « jusqu'à effacement » ; purge à décider. | — | Décision + tâche planifiée (pg_cron) |
| D-05 | P2 | Région d'hébergement Supabase et transferts hors UE non vérifiés ; Mapbox (États-Unis) reçoit la position pour les itinéraires. | — | Mentionné dans la politique. | — | Vérifier la région ; clauses types / DPA |
| C-01 | P1 | `eas.json` : jeton Mapbox factice `YOUR_MAPBOX_ACCESS_TOKEN` écrasait la vraie valeur dans les builds de production et preview. | Valeur d'exemple commitée. | Entrées supprimées ; la variable doit venir d'EAS. | Config relue ; bundle web contient 0 jeton Mapbox | **Déclarer la variable dans EAS** |
| C-02 | P2 | Dépendances inutilisées `expo-notifications`, `expo-task-manager`, `expo-device` (aucun import) ajoutaient des capacités et du code natif. | Restes. | Supprimées. | tsc, 3 bundles | — |
| C-03 | P2 | Permissions : `expo-image-picker` sans texte d'usage iOS (risque de plantage au clic) ; permissions Android inutiles (caméra, micro, stockage, superposition). | Plugin non configuré. | Textes fournis ; permissions bloquées ; localisation limitée au premier plan. | `expo prebuild` réel : Info.plist et manifeste relus (caméra/micro/stockage/superposition = `tools:node="remove"`) | Chaînes `NSLocationAlways…` encore ajoutées par le module (sans service d'arrière-plan) |
| C-04 | P3 | Types CSS manquants : 2 erreurs `tsc`. | Fichier de types absent. | `src/css.d.ts`. | `tsc` propre | — |
| C-05 | P3 | `manage_partnerships.py` : URL et clé d'un ancien projet Supabase (supprimé) codées en dur. | Reste historique. | Variables d'environnement obligatoires. | Syntaxe vérifiée | — |
| C-06 | P2 | Dépôt : 45 vulnérabilités `npm audit` (outillage Expo/Metro, `shell-quote`, `xmldom`…). | Chaîne de build. | Aucune mise à jour aveugle ; elles ne sont pas dans le bundle (vérifié : seul `supabase-js`/React Native/Expo runtime). | `npm audit --json` | Mettre à jour Expo par paliers SDK avec tests |
| C-07 | P3 | Fichiers de travail dans le dépôt (`scratch/`, `scripts/inspect_zoom.js`, `geocode_missing.py`, `.claude/`, `.agents/`). | — | Non touchés (suppression non autorisée). | — | À trier |
| C-08 | P2 | Donnée de test publique : événement « Test » (2027-04-19) dans `events`. | — | Non supprimé (production). | — | Suppression manuelle |
| C-09 | P3 | Dataset local 790 adresses contre 789 en base. | — | Non corrigé. | — | À réconcilier |

---

## D. Rapport de conformité (matrice)

« Validation humaine » = relecture par une personne compétente (juriste/DPO) nécessaire. Aucune ligne n'est « conforme » sans cette validation.

| Référence officielle | Exigence | Applicable ? | Preuve examinée | Résultat | Action restante | Validation humaine |
|---|---|---|---|---|---|---|
| RGPD art. 5 | Minimisation, finalité | Oui (identifiant d'appareil = donnée personnelle) | Code des stores, tables | Partiel : minimal, mais statistiques/suggestions à qualifier | Registre des traitements | Oui |
| RGPD art. 6 | Base légale | Oui | Politique réécrite | À valider (exécution du service / intérêt légitime) | — | Oui |
| RGPD art. 12-14 | Transparence | Oui | `PrivacyPolicyModal` | Corrigé dans l'appli ; **absent hors appli** | Page web (D-02) | Oui |
| RGPD art. 15-21 | Droits | Oui | Bouton d'effacement + e-mail | Effacement implémenté (à déployer) ; accès/portabilité par e-mail | Procédure interne de réponse | Oui |
| RGPD art. 17 | Effacement | Oui | `delete_my_data` + tests | Réussi en local, non déployé | Déploiement | Non |
| RGPD art. 28, 44-46 | Sous-traitants, transferts | Oui (Supabase, Mapbox, Apple/Google) | Politique | Non vérifié (région Supabase inconnue, DPA) | DPA, clauses types | Oui |
| RGPD art. 32 | Sécurité | Oui | Registre S-01…S-12 | **Échoue en production** tant que 006 n'est pas appliquée | Section A | Non |
| RGPD art. 33-34 | Violation | Oui | — | **Un incident est probable** : base modifiable + code admin public avant correction. Vérifier les journaux Supabase pour des modifications inhabituelles ; le critère de notification CNIL (72 h) est à apprécier | Analyse des logs | **Oui** |
| ePrivacy / CNIL traceurs | Consentement des traceurs | À vérifier | Aucun SDK d'analyse/publicité dans `package.json` ; `localStorage` web limité à des préférences et au cache | Pas de traceur soumis à consentement relevé dans le code (absence non prouvée pour la version web servie par un hébergeur tiers) | Vérifier l'hébergeur web | Oui |
| Apple 5.1.1 (i)-(v) | Politique de confidentialité, suppression de compte | Politique : oui. Suppression de compte : non applicable (aucun compte) ; bouton fourni | — | À déclarer dans App Store Connect | Étiquettes de confidentialité | Oui |
| Google Play — Data safety, suppression | Déclaration des données, mécanisme de suppression | Déclaration : oui ; formulaire de suppression hors appli : à fournir si l'appli est jugée « avec compte » | — | Non vérifié | Remplir Data safety | Oui |
| Loi pour la confiance dans l'économie numérique (art. 6) | Mentions légales | Oui (éditeur) | — | Absentes (D-03) | Rédiger | Oui |
| RGAA / loi 2005-102 (accessibilité) | Accessibilité numérique | À qualifier (association, taille) | 42 propriétés d'accessibilité pour 168 `Pressable` | Non audité à l'aide d'un lecteur d'écran | Audit VoiceOver/TalkBack | Oui |
| DSA, DMA, Data Act | — | Non applicables en l'état (pas d'hébergement de contenu tiers public : les suggestions ne sont pas publiées) | Code | À réexaminer si des avis sont publiés | — | Oui |
| Consommateurs / paiement | CGV | Non applicable : aucun paiement dans l'appli (le partenariat payant est géré hors appli) | Code | — | Vérifier la nature des « cartes privilège » (offres commerciales) | Oui |
| Mineurs | — | Public non ciblé | — | Non évalué | Classification d'âge des stores | Oui |

---

## E. Rapport notifications

**Constat initial** : aucune notification n'existait. **Depuis** : chaîne complète implémentée (migration `007`, `src/lib/pushNotifications.ts`, écran « Notifications », onglet admin). **Statut : implémentée et testée côté serveur sur base simulée ; non déployée ; jamais reçue sur un appareil réel.**

| Événement | Condition | Destinataire | Canal | Déclencheur | Traitement | Statut |
|---|---|---|---|---|---|---|
| Nouvel événement | `INSERT` dans `events` | Appareils inscrits avec « Événements » | Push | trigger SQL non bloquant | file `push_outbox` → distribution → API Expo | Testé (simulé) |
| Nouvelle date d'agenda | `INSERT` dans `partner_events` actif | « Agenda des partenaires » | Push | trigger | idem | Testé (simulé) |
| Nouvelle adresse | `INSERT` dans `addresses` avec `is_new` | « Nouvelles adresses » (désactivé par défaut) | Push | trigger ; plusieurs adresses regroupées en un message | idem | Testé (simulé) |
| Annonce libre | Admin (portail) | Appareils inscrits « Événements » | Push | `admin_send_push` ; hors plafond | idem | Testé (simulé) |
| Date d'agenda modifiée/annulée, alerte de sécurité, rappels, messages | — | — | — | — | — | **Volontairement non implémenté** (pas de besoin identifié, risque de spam) |

Règles de fiabilité testées : anti-doublon (type + référence uniques), plafond 2 push/24 h/appareil, heures calmes 21 h-8 h (Paris), message périmé après 24 h jamais envoyé, 3 tentatives sur erreur serveur ou absence de réponse, jeton `DeviceNotRegistered` invalidé (ticket et reçu), reçus relus après 15 min, déclencheurs qui ne bloquent jamais la création de contenu, purge des journaux à 30 jours, jetons effacés avec « Effacer mes données ».

**Non vérifié** : envoi réel à l'API Expo (réponses simulées), acceptation par APNs/FCM, affichage sur iPhone et Android (app ouverte, en arrière-plan, fermée), ouverture du bon écran au toucher, comportement des permissions propre à chaque système, configuration APNs/FCM, `pg_net` et `pg_cron` actifs sur le projet. Un reçu « ok » prouverait l'acceptation par le fournisseur, pas l'affichage.

---

## F. Rapport des tests

| Commande | Environnement | Résultat | Notes |
|---|---|---|---|
| `npx tsc --noEmit` | Node 24.11, TS 6.0.3 | Réussi (0 erreur) après `src/css.d.ts` ; 2 erreurs avant | |
| `npm run test:agenda` | node:test | **53/53** réussis | 33 tests agenda existants + 20 nouveaux (`adminApi` 9, `dataDeletion` 6, `safeLinks` 5) |
| `npm run test:sql` | PGlite (PostgreSQL WebAssembly), `tests/sql/` | **29/29** réussis ; 2 démontrent la faille avant 006 | Données synthétiques ; **pas** le projet Supabase réel |
| `npx expo export` iOS + Android + web | Metro, Hermes | Réussi (iOS 8,1 Mo, Android 8,3 Mo, web 6,4 Mo) | Bundle web : une seule clé JWT (rôle `anon`), aucun `service_role`, aucun jeton Mapbox |
| `npx expo prebuild --no-install` (puis dossiers supprimés) | Expo | Réussi ; Info.plist et manifeste relus | ATS strict (`NSAllowsArbitraryLoads` faux), cible iOS 16.4 ; niveau `targetSdk` Android non relevé |
| `npm audit --json` | npm 11.6 | 45 vulnérabilités (1 critique `shell-quote`, 31 hautes, 13 modérées) | Outillage de build ; aucune mise à jour appliquée |
| `scripts/audit-prod-check.sh` | Production Supabase, clé publique | 4 réussis / 17 échoués (avant 006) | À relancer après déploiement |
| Lint (`expo lint`) | — | **Non exécuté** : ESLint n'est pas installé dans le projet | |
| Tests de l'interface, E2E, lecteur d'écran, performances, appareil réel, builds EAS signés | — | **Non exécutés** | |

Aucun résultat n'a été simulé. Mesure de couverture : non disponible.

---

## G. Checklist de publication

| Contrôle | État |
|---|---|
| Base de production verrouillée (006) et nouveau code admin | ROUGE (échec constaté) |
| Politique de confidentialité à jour dans l'appli | VERT (texte), ORANGE (validation juridique) |
| Politique publiée à une URL publique + mentions légales | ROUGE |
| Effacement des données (appli + serveur) | ORANGE (testé en local ; à déployer et à tester sur appareil) |
| Jeton Mapbox en production | ORANGE (variable EAS à créer) |
| Type check, tests, bundles de production | VERT |
| Permissions iOS/Android justifiées | VERT (relues dans le projet généré) |
| Build iOS signé (profils, certificats, APNs non requis : aucune push) | GRIS |
| Build Android AAB signé, `targetSdk` exigé à la date de soumission | GRIS |
| Étiquettes de confidentialité App Store / Data safety Google | GRIS (brouillon ci-dessous) |
| Tests sur appareils réels (iPhone, Android), connexion lente/coupée, reprise d'arrière-plan | GRIS |
| Accessibilité (VoiceOver/TalkBack, texte agrandi) | GRIS |
| Captures d'écran (dont iPad : `supportsTablet` est vrai), descriptions, âge, compte de démonstration pour l'examen (aucun compte requis ; code admin à ne pas fournir) | GRIS |
| Plan de retour arrière | Migration 006 atomique ; sauvegarde Supabase à confirmer avant exécution (point-in-time recovery selon l'offre) |

**Brouillon de déclarations (à valider)** — données liées à un identifiant d'appareil : identifiant d'appareil (fonctionnalité de l'app), historique d'usage (adresses découvertes, cartes utilisées), contenu fourni par l'utilisateur (suggestions). Position : utilisée au premier plan ; les coordonnées partent vers Mapbox lors d'un itinéraire. Pas de suivi publicitaire, pas de données vendues.

**Décision finale : NON PRÉPARÉE — NON PRÊTE POUR SOUMISSION.** Au moins trois contrôles obligatoires échouent (S-01, S-02, S-03 en production ; politique non publiée). Après déploiement de 005/006, publication de la politique et tests sur appareils, l'état pourrait passer à « PRÉPARATION AVANCÉE — VALIDATIONS RESTANTES ». Cette décision ne concerne que la préparation technique et documentaire, jamais l'approbation d'Apple ou de Google.

---

## Annexe — Fichiers modifiés ou ajoutés

Ajoutés : `src/scripts/006_security_lockdown.sql`, `src/lib/adminApi.ts`, `src/lib/dataDeletion.ts`, `src/lib/safeLinks.ts`, `src/css.d.ts`, `tests/sql/*`, `src/lib/__tests__/{adminApi,dataDeletion,safeLinks}.test.ts`, `scripts/audit-prod-check.sh`, `docs/audit/*`.
Modifiés : portail admin, modale de confidentialité, stores (découvertes, cartes, likes, agenda, auth), `AddressDetailModal`, `PlaceDetailSheet`, `HomeView` (liens sûrs), `app.json`, `eas.json`, `package.json` (+ `@electric-sql/pglite` en développement, − 3 dépendances inutilisées), scripts SQL anciens (neutralisés ou annotés), `manage_partnerships.py`.
Rien n'a été commité, poussé ni publié.
