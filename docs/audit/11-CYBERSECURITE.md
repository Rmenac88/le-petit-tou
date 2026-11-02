# Audit de cybersécurité indépendant — Le Petit Tou (Mission S, constats S2-xx)

- **Date** : 2 novembre 2026. **Branche** : `integration/audit-plus-claude` (HEAD `add426f`). **Périmètre** : base Supabase de production (clé publique, lecture seule), code de l'appli, configuration native et build, notifications, abus.
- **Contraintes respectées** : aucune écriture en production, aucun code admin deviné ou utilisé, aucun fichier de l'appli modifié, aucun commit. Aucun secret n'est reproduit ici.
- **Actions réelles sur la production** : requêtes `GET` sur 43 noms de tables, lectures de réglages publics (`/auth/v1/settings`, `/storage/v1/bucket`, `/graphql/v1` : introspection), appels de fonctions de **lecture** avec de faux identifiants, **2 appels avec un faux code admin** (`verify_admin_access`, `admin_read`) donc 2 échecs ajoutés au compteur de verrouillage (seuil : 10 en 15 min, déjà expiré à la remise du rapport), et des sondes dont le type d'argument est volontairement invalide (elles ne peuvent rien exécuter). Trois appels prévus (`admin_write` avec faux code, `purge_old_data`, `scan_ticket_secure`) ont été **refusés par le garde-fou de l'outil** et n'ont **pas** été lancés.

---

## 1. Résumé pour le commanditaire

