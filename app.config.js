/**
 * Configuration dynamique : complète app.json avec des valeurs lues dans l'environnement
 * (secrets EAS ou .env local) pour ne rien écrire en clair dans le dépôt.
 *
 *   GOOGLE_MAPS_ANDROID_API_KEY  clé Google Maps pour la carte Android (react-native-maps)
 *   EAS_PROJECT_ID               identifiant du projet EAS (notifications push)
 */
module.exports = ({ config }) => {
  const googleKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  const projectId = process.env.EAS_PROJECT_ID;

  return {
    ...config,
    android: {
      ...config.android,
      ...(googleKey ? { config: { googleMaps: { apiKey: googleKey } } } : {}),
    },
    extra: {
      ...config.extra,
      ...(projectId ? { eas: { projectId } } : {}),
    },
  };
};
