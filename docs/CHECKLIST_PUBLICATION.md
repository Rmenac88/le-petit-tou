# Checklist de publication — ce qui reste côté humain

Référence détaillée : `docs/audit/` (audit de sécurité, juridique et boutiques). Cette page n'en est que le résumé court.

## 1. Base de données (Supabase → SQL Editor)
Ordre : `002` → … → `008` (déjà lancés), puis `009` → `015` (Ryadh), puis `016`, `017`, `018` (Claude). Ne jamais rejouer un script plus ancien après `006`.
- [ ] `009` à `015` : migrations de Ryadh pas encore appliquées en production (offres, thème, listes personnelles, etc.).
- [ ] `016_hide_partner_price.sql` : ferme la lecture publique de `sponsored_partners` (le prix payé est lisible aujourd'hui). À lancer en même temps que la mise à jour de l'appli.
- [ ] `017_remove_external_ratings.sql` : **destructif**, efface les notes Google/TripAdvisor de la table `addresses`. Sauvegarde ou exporte la table avant.
- [ ] `018_purge_suggestions.sql` : purge des suggestions d'adresses après 24 mois (tenir la promesse de la politique).
- [ ] Après les scripts : `scripts/audit-prod-check.sh`, puis `scripts/audit-prod-readonly.sql` dans l'éditeur SQL.
- [ ] Historique GitHub : les notes (790) sont dans l'historique public du dépôt (commit `b6b20e5`). Les retirer demande de réécrire l'historique (force-push) : décision de l'association, à faire avant ou après avoir rendu le dépôt privé.

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
