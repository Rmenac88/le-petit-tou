import { Alert, Platform } from 'react-native';

/** Demande de confirmation avant une action du portail (boîte du système sur mobile, du navigateur sur le web). */
export function confirmAction(title: string, text: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${text}`)) onYes();
    return;
  }
  Alert.alert(title, text, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Confirmer', onPress: onYes },
  ]);
}
