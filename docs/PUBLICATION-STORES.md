# Publier Le Petit Tou sur Google Play et l'App Store

Guide pas à pas, établi le 23/11/2026 à partir de l'état réel du projet. Les montants et délais des stores sont ceux
annoncés publiquement par Google et Apple à cette date : à vérifier au moment de l'inscription. Aucune publication
n'est garantie : seuls Google et Apple décident.

## 0. Où on en est

| Point | État |
|---|---|
| Un profil par installation (likes, listes, points, notifications) | Vérifié : identifiant aléatoire par téléphone, isolé côté serveur, jamais lisible par un autre |
| Notifications Android (son, vibration, bandeau, appli fermée) | Vérifié sur Samsung S10e |
| Base de production (migrations 006 à 027) | Appliquée et vérifiée |
| Lenteur à l'ouverture des écrans | Cause corrigée (coffre chiffré relu avant chaque requête) : à confirmer sur le S10e |
| Notifications iPhone | Jamais testées (aucun build iOS) |
| Pages légales | 3 champs à compléter, pages à mettre en ligne, relecture juridique |
| Comptes stores, Supabase, Mapbox, Firebase au nom de l'entreprise | À faire |

**Le portail admin n'existe pas dans les versions des stores** (règle Apple 2.3.1 sur les fonctions cachées). L'équipe
garde un APK de test avec le portail (`eas build --profile preview`), et sur iPhone une version TestFlight interne.

## 1. Avant tout : les comptes au nom de l'entreprise

1. **Supabase** : l'entreprise crée une organisation et choisit l'offre Pro, puis Project Settings → General →
   Transfer project. Rien ne change dans l'appli (même adresse, mêmes clés, mêmes données).
2. **Mapbox** : compte de l'entreprise, jeton public restreint par URL. On remplace `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`
   dans EAS (`eas env:update`) puis on refait les builds.
3. **Firebase** (notifications Android, projet `le-petit-tou-31e6d`) : ajouter l'entreprise comme propriétaire
   (Paramètres du projet → Utilisateurs et autorisations). La clé FCM V1 déjà dans EAS reste valide.
4. **Expo / EAS** : créer une organisation Expo pour l'entreprise et y transférer le projet (Project settings →
   Transfer project). Les identifiants de build (clé de signature Android) suivent le projet.
5. **Google Play Console** : compte développeur « Organisation » (frais d'inscription uniques d'environ 25 $). Il
   faut un numéro D-U-N-S (gratuit, quelques jours à obtenir) et une vérification d'identité. Un compte « personnel »
   récent doit faire un test fermé avec au moins 12 testeurs pendant 14 jours avant la production.
6. **Apple Developer Program** : inscription en tant qu'organisation (environ 99 $ par an), D-U-N-S obligatoire,
   l'entreprise doit être une personne morale. Compter une à deux semaines de vérification.

## 2. Juridique (à faire relire par une personne compétente)

1. `public/mentions-legales.html` : numéro RNA, directeur·rice de la publication, hébergeur des pages web. Si c'est
   l'entreprise qui publie l'appli, l'éditeur devient l'entreprise : revoir tout le bloc « Éditeur ».
2. `public/confidentialite.html` et l'écran Confidentialité de l'appli : vérifier la liste des sous-traitants
   (Supabase, Expo, Google Firebase, Apple, Mapbox), les durées de conservation (24 mois), le contact.
