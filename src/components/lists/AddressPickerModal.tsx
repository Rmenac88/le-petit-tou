import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check, MapPin, Plus, X } from 'lucide-react-native';

import { Brand, Font } from '../../constants/brand';
import { PLACEHOLDER_PHOTO } from '../../constants/placeholder';
import { getOptimizedImageUrl } from '../../lib/imageOptimizer';
import { pickerResults } from '../../lib/listPickerLogic';
import { MAX_SPOTS_PER_LIST } from '../../lib/userListsLogic';
import { userListsStore } from '../../lib/userListsStore';
import SearchPill from '../SearchPill';
import type { ListView } from './ListDetailModal';

interface Props {
  /** Liste à remplir ; null = fenêtre fermée. */
  list: ListView | null;
  /** Adresses du guide, par identifiant. */
  addresses: ReadonlyMap<string, any>;
  onClose: () => void;
}

/**
 * « Ajouter des adresses » : recherche dans tout le guide et ajout d'une touche, sans quitter la liste. La fenêtre
 * reste ouverte pour en ajouter plusieurs à la suite ; une adresse déjà dans la liste se retire d'une seconde touche.
 */
export default function AddressPickerModal({ list, addresses, onClose }: Props) {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  // Repart d'une saisie vide à chaque ouverture (et d'aucun message d'erreur périmé)
  useEffect(() => {
    if (list) {
      setQuery('');
      setError(null);
    }
  }, [list?.id]);

  const allSpots = useMemo(() => Array.from(addresses.values()), [addresses]);
  const results = useMemo(() => pickerResults(allSpots, deferredQuery), [allSpots, deferredQuery]);
  const inList = useMemo(() => new Set(list?.spotIds ?? []), [list?.spotIds]);
  const searching = deferredQuery.trim().length >= 2;

  const toggle = async (spot: any) => {
    if (!list) return;
    setError(null);
    const res = await userListsStore.toggleSpot(list.id, String(spot.id));
    if (!res.ok) setError(res.error);
  };

  return (
    <Modal visible={!!list} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={1}>Ajouter des adresses</Text>
            <Text style={styles.sub} numberOfLines={1}>
              {list?.emoji} {list?.name} · {inList.size}/{MAX_SPOTS_PER_LIST}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.doneBtn} accessibilityRole="button" accessibilityLabel="Terminer">
            <Text style={styles.doneText}>Terminé</Text>
          </Pressable>
        </View>

        <SearchPill
          style={styles.search}
          value={query}
          onChangeText={setQuery}
          placeholder="Rechercher une adresse..."
        />

        {error && (
          <View style={styles.error} accessibilityLiveRegion="polite">
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <FlatList
          data={results}
          keyExtractor={(s) => String(s.id)}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          ListHeaderComponent={
            results.length > 0 && !searching ? <Text style={styles.hint}>Suggestions · tape un nom pour chercher dans tout le guide</Text> : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <X size={26} color={Brand.inkMute} />
              <Text style={styles.emptyTitle}>Aucune adresse trouvée</Text>
              <Text style={styles.emptySub}>Essaie un autre nom, un quartier ou un type de lieu.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const added = inList.has(String(item.id));
            return (
              <Pressable
                style={styles.row}
                onPress={() => toggle(item)}
                accessibilityRole="button"
                accessibilityState={{ selected: added }}
                accessibilityLabel={added ? `Retirer ${item.title} de la liste` : `Ajouter ${item.title} à la liste`}
              >
                <Image
                  source={{ uri: item.image_url ? getOptimizedImageUrl(item.image_url, 200) : PLACEHOLDER_PHOTO }}
                  style={styles.thumb}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                />
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.rowMeta}>
                    <MapPin size={12} color={Brand.inkSoft} strokeWidth={2} />
                    <Text style={styles.rowMetaText} numberOfLines={1}>{item.location || item.address || 'Toulouse'}</Text>
                  </View>
                </View>
                <View style={[styles.toggle, added && styles.toggleOn]}>
                  {added ? <Check size={16} color={Brand.white} strokeWidth={3} /> : <Plus size={16} color={Brand.primaryInk} strokeWidth={3} />}
                </View>
              </Pressable>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12 },
  titleWrap: { flex: 1, minWidth: 0 },
  title: { fontFamily: Font.display, fontSize: 20, color: Brand.ink },
  sub: { fontSize: 12, fontWeight: '700', color: Brand.inkSoft, marginTop: 1 },
  doneBtn: { minHeight: 44, borderRadius: 22, backgroundColor: Brand.primaryDeep, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  doneText: { fontSize: 14, fontWeight: '800', color: Brand.white },
  search: { marginHorizontal: 16, marginBottom: 8 },
  error: { marginHorizontal: 16, marginBottom: 8, borderRadius: 12, padding: 10, backgroundColor: Brand.primarySofter },
  errorText: { fontSize: 13, fontWeight: '600', color: Brand.primaryInk },
  hint: { fontSize: 12, fontWeight: '700', color: Brand.inkSoft, marginBottom: 10 },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.white, borderRadius: 18, padding: 10, minHeight: 76 },
  thumb: { width: 56, height: 56, borderRadius: 14, backgroundColor: Brand.line },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: Brand.ink },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMetaText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: Brand.inkSoft },
  toggle: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.primarySoft, alignItems: 'center', justifyContent: 'center' },
  toggleOn: { backgroundColor: Brand.successDeep },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 36, gap: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Brand.ink },
  emptySub: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: Brand.inkSoft, textAlign: 'center' },
});
