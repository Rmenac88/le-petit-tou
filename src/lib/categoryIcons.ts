import React from 'react';
import {
  Utensils,
  UtensilsCrossed,
  Wine,
  Beer,
  Coffee,
  CakeSlice,
  ShoppingBag,
  Shirt,
  Store,
  Scissors,
  Flower2,
  Ticket,
  Landmark,
  Palette,
  Music,
  Film,
  Dumbbell,
  Bike,
  Gamepad2,
  Bed,
  Sun,
  Leaf,
  ChefHat,
  Home,
  Wrench,
  Moon,
  Compass,
  MapPin,
  Sparkles,
  Star,
  Tag,
} from 'lucide-react-native';

export const CATEGORY_ICON_MAP: Record<string, React.ComponentType<any>> = {
  Utensils,
  UtensilsCrossed,
  Wine,
  Beer,
  Coffee,
  CakeSlice,
  ShoppingBag,
  Shirt,
  Store,
  Scissors,
  Flower2,
  Ticket,
  Landmark,
  Palette,
  Music,
  Film,
  Dumbbell,
  Bike,
  Gamepad2,
  Bed,
  Sun,
  Leaf,
  ChefHat,
  Home,
  Wrench,
  Moon,
  Compass,
  MapPin,
  Sparkles,
  Star,
  Tag,
  // Common aliases
  Brush: Palette,
  Croissant: CakeSlice,
  GlassWater: Wine,
  Trophy: Dumbbell,
  Activity: Dumbbell,
};

/**
 * Rigorously resolves the cleanest, most fitting Lucide vector icon
 * based on the category's natural title, description, and fallback icon name.
 * Eliminates generic AI placeholder icons (Sparkles, Smile, Compass) in favor of trade-accurate iconography.
 */