**Verdict : publiable sous conditions.** Les trois failles critiques du 19/10 (catalogue modifiable, ancien code admin, identifiants d'appareils lisibles) sont bien fermées en production : je l'ai revérifié aujourd'hui avec la seule clé publique. Il n'y a **aucun constat P0**. Il reste trois points à traiter avant publication.

Les 5 points les plus importants :
1. **Le portail admin caché est présent dans l'application des boutiques** (S2-01, P1). L'interrupteur `EXPO_PUBLIC_ENABLE_ADMIN` existe mais n'est plus branché : le code a disparu lors d'une fusion. La liste de contrôle de publication affirme le contraire.
2. **Le montant payé par les partenaires est toujours lisible par n'importe qui** (S2-02, P1) : les deux partenaires sponsorisés ont un `price_paid` non nul, visible avec la clé publique. La migration 016 n'est pas appliquée.
3. **La production est en retard sur le dépôt** (S2-03, P1) : les migrations 015 (listes sur serveur) et 016 ne sont pas déployées ; la fonction `admin_read` en production n'est pas celle du dépôt (comportement différent, source inconnue).
4. **Quotas et « un like par appareil » contournables** (S2-04, P2) : l'identité est un texte choisi par l'appareil ; un script fabrique autant d'« appareils » qu'il veut. Aucune limite de fréquence nulle part (S2-05).
5. **Un lien profond malveillant peut figer l'appli** (S2-06, P2) : `decode-uri-component` (via `expo-router`) met 4,5 s pour 1 500 caractères et 20 s pour 3 000 (mesuré en Node). Présent dans le code livré.

Bonne nouvelle vérifiée : aucune clé secrète dans le code ni dans les 80 commits ; les inscriptions e-mail, Google, téléphone et anonymes sont désactivées (S-10 est donc **clos**) ; les fonctions internes (`_admin_gate`, `purge_old_data`, `push_*`) refusent la clé publique ; le code admin n'est ni stocké ni journalisé.

**Nombre de constats : P0 = 0, P1 = 3, P2 = 7, P3 = 6 (total 16).**

---

## 2. Ce qui a été testé

### 2.1 Surface d'attaque de la base (production, clé publique)

Méthode : `GET /rest/v1/<table>?select=*&limit=1` avec `Prefer: count=exact`. `401` + code `42501` = droit de lecture absent ; `200/206` = lecture possible ; `404/PGRST205` = table inexistante. (`GET /rest/v1/` est réservé au service_role : la liste complète n'est pas obtenable avec la clé publique, d'où l'énumération par noms.)

| Table / vue | Résultat observé | Attendu (dépôt) | Statut |
|---|---|---|---|
| `addresses` (789), `categories` (19), `events` (1), `featured_spots` (1), `spot_likes` (9), `discount_cards` (5) | lecture publique | oui | VÉRIFIÉ |
| `sponsored_partners` (2) | **lecture publique, colonnes `price_paid`, `notify_interval_hours`, `last_notified_at` incluses ; `price_paid` non nul sur les 2 lignes** | fermée après 016 | VÉRIFIÉ → S2-02 |
| `sponsored_partners_public` (vue, 2) | lisible, sans prix | oui | VÉRIFIÉ |
| `partner_events`, `app_settings` | 200, 0 ligne visible | lecture publique | VÉRIFIÉ |
| `admin_users` | **200, 0 ligne** (droit SELECT présent, RLS ou table vide) | fermée | VÉRIFIÉ → S2-14 |
| `spots` (8 lignes de démonstration) | **lisible** ; écriture NON TESTÉE | héritage N-14 | VÉRIFIÉ (lecture) |
| `reviews`, `merchant_notifications`, `merchant_visits` | **200, 0 ligne** ; écriture NON TESTÉE | héritage N-14 | VÉRIFIÉ (lecture) |
| `spot_user_likes`, `user_discount_cards`, `discount_card_uses`, `user_place_discoveries`, `place_suggestions`, `user_push_tokens`, `address_views`, `admin_secrets`, `admin_login_attempts`, `push_devices`, `push_outbox`, `push_deliveries`, `push_requests`, `upload_tickets`, `notification_queue` | 401 / 42501 | fermées | VÉRIFIÉ |
| `user_lists` | **404 (n'existe pas)** | existe après 015 | VÉRIFIÉ → S2-03 |
| `merchant_profiles`, `merchant_codes`, `user_profiles`, `profiles`, `users`, `tickets`, `offers`, … (13 noms) | 404 | inexistantes | VÉRIFIÉ |

Fonctions (`POST /rest/v1/rpc/<f>`). Technique sans risque : un argument de type invalide ou un faux identifiant ne peut rien écrire ; `42501` = droit d'exécution refusé.

| Fonction | Résultat | Statut |
|---|---|---|
| `_admin_gate`, `_lpt_identity`, `purge_old_data`, `push_tick`, `push_collect`, `push_fanout`, `push_receipts` | **401 / 42501 « permission denied »** (refusées, comme voulu) | VÉRIFIÉ |
| `get_my_discoveries`, `get_my_card_usage` (faux UUID, puis texte invalide) | 200, `[]` (aucune donnée, format validé) | VÉRIFIÉ |
| `get_push_preferences` (faux UUID) | 200 `{"registered": false}` | VÉRIFIÉ |
| `get_my_lists` | **404 PGRST202 : fonction absente** | VÉRIFIÉ → S2-03 |
| `verify_admin_access` (faux code) | 200 `false`, 0,55 s | VÉRIFIÉ |
| `admin_read(p_code, p_table)` (faux code) | **400 `P0001 "access denied"`** (exception, alors que la version du dépôt renvoie un JSON `{"ok":false,"error":"forbidden"}`) | VÉRIFIÉ → S2-03 |
| `admin_write`, `admin_*`, `register_push_token`, `increment_spot_like`, `discover_place`, `use_discount_card`, `delete_my_data`, `unregister_push_token`, `update_push_preferences`, `save_my_lists`, `admin_send_push` | non appelées (écriture possible ou compteur admin) ; comportement lu dans `src/scripts` | DÉDUIT |
| 8 fonctions héritées N-14 (`scan_ticket_secure`, `schedule_event_reminders`, `generate_ticket_number`, `handle_new_user`, `rls_auto_enable`, `tr_notify_*`) | existence et droit d'exécution **non établis** (le cache PostgREST ne distingue pas : `_admin_gate` y figure aussi alors qu'elle est refusée). `scan_ticket_secure(p_ticket_number)` et `admin_read` apparaissent dans les suggestions d'erreur | NON TESTÉ |

Autres surfaces :

| Élément | Résultat | Statut |
|---|---|---|
| Auth Supabase (`/auth/v1/settings`) | `email`, `google`, `phone`, `anonymous_users`, tous les fournisseurs : **false** → pas de création de sessions en masse ; **S-10 clos** | VÉRIFIÉ |
| GraphQL (`/graphql/v1`) | « pg_graphql extension is not enabled » | VÉRIFIÉ |
| Edge Functions (`/functions/v1/`) | 404 (aucune) | VÉRIFIÉ |
| Storage : liste des buckets avec la clé publique | `[]` ; `etablissements` « Bucket not found » ; liste d'objets `[]` | VÉRIFIÉ (lecture) ; écriture NON TESTÉE |
| CORS PostgREST | `access-control-allow-origin: *` (normal pour une clé publique) | VÉRIFIÉ |
| Limitation de débit | aucun en-tête `x-ratelimit`/`retry-after` ; Cloudflare devant ; 1 requête a ramené 1,68 Mo (789 adresses) | VÉRIFIÉ (absence d'en-tête) |
| Clé publique | JWT de rôle `anon`, expire en 2098 ; seule clé présente | VÉRIFIÉ |
| Jeton Mapbox | préfixe `pk.` (public) ; requête **avec un `Referer` étranger : HTTP 200** ; métadonnées du jeton sans liste `allowedUrls` | VÉRIFIÉ → S2-07 |

### 2.2 Code, historique, configuration

| Élément | Méthode | Résultat | Statut |
|---|---|---|---|
| Secrets dans l'historique Git (80 commits, toutes branches) | `git log --all -p` avec motifs `service_role`, `sk.eyJ`, `sk_live/test`, `AIza…`, clés privées, `xox`, `ghp_`, `pk.eyJ`, JWT `eyJ…` | 0 secret. `service_role` n'apparaît que dans des garde-fous (tests, scripts Python via variable d'environnement). 2 JWT trouvés, **tous deux de rôle `anon`** (le projet actuel et un ancien projet supprimé). 1 empreinte SHA-256 de 64 caractères : celle de l'**ancien** code admin (`MASTER_HASH`, commit `3bd7017`), déjà tournée (S-02) | VÉRIFIÉ |
| Fichiers sensibles suivis | `git ls-files` (`.env`, `google-services`, `.p8`, `.jks`, `.pem`, `.key`) | aucun ; `.env`, `google-services.json`, clés de service dans `.gitignore` | VÉRIFIÉ |
| `eas.json`, `app.config.js` | lecture | seule la clé publique et l'URL ; jeton Mapbox absent d'`eas.json` ; build de production refusé sans jeton Mapbox ni `GOOGLE_SERVICES_JSON` | VÉRIFIÉ |
| Valeur de repli codée en dur | `src/lib/supabase.ts` contient l'URL et la clé publique en repli | attendu (clé publique) | VÉRIFIÉ |
| Stockage local | `grep` des 22 clés `LPT_*` / `pt_*` | téléphone : `SecureStore` (Keychain/Keystore) ; web : `localStorage`. Contenu : identifiant d'appareil, likes, découvertes, cartes, listes, préférences push, caches du catalogue. **Aucun code admin, aucun jeton de notification** | VÉRIFIÉ |
| « Effacer mes données » | `PrivacyPolicyModal.tsx:41-55`, `dataDeletion.ts` | efface serveur puis découvertes, cartes, likes, notifications, listes, session ; **conserve l'identifiant d'appareil** (nouvelle activité = même identifiant) | VÉRIFIÉ (lecture) |
| Code admin en mémoire seulement | `HomeView.tsx:557-562, 2639` (ref React vidée à la fermeture), absence de `setItem` du code, `secureTextEntry` | conforme | VÉRIFIÉ |
| Journaux `console.*` | 52 occurrences relues | aucun jeton, identifiant d'appareil, code ou e-mail affiché ; `ErrorBoundary` journalise l'objet d'erreur seulement | VÉRIFIÉ |
| Liens ouverts | `safeLinks.ts`, 18 `Linking.openURL` / `window.open` | `http(s)` et `tel:` seulement pour les données de base ; schémas Maps fixes avec `encodeURIComponent` ; `redirectToBookingUrl` passe par `safeWebUrl` | VÉRIFIÉ |
| Rendu de données de base en HTML | `grep innerHTML / dangerouslySetInnerHTML / eval` | un seul usage non constant : `mapboxHtmlTemplate.ts:196` (voir S2-08) ; le reste est rendu par React (échappé) | VÉRIFIÉ |
| Dépendances | `npm audit --omit=dev --json` | **23 alertes dans l'arbre de production** (1 critique, 9 hautes, 11 moyennes, 2 faibles) ; 25 au total (le chiffre « 45 » de N-11 est dépassé) | VÉRIFIÉ |
| Dépendance parasite `"undefined"` | lecture de `package.json` | disparue (N-15 confirmé) | VÉRIFIÉ |
| Configuration native | lecture de `app.json` | `allowBackup: false`, permissions Android limitées à la localisation, 5 permissions bloquées, textes d'usage iOS, `ITSAppUsesNonExemptEncryption: false`, aucun `intentFilters` ni `usesCleartextTraffic` déclaré | VÉRIFIÉ (fichier) ; manifeste généré NON TESTÉ |
| Tests rejoués | `npm run test:agenda` | 282 réussis, 0 échec (le détail de `test:sql` n'a pas pu être relu : exécution interrompue par moi) | VÉRIFIÉ (agenda) |

### 2.3 Ce qui n'a pas pu être vérifié

- **Écriture** : tout ce qui nécessite d'écrire est hors périmètre (règle 1) : écriture directe dans `spots`, `reviews`, `merchant_*`, `admin_users` ; dépôt anonyme dans le bucket `etablissements` ; effet réel de `register_push_token`, `increment_spot_like` avec des identifiants fabriqués ; verrouillage anti force brute en production (le déclencher bloquerait le portail).
- **Politiques RLS et ACL réelles** : pas d'accès administrateur Supabase. `scripts/audit-prod-readonly.sql` (lecture seule) doit être lancé dans l'éditeur SQL : **je n'en ai pas le résultat**.
- Code source des 8 fonctions héritées et de l'`admin_read` en production.
- Appareil réel : Keychain/Keystore, comportement de la WebView, déclenchement du gel par lien profond sur Hermes, notifications reçues, manifeste Android et privacy manifest iOS générés par un build.
- Restrictions de la clé Google Maps / Firebase (non visibles), secrets EAS (accès au compte requis), région Supabase, journaux Supabase (recherche d'exploitation passée).
- Mapbox : portée exacte des scopes du jeton (l'API n'a renvoyé que `usage: pk`).

---

## 3. Constats

Chaque constat : **gravité · preuve · impact · correctif proposé (non appliqué) · effort**.

### P1 — à corriger avant publication

**S2-01 · P1 · Le portail admin est actif dans tous les builds, l'interrupteur n'est plus branché** — VÉRIFIÉ
- Preuve : `src/constants/features.ts:15` définit `Features.adminPortal`, mais `grep` ne trouve **aucun usage** hors `SearchView` (qui n'utilise que `externalRatings`). `HomeView.tsx:685-694` : sept appuis sur le titre ouvrent le portail sans condition. Le commit `513c677` contenait `if (!Features.adminPortal) return;` ; la ligne a disparu depuis (`git log -S"Features.adminPortal"` ne retrouve qu'un seul commit, 513c677). `docs/CHECKLIST_PUBLICATION.md:23` affirme que sans la variable « l'accès bénévole est absent » : **faux**.
- Impact : toute personne qui tape 7 fois sur le titre voit un écran « SÉCURITÉ ADMINISTRATEUR » et peut essayer des codes (10 essais/15 min, voir S2-09). Apple (règle 2.3.1 citée dans le dépôt) refuse les fonctions cachées. Cela prolonge aussi la surface d'attaque du serveur : le verrouillage global bloque le vrai administrateur.
- Correctif : rétablir `if (!Features.adminPortal) return;` au début de `handleTitlePress` et ne pas rendre `AdminPasswordModal`/`AdminPortalModal` quand le drapeau est faux ; ajouter un test unitaire qui échoue si le drapeau n'est plus lu ; vérifier dans le bundle d'un build « store » que le texte « SÉCURITÉ ADMINISTRATEUR » est absent. Effort : S.

**S2-02 · P1 · Le montant payé par les partenaires est lisible publiquement (confirmation de S-12)** — VÉRIFIÉ
- Preuve : `GET /rest/v1/sponsored_partners?select=id,price_paid,…` → HTTP 200, 2 lignes, `price_paid` non nul pour les 2 (comptage fait, valeurs non reproduites). La vue `sponsored_partners_public` existe déjà et fonctionne, mais la table reste ouverte : la migration 016 n'a pas été exécutée en entier.
- Impact : un concurrent ou un autre partenaire connaît le prix payé par chaque sponsor ; c'est le point que la règle commune dit devoir rester interne. Aucune action de l'utilisateur de l'appli n'est nécessaire, une simple requête suffit.
- Correctif : exécuter `016_hide_partner_price.sql` **après** avoir vérifié S2-03 (le portail utilise `admin_read`), puis rejouer le contrôle ci-dessous (attendu : 401). Effort : S.

**S2-03 · P1 · La production n'est pas dans l'état décrit par le dépôt (migrations 015 et 016 ; `admin_read` inconnue)** — VÉRIFIÉ (constat) / DÉDUIT (conséquences)
- Preuve : table `user_lists` et fonctions `get_my_lists` / `save_my_lists` → 404 (015 absente) ; `sponsored_partners` ouverte (016 absente) ; `admin_read` répond par une **exception** `P0001 access denied` (HTTP 400) alors que `016_hide_partner_price.sql:64-70` renvoie un JSON `ok/error` et passe par `_admin_gate`. La fonction en production est donc une ancienne version, héritée (N-14), dont ni le code ni le verrouillage ne sont connus. Le client (`adminApi.ts:111-118`) attend un JSON : l'onglet « partenaires » du portail est probablement en erreur en production.
- Impact : (a) les listes personnelles ne sont pas sauvegardées sur le serveur alors que l'appli, la politique de confidentialité et l'effacement de données les supposent ; (b) une fonction admin non maîtrisée est appelable avec la clé publique : si elle compare le code autrement que `_admin_gate`, elle contourne le verrouillage et la rotation du code (impossible à écarter sans la lire) ; (c) les tests locaux (PGlite) valident un état qui n'existe pas en production.
- Correctif : lancer `scripts/audit-legacy-diagnostic.sql` (lecture seule) et lire la définition d'`admin_read`, `scan_ticket_secure`, `schedule_event_reminders` ; appliquer 015 puis 016 (016 supprime l'ancienne `admin_read`) ; ajouter à la liste de contrôle un état de déploiement « migrations 002 à 016 : appliquées Oui/Non » et le script de contrôle ci-dessous. Effort : S à M.

### P2 — à planifier juste après la publication

**S2-04 · P2 · L'identité est un texte choisi par l'appareil : quotas et « un like par appareil » contournables** — DÉDUIT (code lu ; non exécuté)
- Preuve : `_lpt_identity` (`006_security_lockdown.sql:393-410`) accepte toute chaîne de 32 à 40 caractères hexadécimaux/tirets et la prend comme identité (la connexion anonyme est désactivée : `auth.uid()` est toujours nul). `increment_spot_like`, `discover_place`, `use_discount_card` (même fichier) ne contrôlent rien d'autre. Un script qui envoie un UUID aléatoire à chaque appel obtient un « nouvel appareil » : +1 like par appel sur n'importe quelle adresse (`addresses.likes_count` est mis à jour, ligne `update public.addresses set likes_count = v_total`), points de découverte illimités, réinitialisation des quotas des cartes de réduction (`max_uses`, extension de S-16).
- Impact : likes gonflés ou dégonflés (−1 aussi), classement faussé s'il dépend des likes ; décompte des utilisations des cartes sans valeur probante (le commerçant doit rester l'arbitre). Pas de fuite de données : l'UUID d'un autre appareil (122 bits) n'est ni listé ni lisible, et `get_my_discoveries` renvoie `[]` pour tout identifiant inconnu (VÉRIFIÉ).
- Correctif : accepter qu'aucun compte ne permet de l'empêcher ; borner l'impact (limite globale par adresse et par minute côté SQL, plafond de `likes_count` ajustable, ne pas utiliser les likes pour des décisions commerciales) ; si une preuve forte est voulue, attestation d'appareil (Play Integrity / App Attest) via une Edge Function. Effort : M.

**S2-05 · P2 · Aucune limite de fréquence ni de volume ; croissance illimitée des tables** — DÉDUIT / VÉRIFIÉ (absence d'en-têtes)
- Preuve : aucun `x-ratelimit` ; les politiques d'insertion (`address_views` sans limite de nombre ; `place_suggestions` 1 000 caractères par ligne ; `register_push_token` : jeton validé par `^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$` **sans longueur maximale** ; `spot_user_likes`, `user_discount_cards` par fausse identité) n'imposent ni quota par minute ni plafond de lignes. La purge ne retire que les données de plus de 13 à 24 mois.
- Impact : un script bon marché peut (a) remplir la base (offre gratuite Supabase limitée) ; (b) inscrire des milliers de faux jetons : chaque nouvel événement ou annonce génère alors un envoi à chaque faux appareil, charge sur `pg_net` et sur l'API Expo (réponses `DeviceNotRegistered` ensuite invalidées) ; (c) saturer la modération des suggestions. Le catalogue complet se lit en une requête de 1,7 Mo, sans limite.
- Correctif : longueur maximale du jeton (≤ 200) ; plafond de lignes par identité et par heure dans chaque RPC (table de compteurs, `pg_cron` pour purger) ; alertes d'usage dans le tableau de bord Supabase ; envisager Cloudflare devant le domaine web ; surveiller le volume de `push_devices`. Effort : M.

**S2-06 · P2 · Un lien profond peut figer l'appli (`decode-uri-component` dans `expo-router`)** — VÉRIFIÉ (Node) / NON TESTÉ (appareil)
- Preuve : `npm ls` : `expo-router@57.0.29 → query-string@7.1.3 → decode-uri-component@0.2.2` ; `expo-router/build/fork/getStateFromPath*.js` l'utilise à l'exécution. Mesure : `decode('%E0'×500 + 'x')` 4 477 ms ; ×1 000 : 20 351 ms ; ×2 000 non terminé (> 100 s) (croissance au moins quadratique). Le schéma `lepetittou://` est déclaré (`app.json`), donc tout site web ou toute autre appli peut ouvrir `lepetittou://?x=%E0%E0…`.
- Impact : l'appli se fige (fil JavaScript bloqué) tant qu'elle n'est pas fermée de force ; pas de fuite de données. Le dépôt n'enregistre pas ce lien dans le stockage (non vérifié sur appareil : une relance depuis l'icône n'utilise pas le lien).
- Correctif : mise à jour d'`expo-router` quand une version corrigée existe (`npm audit` indique une correction disponible) ou surcharge (`overrides`) de `decode-uri-component` ≥ version corrigée ; tester le lien sur appareil. Les 22 autres alertes de production sont de l'outillage (`shell-quote` critique via `react-devtools-core`, DÉDUIT non embarqué ; `@expo/cli`, `node-forge`, `image-size`, `browserslist`, `zod`, `brace-expansion`) à traiter par les mises à jour Expo. Effort : S.

**S2-07 · P2 · Le jeton Mapbox n'a aucune restriction d'URL** — VÉRIFIÉ
- Preuve : `GET /styles/v1/mapbox/streets-v12` avec `Referer: https://evil.example/` → HTTP 200 ; métadonnées du jeton sans `allowedUrls`. Le jeton est de toute façon visible dans l'appli (`mapboxHtmlTemplate.ts:412`, web et mobile).
- Impact : n'importe qui peut consommer le quota/la facture Mapbox de l'association avec ce jeton (cartes, itinéraires).
- Correctif : deux jetons : un pour le web restreint aux domaines de l'appli web, un pour les téléphones (impossible à restreindre par URL : plafonner l'usage dans le compte Mapbox et activer les alertes) ; retirer les scopes inutiles. Effort : S.

**S2-08 · P2 · Injection HTML via `image_url` dans la page de la carte** — VÉRIFIÉ (code) / DÉDUIT (exploitation)
- Preuve : `mapboxHtmlTemplate.ts:192-196` : `html += '<img src="' + thumbUrl(s.image_url) + '" …'` puis `el.innerHTML = html`. `thumbUrl` (l. 132-138) ne retire pas les guillemets. Une valeur `x" onerror="…` s'exécute comme script. `admin_write` accepte n'importe quelle chaîne pour `image_url` (`006:177-205`, aucun contrôle de forme). Sur le web, la carte est une `iframe srcDoc` sans `sandbox` (`MapView.tsx:1151`) : même origine que l'appli, donc accès au `localStorage` (identifiant d'appareil, listes). Sur téléphone, le script tourne dans la WebView avec le pont `ReactNativeWebView`.
- Impact : exige une écriture dans le catalogue (code admin, ou une future écriture ouverte) ; c'est une aggravation si le code admin fuit ou si un bénévole colle une URL piégée. Aucun contenu de visiteur n'atteint cette page aujourd'hui.
- Correctif : construire l'élément avec `document.createElement('img')` et `img.src = …` ; refuser dans l'appli et dans `admin_write` les URL d'image qui ne commencent pas par `https://` ; ajouter `sandbox="allow-scripts"` (sans `allow-same-origin`) à l'iframe ; test unitaire avec une valeur piégée. Effort : S.

**S2-09 · P2 · Modèle d'administration : un code partagé, aucun journal, verrouillage global (N-09)** — VÉRIFIÉ (code) / NON TESTÉ (production)
- Preuve : `_admin_gate` (`006:54-86`) : un seul secret partagé (empreinte SHA-256 **non salée** dans `admin_secrets`), compteur global `admin_login_attempts` (10 échecs / 15 min bloquent tout le monde, y compris le vrai administrateur), aucun enregistrement de qui a modifié quoi. `admin_write` renvoie le texte brut de l'erreur SQL (`'invalid: ' || sqlerrm`, l. 191). Le code est transmis dans chaque requête RPC (corps HTTPS). Mesure du temps : 0,55 s pour un code court, une seule mesure : aucun canal auxiliaire démontrable (la comparaison porte sur une empreinte, pas sur le code).
- Impact : un ancien bénévole garde l'accès jusqu'à la rotation du code ; un bot peut tenir le portail verrouillé en permanence avec 10 appels par quart d'heure ; aucune traçabilité pour les modifications ou les annonces push envoyées à tous (`admin_send_push`).
- Correctif : comptes administrateurs nominatifs (table `admin_users` existe déjà, authentification e-mail à activer uniquement pour eux), blocage par appareil ou par IP en plus du seuil global, journal d'activité des actions admin, empreinte salée (ou `crypt`/bcrypt), erreur générique côté client. Effort : M.

**S2-10 · P2 · Dépôt anonyme dans le bucket public `etablissements` (N-10 / S-11)** — DÉDUIT
- Preuve : `006:780-805` crée une politique d'insertion pour `anon` limitée aux dossiers `covers` et `gallery`, 5 Mo, JPEG/PNG/WebP ; le client téléverse avec la clé publique (`AdminPortalModal.tsx:141,148`, `upsert: true`). Non testé en écriture. La politique `app-backgrounds` (012) est correcte : billet à usage unique, 128 bits, sans écrasement.
- Impact : hébergement d'images arbitraires (jusqu'à 5 Mo chacune) sous le domaine du projet, consommation du quota de stockage.
- Correctif : appliquer le modèle de billets de 012 aux dossiers `covers` et `gallery` ; vérifier dans le tableau de bord les politiques réelles du bucket. Effort : M.

### P3 — améliorations

**S2-11 · P3 · Identifiant d'appareil de repli généré par `Math.random`** — DÉDUIT. `deviceIdentity.ts:7-15` utilise `crypto.randomUUID` s'il existe, sinon `Math.random`. Aucun polyfill `crypto` n'est présent dans `expo/src/winter` ni `react-native` (grep) : sur Hermes, le repli est probablement la voie normale (non vérifié sur appareil). Entropie non cryptographique pour une valeur qui sert de secret d'accès aux données de l'appareil. Correctif : `expo-crypto` (`randomUUID`) ; même chose pour le nom de fichier d'envoi (`AdminPortalModal.tsx:82,128`). Effort : S.

**S2-12 · P3 · Messages de la carte : pas de contrôle de l'expéditeur ; WebView ouverte** — VÉRIFIÉ (code). Web : `window.addEventListener('message', …)` (`MapView.tsx:354`) et la page de carte (`mapboxHtmlTemplate.ts:463`) n'examinent ni `event.source` ni `event.origin`, et les envois utilisent `'*'`. Mobile : `originWhitelist={['*']}`, aucune restriction de navigation, `javaScriptEnabled`. Les messages acceptés n'ouvrent aucune action sensible (sélection d'adresse, itinéraire) : impact limité. Correctif : comparer `event.source` à l'iframe, restreindre `originWhitelist` à `['about:blank','https://localhost']` et ajouter `onShouldStartLoadWithRequest`. Effort : S.

**S2-13 · P3 · Aucune intégration continue ni contrôle automatique** — VÉRIFIÉ. `.github/workflows/` est vide ; `docs/ci.workflow.yml`, cité dans la mission, n'existe pas dans le dépôt ; pas de lint (`expo lint` sans configuration vérifiée), pas d'analyse de secrets ni d'`npm audit` planifiée. Correctif : un workflow qui lance `npm ci`, `npm run test:all`, `npm audit --omit=dev` et un détecteur de secrets. Effort : S.

**S2-14 · P3 · `admin_users` : droit SELECT accordé à la clé publique** — VÉRIFIÉ (200, 0 ligne). Si la table contient un jour des e-mails d'administrateurs, seule la RLS les protège. Correctif : `revoke select on public.admin_users from anon` (attention : `_admin_gate` est `security definer`, il n'en dépend pas). Effort : S.

