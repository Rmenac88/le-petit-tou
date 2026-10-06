# Design system — Le Petit Tou

Source de vérité : `src/constants/brand.ts`. Aucune couleur, taille de texte ou rayon « en dur » dans les composants : on importe les tokens.

## Couleurs (`Brand`)
| Token | Valeur | Usage |
|---|---|---|
| `primary` | `#E84A5F` | Rose brique : identité, icônes d'action, gros boutons (≥ 18 px gras) |
| `primaryDeep` | `#C93049` | **Fond de tout bouton/badge à petit texte blanc** (5,25:1) et texte rose (AA) |
| `primarySoft` / `primarySofter` | `#FDECEF` / `#FCE4E8` | Surfaces douces (critique du Petit Tou, pastilles) |
| `chouchou` | `#F2B835` | Label « Chouchou » (texte dessus : `ink`, 9,6:1) |
| `ink` | `#1A1A22` | Titres, texte principal |
| `inkSoft` | `#6A6A78` | **Tout texte secondaire** (5,3:1 sur blanc) |
| `inkMute` | `#9A9AA8` | Icônes décoratives et états désactivés uniquement (2,8:1, jamais pour du texte) |
| `bg` / `white` | `#F8F9FA` / `#FFFFFF` | Fond d'écran / surfaces |
| `line` | `#ECE6EA` | Filets et bordures |
| `night` / `nightMid` / `violet` | `#2B1D46` / `#3A235C` / `#6C4AB6` | Violet sidéral : bandeau d'accueil, carte privilège, intro |

## Typographie
- Titres : Bricolage Grotesque (700/800). Lecture : Plus Jakarta Sans (400–800). Appliquées globalement par `src/lib/typography.ts` à partir de `fontWeight`/`fontSize`.
- Échelle (`Type`) : 12 caption · 13 small · 14 body · 16 bodyLg · 18 title3 · 22 title2 · 28 title1. Formats d'affichage (hero 32, chiffres de classement 64, carte 48) hors échelle.
- Graisses : 800 réservé aux titres et badges ; 600–700 pour les libellés ; jamais 900.
- Minimum 12 px.

## Forme
- Rayons (`Radius`) : 8 · 12 · 20 · 28 · pill. Cartes = 20, pastilles/chips = pill, fiches = 28.
- Ombres douces teintées violet, jamais de noir pur ni de halo coloré.
- Icônes : Lucide uniquement, trait de 2.

## Interaction
- Cible tactile minimale 44 × 44 pt (`Touch.min`).
- Colonne de lecture centrée, 720 px maximum (`Layout.maxWidth`) ; la carte reste pleine largeur.
- Un seul bouton principal par écran ; max. 2 badges par carte.
- La fiche d'une adresse a sa propre barre d'actions : le dock se cache quand elle est ouverte.
