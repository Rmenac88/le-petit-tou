import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';

import { Brand } from '../constants/brand';

interface Props {
  children: React.ReactNode;
  /** Nom de la zone, pour le journal (« accueil », « portail admin »…). */
  scope?: string;
  /** Affichage compact (onglet ou fenêtre) plutôt que plein écran. */
  compact?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
}

/**
 * Filet de sécurité : une erreur de rendu dans une zone n'éteint plus toute l'application.
 * L'utilisateur voit un message en français et peut réessayer ; aucun détail technique n'est affiché.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn(`[ErrorBoundary:${this.props.scope ?? 'app'}]`, error);
  }

  private reset = () => {
    this.setState({ hasError: false });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={[styles.box, this.props.compact && styles.compact]} accessibilityRole="alert">
        <Text style={styles.title}>Oups, quelque chose s'est mal passé</Text>
        <Text style={styles.text}>Cette partie de l'application a rencontré un problème. Vos données ne sont pas perdues.</Text>
        <Pressable style={styles.btn} onPress={this.reset} accessibilityRole="button" accessibilityLabel="Réessayer">
          <Text style={styles.btnText}>Réessayer</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  box: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Brand.bg,
  },
  compact: { flex: 0, minHeight: 200, borderRadius: 20, margin: 16 },
  title: { fontSize: 18, fontWeight: '700', color: Brand.ink, textAlign: 'center', marginBottom: 8 },
  text: { fontSize: 14, color: Brand.inkSoft, textAlign: 'center', marginBottom: 20 },
  btn: {
    minHeight: 44,
    paddingHorizontal: 24,
    borderRadius: 12,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
});
