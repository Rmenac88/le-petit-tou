# Procédure de publication — ce que seul toi peux faire

Tout ce qui se faisait sans compte ni appareil est fait et testé (voir le rapport). Ce document liste le reste, dans l'ordre.
Aucune étape ci-dessous n'a pu être exécutée ni vérifiée par moi : elles dépendent de tes comptes et d'un téléphone.

## 0. Comptes à créer

| Compte | Pour quoi | Remarque |
|---|---|---|
| Expo (expo.dev) | builds dans le cloud, envoi des notifications | gratuit pour commencer |
| Apple Developer Program | tout build installable sur iPhone, App Store, notifications iOS | abonnement annuel ; indispensable, Expo Go ne peut pas remplacer |
| Google Play Console | publication Android | paiement unique à l'ouverture |
| Firebase (console.firebase.google.com) | notifications Android (FCM) | gratuit |
| Google Cloud | clé Google Maps pour Android | à restreindre à l'application |
| Mapbox | jeton public d'itinéraires | à restreindre par URL / identifiant d'appli |

Vérifie les tarifs sur les sites officiels : ils évoluent.

## 1. Supabase (base de données)

1. SQL Editor : exécuter `007_push_notifications.sql` (après 005 et 006, déjà faits).
2. **Database → Extensions** : activer **pg_net** et **pg_cron**, puis relancer 007 (il planifie l'envoi chaque minute et la purge nocturne). Sans pg_cron, aucune notification ne part.
3. **Authentication → Sign In / Providers** : désactiver **Email** et **Google** (aucun écran de connexion dans l'appli). Laisser « Anonymous sign-ins » désactivé.
4. **Projet** : passer à une offre payante si tu veux de vraies sauvegardes. Le plan gratuit n'offre pas de restauration à un instant précis et met le projet en pause après une période d'inactivité ; une pause = application vide pour tous les utilisateurs. Vérifie sur supabase.com/pricing ce que comprend chaque offre et active la sauvegarde avant d'ouvrir l'application au public.
5. Supprimer l'événement de test (`events`, titre « Test », 2027-04-19).
6. Relancer `scripts/audit-prod-check.sh` : tous les contrôles doivent être `PASS`.
7. Noter la **région** du projet (Settings → General) et la reporter dans la politique de confidentialité et les mentions légales (champs jaunes `[À COMPLÉTER]`).

## 2. Projet Expo / EAS

```bash
npm install -g eas-cli
eas login
cd ~/Documents/le-petit-tou
eas init          # crée le projet et écrit extra.eas.projectId dans app.json : à commiter
```

Sans `projectId`, l'écran « Notifications » répond « pas encore configurées » (comportement voulu, pas de plantage).

Variables d'environnement EAS (`eas env:create --help` pour la syntaxe exacte) :

| Nom | Contenu | Visibilité |
|---|---|---|
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | jeton **public** Mapbox (`pk.…`) restreint | visible |
| `GOOGLE_MAPS_ANDROID_API_KEY` | clé Google Maps SDK Android, restreinte au paquet `fr.lepetittou.app` et à l'empreinte de signature | sensible |
| `GOOGLE_SERVICES_JSON` | fichier `google-services.json` de Firebase (variable de type fichier) | sensible |

`EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY` sont déjà dans `eas.json` (valeurs publiques). **Le build de production est refusé** (`app.config.js`) si une des trois variables ci-dessus manque : c'est volontaire, pour ne jamais publier une carte ou des notifications cassées.

## 3. Notifications : configuration des fournisseurs

- **iOS** : au premier build, EAS propose de créer la clé APNs (nécessite le compte Apple Developer). Accepter.
- **Android** : dans Firebase, ajouter une application Android `fr.lepetittou.app`, télécharger `google-services.json` (variable ci-dessus). Puis Paramètres du projet → Comptes de service → générer une clé privée, et la déposer dans EAS : `eas credentials` → Android → *Google Service Account Key for FCM V1*.
- Ne jamais commiter ces fichiers : `google-services.json` et les clés de compte de service sont ignorés par `.gitignore`. Garde-les hors du dépôt (gestionnaire de mots de passe, variables EAS).

## 4. Builds de test sur ton iPhone

Expo Go plante sur ton iPhone et n'est de toute façon pas représentatif (notifications, cartes, permissions). Utilise un **development build** :

```bash
eas device:create                              # enregistre l'iPhone (Apple Developer requis)
eas build --profile development --platform ios
```

Puis `npx expo start --dev-client`. Pour Android : `eas build --profile preview --platform android` donne un APK à installer.

## 5. Liste de tests sur appareil réel (à cocher)

Carte et localisation
- [ ] la carte s'affiche (iPhone : Apple Plans ; Android : Google Maps)
- [ ] la localisation est demandée à l'ouverture de la carte, un refus ne casse rien
- [ ] un itinéraire à pied se calcule
- [ ] pas de plantage au lancement, après 10 minutes en arrière-plan, en mode avion, avec réseau lent

Données
- [ ] découvrir une adresse, fermer/rouvrir l'appli : les points restent
- [ ] utiliser une carte privilège jusqu'à la limite : la dernière fois est refusée
- [ ] likes
- [ ] « Effacer mes données » vide la progression et les cartes

Notifications (le point critique)
- [ ] Accueil → Notifications → activer : la permission du système est demandée
- [ ] portail admin → onglet Notifications : « Appareils inscrits » passe à 1
- [ ] envoyer une annonce de test (hors 21 h-8 h) : elle arrive en moins de deux minutes, **appli ouverte, en arrière-plan et fermée**
- [ ] toucher la notification ouvre le bon écran
- [ ] créer une date d'agenda : notification « À l'agenda » ; créer un événement : notification « Nouvel événement »
- [ ] 15 minutes après : les statistiques montrent `receipt_ok`
- [ ] refuser la permission : message clair, pas de plantage ; désactiver : plus aucune notification
- [ ] iPhone **et** Android (comportements différents)

Administration
- [ ] 7 appuis sur le logo, saisie du code : ajout/modification/suppression d'une adresse, d'une catégorie, d'un événement, d'un partenaire
- [ ] mauvais code : refus ; 10 mauvais codes : verrouillage 15 minutes
- [ ] inactivité 15 minutes : le portail se referme

Accessibilité
- [ ] VoiceOver (iPhone) / TalkBack (Android) : parcours accueil → fiche → carte
- [ ] texte agrandi dans les réglages du système

## 6. Fiches des stores

- **URLs à renseigner** : confidentialité `…/confidentialite.html`, mentions `…/mentions-legales.html`, suppression de données `…/suppression-donnees.html`. Ces pages sont dans `public/` et sont publiées avec l'export web (`npx expo export --platform web`, hébergement au choix, par exemple EAS Hosting : `eas deploy`). Compléter d'abord les champs jaunes.
- **App Store Connect — étiquettes de confidentialité (brouillon à valider)** : *Identifiants → ID de l'appareil* (fonctionnement de l'app, non lié à l'identité, pas de suivi) ; *Données d'utilisation → interaction produit* (adresses découvertes, cartes utilisées) ; *Contenu utilisateur → autre contenu* (suggestions) ; *Position* : utilisée au premier plan, itinéraires envoyés à Mapbox (à déclarer comme collectée si Apple l'exige pour un tiers). « Suivi » : non.
- **Google Play — Sécurité des données (brouillon)** : mêmes catégories ; données chiffrées en transit : oui ; suppression possible depuis l'appli et via la page web : oui.
- **iPad** : `supportsTablet` est vrai, il faut des captures iPad (ou passer à `false` dans `app.json`).
- **Compte de démonstration pour l'examen** : aucun compte n'existe. Indiquer « aucune connexion nécessaire ». Ne **jamais** donner le code admin aux relecteurs.
- **Classification d'âge** : questionnaire des stores (pas de contenu sensible ; la rubrique « alcool » concerne les adresses de bars : à répondre honnêtement).

## 7. Retour arrière

- Application : republier le build précédent (EAS : `eas build:list`), ou désactiver la version dans les consoles.
- Base : migrations 005/006/007 atomiques. Avant de les relancer, faire une sauvegarde (offre payante) ou exporter les tables (Table editor → Export CSV : `addresses`, `events`, `partner_events`, `sponsored_partners`, `categories`, `discount_cards`).
- Notifications : `select cron.unschedule('lpt-push-tick');` les arrête immédiatement.

## 8. Limites connues (à connaître avant de publier)

- Les tests de la chaîne de notifications simulent l'API Expo : aucun envoi réel n'a été fait.
- Les identifiants d'appareil servent de clé d'accès (aucun compte) : réinstaller l'appli remet à zéro progression et quotas.
- Les photos du portail admin sont envoyées avec la clé publique (le stockage ne peut pas vérifier le code admin) : taille, type et dossier sont bornés, mais l'écriture anonyme dans le bucket reste possible. Une fonction Edge réglerait ce point.
- Les performances ne sont pas mesurées ; la couverture de code n'est pas mesurée.
