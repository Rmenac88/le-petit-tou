# Mission S — Audit de cybersécurité (application, API, base, chaîne de build)

Préfixe des constats : **S2-xx** (les S-xx existent déjà dans `docs/audit/01`). Rapport : `docs/audit/11-CYBERSECURITE.md`.
Lis d'abord `00-contexte-commun.md`. Référentiels : OWASP MASVS/MASTG (mobile), OWASP API Security Top 10, OWASP ASVS pour la WebView.

## Objectif
Trouver ce qu'un attaquant motivé pourrait faire **avec uniquement la clé publique de l'appli** (qui est, par nature, extractible de l'application) : lire des données privées,
modifier le catalogue, se faire passer pour l'administrateur, détourner les notifications, saturer le service, voler des données d'autres installations.

## Méthode (par couche, avec preuve)

### 1. Surface d'attaque de la base (production, **lecture seule**)
- Liste tout ce que `anon` peut faire : tables lisibles/inscriptibles, vues, fonctions appelables. Compare à la liste attendue dans `src/scripts` et aux tests `tests/sql/*surface*`.
  Méthode : requêtes `GET` sur chaque table connue (liste dans `src/scripts`, y compris les tables héritées de N-14 : `spots`, `reviews`, `merchant_*`, `notification_queue`, `admin_users`, `admin_secrets`, `user_*`, `address_views`, `place_suggestions`…),
  et appels de RPC avec des paramètres **invalides ou faux** pour constater l'existence et le contrôle d'accès, en vérifiant d'abord dans le SQL qu'un appel ne peut rien écrire.
- Vérifie : lecture du montant `price_paid` (connu : ouvert tant que `016` n'est pas lancé), lecture des jetons push, des suggestions, des vues, des listes d'autres installations, de `admin_secrets`.
- Vérifie la réponse de chaque RPC admin avec un faux code : message d'erreur (fuite d'information ?), temps de réponse (canal auxiliaire ?), verrouillage (N-09) et son effet de déni de service.
- Authentification anonyme : peut-on créer des milliers de sessions ? limites ? Pose la question de l'identifiant d'appareil (UUID) : prédictible ? fuité ? permet-il de lire les données d'une autre installation (listes, découvertes) ?

### 2. Code de l'application
- Secrets : recherche dans le code **et dans tout l'historique Git** (`git log -p`, motifs de clés : `sk_`, `service_role`, `eyJ`, `pk.` Mapbox, `AIza`, mots de passe, codes admin en clair) ; distingue clé publique (attendue) et secret (grave). Vérifie `.gitignore`, `eas.json`, `app.config.js`.
- Stockage local : `SecureStore` vs `AsyncStorage`/`localStorage` ; que contient chaque clé ; que reste-t-il sur l'appareil après « effacer mes données » ; web : cookies/localStorage.
- Liens et schémas : `safeLinks`, `Linking.openURL`, deep links, `window.open`, redirections ; injection d'URL depuis des données de base contrôlables par un attaquant (si une écriture reste ouverte).
- **WebView / iframe Mapbox** : `originWhitelist`, `onMessage` (validation du format et de l'origine), `injectedJavaScript`, `javaScriptEnabled`, chargement de HTML depuis des chaînes contenant des données de base (XSS via nom d'adresse, `innerHTML` dans `mapboxHtmlTemplate.ts`), jeton Mapbox exposé et restrictions d'URL.
- Rendu de contenu venant de la base (descriptions, titres de partenaires, annonces admin, suggestions) : injection, markdown/HTML, longueurs, emoji/caractères de contrôle.
- Portail admin : le code admin ne doit exister qu'en mémoire ; vérifie qu'il n'est écrit ni dans le stockage, ni dans les journaux (`console.*`), ni dans un rapport d'erreur ; l'interrupteur `EXPO_PUBLIC_ENABLE_ADMIN` ; l'envoi d'images (N-10) et les « billets d'envoi ».
- Journalisation : `console.*` qui afficherait jetons, identifiants, adresses e-mail.
- Dépendances : `npm audit --omit=dev` (distingue outillage de build et code livré), paquets abandonnés ou suspects (`package.json` contenait une dépendance parasite : confirme sa disparition), versions d'Expo/React Native et correctifs de sécurité connus.

### 3. Configuration native et chaîne de build
`app.json`, `app.config.js`, `eas.json` : `allowBackup`, permissions Android déclarées (et inutiles), `usesCleartextTraffic`, composants exportés, ATS iOS, descriptions d'usage (position, photos), privacy manifest iOS, clé Google/Firebase, signature, secrets EAS, CI (`docs/ci.workflow.yml`), reproductibilité (`package-lock.json`).

### 4. Notifications
Qui peut s'inscrire, avec quel jeton, avec quelles limites ; peut-on inscrire le jeton d'un autre appareil, polluer la table, désinscrire quelqu'un d'autre (`unregister_push_token` par identifiant d'appareil) ; qui peut envoyer une annonce (code admin) ; contenu injectable ; clé de service jamais côté client.

### 5. Abus et disponibilité (analyse, pas d'attaque réelle)
Ce qu'un script peut faire avec la clé publique à grande échelle : likes gonflés, vues, suggestions en masse, inscriptions de jetons, appels répétés à des RPC coûteuses, lectures du catalogue. Quelles limites de fréquence existent (serveur, base, Supabase), lesquelles manquent.

### 6. Modèle de menace
Tableau acteurs (curieux, concurrent d'un partenaire, ancien bénévole, bot) × objectifs × chemin d'attaque × protection actuelle × risque résiduel.

## Définition de « terminé »
Tableau complet de la surface (chaque table et chaque fonction appelable par la clé publique, avec le résultat observé), tous les points ci-dessus traités avec statut de preuve, historique Git balayé, modèle de menace rempli, constats S2-xx classés et le **plan de correction en 3 lots** (aujourd'hui / avant publication / après).
