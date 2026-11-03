# Ce qu'il te reste à faire, dans l'ordre

Mis à jour le 3 novembre 2026. Chaque étape dit **où cliquer**, **quoi copier**, **ce que tu dois voir**, et **ce qui peut mal tourner**.
Les rapports détaillés sont dans `docs/audit/` (10 à 13). Tout ce que Claude pouvait corriger dans le code est déjà commité sur la branche `integration/audit-plus-claude` (rien n'est poussé sur GitHub).

## Statut au 3 novembre 2026

**Fait** : sauvegarde de la base (`~/Documents/petittou/sauvegardes-base-2026-11-03`), scripts SQL `013` à `018` appliqués en production et vérifiés, contrôle de production conforme, branche poussée sur GitHub, APK Android construit et essayé sur émulateur, pages légales remplies avec les données du registre.
**En attente** : `019` (fermeture des anciens éléments de la base, besoin de ton accord), restriction du jeton Mapbox (connexion à ton compte), nettoyage des données de démonstration (offres, Bonopandas, événement « test »), plan Supabase Pro et dépôt privé (Ryadh / plus tard), comptes boutiques (plus tard).

---

## Étape 1 — Prévenir Ryadh (5 minutes, aujourd'hui)

Il a deux choses à faire de son côté :
1. **Pousser sa branche** sur GitHub : la bannière « Office de tourisme » (fond personnalisable dans le portail) n'existe que sur son ordinateur. 
2. **Relire** la branche `integration/audit-plus-claude` (fusion de son travail du 25/10 avec les corrections d'audit) avant qu'on la pousse.

Message à lui envoyer :
> Salut, peux-tu pousser ta branche (la bannière de l'Office de tourisme n'est pas sur GitHub) ? De mon côté j'ai fusionné ton travail du 25/10 avec des corrections d'audit (accès admin masqué, notes Google retirées, accessibilité, nouveaux scripts SQL 016 à 018). Je te la montre avant de pousser pour que tu la relises.

---

## Étape 2 — Rendre le dépôt GitHub privé (2 minutes, recommandé tout de suite)

**Pourquoi** : le dépôt est public. Son historique contient d'anciennes données devenues inutiles et l'empreinte d'un ancien code admin. Le rendre privé protège ça immédiatement, sans toucher au code.

1. Va sur `https://github.com/Rmenac88/le-petit-tou` → **Settings** (onglet en haut à droite).
2. Tout en bas, section **Danger Zone** → **Change repository visibility** → **Make private**.
3. Confirme en tapant le nom du dépôt.

**Ce que tu dois voir** : un cadenas à côté du nom du dépôt.
**Attention** : seules les personnes invitées pourront voir le code. Vérifie que Ryadh a bien accès (Settings → Collaborators).
**Plus tard** : quand l'appli est prête, retirer les anciennes données de l'historique (demande de le réécrire ; à faire avec Claude).

---

## Étape 3 — Passer Supabase en plan Pro (5 minutes, avant la publication)

**Pourquoi** : le plan gratuit plafonne à 5 Go de trafic par mois (saturé vers 900 utilisateurs actifs), met le projet en pause s'il est inactif, et n'a pas de vraie sauvegarde. Le Pro tient 5 000 utilisateurs.

1. Va sur `https://supabase.com/dashboard` → clique sur ton organisation → **Billing** (Facturation).
2. **Upgrade** → choisis **Pro** (environ 25 $ par mois, à vérifier sur la page de prix au moment de payer).
3. Une fois fait : projet → **Database → Backups**. Tu dois voir les sauvegardes quotidiennes.

---

## Étape 4 — Sauvegarder la table des adresses (3 minutes, OBLIGATOIRE avant l'étape 5)

Le script `017` efface les notes. Garde une copie avant.

1. Supabase → **Table Editor** (icône tableau à gauche) → clique sur la table **addresses**.
2. En haut à droite, bouton **Export** → **Export table as CSV**.
3. Enregistre le fichier dans un endroit sûr (pas dans le dépôt Git).

Si tu as passé l'étape 3, tu as aussi les sauvegardes automatiques (Database → Backups).

---

## Étape 5 — Lancer les scripts SQL, dans l'ordre

**Méthode (pour chaque script)** :
1. Ouvre le fichier dans `src/scripts/` (clic droit sur le fichier → ouvrir avec un éditeur de texte). `Cmd+A` puis `Cmd+C`.
2. Supabase → **SQL Editor** → **New query** → `Cmd+V` → **Run**.
3. Tu dois voir **« Success. No rows returned »**. Une alerte jaune « destructive operation » est normale pour certains scripts : clique sur « Run this query ».
4. Si une erreur rouge apparaît : fais une capture et envoie-la, ne continue pas avec le script suivant. Chaque script est atomique : s'il échoue, il ne change rien.

**L'ordre** (et ce que chacun fait) :

| Ordre | Fichier | Ce qu'il fait | Remarque |
|---|---|---|---|
| 1 | `009_events_columns.sql` | colonnes des événements | de Ryadh |
| 2 | `010_push_style.sql` | style des notifications | de Ryadh |
| 3 | `011_featured_spots.sql` | « chouchous du Petit Tou » | de Ryadh |
| 4 | `012_home_background.sql` | fond d'accueil personnalisable | de Ryadh |
| 5 | `013_offers.sql` | gestion des offres « % » dans le portail | de Ryadh |
| 6 | `014_home_theme.sql` | thème de l'année | de Ryadh |
| 7 | `015_user_lists.sql` | sauvegarde serveur des listes personnelles | de Ryadh |
| 8 | `016_hide_partner_price.sql` | **cache le prix payé par les partenaires** | voir ci-dessous |
| 9 | `017_remove_external_ratings.sql` | **efface les anciennes notes de la table des adresses** | destructif : étape 4 faite avant |
| 10 | `018_purge_suggestions.sql` | supprime les suggestions après 24 mois | |

> Si Ryadh t'a déjà fait lancer certains de ces scripts (009 à 012 notamment), relancer est sans danger : ils sont conçus pour être rejouables. Ne relance **jamais** un script numéroté plus petit que 006 après 006.

**À propos de `016`** : après ce script, les anciennes versions de l'appli ne voient plus les partenaires (elles lisaient la table directement). À lancer quand tu es prêt à utiliser la nouvelle version (celle de la branche `integration/audit-plus-claude`), ou quand aucun testeur n'a besoin de l'ancienne. Après l'avoir lancé, ouvre l'appli et vérifie que « Nos partenaires » s'affiche encore, et que le portail admin liste toujours les partenaires avec leur prix.

**À propos de `018`** : si le message indique que `pg_cron` est absente, va dans Supabase → **Database → Extensions**, active **pg_cron**, puis relance le script.

**Vérification finale** (demande à Claude de la lancer, ou lance-la toi-même) :
1. `scripts/audit-prod-check.sh` (dans le terminal, lecture seule) : tous les contrôles doivent afficher PASS.
2. Colle le contenu de `scripts/audit-prod-readonly.sql` dans le SQL Editor et lance-le : il ne doit renvoyer aucune ligne « FAIL ».

---

## Étape 6 — Nettoyer les données de démonstration dans le portail admin

Pour ouvrir le portail pendant le développement : dans ton fichier `.env`, ajoute `EXPO_PUBLIC_ENABLE_ADMIN=1`, relance l'appli, appuie **7 fois** sur le logo en haut à gauche, saisis ton code admin (toi seul, jamais dans un message).

1. **Offres** : supprime les **5 offres de démonstration** (sinon l'onglet « % » montre de fausses offres au public).
2. **Partenaires** : modifie **Bonopandas** (bouton crayon) pour retirer « Offre exclusive membre – 150 € » : aucune promesse ni montant dans le texte public. Le montant payé se saisit dans le champ « interne ».
3. **Événements** : supprime l'événement **« test »**.

**Ne jamais** laisser `EXPO_PUBLIC_ENABLE_ADMIN=1` dans un build envoyé aux boutiques.

---

## Étape 7 — Mapbox : restreindre le jeton (10 minutes, avec test)

**Pourquoi** : le jeton de la carte accepte n'importe quel site ; quelqu'un pourrait l'utiliser et consommer ton quota.

1. Va sur `https://account.mapbox.com` → **Tokens** → ouvre le jeton public `pk.…` utilisé par l'appli.
2. Dans **URL restrictions**, ajoute les adresses de la version web de l'appli (par exemple `https://ton-site.fr/*`) **si tu en publies une**.
3. **Teste immédiatement la carte** dans l'appli. Si elle devient grise ou vide, retire la restriction : la carte sur téléphone passe par une WebView dont l'adresse d'origine n'est pas garantie, et Claude n'a pas pu le vérifier.
4. Garde les **permissions du jeton** au minimum (lecture de styles et de tuiles seulement).

---

## Étape 8 — Décisions de l'association (réunion de 30 minutes)

Les rapports `docs/audit/13` (section « décisions ») et `docs/audit/03` détaillent chaque point. Voici les plus importants, avec la recommandation de Claude :

| Décision | Recommandation |
|---|---|
| Sur iPhone, l'identifiant survit-il à la réinstallation ? | Le laisser (la personne retrouve ses listes) et le dire clairement. C'est ce que fait déjà l'appli. |
| Durées de conservation | 24 mois sans activité pour les listes, likes, points, suggestions ; 9 mois pour les jetons de notification. C'est ce que fait déjà le code. |
| Mapbox comme seul fournisseur de carte | L'accepter et le déclarer dans la politique et dans les formulaires des boutiques (transfert hors UE). |
| Viser l'iPad | Pas dans la première version : publier en iPhone seulement, plus simple et moins risqué. |
| Libellé des partenaires payants | « Sponsorisé » (déjà en place), avec une mention claire dans la fiche de la boutique. |
| Âge minimal et classe d'âge boutiques | À fixer avec le juriste (présence d'alcool dans les adresses). |
| Droits sur les photos et textes des adresses | Vérifier d'où viennent les images (elles ont été reprises de lepetittou.com) et à qui appartient ce domaine. |
| Référent « données personnelles » | Désigner une personne (et demander au service juridique de TBS Education s'il existe un DPO). |

---

## Étape 9 — Pages légales (en grande partie faites)

Les trois pages (`public/confidentialite.html`, `public/mentions-legales.html`, `public/suppression-donnees.html`) sont remplies avec les informations du registre (SIREN, SIRET, forme juridique, région d'hébergement Irlande). Restent à compléter, ce que seule l'association connaît : numéro RNA, nom du directeur de la publication, hébergeur du site, adresse postale à publier (voir `docs/MESSAGE-ASSOCIATION.md`). Ensuite, les héberger à une adresse publique et noter les trois adresses pour l'étape 10.

---

## Étape 10 — Comptes développeur et boutiques

| Quoi | Où | Coût / délai | À savoir |
|---|---|---|---|
| Apple Developer | `developer.apple.com/programs` | 99 € par an | compte **Organisation** : il faut un numéro **D-U-N-S** (gratuit, quelques jours) |
| Google Play Console | `play.google.com/console` | 25 $ une fois | vérification d'identité ; un compte **personnel** doit avoir **12 testeurs pendant 14 jours** avant publication |
| Expo (EAS) | `expo.dev` | gratuit pour commencer | créer un compte propriétaire pour l'association, pas un compte perso |

Ensuite (avec Claude ou Ryadh) :
1. `eas init` pour obtenir l'identifiant de projet, à définir dans `EAS_PROJECT_ID`. Sans lui, les notifications ne marchent pas.
2. Déclarer les **secrets EAS** : adresse et clé publique Supabase, jeton Mapbox. Les clés de notification : APNs (Apple), Firebase/FCM (Google).
3. Remplir les formulaires de confidentialité des boutiques avec les brouillons de `docs/audit/13` (App Privacy chez Apple, Data safety chez Google), les captures d'écran, la description.
4. Pour chaque boutique : l'URL de politique de confidentialité (étape 9), l'adresse de contact, la classe d'âge.

---

## Étape 11 — Essais sur de vrais téléphones (indispensable)

Aucun test n'a été fait sur de vrais appareils. Avant de publier :
1. **Android** : Ryadh a un APK. Installe-le sur au moins **deux téléphones différents** (un récent, un d'entrée de gamme) et déroule la checklist de 22 étapes du rapport `docs/audit/12-APPAREILS.md` (carte, notifications reçues application fermée, refus de la position, mode avion, « Effacer mes données »).
2. **iPhone** : après l'étape 10, distribue un build **TestFlight** à 3 ou 4 personnes.
3. Teste le texte agrandi (Réglages du téléphone → taille du texte au maximum) et le bouton retour Android.

---

## Étape 12 — Build de production et envoi

À faire avec Claude ou Ryadh, une fois les étapes 5 à 11 terminées :
1. Vérifier que `EXPO_PUBLIC_ENABLE_ADMIN` n'est **pas** défini dans le build de production.
2. `eas build --profile production` (iOS et Android), puis `eas submit`.
3. Relancer `npm run test:all` (doit être entièrement vert) et le contrôle de production (`scripts/audit-prod-check.sh`).
4. Garder sous la main la version précédente tant que la nouvelle n'est pas approuvée par les boutiques (compter quelques jours chez Apple).

---

### Récapitulatif : ce qui bloque la publication

1. Passage au plan Pro (étape 3).
2. Scripts SQL lancés (étape 5), sinon le prix des partenaires reste lisible et les listes ne se sauvegardent pas.
3. Pages légales complétées et hébergées, avis du juriste (étapes 8 et 9).
4. Comptes développeur et tests sur vrais téléphones (étapes 10 et 11).
