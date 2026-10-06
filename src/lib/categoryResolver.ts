// ==============================================================================
// LE PETIT TOU — DYNAMIC CATEGORY RESOLVER & CLASSIFIER
// ==============================================================================

export const CAT_RESTAURANTS = '5cbc4fe4-d6fe-4e5d-af95-8005c333a066';
export const CAT_BARS = '71a09480-03a3-4f4f-b545-586954aa150f';
export const CAT_BOULANGERIES = '8c2d100c-6ef8-4e8c-a773-35dff93aec96';
export const CAT_EPICERIES = '82607432-b9d9-41c6-9f48-97ed533a8e2c';
export const CAT_NOCTURNE = '970ec2f9-f1c9-4bc4-97e1-087bac9f4cdd';
export const CAT_MODE = '8663316f-b328-4075-bb6d-69b4b32a1d5c';
export const CAT_BEAUTE = 'edabac3e-6bad-4c34-9dfd-3551da339e63';
export const CAT_DECO = '3641faf4-4d5d-411d-a767-e6bc7b3c7244';
export const CAT_ARTISANS = 'ab4a99b2-2f1f-4743-8e6f-93b4eff6349f';
export const CAT_CULTURE = '6d206eca-977b-4f94-9e9a-b92fc15b1394';
export const CAT_LOISIRS = 'ac3c90ae-6a65-435b-8884-5fd9e3dc82f8';
export const CAT_SPORT = 'e2a4f899-dadc-4037-bf7e-6d6663afdf14';
export const CAT_HOTELS = 'bc00b03a-ce3e-4c3d-a017-c961d39aca17';
export const CAT_SERVICES = 'd06ccd60-517e-4e10-8182-565df3285b5e';

// Legacy Parent Categories
export const PARENT_GOURMAND = 'e6134429-8d6e-5d84-bf4e-884e016df958';
export const PARENT_SHOPPING = 'dd6f9ea1-9c77-5ecb-9b8d-d085c7ea9429';
export const PARENT_TRINQUER = '61170f20-77e8-5082-8cc5-2d528e21238f';
export const PARENT_CULTURE = '27117a0e-6501-5624-ab76-830d537daf2b';
export const PARENT_SERVICES = '75f3a62d-e7b2-5559-b83d-dc97baaa2af3';

export const PARENT_CHILDREN_MAP: Record<string, string[]> = {
  [PARENT_GOURMAND]: [CAT_RESTAURANTS, CAT_BARS, CAT_BOULANGERIES, CAT_EPICERIES],
  'gourmand-gourmet': [CAT_RESTAURANTS, CAT_BARS, CAT_BOULANGERIES, CAT_EPICERIES],
  [PARENT_SHOPPING]: [CAT_MODE, CAT_BEAUTE, CAT_DECO, CAT_ARTISANS],
  'shopping-beaute': [CAT_MODE, CAT_BEAUTE, CAT_DECO, CAT_ARTISANS],
  [PARENT_TRINQUER]: [CAT_BARS, CAT_NOCTURNE],
  'trinquer-danser': [CAT_BARS, CAT_NOCTURNE],
  [PARENT_CULTURE]: [CAT_CULTURE, CAT_LOISIRS, CAT_SPORT],
  'culture-loisirs': [CAT_CULTURE, CAT_LOISIRS, CAT_SPORT],
  [PARENT_SERVICES]: [CAT_SERVICES, CAT_HOTELS],
  'vie-pratique': [CAT_SERVICES, CAT_HOTELS],
};

const SPECIFIC_CAT_IDS = new Set([
  CAT_RESTAURANTS,
  CAT_BARS,
  CAT_BOULANGERIES,
  CAT_EPICERIES,
  CAT_NOCTURNE,
  CAT_MODE,
  CAT_BEAUTE,
  CAT_DECO,
  CAT_ARTISANS,
  CAT_CULTURE,
  CAT_LOISIRS,
  CAT_SPORT,
  CAT_HOTELS,
  CAT_SERVICES,
]);