**S2-15 · P3 · Les erreurs PostgREST décrivent les fonctions internes** — VÉRIFIÉ. Un appel avec un mauvais paramètre renvoie « Perhaps you meant to call … `_admin_gate(p_code)`, `purge_old_data(p_now)`, `push_tick(p_now)`, `admin_read(p_code, p_table)`, `scan_ticket_secure(p_ticket_number)` ». Aucune n'est exécutable (VÉRIFIÉ pour les fonctions internes), mais la carte de l'API interne est publique. Inhérent à PostgREST ; ne pas considérer ces noms comme secrets.

**S2-16 · P3 · Le catalogue (789 adresses, descriptions, images) est copiable en une requête** — VÉRIFIÉ (1,68 Mo, HTTP 200). Voulu par conception (lecture publique) ; si le contenu a une valeur commerciale ou des droits tiers, la copie par un concurrent est possible. Limiter par Cloudflare / pagination si nécessaire.

### Corrections de statut des audits précédents

| Id | Statut précédent | Constat ce jour |
|---|---|---|
| S-10 | Ouvert (inscriptions e-mail/Google) | **Clos** : `external.email/google/phone/anonymous_users = false` (VÉRIFIÉ) |
| S-12 | Non corrigé | Toujours ouvert (S2-02) |
| N-11 / C-06 | 45 alertes | 25 au total, 23 en production ; critique = `shell-quote` (outillage) ; la seule alerte atteignant le code livré est `decode-uri-component` (S2-06) |
| N-13 | Corrigé | Confirmé : `notification_queue` répond 401 |
| N-14 | Ouvert | Toujours ouvert : `spots`, `reviews`, `merchant_*` lisibles (écriture non testée) ; fonctions héritées non établies ; **ajout** : `admin_read` héritée confirmée différente du dépôt (S2-03) |
| N-15 | Corrigé | Confirmé |
| Checklist publication §« ENABLE_ADMIN » | « accès absent » | **Faux** (S2-01) |

