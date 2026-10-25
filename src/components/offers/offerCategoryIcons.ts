import { Briefcase, Landmark, ShoppingBag, Utensils, Wine, type LucideIcon } from 'lucide-react-native';
import type { OfferCategory } from '../../lib/offersLogic';

export const OFFER_CATEGORY_ICONS: Record<OfferCategory, LucideIcon> = {
  food: Utensils,
  drinks: Wine,
  shopping: ShoppingBag,
  culture: Landmark,
  services: Briefcase,
};
