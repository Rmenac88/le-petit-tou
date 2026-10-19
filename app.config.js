/**
 * Configuration Expo dynamique : complète app.json avec les valeurs propres à l'environnement de build.
 * - GOOGLE_MAPS_ANDROID_API_KEY : clé Google Maps SDK pour Android (sans elle, la carte Android plante).
 * - EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN : jeton public Mapbox (itinéraires et carte web).
 * - GOOGLE_SERVICES_JSON : chemin du fichier google-services.json (Firebase, requis pour les notifications Android) ;
 *   variable de type « fichier » dans EAS.
 * Un build de production sans ces valeurs est refusé pour ne jamais publier une application cassée.
 */
module.exports = ({ config }) => {
  const isProduction = process.env.EAS_BUILD_PROFILE === 'production';
  const googleMapsKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY || '';
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || '';

  if (isProduction) {
    const missing = [];
    if (!googleMapsKey) missing.push('GOOGLE_MAPS_ANDROID_API_KEY');
    if (!process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN) missing.push('EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN');
    if (!googleServicesFile) missing.push('GOOGLE_SERVICES_JSON');
    if (missing.length > 0) {
      throw new Error(
        `Build de production refusé : variable(s) EAS manquante(s) : ${missing.join(', ')}. ` +
          'Ajoute-les avec « eas env:create » (voir docs/audit/02-PUBLICATION.md).'
      );
    }
  }

  // Notifications iOS : entitlement « production » pour les builds destinés aux stores
  const plugins = (config.plugins || []).map((plugin) =>
    Array.isArray(plugin) && plugin[0] === 'expo-notifications'
      ? [plugin[0], { ...plugin[1], mode: isProduction ? 'production' : 'development' }]
      : plugin
  );

  return {
    ...config,
    plugins,
    android: {
      ...config.android,
      ...(googleServicesFile ? { googleServicesFile } : {}),
      config: {
        ...(config.android && config.android.config),
        ...(googleMapsKey ? { googleMaps: { apiKey: googleMapsKey } } : {}),
      },
    },
  };
};