export function getCategoryIcon(title?: string, fallbackIconName?: string): React.ComponentType<any> {
  const norm = (title || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  // 1. Boulangeries, Pâtisseries, Douceurs, Gâteaux
  if (
    norm.includes('boulanger') ||
    norm.includes('patiss') ||
    norm.includes('douceur') ||
    norm.includes('gateau') ||
    norm.includes('croissant') ||
    norm.includes('sucre')
  ) {
    return CakeSlice;
  }

  // 2. Cafés, Salons de thé, Brunch
  if (
    norm.includes('brunch') ||
    norm.includes('cafe') ||
    norm.includes('salon de the') ||
    norm.includes('coffee') ||
    norm.includes('petit-dejeuner')
  ) {
    return Coffee;
  }

  // 3. Bars, Vins, Cocktails, Trinquer, Apéro
  if (
    norm.includes('trinquer') ||
    norm.includes('cocktail') ||
    norm.includes('vin') ||
    norm.includes('apero') ||
    norm.includes('cave') ||
    (norm.includes('bar') && !norm.includes('barbier'))
  ) {
    return Wine;
  }

  // 4. Bières, Pubs, Microbrasseries
  if (norm.includes('biere') || norm.includes('pub') || norm.includes('brasserie')) {
    return Beer;
  }

  // 5. Vie Nocturne, Clubs, Soirées, Danser
  if (
    norm.includes('nocturne') ||
    norm.includes('nuit') ||
    norm.includes('club') ||
    norm.includes('danser') ||
    norm.includes('fete')
  ) {
    return Moon;
  }

  // 6. Restauration, Restaurants, Gastronomie, Gourmand Gourmet
  if (
    norm.includes('restau') ||
    norm.includes('gourmand') ||
    norm.includes('manger') ||
    norm.includes('gastrono') ||
    norm.includes('plat') ||
    norm.includes('table')
  ) {
    return Utensils;
  }

  // 7. Fait Maison, Chefs, Cuisine artisanale
  if (norm.includes('fait maison') || norm.includes('chef') || norm.includes('recette')) {
    return ChefHat;
  }

  // 8. Épiceries Fines, Marchés, Produits du Terroir
  if (
    norm.includes('epicerie') ||
    norm.includes('terroir') ||
    norm.includes('marche') ||
    norm.includes('fromager') ||
    norm.includes('boucher') ||
    norm.includes('poisson')
  ) {
    return Store;
  }

  // 9. Coiffure, Barbier, Beauté capillaire
  if (
    norm.includes('coiff') ||
    norm.includes('barbier') ||
    norm.includes('cheveu') ||
    norm.includes('salon')
  ) {
    return Scissors;
  }

  // 10. Beauté, Spa, Soins, Bien-être, Détente
  if (
    norm.includes('beaute') ||
    norm.includes('spa') ||
    norm.includes('soin') ||
    norm.includes('bien-etre') ||
    norm.includes('massage') ||
    norm.includes('institut') ||
    norm.includes('esthet')
  ) {
    return Flower2;
  }

  // 11. Mode, Vêtements, Friperies, Prêt-à-porter, Chaussures, Maroquinerie
  if (
    norm.includes('mode') ||
    norm.includes('friperie') ||
    norm.includes('vetement') ||
    norm.includes('pret-a-porter') ||
    norm.includes('chaussure') ||
    norm.includes('maroquinerie')
  ) {
    return Shirt;
  }

  // 12. Artisans, Créateurs locaux, Céramique, Ateliers
  if (
    norm.includes('artisan') ||
    norm.includes('createur') ||
    norm.includes('atelier') ||
    norm.includes('couture') ||
    norm.includes('bijou')
  ) {
    return Palette;
  }

  // 13. Shopping, Boutiques, Cadeaux, Papeterie
  if (
    norm.includes('shopping') ||
    norm.includes('boutique') ||
    norm.includes('magasin') ||
    norm.includes('cadeau') ||
    norm.includes('papeterie')
  ) {
    return ShoppingBag;
  }

  // 14. Décoration, Mobilier, Maison, Fleuristes
  if (
    norm.includes('deco') ||
    norm.includes('maison') ||
    norm.includes('meuble') ||
    norm.includes('fleuriste') ||
    norm.includes('plante')
  ) {
    return Home;
  }

  // 15. Musées, Patrimoine, Galeries, Monuments
  if (
    norm.includes('musee') ||
    norm.includes('monument') ||
    norm.includes('patrimoine') ||
    norm.includes('galerie') ||
    norm.includes('histor')
  ) {
    return Landmark;
  }

  // 16. Théâtre, Spectacles, Cinéma, Culture
  if (
    norm.includes('spectacle') ||
    norm.includes('theatre') ||
    norm.includes('cinema') ||
    norm.includes('culture')
  ) {
    return Ticket;
  }

  // 17. Musique, Concerts, Salles
  if (norm.includes('musique') || norm.includes('concert') || norm.includes('jazz')) {
    return Music;
  }

  // 18. Sport, Fitness, Musculation, Gym
  if (
    norm.includes('sport') ||
    norm.includes('fitness') ||
    norm.includes('musculation') ||
    norm.includes('salle de sport') ||
    norm.includes('gym')
  ) {
    return Dumbbell;
  }

  // 19. Activités Outdoor, Vélo, Échappées
  if (
    norm.includes('velo') ||
    norm.includes('outdoor') ||
    norm.includes('randonnee') ||
    norm.includes('balade')
  ) {
    return Bike;
  }

  // 20. Jeux, Loisirs ludiques, Escape Game
  if (
    norm.includes('jeu') ||
    norm.includes('loisir') ||
    norm.includes('escape') ||
    norm.includes('ludique')
  ) {
    return Gamepad2;
  }

  // 21. Hôtels, Hébergements insolites, Nuits
  if (
    norm.includes('hotel') ||
    norm.includes('heberg') ||
    norm.includes('chambre') ||
    norm.includes('nuit')
  ) {
    return Bed;
  }

  // 22. Terrasse, Rooftop, Plein air
  if (
    norm.includes('terrasse') ||
    norm.includes('rooftop') ||
    norm.includes('exterieur') ||
    norm.includes('soleil')
  ) {
    return Sun;
  }

  // 23. Bio, Écoresponsable, Local, Végé
  if (
    norm.includes('bio') ||
    norm.includes('eco') ||
    norm.includes('veget') ||
    norm.includes('nature') ||
    norm.includes('local')
  ) {
    return Leaf;
  }

  // 24. Services, Réparations, Bricolage
  if (
    norm.includes('repar') ||
    norm.includes('bricolage') ||
    norm.includes('depannage') ||
    norm.includes('cle') ||
    norm.includes('service')
  ) {
    return Wrench;
  }

  // 25. Vie Pratique
  if (norm.includes('pratique') || norm.includes('quotidien')) {
    return Home;
  }

  // 26. Toutes les adresses / Explorer
  if (
    norm.includes('toutes') ||
    norm.includes('adresse') ||
    norm.includes('explorer') ||
    norm === 'all'
  ) {
    return Compass;
  }

  // Fallback to explicit icon name if recognized
  if (fallbackIconName && CATEGORY_ICON_MAP[fallbackIconName]) {
    return CATEGORY_ICON_MAP[fallbackIconName];
  }

  return Compass;
}