const cleanNormalize = (str: string): string => {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
};

/**
 * Classifie précisément n'importe quelle adresse dans sa catégorie idéale,
 * qu'elle provienne de Supabase, du JSON local ou qu'elle vienne d'être créée dans le portail admin.
 */
export const classifyAddress = (addr: any): string => {
  if (!addr) return CAT_RESTAURANTS;

  // Si l'adresse est déjà assignée à une sous-catégorie spécifique non-legacy, on la respecte
  if (addr.category_id && SPECIFIC_CAT_IDS.has(addr.category_id)) {
    return addr.category_id;
  }

  const title = cleanNormalize(addr.title || addr.name || '');
  const crumbs = cleanNormalize((addr.breadcrumbs || []).join(' '));
  const tags = cleanNormalize((addr.tags || []).join(' '));
  const desc = cleanNormalize(addr.description || addr.full_description || '');
  const combined = `${title} | ${crumbs} | ${tags} | ${desc}`;

  // 1. Sport & Bien-être actif
  if (
    /activites sportives|sport|fitness|keep cool|escalade|yoga|pilates|crossfit|gym|piscine|musculation|se muscler|enceintes sportives/.test(
      crumbs
    ) ||
    /keep cool|fitness|salle de sport|crossfit/.test(title)
  ) {
    return CAT_SPORT;
  }

  // 2. Beauté, Coiffure & Spa
  if (
    /instants pour soi|coiffeurs|l.ere du bien-etre|instituts de beaute|tatouages et piercings|spa/.test(
      crumbs
    ) ||
    /coiff|barbier|spa|institut de beaute|onglerie|manucure/.test(title)
  ) {
    return CAT_BEAUTE;
  }

  // 3. Loisirs & Jeux de société
  if (/jeux de societe|bars a jeux|escape game|karaoke|bowling|laser/.test(combined)) {
    return CAT_LOISIRS;
  }

  // 4. Vie Nocturne & Clubs
  if (
    /boites|boites generalistes|bars a fetards|discotheque/.test(crumbs) ||
    /boite de nuit|discotheque|clubbing/.test(title)
  ) {
    return CAT_NOCTURNE;
  }

  // 5. Boulangeries & Pâtisseries
  if (
    /patisseries et boulangeries|douceurs sucrees|boulanger|patisser|glacier|chocolat/.test(
      crumbs
    ) ||
    /boulanger|patisser|glacier|chocolatier/.test(title)
  ) {
    return CAT_BOULANGERIES;
  }

  // 6. Épiceries Fines & Terroir
  if (
    /epiceries fines|cavistes|fromager|boucheries et traiteurs|plaisirs sales|cave a vin/.test(
      crumbs
    ) ||
    /epicerie|fromagerie|boucherie|caviste|cave a vin/.test(title)
  ) {
    return CAT_EPICERIES;
  }

  // 7. Bars, Cafés & Salons de thé
  if (
    /coffee shops|boire la tasse|salons de the|bars traditionnels|bars|pubs et bars/.test(
      crumbs
    ) &&
    !/restaurants|bistrots/.test(crumbs)
  ) {
    return CAT_BARS;
  }

  // 8. Déco, Maison & Fleuristes
  if (
    /deco et ameublement|deco d.interieur|fleuristes|plaisir d.offrir/.test(crumbs) ||
    /fleuriste|deco|mobilier/.test(title)
  ) {
    return CAT_DECO;
  }

  // 9. Artisans & Créateurs locaux
  if (/couture|artisan|createur|ceramique/.test(crumbs) || /couture|artisan|ceramique/.test(title)) {
    return CAT_ARTISANS;
  }

  // 10. Services & Vie Pratique
  if (/lunettes|optique|pressing|cordonnerie|imprimerie/.test(crumbs) || /optique|pressing/.test(title)) {
    return CAT_SERVICES;
  }

  // 11. Culture, Musées & Galeries
  if (
    /culture|librairies & bouquinistes|disquaires & vinyles|musee|theatre|cinema|galeries|monuments/.test(
      crumbs
    )
  ) {
    return CAT_CULTURE;
  }

  // 12. Hôtels
  if (/hotel|hebergement|gite/.test(crumbs) || /hotel/.test(title)) {
    return CAT_HOTELS;
  }

  // 13. Fallbacks selon la catégorie parente d'origine
  if (addr.category_id === PARENT_SHOPPING) {
    return CAT_MODE;
  }
  if (addr.category_id === PARENT_TRINQUER) {
    return CAT_BARS;
  }
  if (addr.category_id === PARENT_CULTURE) {
    return CAT_CULTURE;
  }
  if (addr.category_id === PARENT_SERVICES) {
    return CAT_SERVICES;
  }

  // Par défaut : Restaurants & Gastronomie (reste de Gourmand Gourmet)
  return CAT_RESTAURANTS;
};

