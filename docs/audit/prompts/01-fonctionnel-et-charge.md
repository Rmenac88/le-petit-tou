# Mission F — Audit fonctionnel complet et capacité de charge

Préfixe des constats : **F-xx**. Rapport à écrire : `docs/audit/10-FONCTIONNEL-ET-CHARGE.md`.
Lis d'abord `00-contexte-commun.md`.

## Objectif
Établir si l'application fonctionne **sans casse** sur tous ses parcours, y compris les cas limites, et si l'architecture
peut **accueillir plusieurs milliers d'utilisateurs** (visée : 5 000 installations actives, pics de 500 connexions simultanées lors d'une soirée ou d'un envoi de notification).

## Méthode

### 1. Inventaire exhaustif des fonctionnalités (à produire en tableau, avec le fichier source de chacune)
Parcours le code (`src/app`, `src/components`, `src/components/views`, `src/lib`) et liste **tout** ce qu'une personne peut faire :
onglets et leurs états (chargement / vide / erreur / hors ligne), recherche et filtres (catégorie, budget, tags), carte (groupes, 3D, itinéraire, position refusée),
fiche d'adresse (photos, likes, partage, appel, site, itinéraire), profil (carte « Pass privilège », points, découvertes, listes, effacement des données),
offres et cartes de réduction (usage, quotas), agenda (jour, répétition hebdomadaire, fuseau), notifications (choix initial, réglages, refus système),
partenaires sponsorisés, « chouchous », thème d'accueil, intro, portail admin (chaque onglet et chaque écriture), deep links et liens sortants.
Pour chaque fonctionnalité : parcours nominal + au moins deux cas limites (données vides, réseau coupé, très long texte, valeur inattendue de la base, double appui, retour arrière, rotation, application mise en arrière-plan).

### 2. Exécution
- `npm run test:all` : consigne les nombres exacts, et **identifie ce qui n'est PAS couvert** par ces tests (tableau fonctionnalités × tests).
- Les tests SQL (PGlite) prouvent la logique serveur, pas l'interface : dis-le.
- Écris, **dans ton rapport seulement**, des scénarios de test manuels précis (étapes, résultat attendu) pour les parcours non couverts ; n'ajoute pas de fichier de test à l'application.
- Cherche activement les défauts par lecture de code : état partagé non protégé, `useEffect` sans nettoyage, promesses sans `catch`, `JSON.parse` sans protection, division par zéro,
  accès à `undefined` sur des données de base incomplètes (colonnes absentes, `null`), dates et fuseaux (Europe/Paris, passage à l'heure d'hiver le 25 octobre), tri/filtres sur des chaînes accentuées, listes très longues, courses entre requêtes, mémoire (images, WebView).
- Vérifie la dégradation gracieuse quand une migration SQL n'est pas encore appliquée (013, 014, 015, 016 ne le sont pas en production : mesure ce que voit l'utilisateur).

### 3. Capacité de charge (calcul et mesures en lecture seule)
- Mesure en lecture seule ce que télécharge un lancement à froid : nombre de requêtes, taille de chaque réponse (`curl -s -w '%{size_download}'`), temps de réponse, avec et sans cache.
- Estime, **avec ta méthode écrite**, le trafic pour 5 000 utilisateurs actifs par mois et 500 simultanés : requêtes/s, volume sortant, stockage d'images (taille moyenne × nombre d'adresses × lancements).
- Compare aux limites du plan Supabase **actuel (gratuit)** et du plan payant. Vérifie ces limites sur la documentation officielle (Supabase) au moment de l'audit et cite la page ; si tu ne peux pas la consulter, écris `NON VÉRIFIÉ`.
  Points à chiffrer : connexions simultanées, bande passante sortante du stockage (images), connexions anonymes, taille de base, mise en pause d'un projet inactif, sauvegardes.
- Cherche les goulots : requête qui ramène tout le catalogue à chaque lancement, absence de pagination, images non redimensionnées, absence de CDN/cache, appels répétés (polling), planificateur d'envoi (`lpt-push-tick` chaque minute) et envoi à des milliers de jetons (lots Expo de 100, limites de débit Expo), verrou anti force brute **global** (N-09), RPC coûteuses, index manquants (examine `EXPLAIN` raisonné sur les requêtes des scripts SQL).
- Donne un **verdict chiffré** : à partir de quel nombre d'utilisateurs quel composant sature, et ce qu'il faut changer (plan, cache, redimensionnement d'images, pagination) pour atteindre 5 000 puis 20 000.

## Définition de « terminé »
Inventaire complet (aucune fonctionnalité du code absente du tableau), tests exécutés avec sorties, au moins 10 scénarios manuels rédigés, un tableau de capacité avec hypothèses explicites, et la liste des constats F-xx classés.
