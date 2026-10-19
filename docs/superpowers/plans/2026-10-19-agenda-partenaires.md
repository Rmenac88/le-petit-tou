# Agenda des partenaires Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un 5e onglet « Agenda » (dates des adresses partenaires, jour par jour) et un onglet « Agenda » dans le portail admin, avec écriture protégée côté serveur.

**Architecture:** La table `partner_events` (déjà créée, lecture publique seule) est lue directement par l'appli. Toute écriture passe par trois fonctions Supabase `SECURITY DEFINER` qui vérifient le code admin côté serveur. Les dates répétées sont calculées à l'affichage par une fonction pure (`expandOccurrences`). Le code admin vérifié est gardé en mémoire seulement.

**Tech Stack:** Expo SDK 57 / React Native 0.86 / React 19, TypeScript, Supabase (PostgREST + RPC), Lucide, tokens `src/constants/brand.ts`. Tests purs : `node --test` (Node 22.14, `--experimental-strip-types`), aucune nouvelle dépendance.

**Spec:** `docs/superpowers/specs/2026-10-19-agenda-partenaires-design.md`

## Global Constraints

- Branche de travail : `feature/agenda-partenaires` (ne pas pousser sans accord).
- Aucune couleur, taille de texte ou rayon en dur : importer `Brand`, `Type`, `Radius`, `Touch`, `Layout` de `src/constants/brand.ts` (voir `DESIGN_SYSTEM.md`).
- Texte minimum 12 px ; cibles tactiles ≥ 44 pt ; icônes Lucide, trait de 2 ; pas d'emoji dans l'interface.
- Colonne de lecture centrée, 720 px max ; le dock est de 5 onglets maximum.
- Aucune mention technique (`.env`, Supabase, code d'erreur) dans les messages affichés au public.
- Le code admin n'est **jamais** écrit dans le dépôt, ni dans le stockage local, ni dans un journal.
- Les dates sont des chaînes calendaires `YYYY-MM-DD` et des heures `HH:MM` : jamais d'objet `Date` interprété en UTC.
- `npx tsc --noEmit` doit passer sans erreur après chaque tâche.
- Commits : message en français, terminé par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, identité `-c user.name="Sohel109" -c user.email="84157443+Sohel109@users.noreply.github.com"`.

## Review Focus

Entrées et conditions non couvertes par la spec, les plus susceptibles de gêner, avec le test qui les épingle :

1. Série hebdomadaire dont `repeat_weekly_until` = `start_date` → une seule occurrence (Task 1).
2. Série qui traverse un changement de mois, d'année et le passage à l'heure d'hiver → dates exactes, pas de décalage d'un jour (Task 1).
3. Événement dont l'adresse n'existe plus (ou pas encore chargée) → carte omise, aucun plantage (Task 4).
4. Supabase en pause ou réseau coupé → état « Agenda indisponible » + « Réessayer », jamais de message technique (Task 4).
5. Portail admin rouvert sans code en mémoire, ou code erroné → écriture refusée avec message clair, jamais de faux succès ; heure de fin avant l'heure de début refusée au formulaire (Tasks 3 et 5).

---

### Task 1: Calcul des occurrences (logique pure)

**Files:**
- Create: `src/lib/agendaOccurrences.ts`
- Create: `src/lib/__tests__/agendaOccurrences.test.ts`
- Modify: `package.json` (script `test:agenda`), `tsconfig.json` (exclure `src/lib/__tests__`)

**Interfaces:**
- Produces (all exported from `src/lib/agendaOccurrences.ts`, aucune dépendance React/Supabase) :
  - `interface PartnerEventRow { id: string; spot_id: string; title: string; description?: string | null; start_date: string; start_time: string; end_time?: string | null; repeat_weekly_until?: string | null; location_override?: string | null; link_url?: string | null; is_active: boolean }`
  - `interface Occurrence { event: PartnerEventRow; occurrenceDate: string; isRecurring: boolean }`
  - `addDays(isoDate: string, days: number): string`
  - `expandOccurrences(events: PartnerEventRow[], rangeStart: string, rangeEnd: string): Occurrence[]` (bornes incluses ; tri par date puis `start_time`)
  - `buildDayStrip(todayIso: string, count: number): string[]` (`count` jours à partir d'aujourd'hui)
  - `weekdayLabel(isoDate: string): string` (« lundi » … « dimanche », en minuscules)
  - `isValidTimeRange(start: string, end?: string | null): boolean` (vrai si `end` absent ou strictement après `start`)

- [ ] **Step 1: Écrire les tests qui échouent** dans `src/lib/__tests__/agendaOccurrences.test.ts` (`node:test` + `node:assert/strict`, import `../agendaOccurrences.ts`) : `addDays('2026-10-30', 3) === '2026-11-02'` ; `addDays('2026-12-30', 3) === '2027-01-02'` ; `addDays('2026-10-24', 2) === '2026-10-26'` (passage à l'heure d'hiver le 2026-10-25) ; événement ponctuel dans l'intervalle → 1 occurrence `isRecurring === false` ; ponctuel hors intervalle → 0 ; hebdomadaire du `2026-10-01` au `2026-10-29` sur l'intervalle `2026-10-01..2026-10-31` → dates `10-01, 10-08, 10-15, 10-22, 10-29` avec `isRecurring === true` ; `repeat_weekly_until === start_date` → exactement 1 occurrence ; `repeat_weekly_until` inclus (série finissant un jeudi → le dernier jeudi est présent) ; intervalle plus court que la série (`2026-10-14..2026-10-20`) → uniquement `10-15` ; série traversant le nouvel an (`2026-12-24` +7 jours) → `2026-12-31` puis `2027-01-07` ; événements `is_active: false` ignorés ; tri : deux événements le même jour à `21:00` et `18:30` ressortent dans l'ordre `18:30`, `21:00` ; `buildDayStrip('2026-10-30', 3)` → `['2026-10-30','2026-10-31','2026-11-01']` ; `weekdayLabel('2026-10-22') === 'jeudi'` ; `isValidTimeRange('19:00','23:00') === true`, `('19:00','19:00') === false`, `('19:00','18:00') === false`, `('19:00', null) === true`.
- [ ] **Step 2: Ajouter le script** `"test:agenda": "node --experimental-strip-types --test src/lib/__tests__/agendaOccurrences.test.ts"` dans `package.json` et `"exclude": ["node_modules", "src/lib/__tests__"]` dans `tsconfig.json` (conserver les autres options).
- [ ] **Step 3: Lancer** `npm run test:agenda`. Attendu : échec (module introuvable).
- [ ] **Step 4: Implémenter** `src/lib/agendaOccurrences.ts` avec les signatures ci-dessus, en syntaxe TypeScript effaçable (pas d'`enum`, pas de propriété de paramètre). Les dates se manipulent par `Date.UTC(y, m - 1, d)` + ajout de `days * 86400000` puis reformatage `YYYY-MM-DD` en UTC (jamais de fuseau local).
- [ ] **Step 5: Lancer** `npm run test:agenda`. Attendu : tous les tests passent.
- [ ] **Step 6: Commit** — `git add src/lib/agendaOccurrences.ts src/lib/__tests__ package.json tsconfig.json` — « Agenda : calcul des occurrences (dates répétées) ».

### Task 2: Scripts SQL (table documentée + écriture sécurisée)

**Files:**
- Create: `src/scripts/004_partner_events.sql` (copie fidèle de ce qui a déjà été exécuté : table, contrainte `partner_events_repeat_check`, deux index, RLS activée, politique « Lecture publique agenda partenaires »)
- Create: `src/scripts/005_admin_secure_writes.sql`

**Interfaces:**
- Produces (côté Supabase, après exécution manuelle de `005`) :
  - table `admin_secrets(key text primary key, value text not null)`, RLS activée, aucune politique ;
  - `verify_admin_access(access_code text) returns boolean` réécrite : branche `admin_users` conservée, sinon `encode(extensions.digest(trim(access_code),'sha256'),'hex') = (select value from admin_secrets where key = 'admin_code_sha256')` ; aucun code en clair ;
  - `admin_list_partner_events(p_code text) returns setof public.partner_events` (toutes les lignes, triées par `start_date`) ;
  - `admin_save_partner_event(p_code text, p_event jsonb) returns public.partner_events` (insère si `p_event->>'id'` absent, sinon met à jour ; champs acceptés : `spot_id, title, description, start_date, start_time, end_time, repeat_weekly_until, location_override, link_url, is_active` ; refuse si `title` ou `spot_id` vide, si `end_time <= start_time`, ou si `repeat_weekly_until < start_date` ; l'identifiant n'est jamais modifiable) ;
  - `admin_delete_partner_event(p_code text, p_id uuid) returns integer` (nombre de lignes supprimées) ;
  - chaque fonction `SECURITY DEFINER`, `set search_path = public, extensions`, lève `exception 'forbidden'` si `verify_admin_access(p_code)` est faux ; `revoke all … from public` puis `grant execute … to anon, authenticated`.
- Le script `005` contient en tête une variable `v_code text := 'CHANGE_MOI';` (bloc `do $$`) qui écrit l'empreinte dans `admin_secrets` ; il **refuse de s'exécuter** (`raise exception`) tant que la valeur vaut `CHANGE_MOI` ou fait moins de 16 caractères. Le nouveau code n'est écrit nulle part dans le dépôt.

- [ ] **Step 1: Écrire `004_partner_events.sql`** (identique au script exécuté le 2026-10-19).
- [ ] **Step 2: Écrire `005_admin_secure_writes.sql`** selon l'Interfaces ci-dessus, avec en commentaire d'en-tête les trois consignes à l'utilisateur : (1) remplacer `CHANGE_MOI` par un nouveau code long, (2) coller dans Supabase → SQL Editor → Run, (3) ne pas commiter la version modifiée.
- [ ] **Step 3 (action utilisateur, guidée) :** l'utilisateur exécute `005` avec son nouveau code. Résultat attendu : « Success. No rows returned ».
- [ ] **Step 4: Vérifier côté serveur** (avec la clé publique, depuis le `.env`) :
  - `POST /rest/v1/rpc/admin_list_partner_events` avec `{"p_code":"mauvais"}` → HTTP 400/403 et message contenant `forbidden` ;
  - même appel avec l'**ancien** code (celui de l'ancienne fonction) → `forbidden` (preuve de la rotation) ;
  - appel avec le nouveau code (fourni par l'utilisateur pour ce test, non conservé) → HTTP 200 et `[]` ;
  - `POST /rest/v1/partner_events` anonyme → toujours 401 / `42501`.
- [ ] **Step 5: Commit** — `git add src/scripts/004_partner_events.sql src/scripts/005_admin_secure_writes.sql` (jamais avec le vrai code) — « Agenda : scripts SQL (table + écriture protégée) ».

### Task 3: Accès aux données (`partnerEventsStore`)

**Files:**
- Create: `src/lib/partnerEventsStore.ts`

**Interfaces:**
- Consumes: `supabase` de `src/lib/supabase.ts` ; `PartnerEventRow`, `isValidTimeRange` de Task 1 ; fonctions RPC de Task 2.
- Produces:
  - `class AgendaError extends Error { kind: 'forbidden' | 'network' | 'invalid' }`
  - `fetchPublicPartnerEvents(todayIso: string): Promise<PartnerEventRow[]>` — lignes actives dont `repeat_weekly_until >= todayIso` ou `start_date >= todayIso` (filtre PostgREST `.or(...)`), triées par `start_date` ; lève `AgendaError('network')` si Supabase renvoie une erreur
  - `adminListPartnerEvents(code: string): Promise<PartnerEventRow[]>`
  - `adminSavePartnerEvent(code: string, event: Pick<PartnerEventRow,'spot_id'|'title'|'start_date'|'start_time'> & Partial<PartnerEventRow>): Promise<PartnerEventRow>` — valide `isValidTimeRange` avant l'appel (`AgendaError('invalid')` avec message en français), traduit `forbidden` en `AgendaError('forbidden')`
  - `adminDeletePartnerEvent(code: string, id: string): Promise<number>` (`AgendaError('forbidden')` si refusé ; renvoie le nombre de lignes supprimées)

- [ ] **Step 1: Implémenter le fichier** avec les signatures ci-dessus. Les messages d'`AgendaError` sont en français, sans terme technique.
- [ ] **Step 2: Vérifier** `npx tsc --noEmit` (aucune erreur).
- [ ] **Step 3: Vérifier à la main** (Node, avec le `.env`) que `fetchPublicPartnerEvents` équivalent PostgREST renvoie `[]` et que l'appel `admin_list_partner_events` avec un mauvais code est traduit en `forbidden` (réutilise les commandes de Task 2 Step 4).
- [ ] **Step 4: Commit** — « Agenda : accès aux données (lecture publique + fonctions admin) ».

### Task 4: Onglet Agenda (côté public)

**Files:**
- Create: `src/components/views/AgendaView.tsx`
- Create: `src/components/views/agenda/DayStrip.tsx`
- Modify: `src/components/FloatingDock.tsx` (`TabType` + onglet `{ type: 'agenda', icon: CalendarDays }`, ordre : home, search, **agenda**, map, cards), `src/app/index.tsx` (état `hasVisitedAgenda`, montage différé identique à `search`/`cards`, colonne `styles.column`, `onToggleDock={setIsDockVisible}`)

**Interfaces:**
- Consumes: `fetchPublicPartnerEvents`, `AgendaError` (Task 3) ; `expandOccurrences`, `buildDayStrip`, `weekdayLabel`, `Occurrence` (Task 1) ; `AddressDetailModal`, `SpotDetail` ; `dataset.addresses` / `dataset.categories` ; `supabase.from('addresses')`.
- Produces: `export default function AgendaView(props: { onToggleDock?: (visible: boolean) => void })` ; `DayStrip(props: { days: string[]; selected: string; markedDays: Set<string>; onSelect: (iso: string) => void })`.

- [ ] **Step 1: Dock et racine.** Ajouter `'agenda'` à `TabType`, l'onglet avec `accessibilityLabel` `tab-agenda`, et le montage différé dans `index.tsx`. Vérifier `npx tsc --noEmit`.
- [ ] **Step 2: `DayStrip`** : 14 jours, défilement horizontal, jour sélectionné fond `Brand.primaryDeep` + texte `Brand.white`, pastille `Brand.chouchou` de 6 px sous les jours de `markedDays`, chaque jour ≥ 44 × 56 pt, libellé « lun. 20 » (`Type.small`).
- [ ] **Step 3: `AgendaView`** : à l'ouverture, charge les événements (`fetchPublicPartnerEvents(today)`) puis les adresses concernées (`dataset.addresses` + `supabase.from('addresses').select('*').in('id', spotIds)` pour compléter) ; calcule les occurrences sur `buildDayStrip(today, 14)` ; sélectionne aujourd'hui ; puces de catégories (`dataset.categories`, « Tout » par défaut) ; une carte par occurrence : photo de l'adresse (`PLACEHOLDER_PHOTO` si absente), nom de l'adresse, titre, `start_time`(–`end_time`), lieu (`location_override` sinon `address`), tag « chaque {weekdayLabel} » si `isRecurring`. Toucher une carte ouvre `AddressDetailModal` ; `onToggleDock(!detail)` cache le dock pendant l'ouverture.
- [ ] **Step 4: États.** Chargement : trois cartes squelettes (`Brand.line`). Vide : logo `logo-transparent.png` + « Rien de prévu ce jour-là ». Erreur (`AgendaError`) : « Agenda indisponible pour le moment » + bouton « Réessayer » (relance le chargement) ; aucun texte technique. Occurrence dont l'adresse est introuvable : carte omise sans erreur.
- [ ] **Step 5: Vérifier** `npx tsc --noEmit`, puis sur le simulateur iOS : onglet visible dans le dock (5 icônes, aucune ne déborde), état vide affiché (la table est vide), et état d'erreur obtenu en coupant temporairement `EXPO_PUBLIC_SUPABASE_URL` (puis restaurer le `.env`). Capture d'écran de chaque état.
- [ ] **Step 6: Commit** — « Agenda : onglet public (bandeau de jours, liste, états) ».

### Task 5: Onglet Agenda de l'admin (écriture protégée)

**Files:**
- Create: `src/components/admin/AgendaAdminPanel.tsx`
- Modify: `src/components/AdminPasswordModal.tsx` (`onSuccess: (code: string) => void` ; suppression de `MASTER_HASH`, de `computeHash` et des deux branches de secours qui les utilisent), `src/components/views/HomeView.tsx` (garder le code reçu en mémoire dans un `useRef<string>`, le passer en prop `adminCode` à `AdminPortalModal`, l'effacer à la fermeture), `src/components/AdminPortalModal.tsx` (prop `adminCode?: string`, onglet `'agenda'` « Agenda (n) » qui affiche `<AgendaAdminPanel adminCode={adminCode} spots={spots} />`)

**Interfaces:**
- Consumes: `adminListPartnerEvents`, `adminSavePartnerEvent`, `adminDeletePartnerEvent`, `AgendaError` (Task 3) ; `isValidTimeRange`, `weekdayLabel` (Task 1) ; `spots` (liste des adresses déjà chargée par le portail).
- Produces: `AgendaAdminPanel(props: { adminCode?: string; spots: any[]; onCountChange?: (n: number) => void })`.

- [ ] **Step 1: Mot de passe.** Passer le code vérifié à `onSuccess(code)` ; supprimer le secours par empreinte locale. Conséquence assumée : sans réseau, l'admin ne se déverrouille plus (message « Clé d'accès incorrecte » inchangé).
- [ ] **Step 2: Transmission en mémoire.** `HomeView` stocke le code dans un `useRef` (pas d'état persisté, pas de `console.log`), le passe à `AdminPortalModal`, et le remet à `''` quand le portail se ferme.
- [ ] **Step 3: `AgendaAdminPanel` — liste.** Charge `adminListPartnerEvents(adminCode)` ; sans `adminCode`, affiche « Reconnecte-toi à l'admin pour gérer l'agenda » ; chaque ligne : nom de l'adresse, titre, prochaine date, tag « chaque {jour} jusqu'au {date} » ou « terminé », état actif, et « Adresse introuvable » en alerte si `spot_id` ne correspond à aucune adresse de `spots` ; actions (cibles 44 pt) : modifier, activer/désactiver (`adminSavePartnerEvent` avec `is_active`), retirer (modale de confirmation, puis `adminDeletePartnerEvent`). Toute erreur `forbidden` affiche « Code admin refusé : reconnecte-toi » ; jamais de succès affiché sans réponse valide du serveur.
- [ ] **Step 4: `AgendaAdminPanel` — formulaire.** Sélecteur d'adresse avec recherche parmi `spots` (même interaction que le sélecteur d'adresse du formulaire des partenaires), titre, description, date (`YYYY-MM-DD`), heure de début, heure de fin, case « Répéter chaque semaine » + date de fin de série, lieu précis, lien. Refuse l'envoi si `isValidTimeRange` est faux ou si la date de fin de série précède la date de début, avec un message en français sous le champ. Mode modification (remplit le formulaire, bouton « Annuler »).
- [ ] **Step 5: Vérifier** `npx tsc --noEmit`. Puis test de bout en bout sur le simulateur, **avec un événement bidon** : ouvrir l'admin (7 appuis sur le logo, nouveau code), créer « Test agenda » hebdomadaire sur 3 semaines, vérifier qu'il apparaît dans l'onglet Agenda public sur les 3 jours attendus, le désactiver (disparaît du public), le modifier, puis le retirer. Vérifier aussi : mauvais code → refus ; fermer/rouvrir le portail sans ressaisir le code → message « Reconnecte-toi ».
- [ ] **Step 6: Commit** — « Agenda : onglet admin (ajout, modification, retrait) et code admin gardé en mémoire ».

### Task 6: Charte, vérification finale et clôture

**Files:**
- Modify: `DESIGN_SYSTEM.md` (une ligne : 5 onglets, onglet Agenda)

- [ ] **Step 1: Charte.** Ajouter la ligne dans la section « Interaction » de `DESIGN_SYSTEM.md`. Vérifier qu'aucune couleur hexadécimale n'a été écrite en dur dans les fichiers créés (`grep -nE "#[0-9A-Fa-f]{6}" src/components/views/AgendaView.tsx src/components/views/agenda src/components/admin` → aucune ligne).
- [ ] **Step 2: Contrôles.** `npm run test:agenda` (tous passent), `npx tsc --noEmit` (aucune erreur), recherche d'une fuite du code admin : `git grep -n "CHANGE_MOI"` ne doit trouver que le script `005` ; l'ancien code ne doit plus apparaître dans les fichiers modifiés.
- [ ] **Step 3: Contrôle visuel final** sur le simulateur : onglet Agenda (vide, avec un événement, erreur), 5 icônes du dock non rognées, fiche ouverte depuis l'agenda (dock caché), onglet admin.
- [ ] **Step 4: Commit** — « Agenda : charte et vérifications finales ». Résumé à l'utilisateur de ce qui reste à sa charge : exécuter `005` (si ce n'est pas fait), supprimer l'événement bidon, décider de la publication (aucun push sans accord).