---

## 4. Modèle de menace

| Acteur | Objectif | Chemin d'attaque | Protection actuelle | Risque résiduel |
|---|---|---|---|---|
| Curieux avec la clé publique | Lire des données privées | Lecture directe des tables, RPC avec UUID inventés | RLS et droits retirés sur toutes les tables utilisateur ; RPC liées à l'identité, `[]` si inconnue (VÉRIFIÉ) | Faible. Reste : `price_paid` (S2-02), `spots`/`reviews` lisibles (N-14) |
| Curieux / concurrent d'un partenaire | Connaître le prix payé par un sponsor | `GET sponsored_partners` | Aucune tant que 016 n'est pas appliquée | **Élevé** (S2-02) |
| Concurrent | Copier le catalogue | Requête unique de 1,7 Mo | Aucune (voulu) | Moyen, accepté (S2-16) |
| Concurrent / bot | Gonfler ou dégonfler des likes, épuiser des offres | RPC avec UUID aléatoires en boucle | Un like par identité, mais identité gratuite | Moyen (S2-04, S2-05) |
| Bot | Saturer base et notifications | Faux jetons, vues, suggestions | Formats et tailles bornés, pas de débit | Moyen (S2-05) |
| Bot / curieux | Deviner le code admin | `verify_admin_access` / `admin_*` | SHA-256, 10 essais / 15 min globaux ; ancien code changé | Faible pour la devinette ; **déni de service du portail** possible (S2-09) |
| Visiteur ordinaire | Trouver le portail admin | 7 appuis sur le titre | Aucune dans les builds store (S2-01) | Moyen (conformité Apple + surface) |
| Ancien bénévole | Modifier le catalogue, envoyer une annonce à tous | Garde le code admin | Aucune révocation individuelle, aucun journal | **Élevé** si le code n'est pas changé au départ (S2-09) |
| Attaquant ayant le code admin | Injecter du script via une URL d'image | `admin_write` + `innerHTML` | Aucune validation | Moyen (S2-08) |
| Attaquant à distance | Figer l'appli d'une victime | Lien `lepetittou://…%E0%E0…` | Aucune | Faible à moyen (S2-06) |
| Tiers | Consommer le quota Mapbox | Jeton public non restreint | Aucune | Moyen financier (S2-07) |
| Tiers | Héberger des images | Dépôt anonyme dans `etablissements` | Taille et type | Faible à moyen (S2-10) |
| Fuite du dépôt | Secrets | Historique Git public | Aucun secret trouvé ; ancien code admin remplacé | Faible |

