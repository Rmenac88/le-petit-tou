import React from 'react';
import { Alert, FlatList, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Pencil, Plus, Trash2, X } from 'lucide-react-native';

import { Brand, Font } from '../../constants/brand';
import { PLACEHOLDER_PHOTO } from '../../constants/placeholder';
import { getOptimizedImageUrl } from '../../lib/imageOptimizer';
import { userListsStore } from '../../lib/userListsStore';

export interface ListView {
  id: string;
  name: string;
  emoji: string;
  /** « likes » : liste en lecture seule (les likes se retirent avec le cœur). */
  readOnly?: boolean;
  /** Listes créées par l'utilisateur : modifiables et supprimables. */
  custom?: boolean;
  spotIds: string[];
}

interface Props {
  list: ListView | null;
  addresses: ReadonlyMap<string, any>;
  onClose: () => void;
  onOpenSpot: (address: any) => void;
  onEdit?: () => void;
  /** Ouvre le sélecteur « Ajouter des adresses » (listes modifiables). */
  onAddSpots?: () => void;
}

const confirm = (title: string, message: string, confirmLabel: string, onConfirm: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Annuler', style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
};

/** Contenu d'une liste : les adresses, avec retrait (listes personnelles) et ouverture de la fiche. */
export default function ListDetailModal({ list, addresses, onClose, onOpenSpot, onEdit, onAddSpots }: Props) {
  const spots = (list?.spotIds ?? []).map((id) => addresses.get(id)).filter(Boolean);

  const remove = (spot: any) => {
    if (!list || list.readOnly) return;
    userListsStore.removeSpot(list.id, String(spot.id));
  };

  const deleteList = () => {
    if (!list?.custom) return;
    confirm('Supprimer la liste ?', `« ${list.name} » sera supprimée. Les adresses ne sont pas supprimées du guide.`, 'Supprimer', async () => {
      await userListsStore.deleteList(list.id);
      onClose();
    });
  };

  return (
    <Modal visible={!!list} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Retour">
            <ChevronLeft size={22} color={Brand.ink} />
          </Pressable>
          <View style={styles.titleWrap}>
            <Text style={styles.title} numberOfLines={2}>{list?.emoji} {list?.name}</Text>
            <Text style={styles.count}>{spots.length} adresse{spots.length > 1 ? 's' : ''}</Text>
          </View>
          {list?.custom && (
            <>
              <Pressable onPress={onEdit} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Modifier la liste">
                <Pencil size={18} color={Brand.ink} />
              </Pressable>
              <Pressable onPress={deleteList} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Supprimer la liste">
                <Trash2 size={18} color={Brand.primaryDeep} />
              </Pressable>
            </>
          )}
        </View>

        <FlatList
          data={spots}
          keyExtractor={(s) => String(s.id)}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          ListHeaderComponent={
            !list?.readOnly && onAddSpots ? (
              <Pressable style={styles.addBtn} onPress={onAddSpots} accessibilityRole="button" accessibilityLabel="Ajouter une adresse à la liste">
                <Plus size={18} color={Brand.white} strokeWidth={2.6} />
                <Text style={styles.addBtnText}>Ajouter une adresse</Text>
              </Pressable>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyEmoji}>{list?.emoji}</Text>
              <Text style={styles.emptyTitle}>Cette liste est vide</Text>
              <Text style={styles.emptySub}>
                {list?.readOnly
                  ? 'Touche le cœur d’une adresse pour la retrouver ici.'
                  : 'Touche « Ajouter une adresse », ou le signet depuis la fiche d’une adresse.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => onOpenSpot(item)} accessibilityRole="button" accessibilityLabel={item.title}>
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
              {!list?.readOnly && (
                <Pressable
                  onPress={() => remove(item)}
                  hitSlop={8}
                  style={styles.removeBtn}
                  accessibilityRole="button"
                  accessibilityLabel={`Retirer ${item.title} de la liste`}
                >
                  <X size={16} color={Brand.inkSoft} />
                </Pressable>
              )}
            </Pressable>
          )}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: Brand.line },
  titleWrap: { flex: 1, minWidth: 0, paddingHorizontal: 4 },
  title: { fontFamily: Font.display, fontSize: 19, lineHeight: 23, color: Brand.ink },
  count: { fontSize: 12, fontWeight: '700', color: Brand.inkSoft, marginTop: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 40, flexGrow: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.white, borderRadius: 18, padding: 10, minHeight: 84 },
  thumb: { width: 64, height: 64, borderRadius: 14, backgroundColor: Brand.line },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: Brand.ink },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowMetaText: { flex: 1, fontSize: 12.5, fontWeight: '600', color: Brand.inkSoft },
  removeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48, borderRadius: 24, backgroundColor: Brand.primaryDeep, marginBottom: 12 },
  addBtnText: { fontSize: 15, fontWeight: '800', color: Brand.white },
  empty: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 36, gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: Brand.ink },
  emptySub: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: Brand.inkSoft, textAlign: 'center' },
});
