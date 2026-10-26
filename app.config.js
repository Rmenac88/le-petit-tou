/**
 * Configuration Expo dynamique : complète app.json avec les valeurs propres à l'environnement de build.
 * - EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN : jeton public Mapbox (carte et itinéraires, sur téléphone comme sur le web).
 * - GOOGLE_SERVICES_JSON : chemin du fichier google-services.json (Firebase, requis pour les notifications Android) ;
 *   variable de type « fichier » dans EAS.
 * Un build de production sans ces valeurs est refusé pour ne jamais publier une application cassée.
 */
module.exports = ({ config }) => {
  const isProduction = process.env.EAS_BUILD_PROFILE === 'production';
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON || '';

  if (isProduction) {
    const missing = [];
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
    },
  };
};
