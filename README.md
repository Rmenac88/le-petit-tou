# Le Petit Tou 🏠

Bienvenue dans le dépôt officiel de l'application **Le Petit Tou** ! Cette application mobile et web moderne et responsive en style **Neo-Brutalist** propose une carte interactive de Toulouse, un portail administrateur sécurisé, un scanner de billets d'événements et un système complet de notifications push.

---

## 🚀 Guide d'installation et de lancement local

Suivez ces étapes pour installer et exécuter l'application sur votre ordinateur.

### 1. Cloner le projet
Dans votre terminal, clonez ce dépôt puis placez-vous dans le dossier :
```bash
git clone https://github.com/Rmenac88/le-petit-tou.git
cd le-petit-tou
```

### 2. Installer les dépendances
Installez tous les modules Node nécessaires :
```bash
npm install
```

### 3. Configurer la base de données (Supabase)
Pour des raisons de sécurité, le fichier contenant les clés secrètes n'est pas poussé sur le dépôt.
1. Créez un fichier nommé **`.env`** à la racine du projet.
2. Copiez le contenu de `.env.example` ou collez directement ceci :
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://votre-id-de-projet.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anonyme-anon-key-ici
   ```
3. Remplacez les valeurs par les coordonnées de votre propre projet de base de données Supabase.

### 4. Lancer le serveur de développement
Démarrez le bundler Expo :
```bash
npm start
```

*   **Pour lancer la version Web :** Appuyez sur la touche **`w`** dans le terminal pour l'ouvrir dans votre navigateur.
*   **Pour lancer sur Mobile (Expo Go) :** Téléchargez l'application **Expo Go** sur votre smartphone, puis scanne le QR code affiché dans le terminal (les deux appareils doivent être connectés sur le même Wi-Fi).

> 💡 **Astuce si le Wi-Fi bloque :** Si vous n'êtes pas sur le même réseau Wi-Fi ou si la connexion échoue, lancez le serveur en mode tunnel :
> ```bash
> npx expo start --tunnel --clear
> ```

---

## 🛠️ Schéma SQL de la Base de Données

Pour que toutes les fonctionnalités de billetterie, de notifications et d'adresses fonctionnent, exécutez ce script SQL dans l'onglet **SQL Editor** de votre console Supabase :

```sql
-- 1. Table des adresses
create table if not exists public.spots (
  id text primary key,
  name text not null,
  description text,
  lat double precision not null,
  lng double precision not null,
  category text not null,
  ambiance text not null,
  price_min integer default 10,
  price_max integer default 50,
  is_open_now boolean default true,
  image_url text,
  video_url text,
  average_rating numeric(3,2) default 4.5,
  review_count integer default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Table des favoris
create table if not exists public.user_favorites (
  user_id uuid references auth.users(id) on delete cascade,
  spot_id text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  primary key (user_id, spot_id)
);

-- 3. Table des événements
create table if not exists public.events (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  event_date date not null,
  event_time text not null,
  location text not null,
  price numeric(10, 2) default 0.00 not null,
  max_participants integer default 100,
  image_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Table des inscriptions / billets
create table if not exists public.event_registrations (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  ticket_number text unique,
  payment_status text default 'paid' not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Table des tokens push et préférences
create table if not exists public.user_push_tokens (
  device_id text primary key,
  user_id uuid references auth.users(id) on delete cascade,
  push_token text not null,
  notify_new_events boolean default true not null,
  notify_new_spots boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. File d'attente des push notifications
create table if not exists public.notification_queue (
  id uuid default gen_random_uuid() primary key,
  push_token text not null,
  title text not null,
  body text not null,
  data jsonb,
  status text default 'pending' not null,
  error_message text,
  send_after timestamp with time zone default timezone('utc'::text, now()) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sent_at timestamp with time zone
);

-- Index pour accélérer la file d'attente
create index if not exists idx_notification_queue_pending 
on public.notification_queue(status, send_after) 
where status = 'pending';

-- Désactiver la sécurité RLS pour le prototype
alter table public.user_favorites disable row level security;
alter table public.spots disable row level security;
alter table public.events disable row level security;
alter table public.event_registrations disable row level security;
alter table public.user_push_tokens disable row level security;
alter table public.notification_queue disable row level security;
```

---

## 🎨 Fonctionnalités Principales

*   🗺️ **Carte Interactive (Toulouse) :** Leaflet (Web) et react-native-maps (Mobile) avec pins personnalisés selon la catégorie.
*   🔑 **Portail Membre Admin Secret :** Authentification brutale par code secret sur le profil. Permet de scanner des billets en direct et de publier des événements ou des adresses avec géolocalisation automatique et importation photo/vidéo.
*   📷 **Scanner Caméra Intégré :** Flux vidéo live et laser d'animation de scan pour la validation en temps réel des QR codes de billets.
*   🎫 **Billetterie & Inscriptions :** Réservation, génération de billets uniques et annulation en temps réel sur le compte utilisateur.
*   📲 **Notifications Push :** Préférences personnalisables avec triggers SQL automatiques lors de la publication de nouveautés.
