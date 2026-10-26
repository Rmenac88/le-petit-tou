import React, { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check, Plus, X } from 'lucide-react-native';

import { Brand, Font } from '../../constants/brand';
import { userListsStore } from '../../lib/userListsStore';
import { MAX_LISTS, type ListsState } from '../../lib/userListsLogic';
import ListEditorModal from './ListEditorModal';

interface Props {
  visible: boolean;
  spotId: string | null;
  spotTitle?: string;
  onClose: () => void;
}

/** « Ajouter à une liste » : coche ou décoche l'adresse dans chaque liste, ou crée une nouvelle liste. */
export default function AddToListSheet({ visible, spotId, spotTitle, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [state, setState] = useState<ListsState>(userListsStore.getState());
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!visible) return;
    setMessage('');
    return userListsStore.subscribe(setState);
  }, [visible]);

  if (!spotId) return null;
  const id = spotId;

  const toggle = async (listId: string) => {
    const res = await userListsStore.toggleSpot(listId, id);
    setMessage(res.ok ? '' : res.error);
  };

  return (
    <>
      <Modal visible={visible && !creating} animationType="slide" transparent onRequestClose={onClose} statusBarTranslucent>
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
            <View style={styles.header}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.title}>Ajouter à une liste</Text>
                {spotTitle ? <Text style={styles.sub} numberOfLines={1}>{spotTitle}</Text> : null}
              </View>
              <Pressable onPress={onClose} hitSlop={10} style={styles.close} accessibilityRole="button" accessibilityLabel="Fermer">
                <X size={18} color={Brand.ink} />
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 8 }} showsVerticalScrollIndicator={false}>
              {state.lists.map((list) => {
                const inList = list.spotIds.includes(id);
                return (
                  <Pressable
                    key={list.id}
                    style={[styles.row, inList && styles.rowActive]}
                    onPress={() => toggle(list.id)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: inList }}
                    aria-checked={inList}
                    accessibilityLabel={list.name}
                  >
                    <Text style={styles.emoji}>{list.emoji}</Text>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.name} numberOfLines={1}>{list.name}</Text>
                      <Text style={styles.count}>{list.spotIds.length} adresse{list.spotIds.length > 1 ? 's' : ''}</Text>
                    </View>
                    <View style={[styles.check, inList && styles.checkOn]}>
                      {inList && <Check size={14} color={Brand.white} strokeWidth={3} />}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {message ? <Text style={styles.error}>{message}</Text> : null}

            {state.lists.length < MAX_LISTS && (
              <Pressable style={styles.create} onPress={() => setCreating(true)} accessibilityRole="button">
                <Plus size={18} color={Brand.primaryDeep} strokeWidth={2.4} />
                <Text style={styles.createText}>Nouvelle liste</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      <ListEditorModal
        visible={visible && creating}
        onClose={() => setCreating(false)}
        onSaved={(list) => userListsStore.addSpot(list.id, id)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43, 29, 70, 0.65)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  title: { fontFamily: Font.display, fontSize: 20, color: Brand.ink },
  sub: { fontSize: 13, fontWeight: '600', color: Brand.inkSoft, marginTop: 2 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.bg, borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, minHeight: 60, borderWidth: 1.5, borderColor: 'transparent' },
  rowActive: { backgroundColor: Brand.primarySoft, borderColor: Brand.primary },
  emoji: { fontSize: 24, width: 32, textAlign: 'center' },
  name: { fontSize: 15, fontWeight: '700', color: Brand.ink },
  count: { fontSize: 12, fontWeight: '600', color: Brand.inkSoft, marginTop: 1 },
  check: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#CFC7CC', alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: Brand.primaryDeep, borderColor: Brand.primaryDeep },
  error: { marginTop: 10, fontSize: 13, color: Brand.primaryInk, fontWeight: '600' },
  create: { marginTop: 12, minHeight: 48, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', borderColor: Brand.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  createText: { fontSize: 15, fontWeight: '800', color: Brand.primaryDeep },
});
