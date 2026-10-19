# Actions à faire par toi (dans l'ordre) — audit du 19 octobre 2026

Je n'ai pas pu agir sur la base Supabase de production (pas d'accès administrateur) et je n'ai rien poussé ni publié.
Tout ce qui suit est donc à faire par toi. Les étapes 1 à 3 sont **urgentes** : la base est aujourd'hui modifiable par n'importe qui.

## Pourquoi c'est urgent (preuves du 19/10/2026, détail dans le rapport)

- Le dépôt GitHub est **public**. L'**ancien code admin** y figure dans l'historique Git et **est toujours accepté** par la base (testé : la fonction `verify_admin_access` répond `true`).
- Les tables `addresses`, `categories`, `events`, `sponsored_partners` sont **modifiables par n'importe qui** avec la clé publique de l'appli (testé par une réécriture neutre de l'identifiant d'une ligne : 1 ligne modifiée dans chacune des 4 tables).
- La table `user_place_discoveries` est **lisible par tous** (identifiants d'appareils exposés).

## Étapes

1. **Choisir un nouveau code admin** : 16 caractères minimum, aléatoire, jamais utilisé ailleurs, différent de l'ancien (gestionnaire de mots de passe).
2. **Supabase → SQL Editor** : coller `src/scripts/005_admin_secure_writes.sql` en remplaçant `CHANGE_MOI` par le nouveau code → Run → « Success ». *(Ne commite jamais cette version modifiée.)*
3. **Supabase → SQL Editor** : coller `src/scripts/006_security_lockdown.sql` → Run → « Success ». Le script est atomique : s'il échoue, rien n'est modifié.
4. **Vérifier** depuis ton terminal (lecture seule, rien n'est cassé si tout va bien) :
   ```bash
   EXPO_PUBLIC_SUPABASE_URL=https://ckesvawakxblsuhmzaeo.supabase.co \
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<la clé publique de eas.json> \
   scripts/audit-prod-check.sh
   ```
   Tous les contrôles doivent afficher `PASS`. (Pour tester aussi que l'ancien code est mort : ajoute `OLD_ADMIN_CODE=<ancien code>` avant la commande.)
5. **Supabase → Authentication → Sign In / Providers** :
   - désactiver l'inscription par **e-mail** et par **Google** (l'appli n'a aucun écran de connexion ; ils sont actuellement ouverts) ;
   - laisser « Anonymous sign-ins » **désactivé** (l'appli fonctionne avec un identifiant d'appareil ; voir S-08).
6. **Supabase → Table editor → events** : supprimer l'événement « Test » (date 2027-04-19) visible publiquement. (Je n'ai rien supprimé en production.)
7. **Mapbox** : vérifier qu'un jeton **public** (`pk.…`) restreint par URL/identifiant d'appli existe, puis le déclarer comme variable d'environnement EAS `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` (production et preview). Le jeton factice `YOUR_MAPBOX_ACCESS_TOKEN` qui était dans `eas.json` a été retiré : il aurait cassé la carte web et les itinéraires du build de production.
8. **Publier la politique de confidentialité sur une page web publique** (obligatoire pour App Store Connect et Google Play) à partir du texte de `src/components/PrivacyPolicyModal.tsx`, et faire relire par une personne compétente (durées de conservation, région d'hébergement Supabase, base légale).
9. **Décider de la conservation** : aujourd'hui rien ne purge les données anciennes (voir D-04). Choisir une durée (par exemple 24 mois d'inactivité) et l'écrire dans la politique.
10. Seulement ensuite : build de production (`eas build --profile production`), puis tests sur appareils réels (liste dans le rapport, section G).

## Ordre d'installation des scripts SQL (base neuve)

`002` → `003` → `004` → `005` (nouveau code) → `006` **en dernier, toujours**. Ne jamais rejouer un script plus ancien après 006. Les scripts qui désactivaient la sécurité (`fix_admin_and_database_schema.sql`, `fix_user_push_tokens.sql`, `merchant_system.sql`, `supabase_complete_setup.sql`) ont été neutralisés dans le dépôt.

## Ce qui change pour l'appli

- Le portail admin écrit désormais via la fonction serveur `admin_write` (code vérifié côté base, 10 échecs en 15 minutes = verrouillage 15 minutes).
- Il faut **publier la nouvelle version de l'appli en même temps que 006** : l'ancienne version ne pourra plus modifier le catalogue ni lire/écrire la progression (elle l'affichera à partir de son cache local).
- La progression et les cartes déjà enregistrées avec un identifiant d'appareil restent lisibles via les nouvelles fonctions (même identifiant). Les 3 lignes actuelles de `user_place_discoveries` restent lisibles par leur propriétaire (même identifiant d'appareil).