/**
 * Vérifie si une adresse appartient à une catégorie donnée (gère les ID spécifiques, les slugs et les catégories parentes).
 */
export const isAddressInCategory = (addr: any, categoryFilter: string | null | undefined): boolean => {
  if (!categoryFilter || categoryFilter === 'all') return true;

  const directId = addr.category_id;
  const resolvedId = classifyAddress(addr);

  // Match direct sur l'ID de catégorie résolue ou brute
  if (resolvedId === categoryFilter || directId === categoryFilter) {
    return true;
  }

  // Match sur le slug (si fourni)
  if (addr.category_slug && addr.category_slug === categoryFilter) {
    return true;
  }

  // Match sur la catégorie parente (ex: "Gourmand Gourmet" regroupe Restaurants, Bars, Boulangeries, Épiceries)
  const children = PARENT_CHILDREN_MAP[categoryFilter];
  if (children) {
    if (children.includes(resolvedId) || (directId && children.includes(directId))) {
      return true;
    }
  }

  return false;
};

/**
 * Calcule le nombre d'adresses d'une catégorie en temps réel
 */
export const getCategorySpotCount = (addresses: any[], categoryFilter: string): number => {
  if (!Array.isArray(addresses)) return 0;
  if (!categoryFilter || categoryFilter === 'all') return addresses.length;
  return addresses.filter(addr => isAddressInCategory(addr, categoryFilter)).length;
};

const LEGACY_PARENT_IDS = new Set([
  PARENT_GOURMAND,
  PARENT_SHOPPING,
  PARENT_TRINQUER,
  PARENT_CULTURE,
  PARENT_SERVICES,
]);

/**
 * Retourne la liste ordonnée des catégories populaires pour l'accueil,
 * classées par pertinence et nombre d'adresses réelles, sans doublons vides.
 */
export const getOrderedPopularCategories = (
  allCategories: any[],
  addresses: any[],
  includeParents: boolean = false
): any[] => {
  if (!Array.isArray(allCategories)) return [];

  // Exclure les 5 catégories parentes legacy si includeParents est faux
  const filtered = allCategories.filter(cat => {
    if (!includeParents && LEGACY_PARENT_IDS.has(cat.id)) return false;
    const count = getCategorySpotCount(addresses, cat.id);
    return count > 0;
  });

  // Trie par nombre décroissant d'adresses
  return filtered.sort((a, b) => {
    const countA = getCategorySpotCount(addresses, a.id);
    const countB = getCategorySpotCount(addresses, b.id);
    return countB - countA;
  });
};

