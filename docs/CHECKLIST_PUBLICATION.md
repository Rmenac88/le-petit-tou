# Checklist de publication — ce qui reste côté humain

Référence détaillée : `docs/audit/` (audit de sécurité, juridique et boutiques). Cette page n'en est que le résumé court.

## 1. Base de données (Supabase → SQL Editor)
Ordre : `002` → `003` → `004` → `005` (avec ton code admin) → `006` → `007` → `008` → `009`. Ne jamais rejouer un script plus ancien après `006`.
- [x] 006, 007, 008 : déjà lancés en production (21/10).
- [ ] `009_hide_partner_price.sql` : ferme la lecture publique de `sponsored_partners` (le prix payé était lisible) et crée la vue publique. **À lancer en même temps que la mise à jour de l'appli** : une ancienne version de l'appli ne verrait plus les partenaires.
- [ ] Vérifier après 009 : `scripts/audit-prod-check.sh`.

## 2. Décisions ouvertes (voir `docs/audit/04-SUIVI-2026-10-21.md`)
- [ ] N-09 : verrouillage anti force brute global (10 mauvais codes bloquent tout le monde 15 min).
- [ ] N-10 : envoi des photos du portail avec la clé publique (Edge Function à prévoir).
- [ ] N-12 : supprimer l'événement « test » de la table `events` depuis le portail admin.
- [ ] N-14 : tables et fonctions héritées (`spots`, `reviews`, …) : lancer `scripts/audit-legacy-diagnostic.sql`.
- [ ] Texte du partenaire existant (« Offre exclusive membre – 150 € ») : à réécrire dans le portail admin, sans mention de prix ni d'avantage.

## 3. Comptes et identifiants
- [ ] Apple Developer (Organisation, D-U-N-S) et Google Play (vérification, 12 testeurs pendant 14 jours pour un compte personnel).
- [ ] Secrets EAS : Supabase, Mapbox (jeton public restreint), clé Google Maps Android, FCM/APNs.

## 4. Builds et accès admin
- [ ] Build store : ne PAS définir `EXPO_PUBLIC_ENABLE_ADMIN` (l'accès bénévole est alors absent).
- [ ] Build interne pour les bénévoles : `EXPO_PUBLIC_ENABLE_ADMIN=1`.
- [ ] Tests sur vrais iPhone et Android (liste : `docs/audit/04-SUIVI-2026-10-21.md` §5).

## 5. Juridique et boutiques
- [ ] Analyse écrite de l'éventuelle violation de données (RGPD art. 33, délai de 72 h) : décision du responsable du traitement.
- [ ] Compléter les champs `[À COMPLÉTER]` de `public/` et héberger ces pages.
- [ ] Notes Google/TripAdvisor : `Features.externalRatings` reste à `false` tant que le droit de les republier n'est pas confirmé.
- [ ] Mention Évin, classe d'âge, déclarations de confidentialité Apple/Google.
