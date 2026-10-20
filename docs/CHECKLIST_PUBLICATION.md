# Checklist de publication — ce qui reste côté humain

Le code de la branche `chore/preparation-publication` règle ce qui est réglable dans le dépôt.
Reste ce qui demande un compte, une base de données ou un appareil réel.

## 1. Base de données (Supabase → SQL Editor)
- [ ] Lancer `src/scripts/006_push_tokens_secure.sql` (ferme `user_push_tokens`, crée les fonctions des notifications).
- [ ] Vérifier que la sauvegarde automatique est active (offre payante : le projet gratuit se met en pause).
- [ ] Encore ouvert : les autres tables (`spot_likes`, `address_views`, `place_suggestions`, …) et les écritures directes de `AdminPortalModal` (adresses, catégories, événements, partenaires) n'ont pas encore de fonctions sécurisées. À traiter avant la publication (brief §3).

## 2. Comptes et identifiants
- [ ] Apple Developer (compte Organisation → numéro D-U-N-S) et Google Play (idem, vérification).
- [ ] `eas init` puis définir `EAS_PROJECT_ID` (sans lui, les notifications restent indisponibles : l'écran l'indique).
- [ ] Secrets EAS : `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`, `GOOGLE_MAPS_ANDROID_API_KEY` (clé restreinte au package `fr.lepetittou.app`).
- [ ] Clé APNs (iOS) et FCM (Android) fournies à EAS pour les notifications.

## 3. Builds
- [ ] Build store : ne PAS définir `EXPO_PUBLIC_ENABLE_ADMIN` (l'accès bénévole est alors absent).
- [ ] Build interne pour les bénévoles : `EXPO_PUBLIC_ENABLE_ADMIN=1`.
- [ ] Tester sur vrais iPhone et Android (notifications, carte, agenda, hors-ligne).

## 4. Juridique et fiches des stores
- [ ] Relecture de la politique de confidentialité (`PrivacyPolicyModal.tsx`) et publication d'une URL publique (obligatoire pour les stores).
- [ ] Droit de republier notes et avis Google/TripAdvisor : tant que non confirmé, `Features.externalRatings` reste à `false`.
- [ ] Mention Évin / consommation d'alcool dans la fiche, âge minimum, contenu « sponsorisé » déclaré.
- [ ] Captures d'écran, description, mots-clés, questionnaire de confidentialité Apple/Google.

## 5. Envoi des notifications
`SUPABASE_SERVICE_ROLE_KEY` dans un `.env` hors dépôt, puis :
`python3 src/scripts/send_push_notification.py --title "…" --body "…" --type events`
(aucune notification publicitaire de partenaire).