export const classifySpot = (addr: any): 'food' | 'drinks' | 'shopping' | 'beauty' | 'culture' | 'sport' | 'services' => {
  const crumbs = (addr.breadcrumbs || []).join(' ').toLowerCase();
  const tags = (addr.tags || []).join(' ').toLowerCase();
  const title = (addr.title || addr.name || '').toLowerCase();

  const sportTerms = ['sport', 'fitness', 'escalade', 'yoga', 'pilates', 'gym', 'danse', 'combat', 'crossfit', 'piscine', 'musculation', 'keep cool', 'salle de sport'];
  if (sportTerms.some(spt => crumbs.includes(spt) || title.includes(spt) || tags.includes(spt))) return 'sport';

  const beautyTerms = ['coiffeur', 'barbier', 'institut de beaute', 'institut de beauté', 'spa', 'massage', 'soin du corps', 'onglerie', 'tatouage', 'piercing', 'esthetique', 'esthétique', 'epilation', 'épilation', 'bien-etre', 'bien-être'];
  if (beautyTerms.some(bt => crumbs.includes(bt) || title.includes(bt) || tags.includes(bt))) return 'beauty';

  const shoppingTerms = ['pret-a-porter', 'prêt-à-porter', 'bijoux', 'accessoire', 'friperie', 'chaussure', 'maroquinerie', 'deco', 'déco', 'mobilier', 'fleuriste', 'cadeau', 'boutique', 'mode', 'vetement', 'vêtement', 'droguerie', 'mercerie', 'optique', 'lunette', 'artisan'];
  if (shoppingTerms.some(st => crumbs.includes(st) || title.includes(st) || tags.includes(st))) return 'shopping';

  const drinkTerms = ['bar', 'cocktail', 'biere', 'bière', 'pub', 'club', 'boite de nuit', 'boîte de nuit', 'cave a vin', 'cave à vin', 'salon de the', 'salon de thé', 'coffee', 'cafe', 'café', 'brunch', 'patisserie', 'pâtisserie', 'glacier', 'boulangerie'];
  if (drinkTerms.some(dt => crumbs.includes(dt) || title.includes(dt) || tags.includes(dt))) return 'drinks';

  const cultureTerms = ['musee', 'musée', 'theatre', 'théâtre', 'cinema', 'cinéma', 'librairie', 'galerie', 'escape game', 'art', 'exposition', 'spectacle', 'visite', 'monument'];
  if (cultureTerms.some(ct => crumbs.includes(ct) || title.includes(ct) || tags.includes(ct))) return 'culture';

  const foodTerms = ['restaurant', 'bistrot', 'brasserie', 'burger', 'pizza', 'creperie', 'crêperie', 'sushi', 'tapas', 'italien', 'asiatique', 'traiteur', 'gastronomique', 'cuisine'];
  if (foodTerms.some(ft => crumbs.includes(ft) || title.includes(ft) || tags.includes(ft))) return 'food';

  const catId = addr.category_id || '';
  if (catId === 'e6134429-8d6e-5d84-bf4e-884e016df958' || catId === '5cbc4fe4-d6fe-4e5d-af95-8005c333a066' || catId === '82607432-b9d9-41c6-9f48-97ed533a8e2c') return 'food';
  if (catId === '61170f20-77e8-5082-8cc5-2d528e21238f' || catId === '71a09480-03a3-4f4f-b545-586954aa150f' || catId === '970ec2f9-f1c9-4bc4-97e1-087bac9f4cdd' || catId === '8c2d100c-6ef8-4e8c-a773-35dff93aec96') return 'drinks';
  if (catId === 'dd6f9ea1-9c77-5ecb-9b8d-d085c7ea9429' || catId === '8663316f-b328-4075-bb6d-69b4b32a1d5c' || catId === '3641faf4-4d5d-411d-a767-e6bc7b3c7244' || catId === 'ab4a99b2-2f1f-4743-8e6f-93b4eff6349f') return 'shopping';
  if (catId === 'edabac3e-6bad-4c34-9dfd-3551da339e63') return 'beauty';
  if (catId === '27117a0e-6501-5624-ab76-830d537daf2b' || catId === '6d206eca-977b-4f94-9e9a-b92fc15b1394' || catId === 'ac3c90ae-6a65-435b-8884-5fd9e3dc82f8') return 'culture';
  if (catId === 'e2a4f899-dadc-4037-bf7e-6d6663afdf14') return 'sport';
  if (catId === '75f3a62d-e7b2-5559-b83d-dc97baaa2af3' || catId === 'd06ccd60-517e-4e10-8182-565df3285b5e' || catId === 'bc00b03a-ce3e-4c3d-a017-c961d39aca17') return 'services';

  return 'food';
};

