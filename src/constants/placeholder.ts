import { Asset } from 'expo-asset';

/** Visuel local de secours (remplace les anciennes URLs Unsplash qui finissent par casser). */
export const PLACEHOLDER_PHOTO: string = Asset.fromModule(
  require('../../assets/images/placeholder-photo.png')
).uri;
