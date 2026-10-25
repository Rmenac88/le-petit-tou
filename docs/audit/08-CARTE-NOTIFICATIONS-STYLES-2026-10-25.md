# Carte optimisée, choix des notifications, audit de mise en page (25 octobre 2026)

Commité en local, rien de poussé, **aucune migration SQL** : tout est côté application, un nouvel APK est nécessaire.

## 1. Carte

### Ce qui coûtait cher (mesuré dans le navigateur, mêmes réglages avant/après)

| Cause | Avant | Après |
|---|---|---|
| Repères d'adresses | éléments HTML déplacés à chaque image : **531 repères + 531 photos** à zoom 15 (quartier), 121 à zoom 16,5 | **0** : pastilles et groupes dessinés par la carte (WebGL) ; un seul repère HTML, celui de l'adresse sélectionnée |
| Regroupement | bibliothèque Supercluster téléchargée depuis un site tiers (unpkg), calcul sur le fil principal | regroupement natif de Mapbox, dans un worker ; plus aucune ressource tierce (un test le vérifie) |
| Projection | globe + brouillard + étoiles | carte plane (suffisant pour une ville) |
| Bâtiments 3D | couche d'extrusion active dès le zoom 14, même à plat | ajoutée **seulement** en mode 3D, masquée au retour à plat |
| Étiquettes de commerces Mapbox | affichées (doublon avec nos adresses, collisions à calculer) | masquées |
| Sélection d'une adresse | message de **2,3 Mo** (790 adresses jointes) vers la carte à chaque appui (≈ 100 Ko sur téléphone) | message minuscule (la liste n'est plus jointe) |
| Mise à jour de la liste | renvoyée à chaque lettre tapée et à chaque sélection | regroupée (150 ms), allégée, et **jamais renvoyée si identique** (empreinte) |
| Messages à chaque image | message « inclinaison » envoyé à l'appli à chaque image pendant l'inclinaison | un message seulement quand le mode 3D change |
| Plantage de la WebView (mémoire d'un téléphone modeste) | carte vide définitivement | relance automatique (3 fois max en 30 s), la liste est renvoyée au signal « prête » |

Mesures (ordinateur, carte réelle ; ordre de grandeur, pas une mesure de téléphone) : repères HTML à zoom 15 : **531 → 0** (dont 531 images chargées → 0) ; éléments HTML de la page : **plusieurs centaines → 24** ; pendant une série de déplacements à zoom 15 : **≈ 377 éléments créés → 0**, blocage du fil principal **≈ 99 ms → 30 ms** (la série de déplacements de référence n'était pas parfaitement identique : à lire comme un ordre de grandeur). Fonctions vérifiées dans le navigateur avec la vraie carte : clic sur un groupe (zoom d'expansion), clic sur une adresse (repère photo, message `SPOT_CLICKED`, fiche), clic dans le vide, mise à jour de liste (identique = aucun redessin), mode 3D, itinéraire.

**Changement visible** : sur la carte, les adresses sont désormais des pastilles de la couleur de leur catégorie avec leur icône (restaurant, bar, shopping…) au lieu de miniatures photo ; la photo reste affichée sur l'adresse sélectionnée et dans la fiche.

Autres corrections de la carte : les puces de catégories (« Tous / Restos / Shopping… ») étaient **coupées à gauche et inaccessibles** (contenu centré dans une liste qui défile) ; leurs compteurs étaient des **nombres figés faux** (« Restos 286 » alors qu'il y en a 82 dans le classement de la carte) ; la fenêtre de filtres, à mi-hauteur, avait sa moitié basse **hors de l'écran** (bouton « Voir les résultats » introuvable sans la tirer vers le haut) ; texte blanc sur jaune illisible (1,8:1) ; « Evenements » sans accent ; l'interrupteur « Ouvert actuellement » avait un style à part.

## 2. Choix des notifications au premier lancement

- Nouvelle fenêtre « **On reste en contact ?** » : trois interrupteurs (Événements, Agenda des partenaires, Nouvelles adresses), bouton « Activer les notifications », lien « Plus tard ». La demande d'autorisation du système n'apparaît **qu'après** ce choix.
- **Une seule fois par téléphone** : mémorisé localement (même clé que la version précédente : un téléphone déjà sollicité n'est pas re-sollicité). Pas proposée si le téléphone est déjà inscrit (état relu : cela couvre la réinstallation avec la même identité) ni si le système a bloqué les notifications. Si un autre écran est ouvert à ce moment, on réessaie quelques secondes plus tard.
- « Effacer mes données » remet le téléphone à neuf : le choix est reproposé une fois.
- **Interrupteurs de marque** (`BrandSwitch`) identiques sur Android, iOS et web, dans la fenêtre de bienvenue, les réglages des notifications et les filtres de la carte. Réglages restylés (cartes, émoji, marge de sécurité en bas).
- Pour voir la fenêtre sur ton téléphone : elle ne s'affiche qu'au premier lancement. Sur un téléphone où l'ancienne proposition a déjà été vue, vider les données de l'appli (Android : Paramètres › Applis › Le Petit Tou › Stockage › Effacer les données) ou « Effacer mes données » dans l'appli.

## 3. Audit de mise en page (captures + contrôle automatique)

Méthode : l'appli web à 375×812 et 320×568 (petit téléphone), tous les écrans et toutes les fenêtres (accueil, recherche, carte, filtres, wallet, agenda, fiche, catégories, mot de passe, les 9 onglets du portail), captures d'écran, et un contrôle automatique qui relève : débordement horizontal, texte coupé, boutons qui se chevauchent, zones de toucher < 40 px, contraste de texte < 4,5:1.

Défauts trouvés et corrigés :

| Écran | Défaut | Correction |
|---|---|---|
| Catégories (« Voir tout ») | marges doublées : colonne de texte de 65 px, « Gourmand Gourmet » devenait « Gourman d … » ; texte blanc sur fond rose (illisible) pour la sélection | grille 2 colonnes, icône au-dessus du nom (nom sur toute la largeur), texte rose foncé |
| Carte | puces coupées, compteurs faux, fenêtre de filtres, contraste, accent | voir §1 |
| Fiche d'une adresse | barre « On y va / Sur la carte » translucide : le texte qui défile transparaissait ; pas de marge de sécurité | barre opaque, marge de sécurité |
| Portail › Événements | champs « heure » et « places max » **dépassaient de la carte** ; libellés et placeholders tronqués ; « 1 événements » ; sous-onglets sur deux lignes à 320 px | `minWidth: 0`, placeholders courts, pluriel, texte réduit sur une ligne |
| Portail › Partenaires | champs côte à côte **à des hauteurs différentes** (libellés de 1 et 2 lignes) | libellés courts + alignement en bas ; la précision « montant interne, jamais affiché » est conservée en note |
| Portail › Catégories | le nom touchait les boutons modifier/supprimer | espace, nom sur 2 lignes max |
| Portail (général) | boutons modifier/supprimer 34 px collés l'un à l'autre (suppression à côté de modification) ; onglets et pastilles 29-31 px | 40 px avec écart de 8 px ; onglets 37 px, pastilles 35 px ; raccourcis de date agrandis |
| Accueil | liens « Voir tout » de 17 px de haut ; boutons du pied de page 31 px ; bouton « Réserver » 29 px ; accroche de recherche coupée en plein mot sur petit écran | zones de toucher agrandies (sans changer l'aspect), 44 px, 40 px, accroche courte sous 350 px |
| Contrastes | bouton « Ajouter » vert (3,1:1), notes ambre (3,2:1), erreurs rose sur rose (4,35:1), « Envoyer l'annonce » blanc sur rose vif (3,8:1) | jetons de marque `successDeep`, `ratingInk`, `primaryInk`, bouton en rose foncé ; un test vérifie 9 couples de couleurs |

Résultat du contrôle automatique après correction : **aucun débordement, aucun texte coupé, aucun chevauchement, aucun contraste insuffisant** sur les écrans listés, à 375 px et 320 px (restent des zones de toucher visuellement petites dont la zone active est agrandie sans changer l'aspect).

## Tests

- 172 tests unitaires (+35 : page de la carte, pont carte, empreintes, notifications, interrupteur, mises en page, contrastes), 116 tests SQL, types, paquet Android (Hermes), `expo-doctor` 21/21.
- Contrôle par sabotage : en réintroduisant trois défauts (contenu centré des puces, fenêtre de filtres déplacée au lieu d'être redimensionnée, grille horizontale, champs sans `minWidth`) les garde-fous échouent (4 tests).

## Non vérifié sur appareil réel

- Les performances réelles de la carte sur le Galaxy S10e (fluidité au pincement/déplacement, mémoire) : les chiffres ci-dessus sont ceux d'un navigateur d'ordinateur ; la cadence d'images n'a pas pu être mesurée (le navigateur de test ralentit les animations hors écran).
- Le rendu natif des listes, de la fenêtre de bienvenue et des interrupteurs sur Android/iOS (vérifiés sur le web uniquement).
- La demande d'autorisation du système suite au choix, et l'inscription réelle (nécessitent un téléphone avec les notifications).
- Le clavier qui peut recouvrir des champs du portail sur Android récent (non traité, non testable ici).
