# Superpowers × Gemini × Le Petit Tou

@./.agents/skills/using-superpowers/SKILL.md
@./.agents/skills/using-superpowers/references/gemini-tools.md

## Directives & Workflows Superpowers
- **Cadre méthodologique** : Suivre systématiquement les skills Superpowers présents sous `.agents/skills/` (`using-superpowers`, `brainstorming`, `writing-plans`, `subagent-driven-development`, `verification-before-completion`, `systematic-debugging`).
- **Source de vérité** : Le repository `le-petit-tou` est la source de vérité absolue.
- **Architecture de données** : Toutes les adresses et cartes transitent par `placesRepository.ts`, `authService.ts`, `discoveryStore.ts` et `discountCardsStore.ts`.
- **Zéro Régression & Zéro Slop** : Toute modification doit être validée par `npx tsc --noEmit` et préserver l'intégrité visuelle Apple & Le Petit Tou.
