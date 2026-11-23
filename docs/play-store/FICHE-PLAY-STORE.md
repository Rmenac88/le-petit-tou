# Le Petit Tou : tout ce qu'il faut saisir dans la Play Console

Préparé le 23/11/2026 d'après le code et la base de production. À copier-coller rubrique par rubrique.
Les champs marqués **[À FOURNIR]** dépendent de l'entreprise.

---

## 1. Créer l'application

| Champ | Réponse |
|---|---|
| Nom de l'application | **Le Petit Tou** |
| Langue par défaut | Français (France) – fr-FR |
| Application ou jeu | Application |
| Gratuite ou payante | Gratuite |
| Déclarations | Cocher les règles du programme pour les développeurs et les lois d'exportation des États-Unis |

---

## 2. Fiche principale du store

### Nom (30 caractères max)
```
Le Petit Tou
```

### Description courte (80 caractères max, 78 utilisés)
```
Toulouse en rose : 789 adresses testées par des étudiants, carte et bons plans
```

### Description complète (4 000 caractères max)
```
Le Petit Tou, c'est le city-guide gratuit des bonnes adresses de Toulouse, testées pour de vrai par des étudiants.

Restaurants, cafés, bars, boutiques, friperies, beauté, culture : plus de 780 adresses choisies, avec une fiche claire pour chacune, des photos, le quartier, les horaires et le budget.

TROUVE TA PROCHAINE PÉPITE
• Une recherche rapide par nom, quartier, envie ou type de lieu
• Des filtres par catégorie et par budget (jusqu'à 10 €, 20 €, 30 €)
• Les « chouchous du moment », classés par les likes de la communauté
• Les coups de cœur de l'équipe, mis en avant chaque semaine

UNE CARTE PENSÉE POUR LA BALADE
• Toutes les adresses sur une carte de Toulouse, regroupées pour rester lisibles
• Ta position (si tu le souhaites) pour voir ce qui est près de toi
• L'itinéraire à pied jusqu'à l'adresse, ou l'ouverture de ton appli de navigation
• Une vue en 3D pour se repérer dans la ville

TES LISTES ET TES LIKES
• Like les adresses que tu adores
• Range-les dans « À tester plus tard », « Y retourner » ou tes propres listes
• Tout est sauvegardé : tu retrouves tes listes à chaque ouverture
• Un code de récupération pour retrouver ton profil sur un nouveau téléphone

TA CARTE DE MEMBRE ET TES POINTS
• Gagne des points à chaque adresse découverte et monte de niveau
• Présente ta carte de membre chez les partenaires
• Profite des réductions réservées aux membres dans l'onglet « − % »

NE RATE RIEN
• L'agenda des événements et des rendez-vous des partenaires
• Le lien direct vers l'agenda de l'Office de tourisme de Toulouse
• Des notifications si tu le souhaites : nouvel événement, nouvelle date à l'agenda, nouvelles adresses. Tu choisis quoi recevoir, et rien n'est envoyé la nuit

SANS COMPTE, SANS PUB CIBLÉE
• Aucune inscription : ni e-mail, ni mot de passe, ni réseau social
• Aucune publicité ciblée et aucun pistage
• Tu peux effacer toutes tes données à tout moment, depuis l'appli

Certaines adresses sont mises en avant dans le cadre de partenariats : elles sont toujours signalées par l'étiquette « Sponsorisé ».

Le Petit Tou, pour voir la ville en rose.
```

### Visuels

| Élément | Fichier | Exigence Google |
|---|---|---|
| Icône | `docs/play-store/visuels/icone-512.png` | PNG 512 × 512, 1 Mo max |
| Image de présentation | `docs/play-store/visuels/presentation-1024x500.png` | PNG ou JPEG 1024 × 500 |
| Captures d'écran (téléphone) | `docs/play-store/visuels/capture-*.png` | 2 à 8 images, côté entre 320 et 3 840 px, rapport ≤ 2:1 |

### Coordonnées (affichées publiquement)

| Champ | Réponse |
|---|---|
| Adresse e-mail | **[À FOURNIR]** (ex. contact@lepetittou.net) |
| Site web | **[À FOURNIR]** |
| Téléphone | facultatif |

### Catégorie et tags

| Champ | Réponse |
|---|---|
| Catégorie | **Voyages et infos locales** |
| Tags | Guides de voyage, Restaurants, Shopping (au choix dans la liste de Google) |

---

## 3. Contenu de l'application (menu « Règles et programmes » → « Contenu de l'application »)

### Règles de confidentialité
URL de `public/confidentialite.html` une fois en ligne : **[À FOURNIR]**

### Accès à l'application
« **Toutes les fonctionnalités sont disponibles sans restrictions d'accès** » (aucun identifiant nécessaire).

### Annonces
**Oui, mon application contient des annonces.**
Raison : des adresses partenaires sont mises en avant contre rémunération (étiquette « Sponsorisé »). Il n'y a ni
réseau publicitaire ni publicité ciblée, mais Google compte les placements payants comme des annonces.

