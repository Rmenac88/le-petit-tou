# Agenda des partenaires — design

Date : 2026-10-19 · Statut : à relire avant plan d'implémentation

## Objectif

Donner aux utilisateurs un endroit unique pour voir **les dates des entreprises partenaires** (soirées, happy hours, offres…), et donner aux bénévoles un outil dans l'admin pour les gérer.

Réponses de cadrage (validées avec le commanditaire) :

| Question | Décision |
|---|---|
| Qui saisit les dates ? | Les bénévoles, depuis l'admin. Pas de compte partenaire. |
| Où est l'agenda ? | Nouvel onglet « Agenda » (5e) dans le dock. |
| Forme de l'écran | Bandeau de jours + liste des événements du jour. |
| Répétition | Dates ponctuelles + répétition chaque semaine jusqu'à une date. |
| Quelles entreprises ? | N'importe quelle adresse du guide (les 790), choisie dans l'admin. |

Hors périmètre (volontaire) : comptes et accès partenaires, notifications/rappels, ajout au calendrier du téléphone, vue mensuelle, récurrences autres qu'hebdomadaires, lien avec la billetterie.

## Distinction avec l'existant

- `events` = événements **de l'association** (billetterie, prix, places). Inchangé.
- `sponsored_partners` = **Top Partenaires** de l'accueil. Inchangé.
- `partner_events` (nouveau) = dates **des adresses du guide**. Ne touche ni l'un ni l'autre.

## Données

Nouvelle table Supabase `partner_events` (script `src/scripts/004_partner_events.sql`, à exécuter dans l'éditeur SQL de Supabase) :

| Colonne | Type | Remarque |
|---|---|---|
| `id` | uuid, défaut `gen_random_uuid()` | clé primaire |
| `spot_id` | text, non nul | identifiant de l'adresse (table `addresses`) |
| `title` | text, non nul | |
| `description` | text | courte, facultative |
| `start_date` | date, non nul | première date |
| `start_time` | text (`HH:MM`), non nul | |
| `end_time` | text (`HH:MM`) | facultatif |
| `repeat_weekly_until` | date | si renseignée : l'événement revient chaque semaine, même jour, jusqu'à cette date incluse |
| `location_override` | text | lieu précis ; par défaut l'adresse de la fiche |
| `link_url` | text | facultatif |
| `is_active` | boolean, défaut true | |
| `created_at` | timestamptz, défaut now() | |

Règles d'accès (RLS) sur le modèle de `secure_admin_and_rls.sql` : lecture publique des lignes `is_active = true` ; toute écriture réservée à l'admin. Index sur `(start_date)` et `(spot_id)`.

Contraintes : `repeat_weekly_until >= start_date` quand renseignée ; `end_time` après `start_time` quand renseignée (même jour).

### Calcul des occurrences (logique pure, testée)

`src/lib/agendaOccurrences.ts` exporte `expandOccurrences(events, rangeStart, rangeEnd)` :

- Un événement sans `repeat_weekly_until` produit une occurrence si `start_date` est dans l'intervalle.
- Avec `repeat_weekly_until` : une occurrence à `start_date`, puis tous les 7 jours, jusqu'à `repeat_weekly_until` inclus, limitée à l'intervalle demandé.
- Les dates sont traitées comme des **dates calendaires locales** (chaînes `YYYY-MM-DD`), jamais comme des instants UTC, pour éviter les décalages d'un jour.
- Résultat trié par date puis heure ; chaque occurrence garde l'`id` de l'événement et sa date (`occurrenceDate`).

## Onglet Agenda (côté public)

Fichiers : `src/components/views/AgendaView.tsx` (+ petits composants dans `src/components/views/agenda/`), `src/lib/partnerEventsStore.ts`.

- **Dock** : `TabType` reçoit `'agenda'` ; icône Lucide `CalendarDays` ; 5 onglets, cibles de 44 pt, libellé d'accessibilité `tab-agenda`. Montage différé à la première visite, comme les autres onglets (`src/app/index.tsx`).
- **En-tête** : titre « Agenda » (22 px) et une phrase courte.
- **Bandeau de jours** : 14 jours glissants à partir d'aujourd'hui, défilement horizontal. Jour sélectionné en `primaryDeep` (texte blanc), pastille discrète sous les jours qui ont au moins un événement. Le jour d'aujourd'hui est sélectionné par défaut.
- **Liste du jour** : une carte par occurrence (photo de l'adresse, nom de l'adresse, titre, heure, lieu, tag « chaque jeudi » si répété). Tri par heure.
- **Filtre** : puces de catégories (réutilise les catégories de l'appli) ; « Tout » par défaut.
- **Tap sur une carte** : ouvre la fiche de l'adresse (`AddressDetailModal`), le dock se cache pendant l'ouverture.
- **États** : chargement (squelette), vide (« Rien de prévu ce jour-là » avec le logo), erreur (« Agenda indisponible pour le moment » + bouton « Réessayer »). Aucun message technique ni mention de `.env`.
- **Charte** : tokens `Brand`/`Type`/`Radius` uniquement, colonne centrée (720 px max), minimum 12 px, trait d'icône 2.

## Admin

Dans `AdminPortalModal.tsx` : nouvel onglet « Agenda (n) ».

- Liste des événements (à venir d'abord) : adresse, titre, prochaine date, tag de répétition, état actif.
- Formulaire d'ajout/modification : choix de l'adresse (recherche dans les 790, comme le sélecteur d'adresse des partenaires), titre, description, date, heure de début, heure de fin, case « Répéter chaque semaine » + date de fin, lieu précis, lien.
- Actions par ligne : modifier, activer/désactiver, retirer (confirmation).
- Chaque écriture vérifie la réponse de Supabase (`error` ou 0 ligne) ; en cas de refus (RLS), message clair, aucun faux succès (même principe que le Top Partenaires).

## Erreurs et cas limites

- Supabase indisponible ou en pause : l'onglet affiche l'état d'erreur avec « Réessayer » ; l'admin affiche le message d'erreur réel.
- Adresse liée supprimée : l'événement n'est pas affiché côté public (jointure vide) et apparaît en alerte dans l'admin.
- Série dont la date de fin est passée : n'apparaît plus ; reste visible dans l'admin (« terminé »).

## Tests

- `expandOccurrences` : événement ponctuel ; hebdomadaire sur plusieurs semaines ; passage de mois et d'année ; `repeat_weekly_until` inclus ; intervalle plus court que la série ; événement hors intervalle ; tri.
- Vérification manuelle sur le simulateur iOS : bandeau, changement de jour, filtre, tap vers la fiche, états vide/erreur, onglet admin (ajout, modification, retrait, répétition).
- `npx tsc --noEmit` sans erreur.

## Fichiers

Créés : `docs/…/2026-10-19-agenda-partenaires-design.md`, `src/scripts/004_partner_events.sql`, `src/lib/agendaOccurrences.ts` (+ test), `src/lib/partnerEventsStore.ts`, `src/components/views/AgendaView.tsx`, `src/components/views/agenda/*`.
Modifiés : `src/components/FloatingDock.tsx`, `src/app/index.tsx`, `src/components/AdminPortalModal.tsx`, `DESIGN_SYSTEM.md` (une ligne sur l'onglet).

## Points ouverts (non bloquants)

- La base distante n'est modifiable que par le script SQL lancé à la main ; tant qu'il n'est pas lancé, l'onglet affiche l'état d'erreur.
- Aucun framework de test n'est installé dans le projet : le test de `expandOccurrences` sera un script Node exécutable (`node --test`) sans nouvelle dépendance.
