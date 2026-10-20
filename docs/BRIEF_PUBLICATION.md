# Le Petit Tou — Brief « prêt à publier ? »

Date : 2026-10-19 · Auteur : audit de l'état du dépôt (`main` = `64419c3`) · Base de données : projet Supabase de production

**Comment lire ce document.** Chaque constat est marqué **[Vérifié]** (mesuré dans le code, sur la base, ou à l'écran) ou **[À vérifier]** (hypothèse raisonnable que je n'ai pas pu confirmer). Les durées sont des estimations d'ordre de grandeur pour un développeur à l'aise avec Expo/Supabase. Ce n'est pas un avis juridique.

**Limite importante de cet audit.** Tout ce que j'ai testé à l'écran l'a été **dans Safari, sur le web** (l'appli web ouverte dans le simulateur iPhone). **Je n'ai jamais lancé l'appli native** (iOS ou Android), ni sur un vrai téléphone. Or c'est ce qui sera publié dans les stores. C'est le premier risque de tout ce brief.

---

## 1. Verdict en une page

| Domaine | État | Prêt pour une bêta fermée ? | Prêt pour le public ? |
|---|---|---|---|
| Idée, contenu éditorial, base de 790 adresses | Solide | Oui | Oui, après contrôle des droits (§4) |
| Design / identité | Bonne base, cohérente | Oui | Presque (icône, illustrations, accessibilité) |
| Fonctionnalités principales (accueil, recherche, carte, fiches, agenda) | Fonctionnent sur le web | À confirmer en natif | Non, tant que le natif n'est pas testé |
| Sécurité de la base | **Insuffisante** | Non | **Non** |
| Conformité (RGPD, règles Apple/Google, droits d'auteur, publicité) | **Non traitée** | Non | **Non** |
| Publication technique (icône, jeton Mapbox, notifications, comptes développeur) | **Non prête** | Non | **Non** |
| Qualité logicielle (tests, CI, suivi des erreurs) | Quasi absente | Risqué | **Non** |

**En clair :** l'appli est une très bonne maquette fonctionnelle, avec une identité réussie. Elle n'est pas publiable en l'état, et surtout pas pour des raisons de design : les vrais bloquants sont la **sécurité de la base**, la **conformité** et la **chaîne de publication** (comptes, icône, jetons, build natif). Compte réaliste : **6 à 10 semaines** pour une version publiable en bêta publique, dont une partie d'attente administrative (comptes développeur d'association).

---

## 2. Bloquants absolus (P0) — rien ne part dans un store sans ça

### 2.1 L'icône de l'appli est celle d'Expo
**[Vérifié]** `assets/images/icon.png` est le logo bleu par défaut d'Expo (chevron blanc sur fond bleu quadrillé). Les icônes Android (`android-icon-*`) viennent du même modèle. Sur l'écran d'accueil du téléphone, l'appli s'appellerait « Le Petit Tou » avec le logo d'Expo.
**À faire :** icône 1024×1024 sans transparence ni coins arrondis, aux couleurs de la marque (cœur rouge sur crème ou violet), icône adaptative Android (avant-plan + fond), icône monochrome Android, écran de démarrage natif (`splash-icon`) cohérent avec l'intro. Prévoir aussi la favicon web.
**Effort :** 0,5 jour (le logo détouré existe, `logo-transparent.png`).

### 2.2 Les builds de production n'auraient pas de carte fonctionnelle
**[Vérifié]** `eas.json` (profils `preview` et `production`) contient `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN: "YOUR_MAPBOX_ACCESS_TOKEN"` : un texte factice. Un build construit avec ce fichier aurait des itinéraires cassés (le jeton sert aux calculs d'itinéraire).
**[Vérifié]** Aucune clé Google Maps n'est configurée pour Android (`app.json` n'a pas de `android.config.googleMaps.apiKey`), alors que la carte native utilise `react-native-maps`. Sur Android, la carte serait vide.
**À faire :** déclarer les secrets dans EAS (`eas secret`), restreindre le jeton Mapbox (domaines/identifiant d'appli), créer et restreindre une clé Google Maps Android, et retirer les valeurs écrites en clair de `eas.json`.
**Effort :** 0,5 à 1 jour.

### 2.3 L'appli native n'a jamais été testée
**[Vérifié]** Aucun build natif lancé dans cet audit. La carte fonctionne **différemment** selon la plateforme : sur le web c'est une page Mapbox GL dans un cadre intégré (`mapboxHtmlTemplate.ts`, 873 lignes) ; sur iOS/Android c'est `react-native-maps` (Apple Maps / Google Maps), avec un autre rendu et d'autres comportements (épingles, regroupements, 3D, itinéraires). Le même constat vaut pour la nouvelle pile (Expo SDK 57, React Native 0.86, Reanimated 4, React 19) : jeune, à valider sur appareil.
**À faire :** build de développement (`eas build --profile development`) sur au moins 1 iPhone récent, 1 iPhone plus ancien, 1 Android milieu de gamme, 1 petit écran Android. Dérouler tous les parcours. Vérifier zones sûres (encoche, barre d'accueil), clavier, rotation verrouillée, geste de retour Android, texte agrandi (accessibilité).
**Effort :** 3 à 5 jours (tests + corrections). C'est le poste le plus incertain.

### 2.4 Sécurité de la base de données
**[Vérifié]** Au moment du test, avec la seule clé publique de l'appli (qui est dans le binaire, donc connue de tous) :
- `addresses`, `categories`, `events`, `sponsored_partners` : **l'écriture anonyme n'est pas bloquée** (le serveur rejette seulement parce que des colonnes obligatoires sont vides). Autrement dit, n'importe qui peut a priori créer, modifier ou supprimer des adresses, catégories, événements et partenaires. Je n'ai pas testé la suppression ni la modification par prudence, mais l'absence de blocage à l'insertion indique que la sécurité par ligne (RLS) est inactive ou permissive sur ces tables.
- `user_push_tokens` : **lisible, inscriptible et effaçable par n'importe qui** (j'ai pu y créer puis supprimer une ligne). Dès qu'il y aura de vrais jetons de notification, n'importe qui pourra les lire, les voler ou les supprimer. *(Incident : mon test a créé une ligne vide dans cette table ; je l'ai supprimée immédiatement, la table est revenue à 0 ligne.)*
- Bonne nouvelle : `discount_cards` refuse l'écriture, le téléversement de photos dans le stockage refuse l'écriture anonyme, et la table `partner_events` (agenda) est protégée.
- **[Vérifié]** Quatre scripts du dépôt désactivent explicitement la sécurité par ligne (`fix_admin_and_database_schema.sql`, `fix_user_push_tokens.sql`, `merchant_system.sql`, `supabase_complete_setup.sql`). Le dépôt contient 32 scripts SQL/Python de sources et d'ordres inconnus ; l'état réel de la base ne correspond à aucun d'eux de façon sûre.
- **[Vérifié]** Le code admin a été **public** (écrit en clair dans `secure_admin_and_rls.sql` sur un dépôt public, commit `3bd7017`). Il a été remplacé par une empreinte stockée côté serveur (script `005`), mais seul le nouvel agenda en profite : le reste de l'admin écrit directement dans les tables, sans autre contrôle que l'écran.
**À faire :**
1. Activer la RLS sur **toutes** les tables ; lecture publique seulement là où c'est voulu ; **plus aucune écriture directe pour `anon`**.
2. Faire passer toutes les écritures de l'admin (adresses, catégories, événements, partenaires) par des fonctions protégées comme celles de l'agenda, ou par de vrais comptes admin.
3. Pour les jetons de notification : insertion limitée à son propre appareil, lecture interdite côté appli, envoi depuis un serveur uniquement.
4. Écrire **un seul** schéma de référence (migrations Supabase) et supprimer ou archiver les 32 scripts historiques.
5. Faire une revue indépendante des règles d'accès avant le lancement (voir §10).
**Effort :** 3 à 5 jours. **C'est le sujet le plus urgent du dépôt**, y compris avant toute publication.

### 2.5 La fonction « admin cachée » dans l'appli publique
**[Vérifié]** Le portail admin (7 appuis sur le logo) est **embarqué dans l'appli grand public**. Les règles de l'App Store interdisent les fonctions cachées ou non documentées (guideline 2.3.1) : c'est un motif de refus classique. Ça expose aussi tout le code d'administration à quiconque décompile l'appli.
**À faire :** sortir l'admin de l'appli publique : petite appli web d'administration séparée (même Supabase, accès par e-mail), ou à défaut une version « interne » de l'appli distribuée seulement à l'équipe. L'agenda et les partenaires sont déjà faits pour fonctionner avec des fonctions serveur.
**Effort :** 3 à 6 jours selon l'option.

### 2.6 Comptes développeur et statut juridique
**[À vérifier]** Pour publier au nom de l'association (et non d'un individu), Apple (99 €/an) et Google (25 € une fois) demandent généralement un compte « organisation » avec un **numéro D-U-N-S** (gratuit mais qui prend de quelques jours à plusieurs semaines) et un site web de l'organisation. Un compte personnel Google récent impose en plus une phase de test fermé (nombre minimum de testeurs sur plusieurs semaines) avant la production.
**À faire :** lancer **dès maintenant** les démarches D-U-N-S et les comptes : c'est le chemin le plus long et il ne dépend pas du code.
**Effort :** 1 à 4 semaines d'attente, 0,5 jour de travail.

---

## 3. Sécurité et données — le reste

- **Mise en pause de Supabase [Vérifié, deux fois pendant cet audit].** Le plan gratuit met le projet en pause après une semaine d'inactivité : l'appli affichait un message « configurez votre .env » devant les utilisateurs. Il faut un plan payant (environ 25 $/mois) : pas de pause, sauvegardes quotidiennes, plus de marge, et la transformation d'images si on la veut.
- **Un seul environnement [Vérifié].** Développement, tests et production partagent le même projet Supabase. Mes tests, et ceux de ton collègue, touchent les vraies données. Il faut au minimum un second projet « test ».
- **Sauvegardes [À vérifier].** Aucune stratégie de sauvegarde ou de restauration documentée. Avec le plan gratuit, il n'y a pas de restauration à un instant donné.
- **Clé publique dans l'historique git [Vérifié].** `.env` a été commité (`38a7a28`), et `eas.json` contient l'URL et la clé « anon ». Cette clé est publique par conception (elle est dans tout binaire), donc ce n'est pas une fuite en soi, mais **toute la sécurité repose sur les règles d'accès (§2.4)**, pas sur le secret de la clé.
- **Aucun secret côté serveur trouvé [Vérifié].** Aucune clé `service_role`, clé privée ou jeton d'API privé dans le code suivi (recherche sur motifs usuels).
- **Limitation d'abus [À vérifier].** Rien n'empêche aujourd'hui de spammer les « likes », les suggestions d'adresses ou les découvertes. Prévoir des limites (Edge Functions ou quotas) avant un lancement visible.
- **Code admin.** Pas de limitation du nombre d'essais sur la vérification du code (accepté dans la spec de l'agenda tant que le code est long). Changer le code si l'ancien a pu être vu par des tiers : **c'est fait si le script 005 a tourné**, à confirmer par ton essai dans l'admin.

---

## 4. Conformité et légal — à valider avec une personne compétente

### 4.1 Droits sur les données et les images (risque élevé)
**[À vérifier — priorité forte]** Le jeu de données mentionne des notes et avis **Google** et **TripAdvisor** (types `source: 'Google' | 'TripAdvisor'`), et l'historique parle d'enrichissement de **759 établissements** (téléphones, sites, notes, horaires) par des scripts d'extraction. Les conditions d'utilisation de Google Maps Platform et de TripAdvisor interdisent en général de copier, stocker ou republier leurs notes et avis. Il faut documenter l'origine de chaque champ et **supprimer ou remplacer** ce qui ne peut pas être republié (par exemple n'afficher que les notes du Petit Tou).
**[À vérifier]** 788 photos hébergées dans le stockage Supabase : confirmer qu'elles viennent bien des visites des étudiants ou de sources libres/autorisées. Le jeu de données contient aussi 2 images Unsplash de repli.
**[Vérifié]** Les textes de la critique (« L'avis du Petit Tou ») sont l'œuvre de l'association : c'est la vraie valeur et c'est protégeable.

### 4.2 RGPD et politique de confidentialité
- **[Vérifié]** La politique n'existe que **dans l'appli** (`PrivacyPolicyModal`, adresse de contact `contact@lepetittou.net`). Les stores exigent une **adresse web publique** pour la politique.
- **[Vérifié]** Elle affirme que l'appli « ne recueille aucune donnée personnelle nominative ». Or l'appli crée une **identité anonyme** (connexion anonyme Supabase + identifiant d'appareil), enregistre des « découvertes » de lieux, des likes, des jetons de notification et, selon les écrans, la position. Une donnée **pseudonyme rattachée à un appareil reste une donnée personnelle** au sens du RGPD. La politique doit décrire exactement : quelles données, pourquoi, base légale, durée de conservation, sous-traitants (Supabase, Mapbox, Expo), droits et moyen de suppression.
- **À faire aussi :** remplir les fiches de confidentialité des stores (Apple « privacy nutrition label », Google « Data safety ») de façon cohérente avec la politique ; prévoir un moyen simple d'effacer les données liées à l'appareil (écran « Mes données »).
- **Bandeau de consentement :** non nécessaire si l'on n'utilise ni publicité ni suivi tiers ; à reconsidérer dès qu'on ajoute des statistiques.

### 4.3 Publicité et partenaires sponsorisés
**[À vérifier]** Le « Top Partenaires » est payant (champ interne `price_paid`). En France, un placement rémunéré doit être **clairement identifiable comme tel**. Aujourd'hui l'étiquette affichée est « OFFICIEL » et « PARTENAIRE », ce qui peut ne pas suffire. Prévoir la mention « Sponsorisé » ou « Partenaire » explicite, et des conditions écrites avec les commerçants.
**Alcool [À vérifier] :** le guide met en avant des bars (happy hours, soirées). La loi Evin encadre la publicité pour l'alcool, et les stores demandent une classification d'âge adaptée. À faire valider.

### 4.4 Règles des stores
- **Fonctions cachées** : voir §2.5.
- **Notifications [Vérifié]** : `expo-notifications` est installé mais **aucun code d'enregistrement des notifications n'existe dans l'appli**, et le plugin n'est pas déclaré dans `app.json`. La promesse « notifications » n'est donc pas livrée. Si on la livre : accord explicite de l'utilisateur, possibilité de refuser sans perdre l'accès, aucune notification publicitaire sans consentement séparé (les « notifications de partenaires » du modèle de données doivent être facultatives et désactivables).
- **« Apple Wallet » [Vérifié]** : la carte est un **composant visuel** (fichier `AppleWalletCard.tsx`), pas un vrai pass Wallet (aucun PassKit, aucun `.pkpass`). Ne jamais écrire « Apple Wallet » dans l'appli ni dans les fiches de store : c'est une marque d'Apple, et ça tromperait l'utilisateur. J'ai déjà retiré cette mention de l'écran (le titre dit « Ta carte Petit Tou »), mais le nom du fichier et des commentaires reste. Un vrai pass demande une signature avec un certificat Apple et un petit serveur.
- **Localisation [Vérifié]** : uniquement « quand l'appli est ouverte », texte d'autorisation en français présent. Aucune localisation en arrière-plan : parfait, à conserver.
- **Paiements [Vérifié]** : les réservations d'événements renvoient vers une billetterie externe pour des événements physiques : généralement acceptable, à confirmer lors de la revue.
- **Contenu généré par les utilisateurs** : seulement les likes et les suggestions d'adresses (`place_suggestions`). Si les suggestions sont texte libre, prévoir signalement et modération.

---

## 5. Produit : ce qui est promis mais pas encore réel

| Fonction | État réel | Écart |
|---|---|---|
| Carte privilège / Wallet | Carte visuelle uniquement | Pas de QR dynamique, pas de liste des réductions utilisable, pas de vérification côté commerçant. Le brief de marque en faisait un pilier. |
| Réductions « Le Petit Tou » | Tables et fonction `use_discount_card` prévues | Aucun parcours commerçant ; je n'ai pas pu vérifier que la fonction existe en base. |
| Progression / points / « Flâneur Toulousain » | Stockés pour un appareil | Perdus si on réinstalle l'appli ou change de téléphone ; aucune récupération possible sans compte. |
| Notifications | Table + script Python manuel | Pas de code dans l'appli, pas de serveur d'envoi, pas de clé APNs/FCM. |
| Comptes utilisateurs | Connexion anonyme seulement | Pas de favoris synchronisés entre appareils. À décider : a-t-on besoin d'un compte ? (Voir §11.) |
| Thème annuel | Prévu par le brief de marque | Couleurs et textes de la promo codés en dur ; un changement chaque mai demande une nouvelle version. |
| Agenda des partenaires | Livré (web) | Description et lien enregistrés mais non affichés ; à tester en natif ; 9 points mineurs listés (§8). |
| Recherche populaire | Liste fixe générique | Pas reliée aux vraies données. |

---

## 6. Architecture et code

### 6.1 Constat chiffré [Vérifié]
- **Trois fichiers de plus de 2 500 lignes** : `MapView.tsx` (2 791), `AdminPortalModal.tsx` (2 658), `HomeView.tsx` (2 568), plus `homeStyles.ts` (2 049). Difficile à relire, à tester et à faire évoluer à plusieurs.
- **207 usages de `any`** TypeScript, **41 `console`** laissés dans le code, **0 `ErrorBoundary`** (une erreur d'affichage peut blanchir l'écran sans message).
- **Accès aux données éparpillé** : 16 appels directs à la table `addresses` dans les composants, des fusions de données (jeu embarqué + Supabase) répétées dans les vues, et une synchronisation par événements du navigateur (`window.dispatchEvent`) qui n'existe pas en natif.
- **Données en double** : le jeu `dataset.json` (1,9 Mo, 790 adresses) est **embarqué dans l'appli** *et* lu depuis Supabase. Il y a donc deux sources de vérité, qui peuvent diverger (par exemple l'adresse supprimée en base qui reste visible : point mineur déjà noté).
- **Dépôt encombré [Vérifié]** : 75 fichiers d'outils d'agents IA (`.agents/`) suivis, 3 fichiers d'instructions (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`), des dossiers `scratch/` et `scripts/` de tests jetables, un script Python à la racine, 32 scripts dans `src/scripts`.
- **Pas d'outillage qualité [Vérifié]** : aucune configuration de lint ou de formatage, **aucun test automatique** hors l'agenda (33 tests), **aucune intégration continue**.
- **Pile très récente** : Expo 57, React Native 0.86, TypeScript 6, React 19 + compilateur : bonne base, mais peu de retours d'expérience ; épingler les versions et tester en natif (§2.3).

### 6.2 Recommandations (par ordre de valeur)
1. **Une couche d'accès aux données** (un module « dépôt » par ressource : adresses, partenaires, événements, agenda) avec cache, expiration et mode hors ligne ; plus aucun appel Supabase dans les composants.
2. **Un seul jeu de données** : le jeu embarqué ne sert qu'à démarrer hors ligne et se met à jour depuis Supabase (version datée), ou on l'abandonne.
3. **Découper les trois gros fichiers** par responsabilité (sections de l'accueil, couches de la carte, panneaux d'admin).
4. **Types partagés** (`Address`, `Category`, `Partner`, `Event`, `PartnerEvent`) et traque des `any`.
5. **ErrorBoundary** global + écran d'erreur de marque ; supprimer les `console`.
6. **Lint + formatage + tests de logique + intégration continue** (voir §9).
7. **Nettoyer le dépôt** : sortir `.agents/` et les fichiers d'outils du suivi si l'équipe ne s'en sert plus ; supprimer `scratch/`, anciens scripts ; ranger la base dans des migrations versionnées.
8. **Séparer l'admin** de l'appli publique (§2.5) : le gain de taille et de sécurité est double.
**Effort total :** 8 à 15 jours selon l'ambition (1 à 3 : 4-6 jours ; 4 à 7 : 3-5 jours ; 8 : 3-6 jours).

---

## 7. Design et expérience

Ce qui est **déjà fait** : identité (palette, polices, logo détouré), accueil, recherche, fiche d'adresse, carte, agenda, états de chargement/vide/erreur, charte écrite (`DESIGN_SYSTEM.md`), cibles tactiles et contrastes corrigés, signes d'IA retirés.

Ce qu'il **reste** :

1. **Icône, écran de démarrage, visuels de store** (§2.1 et §10) : le travail de design le plus urgent, car lié à la publication.
2. **Illustrations** style risographie pour les états vides, l'accueil, l'onboarding (demandées par le brief de marque) : nécessitent un·e illustrateur·rice ou une banque cohérente.
3. **Onboarding du premier lancement** : expliquer en 3 écrans max ce qu'est le guide, la carte, la carte privilège ; demander la localisation **au moment où elle sert**, avec une phrase claire. Aujourd'hui l'intro est seulement un logo.
4. **Pictogrammes d'équipements** sur mesure (terrasse, végé, accessibilité…), actuellement des tags texte.
5. **Mode sombre** : verrouillé en clair. Acceptable au lancement, à assumer explicitement.
6. **Accessibilité** : 40 étiquettes pour 167 boutons ; pas de tests lecteur d'écran (VoiceOver/TalkBack) ; **texte agrandi** (Dynamic Type) jamais testé, risque de coupures dans les cartes, le dock et les puces. À corriger avant la bêta publique : c'est aussi un critère de qualité des stores.
7. **Tablette et grand écran** : colonne centrée de 720 px (fait) mais pas de mise en page dédiée ; l'appli déclare `supportsTablet: true` sur iOS : soit on teste iPad, soit on passe à `false`.
8. **Carte** : le style natif (Apple/Google) ne ressemble pas à la version web Mapbox ; décider du rendu cible et le décliner (épingles par catégorie, regroupements, épingle « Chouchou »).
9. **Micro-textes** : relire tous les messages dans le ton de la marque (complice, humour, jamais technique) ; fiche « Chouchou » et « critique » bien mises en avant.
10. **Squelettes de chargement** pour recherche, wallet et carte (pas faits) et animation de transition entre onglets (volontairement instantanée aujourd'hui).
11. **Les 9 points mineurs de l'agenda** (§8) et les 294 couleurs encore écrites en dur (hors jetons de charte).
**Effort :** 6 à 12 jours de design + intégration, hors illustrations.

---

## 8. Dette connue de l'agenda (relecture indépendante)

- L'agenda public cherche d'abord dans le jeu embarqué : une adresse supprimée en base reste visible côté public.
- Description et lien d'un événement saisis mais jamais affichés.
- En modification, basculer « Actif/Inactif » puis enregistrer peut réécrire l'ancienne valeur.
- Si un enregistrement réussit mais que le rechargement de la liste échoue, le message de succès est remplacé par une erreur (risque de doublon).
- Série terminée mais inactive : première date (passée) affichée au lieu de « Prochaine ».
- Compteur « Agenda (0) » tant que l'onglet admin n'a pas été ouvert.
- Messages du serveur sans accents.
- Un rayon écrit en dur, rôles d'accessibilité manquants sur cartes et puces.
- La requête SQL enregistrée dans Supabase contient le code admin en clair : à supprimer.
- Événement qui finit après minuit : refusé (décision produit à prendre).
**Effort :** 1 à 2 jours.

---

## 9. Qualité, outillage et exploitation

1. **Intégration continue** (GitHub Actions) : à chaque envoi, contrôle de typage, lint, tests de logique, vérification qu'aucun secret n'est commité. **0,5 à 1 jour.**
2. **Suivi des erreurs** (Sentry ou équivalent) : aujourd'hui une panne chez un utilisateur est invisible. **0,5 jour.**
3. **Statistiques d'usage respectueuses** (sans identifiant publicitaire) : pour savoir ce qui est utilisé ; compatible avec une politique de confidentialité simple. **0,5 à 1 jour.**
4. **Tests** : logique pure (dates, filtres, recherche, fusion de données), puis quelques parcours de bout en bout sur appareil (Maestro ou Detox). **3 à 5 jours** pour une couverture raisonnable.
5. **Environnements** : projet Supabase « test » séparé ; profils EAS `development` / `preview` / `production` avec leurs propres variables. **1 jour.**
6. **Mises à jour sans passer par le store** (EAS Update) pour corriger vite un texte ou un bug JavaScript. **0,5 jour.**
7. **Journal de version, numéro de build automatique** (`autoIncrement` est déjà activé en production).
8. **Surveillance de la base** : alertes d'espace, de bande passante (788 images ≈ 100 Ko chacune, soit environ 80 Mo à tout charger ; surveiller la bande passante du stockage au lancement) et de pause.

---

## 10. Dossier de publication (App Store et Google Play)

À préparer en parallèle du code :

- **Comptes** : Apple Developer (99 €/an) et Google Play Console (25 €), au nom de l'association, avec numéro D-U-N-S si compte organisation (§2.6).
- **Identifiants** : `fr.lepetittou.app` est déjà défini pour iOS et Android. **[Vérifié]** Le dépôt utilise **trois domaines différents** : `lepetittou.fr` (identifiant de l'appli), `lepetittou.net` (adresse de contact de la politique de confidentialité) et `lepetittou.com` (site, d'où viennent les images d'origine). **[À vérifier]** lesquels l'association contrôle réellement, et lequel héberge la politique de confidentialité et la page d'assistance exigées par les stores.
- **Fiches de store** : nom, sous-titre, description courte et longue, mots-clés, catégorie (Cuisine et boissons / Style de vie), classification d'âge (alcool), captures d'écran pour les tailles exigées (iPhone 6,9", 6,5", iPad si supporté ; Android téléphone), visuel de présentation Google (1024×500), icône 512×512.
- **Fiches de confidentialité** (§4.2) et **déclaration d'usage de la localisation**.
- **Compte de démonstration** : l'appli n'a pas de connexion, donc rien à fournir ; mais **le portail admin caché** devra avoir disparu (§2.5).
- **Test interne** : TestFlight (iOS) et test interne/fermé Google : prévoir **2 à 3 semaines de bêta** avec de vrais étudiants avant le public.
- **Délais de revue** : environ 1 à 3 jours chez Apple, quelques jours chez Google ; prévoir une marge pour un premier refus.
- **Revue de sécurité indépendante** des règles d'accès de la base (une demi-journée à deux jours selon la personne) avant le lancement.

---

## 11. Décisions que seule l'association peut prendre

1. **Compte utilisateur oui ou non ?** Sans compte : simple, respectueux, mais points, favoris et carte privilège restent liés à l'appareil. Avec compte (e-mail ou « Se connecter avec Apple ») : synchronisation, récupération, mais plus de RGPD, plus de support, et Apple impose alors la suppression de compte dans l'appli.
2. **Qui est le « commerçant » de la carte privilège ?** Comment un commerçant vérifie-t-il une réduction ? (QR à scanner, code à lire, simple montrer l'écran ?) Sans réponse, la carte reste décorative.
3. **Notifications : oui ou non au lancement ?** Si oui : quel contenu, qui l'envoie, à quelle fréquence, avec quel consentement ? Les notifications de partenaires payants sont le point le plus sensible.
4. **Modèle économique des partenaires** : conditions écrites, étiquetage « Sponsorisé », durée, tarifs affichés ou non.
5. **Qui administre ?** Une personne ou toute l'équipe ? Combien de bénévoles auront accès à l'admin, avec quels droits ?
6. **Origine des données** : accepter de retirer notes/avis externes et ce qui ne peut pas être republié.
7. **Périmètre du lancement** : Toulouse seulement ? Quelle promo pour le thème annuel ? Date visée (rentrée suivante ?).
8. **Plateformes** : iOS et Android au lancement, ou iOS d'abord (la majorité des étudiants), Android ensuite.

---

## 12. Feuille de route proposée

**Phase 0 — Fondations (1 semaine, démarrer tout de suite)**
- Lancer les comptes développeur et le numéro D-U-N-S (§2.6) — chemin le plus long.
- Sécuriser la base (§2.4) : RLS partout, écritures de l'admin par fonctions, jetons de notification protégés, schéma de référence.
- Plan Supabase payant + second projet « test » (§3).
- Corriger les secrets de build : jeton Mapbox, clé Google Maps Android (§2.2).

**Phase 1 — L'appli réelle (2 semaines)**
- Build natif de développement, tests sur appareils, corrections (§2.3).
- Icône, écran de démarrage, onboarding, accessibilité et texte agrandi (§2.1, §7).
- Sortir l'admin de l'appli publique (§2.5).
- Suivi des erreurs, intégration continue, lint, types (§6, §9).

**Phase 2 — Conformité et dossier (1 à 2 semaines, en parallèle de la phase 1)**
- Politique de confidentialité publique, fiches des stores, classification d'âge (§4).
- Contrôle des droits sur données et images (§4.1).
- Étiquetage des partenaires, conditions pour les commerçants (§4.3).
- Décisions produit (§11) : comptes, carte privilège, notifications.

**Phase 3 — Bêta fermée (2 à 3 semaines)**
- TestFlight + test interne Google avec 20 à 50 étudiants ; retours, corrections ; statistiques et erreurs surveillées.

**Phase 4 — Lancement**
- Revue de sécurité indépendante, soumission aux stores, plan de communication, supervision des premiers jours.

**Après le lancement :** thème annuel à distance, illustrations, vrai pass Wallet, notifications, comptes utilisateurs, outils bénévoles (rôles, statistiques), version tablette.

---

## 13. Ce que je recommande de faire en premier (les 7 actions les plus rentables)

1. **Fermer les écritures anonymes** sur la base et protéger les jetons de notification (§2.4) — le plus risqué, le plus rapide à corriger.
2. **Lancer les comptes développeur d'association et le D-U-N-S** (§2.6) — le plus lent, il bloque tout le reste.
3. **Faire tourner l'appli en natif sur 2 téléphones** (§2.3) — on saura enfin où on en est vraiment.
4. **Remplacer l'icône et corriger les secrets de build** (§2.1, §2.2) — une demi-journée chacun, bloquants.
5. **Sortir l'admin de l'appli publique** (§2.5) — évite un refus Apple et sécurise l'administration.
6. **Vérifier l'origine des notes, avis et photos** (§4.1) — peut obliger à retirer des données ; mieux vaut le savoir tôt.
7. **Décider du compte utilisateur et de la carte privilège** (§11) — ils déterminent toute la suite du produit.