---

## 5. Plan de correction en trois lots

**Lot 1 — aujourd'hui (aucune ligne de code de l'appli nécessaire, ou 1 à 3 lignes)**
1. Lancer `scripts/audit-legacy-diagnostic.sql` et `scripts/audit-prod-readonly.sql` dans Supabase ; lire `admin_read` et `scan_ticket_secure` (S2-03).
2. Appliquer 015 puis 016 (S2-02, S2-03) ; rejouer le contrôle de la section 6 (attendu : `sponsored_partners` en 401).
3. Rétablir l'interrupteur du portail admin (S2-01) et corriger la case de la liste de contrôle ; vérifier dans le bundle store.
4. Changer le code admin si un bénévole a quitté l'association (S2-09).
5. Restreindre le jeton Mapbox web par URL et activer les alertes d'usage (S2-07).

**Lot 2 — avant publication**
6. Échapper l'URL d'image de la carte et poser `sandbox` sur l'iframe (S2-08) ; contrôler `image_url` côté `admin_write`.
7. Longueur maximale du jeton push et plafonds par identité sur les RPC publiques (S2-05, début de S2-04).
8. Mettre à jour `expo-router` ou surcharger `decode-uri-component` ; tester le lien malveillant sur appareil (S2-06).
9. Décider du sort des restes N-14 (`spots`, `reviews`, `merchant_*`, 8 fonctions héritées) après lecture du diagnostic.
10. Build de production réel : relire le manifeste Android (`allowBackup`, permissions, composants exportés) et le privacy manifest iOS générés.

