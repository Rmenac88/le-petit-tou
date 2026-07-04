import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function SearchView() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Recherche</Text>
      <Text style={styles.subtitle}>Trouvez des adresses et activités</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
  },
});
