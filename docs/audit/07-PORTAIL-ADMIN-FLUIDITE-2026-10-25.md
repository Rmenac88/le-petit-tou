# Portail admin : fluidité sur téléphone (25 octobre 2026)

Commité en local, rien de poussé, **aucune migration SQL** (tout est côté appli). Un nouvel APK est nécessaire.

## Causes trouvées (mesurées, pas supposées)

| # | Cause | Effet |
|---|---|---|
| 1 | À l'ouverture, le portail retéléchargeait **toute** la table `addresses` (`select *` : 400 Ko transférés, **1,6 Mo à lire**, dont 1 Mo de descriptions) | attente + lecture JSON lourde sur le fil principal |
| 2 | Puis il **diffusait ces 790 adresses à toute l'appli** (`dataStore.notifyAddressesChanged`) : reconstruction de l'index de recherche (deux fois), recalcul de l'accueil, de la carte (790 repères reformatés) et de l'écran de recherche, le tout derrière le portail | gel de plusieurs secondes sur un téléphone modeste ; refait à chaque enregistrement et à la fermeture |
| 3 | La liste montait **790 cartes d'un coup** (817 images, ~25 000 éléments) sans virtualisation, avec un classement de catégorie par ligne à chaque rendu | mémoire et rendu énormes, saisie lente dans la recherche |
| 4 | « Déverrouiller » : attente artificielle de 350 ms après la réponse du serveur, première requête qui paye la connexion (DNS + TLS), aucun message si le réseau est lent | ressenti d'un bouton qui « réfléchit » |
| 5 | Onglet Catégories : décompte des adresses par catégorie refait à chaque lettre tapée | à-coups dans le formulaire |

## Mesures (navigateur d'ordinateur, appli en mode développement : un téléphone sera plus lent, c'est le **rapport** qui compte)

| Mesure | Avant | Après |
|---|---|---|
| « Déverrouiller » → portail affiché | 1 356 ms | **≈ 265–300 ms** (dont 120 ms de réseau simulé) |
| Éléments affichés à l'ouverture | 24 753 (817 images) | **1 341 (36 images)** |
| Blocage du fil principal à l'ouverture | **1 895 ms** (9 tâches longues) | **0 ms** |
| Première lettre tapée dans la recherche | 463 ms | **11 ms** (liste mise à jour juste après, sans bloquer la saisie) |
| Liste des adresses téléchargée | 1,64 Mo (400 Ko compressés) | **311 Ko (59 Ko compressés)** |
| Onglet Catégories | 73 ms de blocage | **0 ms** |
| Fermeture du portail sans modification | rechargement complet de l'appli | **aucune requête** |

## Ce qui a changé

- **Liste virtualisée** (seules les lignes visibles existent, jamais plus d'une cinquantaine), lignes mémorisées, vignettes réduites et mises en cache, recherche différée et sans accents (`cafe` trouve `Café`), filtre de catégorie calculé une seule fois.
- **Colonnes légères** pour la liste ; la **fiche complète** est lue en base à l'ouverture d'une adresse. Tant qu'elle n'est pas arrivée, le formulaire est **verrouillé** (bandeau « Chargement de la fiche complète… », bouton Réessayer) : sinon un enregistrement aurait effacé les descriptions et la galerie. Au passage, la fiche affichée est toujours celle de la base (avant : celle de la liste, possiblement périmée).
- **Plus de diffusion à l'appli** pendant la session. L'accueil se rafraîchit **une seule fois**, à la fermeture, et **seulement** si une écriture du catalogue a réussi.
- Enregistrer/supprimer met la liste à jour **sur place** (plus de re-téléchargement complet).
- Les téléchargements du portail démarrent ~350 ms après l'ouverture (animation terminée) ; la liste s'affiche tout de suite avec la dernière version connue de l'appli.
- **Déverrouillage** : plus d'attente artificielle, connexion préchauffée pendant la saisie du code (requête publique minuscule), message « Connexion lente… » après 3 s.
- Recherche rapide des panneaux Chouchous/Agenda : texte normalisé calculé une seule fois par adresse.

## Bogues corrigés au passage

- **Appui « perdu » avec le clavier ouvert** : sur téléphone, avec le clavier affiché, le premier appui sur un bouton (Enregistrer, catégorie, Géocoder…) ne faisait que fermer le clavier. Tous les écrans défilants du portail ont désormais `keyboardShouldPersistTaps="handled"`.
- **Suppression ratée** (hors ligne, code refusé) : l'élément disparaissait de la liste alors qu'il existait toujours. La liste est maintenant restaurée.
- Sélecteur d'image : option `mediaTypes` passée au format actuel (l'ancienne énumération est dépréciée).

## Tests

- `adminSpotsLogic.test.ts` (5) : colonnes de la liste, recherche, libellé de catégorie, mises à jour locales.
- `adminPortalPerformance.test.ts` (7) : garde-fous (liste virtualisée, colonnes légères, aucune diffusion, rafraîchissement conditionnel, fiche complète avant modification et formulaire verrouillé, clavier, restauration après échec, déverrouillage). **Contrôle par sabotage** : en réintroduisant trois régressions, trois tests échouent.
- Total : **137 tests unitaires**, **116 tests SQL**, Python, types, paquet Android (Hermes) fabriqué.
- Vérifié dans un navigateur (taille téléphone, serveur de vérification simulé, écritures simulées : la vraie base n'a pas été modifiée) : ouverture, défilement (23 à 50 lignes montées sur 789), recherche, filtre de catégorie, ouverture d'une fiche (descriptions conservées à l'enregistrement : 598 caractères réécrits à l'identique), mise à jour sur place, un seul rafraîchissement à la fermeture, aucune requête à la fermeture sans modification, tous les onglets.

## Non vérifié sur appareil réel

- Le comportement natif de la liste virtualisée (Android/iOS) : standard, mais mesuré uniquement sur le web.
- Le clavier qui recouvre les champs du bas dans la fenêtre du portail sur Android récent : **non traité** (pas de `KeyboardAvoidingView` ajouté sans pouvoir le tester).
- Les temps réels sur un vrai téléphone : à chronométrer sur le S10e.