**Lot 3 — après publication**
11. Comptes administrateurs nominatifs, journal d'activité, blocage par appareil (S2-09).
12. Billets d'envoi pour `covers`/`gallery` (S2-10) ; `expo-crypto` (S2-11) ; restrictions de la WebView (S2-12).
13. Intégration continue (tests, `npm audit`, détection de secrets) (S2-13) ; `revoke select` sur `admin_users` (S2-14).
14. Attestation d'appareil si les likes ou les offres deviennent critiques (S2-04) ; Cloudflare/limitation si l'abus apparaît (S2-05, S2-16).

---

## 6. Questions ouvertes pour l'association

1. Qui connaît le code admin actuel, et quand a-t-il été changé pour la dernière fois ? Un bénévole est-il parti depuis ?
2. La base Supabase est-elle partagée avec un autre projet (origine de `spots`, `reviews`, `merchant_*`, `scan_ticket_secure`) ? Peut-on supprimer ces éléments ?
3. Les likes servent-ils à classer ou à valoriser des adresses auprès de partenaires ? (détermine l'effort sur S2-04)
4. Quelle est la limite acceptable de coût Mapbox et Supabase par mois ? Qui reçoit les alertes ?
5. Le bucket `etablissements` est-il utilisé par l'application publique (les images affichées en viennent-elles) ? Quelles politiques y voit-on dans le tableau de bord ?
6. Souhaitez-vous conserver le portail admin dans un build interne uniquement (recommandé) ?

---

## 7. Rejouer les vérifications (lecture seule)

Prérequis : `.env` avec `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Aucune de ces commandes n'écrit ; ne pas ajouter d'appel `admin_*` avec un code.

```bash
cd /Users/sohel/Documents/petittou/le-petit-tou && set -a && . ./.env && set +a
H=(-H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" -H "Authorization: Bearer $EXPO_PUBLIC_SUPABASE_ANON_KEY")
# 1. Tables : code HTTP et nombre de lignes (attendu 401 sur toutes les tables utilisateur et, après 016, sur sponsored_partners)
for t in sponsored_partners spots reviews merchant_notifications merchant_visits admin_users user_lists user_place_discoveries \
         user_push_tokens push_devices notification_queue place_suggestions address_views admin_secrets; do
  printf '%s ' "$t"; curl -s -o /dev/null -w '%{http_code}\n' "${H[@]}" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/$t?select=*&limit=1"; done
# 2. Prix des partenaires : doit échouer (401) après 016
curl -s "${H[@]}" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/sponsored_partners?select=price_paid&limit=1" | cut -c1-80
# 3. Fonctions internes : attendu 42501 (types invalides, aucune exécution possible)
for f in purge_old_data push_tick push_collect push_fanout push_receipts; do
  curl -s -X POST "${H[@]}" -H 'Content-Type: application/json' "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/rpc/$f" -d '{"p_now":"x"}' | cut -c1-110; echo; done
# 4. Présence de 015 (attendu 200 après déploiement, 404 aujourd'hui)
curl -s -o /dev/null -w '%{http_code}\n' -X POST "${H[@]}" -H 'Content-Type: application/json' "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/rpc/get_my_lists" -d '{"p_device_id":"00000000-0000-4000-8000-0000000000aa"}'
# 5. Inscriptions (attendu : tout false)
curl -s "$EXPO_PUBLIC_SUPABASE_URL/auth/v1/settings" -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY" | python3 -c "import sys,json;print({k:v for k,v in json.load(sys.stdin)['external'].items() if v})"
# 6. Code : interrupteur admin non lu, innerHTML, dépendances
grep -rn "Features.adminPortal" src | grep -v constants/features.ts || echo "adminPortal jamais lu (S2-01)"
grep -n "el.innerHTML" src/components/views/map/mapboxHtmlTemplate.ts
npm audit --omit=dev --json | python3 -c "import sys,json;print(json.load(sys.stdin)['metadata']['vulnerabilities'])"
node -e "const d=require('decode-uri-component');let t=Date.now();d('%E0'.repeat(300)+'x');console.log(Date.now()-t,'ms')"
# 7. Historique Git : JWT présents et leur rôle (attendu : anon seulement)
git log --all -p --format='' -- . ':!package-lock.json' | grep -ohE "eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}" | sort -u | \
  python3 -c "import sys,base64,json;[print(json.loads(base64.urlsafe_b64decode(l.split('.')[1]+'=='))['role']) for l in sys.stdin]"
npm run test:agenda
```

Dans l'éditeur SQL de Supabase (lecture seule) : `scripts/audit-prod-readonly.sql` puis `scripts/audit-legacy-diagnostic.sql`.

**Total : P0 = 0 · P1 = 3 · P2 = 7 · P3 = 6 (16 constats).**