export const getBudgetInfo = (addr: any): { estimatedBudget: number; priceMin: number; priceMax: number; budgetLabel: string; priceLevel: string } => {
  const desc = `${addr.description || ''} ${addr.full_description || ''}`;
  const title = (addr.title || addr.name || '').toLowerCase();
  const fullText = `${title} ${desc}`.toLowerCase();
  const pl = addr.price_level || '€€';

  const regex = /(\d+[\.,]?\d*)\s*€/g;
  const matches: number[] = [];
  let match;
  while ((match = regex.exec(desc)) !== null) {
    const val = parseFloat(match[1].replace(',', '.'));
    if (val >= 3 && val <= 150) matches.push(val);
  }

  if (matches.length > 0) {
    const minP = Math.round(Math.min(...matches));
    const maxP = Math.round(Math.max(...matches));
    const avgP = Math.round(matches.reduce((a, b) => a + b, 0) / matches.length);
    const est = Math.max(minP, Math.min(maxP, avgP));
    return {
      estimatedBudget: est,
      priceMin: minP,
      priceMax: maxP,
      budgetLabel: minP === maxP ? `~${est}€` : `${minP}€ - ${maxP}€`,
      priceLevel: est < 15 ? '€' : est <= 32 ? '€€' : '€€€',
    };
  }

  if (['burger', 'sandwich', 'kebab', 'tacos', 'fast food', 'street food', 'boulangerie'].some(w => fullText.includes(w))) {
    return { estimatedBudget: 12, priceMin: 8, priceMax: 16, budgetLabel: '8€ - 16€', priceLevel: '€' };
  }
  if (['cafe', 'café', 'coffee', 'glacier', 'patisserie', 'pâtisserie', 'douceur'].some(w => fullText.includes(w))) {
    return { estimatedBudget: 9, priceMin: 4, priceMax: 14, budgetLabel: '4€ - 14€', priceLevel: '€' };
  }
  if (['bar a biere', 'pub', 'biere', 'bière'].some(w => fullText.includes(w))) {
    return { estimatedBudget: 14, priceMin: 6, priceMax: 20, budgetLabel: '6€ - 20€', priceLevel: '€' };
  }
  if (['cocktail', 'bar a vin', 'tapas', 'apero'].some(w => fullText.includes(w))) {
    return { estimatedBudget: 22, priceMin: 12, priceMax: 30, budgetLabel: '12€ - 30€', priceLevel: '€€' };
  }
  if (['etoile', 'étoilé', 'gastronomique', 'michelin'].some(w => fullText.includes(w))) {
    return { estimatedBudget: 65, priceMin: 45, priceMax: 110, budgetLabel: '45€ - 110€', priceLevel: '€€€' };
  }

  if (pl === '€') {
    return { estimatedBudget: 12, priceMin: 6, priceMax: 18, budgetLabel: '6€ - 18€', priceLevel: '€' };
  }
  if (pl === '€€€') {
    return { estimatedBudget: 50, priceMin: 35, priceMax: 80, budgetLabel: '35€ - 80€', priceLevel: '€€€' };
  }
  return { estimatedBudget: 24, priceMin: 15, priceMax: 35, budgetLabel: '15€ - 35€', priceLevel: '€€' };
};