3. `public/conditions-utilisation.html` : brouillon à valider (tribunal compétent, médiation).
4. **Mettre les 4 pages en ligne à une adresse stable** (site de l'entreprise, ou hébergement statique) : les stores
   exigent l'adresse de la politique de confidentialité et, pour Google, celle de la page « Supprimer mes données ».
5. Contenus : vérifier les droits sur les photos et descriptions des établissements (beaucoup ont été importées).
6. Partenaires « Sponsorisé » : c'est de la publicité au sens des stores ; l'étiquette est déjà affichée.

## 3. Nettoyer la base avant la sortie (Ryadh s'en charge)

5 offres de démonstration, événements et notifications de test, likes et points des téléphones de test. Les
téléphones de test peuvent aussi utiliser « Effacer mes données ».

## 4. Construire les versions des stores

```bash
npx eas-cli build --profile production --platform android
npx eas-cli build --profile production --platform ios
```
Le profil `production` refuse de construire sans jeton Mapbox ni fichier Firebase, et n'inclut pas le portail admin.
Pour iOS, EAS crée lui-même les certificats et la clé de notifications (APNs) au premier build, avec le compte Apple.

## 5. Google Play

1. Play Console → Créer une application : nom « Le Petit Tou », langue française, application gratuite.
2. **Fiche du store** : description courte (80 caractères) et longue, icône 512×512, image de présentation 1024×500,
   au moins 2 captures d'écran de téléphone.
3. **Contenu de l'application** :
   - politique de confidentialité : l'adresse de `confidentialite.html` ;
   - publicités : **oui** (partenaires sponsorisés) ;
   - accès à l'application : aucun identifiant nécessaire ;
   - classification du contenu : questionnaire (aucune violence, pas de jeux d'argent) ;
   - public cible : 13 ans et plus (ou 18 ans et plus si des bars et cocktails sont mis en avant) ;
   - **Sécurité des données** (Data safety), d'après le code :
     - identifiants de l'appareil : collectés, non partagés, pour le fonctionnement de l'appli, chiffrés en transit,
       suppression possible (« Effacer mes données ») ;
     - position : utilisée seulement sur le téléphone, jamais envoyée au serveur, donc **non collectée** ;
     - activité dans l'appli (likes, listes, adresses visitées) : collectée, non partagée, pour le fonctionnement ;
     - aucun nom, aucune adresse e-mail, aucun paiement, aucun suivi publicitaire ;
   - page de suppression des données : l'adresse de `suppression-donnees.html`.
4. **Tests** : envoyer le fichier `.aab` en test interne, puis en test fermé (obligatoire 14 jours avec 12 testeurs
   pour un compte personnel récent), puis en production. Envoi automatique possible : `npx eas-cli submit -p android`
   (il faut une clé de compte de service Google Play dans EAS).
5. Examen par Google : de quelques heures à 7 jours.

## 6. App Store

1. App Store Connect → Nouvelle app : identifiant `fr.lepetittou.app`, nom, langue française, catégorie
   « Voyages » ou « Cuisine et boissons ».
2. **TestFlight d'abord** : installer le build sur un iPhone, vérifier les notifications (appli fermée), la
   position refusée puis acceptée, la carte, « Effacer mes données ».
3. **Confidentialité de l'app** (App Privacy) :
   - identifiants (identifiant d'appareil) : collectés, **non liés à l'identité**, fonctionnement de l'appli ;
   - activité (likes, listes, découvertes) : collectée, non liée à l'identité, fonctionnement de l'appli ;
   - position : non collectée (elle ne quitte pas le téléphone) ;
   - pistage : **non** (pas de publicité ciblée, donc pas de demande d'autorisation de suivi).
4. **Fiche** : captures pour iPhone 6,9 et 6,5 pouces, description, mots-clés, adresse d'assistance, adresse de la
   politique de confidentialité, classification par âge (questionnaire), copyright.
5. **Notes pour l'examen** : « Aucun compte n'est nécessaire : un identifiant anonyme est créé à l'installation. La
   position est facultative. Les adresses marquées Sponsorisé sont des partenariats payants. »
6. Chiffrement : déjà déclaré « non soumis » (`ITSAppUsesNonExemptEncryption: false`).
7. Envoi : `npx eas-cli submit -p ios`, puis « Soumettre pour examen ». Examen : en général 1 à 3 jours.

## 7. Causes de refus les plus probables (et parades)

| Risque | Parade |
|---|---|
| Politique de confidentialité inaccessible ou incomplète | Pages en ligne, 3 champs remplis, relues |
| Contenus et photos de tiers sans autorisation (Apple 5.2) | Garder la preuve des autorisations, retirer les photos douteuses |
| Formulaires de données qui ne correspondent pas au code | Remplir exactement comme au § 5 et § 6 |
| « Fonctionnalité minimale » (Apple 4.2) | La carte, les listes, les offres et les notifications vont au-delà d'un simple site : le dire dans les notes |
| Plantage pendant l'examen | Tester le build exact envoyé (TestFlight, test interne) |

## 8. Après la sortie

Surveiller : quotas Supabase et Mapbox, reçus d'envoi des notifications (portail → statistiques), avis des stores.
Prévoir ensuite : connexion anonyme Supabase (identité vérifiée par le serveur), base de test séparée (branche
Supabase), découpage des très gros fichiers, Expo SDK 58.