### Classification du contenu (questionnaire IARC)

| Question | Réponse |
|---|---|
| Catégorie | Toutes les autres catégories d'applications (ni jeu, ni réseau social) |
| Violence, sexualité, langage grossier | Non |
| Substances contrôlées : l'appli fait-elle référence à l'alcool ou le montre-t-elle ? | **Oui** (bars et cocktails parmi les adresses) |
| Jeux d'argent ou simulation | Non |
| Les utilisateurs peuvent-ils communiquer entre eux ou partager du contenu ? | Non (la suggestion d'adresse n'est lue que par l'équipe) |
| Partage de la position avec d'autres utilisateurs | Non |
| Achats numériques | Non |

### Public cible et contenu
| Question | Réponse |
|---|---|
| Tranches d'âge visées | **18 ans et plus** (alcool et bars mis en avant). Si l'entreprise retire les bars : 13 ans et plus |
| L'appli peut-elle attirer les enfants ? | Non |

### Applications d'actualités
Non.

### Fonctionnalités financières, santé, applications gouvernementales
Non, non, non.

### Identifiant publicitaire (Advertising ID)
**Non**, l'application n'utilise pas l'identifiant publicitaire.

---

## 4. Sécurité des données (formulaire « Data safety »)

### Questions générales

| Question | Réponse |
|---|---|
| L'appli collecte-t-elle ou partage-t-elle des données utilisateur des types requis ? | **Oui** |
| Toutes les données collectées sont-elles chiffrées lors de leur transfert ? | **Oui** (HTTPS uniquement) |
| Proposez-vous un moyen de demander la suppression des données ? | **Oui** : dans l'appli (Profil → Confidentialité et RGPD → Effacer mes données) et sur la page web de suppression |
| URL de suppression des données | URL de `public/suppression-donnees.html` : **[À FOURNIR]** |

### Types de données à cocher

Partagées : **aucune**. Les prestataires techniques (Supabase, Google Firebase, Mapbox, Expo) traitent les données
pour notre compte : selon les règles de Google, ce n'est pas du « partage ».

| Catégorie Google | Type | Collectée | Partagée | Traitement éphémère | Obligatoire ou facultative | Finalités |
|---|---|---|---|---|---|---|
| Position | **Position précise** | Oui | Non | **Oui** (envoyée à Mapbox pour calculer l'itinéraire à pied, jamais enregistrée) | **Facultative** | Fonctionnalités de l'application |
| Position | Position approximative | Oui | Non | Oui | Facultative | Fonctionnalités de l'application |
| Activité dans les applications | **Interactions avec l'application** (likes, listes, adresses découvertes, offres utilisées, fiches consultées) | Oui | Non | Non | Obligatoire | Fonctionnalités de l'application ; Données analytiques (nombre de vues par adresse, sans identifiant) |
| Activité dans les applications | **Autres contenus générés par l'utilisateur** (proposition d'adresse) | Oui | Non | Non | Facultative | Fonctionnalités de l'application |
| Identifiants de l'appareil ou autres | **Identifiants de l'appareil ou autres** (identifiant aléatoire de l'installation, jeton de notification) | Oui | Non | Non | Obligatoire | Fonctionnalités de l'application |

**Ne PAS cocher** : informations personnelles (nom, e-mail, adresse, téléphone), informations financières, santé,
messages, photos et vidéos, fichiers audio, fichiers et documents, agenda, contacts, historique de navigation,
informations et performances de l'application (aucun outil de suivi des plantages n'est intégré).

---

## 5. Version de production

| Champ | Réponse |
|---|---|
| Fichier | `.aab` produit par `npx eas-cli build --profile production --platform android` |
| Signature | « Signature d'application par Google Play » : accepter (EAS fournit la clé d'importation) |
| Nom de la version | 1.0.0 |
| Notes de version | « Première version du Petit Tou : 789 bonnes adresses de Toulouse, carte, listes, carte de membre et offres partenaires. » |
| Pays | France (ou Union européenne : **[À DÉCIDER]**) |

Ordre conseillé : **test interne** (2 ou 3 personnes, quelques jours), puis **production**. Un compte « personnel »
récent doit en plus passer par un **test fermé de 14 jours avec 12 testeurs** avant d'avoir le droit de publier.

---

## 6. Avant d'appuyer sur « Envoyer pour examen »

- [ ] Les 4 pages légales sont en ligne et les liens fonctionnent sur téléphone
- [ ] Les 3 champs « À COMPLÉTER » des mentions légales sont remplis
- [ ] Les offres de démonstration sont supprimées, les vraies offres sont en ligne
- [ ] Le jeton Mapbox est celui de l'entreprise (ou le tien, temporairement)
- [ ] Le `.aab` a été installé en test interne et tout marche : carte, notifications, listes, effacement des données
