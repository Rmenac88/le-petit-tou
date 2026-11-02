# Mission D — Données personnelles, fonctionnement « sans compte » et conformité légale

Préfixe des constats : **D2-xx** (les D-xx existent déjà dans `docs/audit/01` et `03`). Rapport : `docs/audit/13-DONNEES-ET-LEGAL.md`.
Lis d'abord `00-contexte-commun.md`, puis `docs/audit/03-JURIDIQUE-ET-BOUTIQUES-2026-10-21.md` en entier.
Rappel : tu n'émets **pas d'avis juridique** ; tu prépares le dossier pour qu'un juriste ou le DPO de l'association le valide.

## Question centrale du commanditaire
« Comme l'application n'a pas de compte (ni Google, ni Apple, ni e-mail), la base de données et le code permettent-ils, à **chaque téléchargement**, d'enregistrer les données de l'utilisateur
(likes, listes, découvertes, points, cartes de réduction) **sans passer par un compte** ? Que devient cette donnée quand la personne **désinstalle** l'appli, **réinstalle**, **change de téléphone** ou demande l'effacement ? »
Il t'a été dit « quand une personne désinstalle, ça supprime les données » : **vérifie-le**, ne le prends pas pour acquis. Examine en particulier :
- où chaque donnée est stockée (téléphone : `AsyncStorage` / `SecureStore` / `localStorage` ; serveur : quelles tables, rattachées à quel identifiant) ;
- ce que fait iOS à la désinstallation pour les éléments du Trousseau (`SecureStore`) et ce que fait Android (sauvegarde cloud, `allowBackup`) ;
- l'identifiant : où il est créé, quand, s'il survit à une réinstallation, s'il permet de relier deux installations, s'il est envoyé à des tiers ;
- les copies serveur (listes `user_lists`, découvertes, likes, jetons, vues) : durée de conservation réelle, purge (`lpt-purge`), effacement (« Effacer mes données » : que supprime-t-il côté serveur et côté téléphone ? teste la logique dans `src/lib/dataDeletion.ts` et les fonctions SQL), données orphelines après désinstallation (le serveur ne sait pas qu'on a désinstallé) ;
- le changement de téléphone : les données sont-elles perdues, et le texte de l'appli le dit-il ?

## Méthode

### 1. Cartographie des traitements (livrable : « registre des traitements » provisoire)
Pour **chaque donnée** (identifiant d'appareil, identifiant de session anonyme, jeton de notification, plateforme/version, préférences de notification, likes, listes personnelles, adresses découvertes et points, cartes de réduction utilisées, vues de fiches, suggestions d'adresses avec texte libre,
position (si demandée), adresse IP côté Supabase/Expo/Mapbox, journaux) : finalité, base légale proposée (à valider), lieu de stockage, durée de conservation réelle (code/SQL) vs annoncée (texte), destinataires et sous-traitants (Supabase, Expo, Apple/Google push, Mapbox, hébergeur du site), pays/région, droits applicables et comment ils sont exercés.

### 2. Écart entre ce qui est dit et ce qui est fait
Compare ligne à ligne : `src/components/PrivacyPolicyModal.tsx`, `public/confidentialite.html`, `public/mentions-legales.html`, `public/suppression-donnees.html` (et leurs champs `[À COMPLÉTER]`)
avec le comportement réel du code et des scripts SQL. Relève chaque affirmation fausse, trompeuse, absente ou impossible à tenir (par exemple « aucune donnée », « 2 notifications maximum par jour » alors que les annonces admin ne sont pas plafonnées, durée de conservation, hébergement).

### 3. Points légaux à instruire (rassemble les faits du code, formule les questions au juriste)
RGPD (information, base légale, minimisation, durée, droits, sous-traitants, transferts hors UE, violation de données et délai de 72 h déjà évoqué dans `03`), ePrivacy / article 82 de la loi Informatique et Libertés (identifiant d'appareil, jeton push, stockage local : consentement ou exemption ?),
consentement aux notifications (pas de publicité de partenaire), **publicité et contenus sponsorisés** (étiquetage « sponsorisé », absence de classement trompeur, mentions des offres/réductions et de leur durée, loyauté des avis et notes), **loi Évin et alcool** (mention, âge minimum, contenus des fiches de bars), mineurs (public étudiant : âge minimal et déclarations des boutiques),
mentions légales et statut de l'éditeur (association loi 1901), propriété des photos et textes des établissements (droit des producteurs de bases de données, droit d'auteur des photos : d'où viennent-elles ?), notes Google/TripAdvisor (retirées : vérifie qu'il n'en reste ni dans l'appli, ni dans le jeu de données, ni dans l'historique public du dépôt), conditions des boutiques (Apple App Privacy « nutrition labels », Google Play « Data safety », règle Apple 5.1.1 et 5.1.2, suppression de compte et de données), accessibilité (RGAA/EAA pour une association : applicabilité à confirmer).
Pour chaque point : faits observés (preuve), texte à produire ou corriger, qui doit valider, échéance.

### 4. Brouillons prêts à relire
Fournis dans le rapport : (a) les déclarations **App Privacy (Apple)** et **Data safety (Google)** pré-remplies d'après le code, avec les cases incertaines marquées ; (b) un projet de texte de politique de confidentialité en français courant, cohérent avec le code **tel qu'il est** ; (c) la liste des 15 questions à poser au responsable du traitement.

## Définition de « terminé »
Registre des traitements complet, réponse argumentée et prouvée à la question centrale (avec le cas iOS, Android, web), tableau « dit / fait » rempli, brouillons (a) (b) (c), constats D2-xx classés, et la liste des décisions que seul le responsable du traitement peut prendre.
