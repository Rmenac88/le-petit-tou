# Le Petit Tou — Directives pour les Agents IA & Superpowers

@./.agents/skills/using-superpowers/SKILL.md

## Framework d'Ingénierie Superpowers
Ce projet est connecté au framework officiel Superpowers (`obra/superpowers`).
Tous les skills sont installés dans `.agents/skills/` :
- `using-superpowers` : Règles d'invocation des compétences d'ingénierie.
- `systematic-debugging` : Traçage des causes profondes avant toute modification.
- `subagent-driven-development` : Décomposition et revue de code multi-agents.
- `test-driven-development` : Développement guidé par les tests.
- `verification-before-completion` : Validation obligatoire avant de clore une tâche.
- `writing-plans` : Spécification des architectures et plans de refactoring.

## Règles Projet Le Petit Tou
- Expo SDK 57 / React Native 0.86 / React 19.
- Respecter scrupuleusement la charte graphique décrite dans `DESIGN_SYSTEM.md` (tokens dans `src/constants/brand.ts`) : rose brique `#E84A5F`, rose poudré `#FDECEF`, jaune Chouchou `#F2B835`, anthracite `#1A1A22`, violet sidéral `#2B1D46`. Aucune couleur, taille de texte ou rayon en dur : importer les tokens.
- Ne jamais casser la navigation, le dock flottant ni les gestes tactiles Apple Maps.
