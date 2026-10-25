import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Plus } from 'lucide-react-native';

import { Brand, Font } from '../../constants/brand';
import { loadDeviceLikedSpotIds } from '../../lib/likesStore';
import { onAppEvent } from '../../lib/appEvents';
import { userListsStore } from '../../lib/userListsStore';
import { MAX_LISTS, type ListsState } from '../../lib/userListsLogic';
import ListDetailModal, { type ListView } from './ListDetailModal';
import ListEditorModal from './ListEditorModal';

interface Props {
  /** Adresses du guide, par identifiant. */
  addresses: ReadonlyMap<string, any>;
  onOpenSpot: (address: any) => void;
}

const LIKES_ID = '__likes__';

/** « Mes listes » de l'espace profil : mes likes, « À tester plus tard », « Y retourner » et les listes créées. */
export default function MyListsSection({ addresses, onOpenSpot }: Props) {
  const [state, setState] = useState<ListsState>(userListsStore.getState());
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ open: boolean; listId: string | null }>({ open: false, listId: null });

  useEffect(() => userListsStore.subscribe(setState), []);
  useEffect(() => {
    let alive = true;
    const refresh = () => loadDeviceLikedSpotIds().then((ids) => alive && setLikedIds(ids));
    refresh();
    const off = onAppEvent('pt_likes_updated', refresh);
    return () => {
      alive = false;
      off();
    };
  }, []);

  const views: ListView[] = useMemo(
    () => [
      { id: LIKES_ID, name: 'Mes likes', emoji: '❤️', readOnly: true, spotIds: likedIds },
      ...state.lists.map((l) => ({ id: l.id, name: l.name, emoji: l.emoji, custom: l.kind === 'custom', spotIds: l.spotIds })),
    ],
    [state, likedIds]
  );
  const open = views.find((v) => v.id === openId) ?? null;
  const editing = state.lists.find((l) => l.id === editor.listId) ?? null;
  const count = (v: ListView) => v.spotIds.filter((id) => addresses.has(id)).length;

  return (
    <View style={styles.section}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Mes listes</Text>
        {state.lists.length < MAX_LISTS && (
          <Pressable style={styles.addBtn} onPress={() => setEditor({ open: true, listId: null })} accessibilityRole="button" accessibilityLabel="Créer une liste">
            <Plus size={16} color={Brand.white} strokeWidth={2.6} />
            <Text style={styles.addBtnText}>Nouvelle</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.cards}>
        {views.map((v) => (
          <Pressable key={v.id} style={styles.row} onPress={() => setOpenId(v.id)} accessibilityRole="button" accessibilityLabel={`${v.name}, ${count(v)} adresses`}>
            <View style={styles.emojiCircle}>
              <Text style={styles.emoji}>{v.emoji}</Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.rowTitle} numberOfLines={1}>{v.name}</Text>
              <Text style={styles.rowSub}>{count(v)} adresse{count(v) > 1 ? 's' : ''}</Text>
            </View>
            <ChevronRight size={18} color={Brand.inkMute} />
          </Pressable>
        ))}
      </View>
      <Text style={styles.note}>Tes listes restent sur ton téléphone.</Text>

      <ListDetailModal
        list={open}
        addresses={addresses}
        onClose={() => setOpenId(null)}
        onOpenSpot={onOpenSpot}
        onEdit={() => setEditor({ open: true, listId: open?.id ?? null })}
      />
      <ListEditorModal
        visible={editor.open}
        list={editing}
        onClose={() => setEditor({ open: false, listId: null })}
        onSaved={(l) => !editing && setOpenId(l.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 8 },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  title: { fontFamily: Font.display, fontSize: 20, color: Brand.ink },
  addBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primaryDeep, borderRadius: 16, paddingHorizontal: 14, minHeight: 40, justifyContent: 'center' },
  addBtnText: { fontSize: 14, fontWeight: '800', color: Brand.white },
  cards: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Brand.white, borderRadius: 20, paddingVertical: 12, paddingHorizontal: 14, minHeight: 68, shadowColor: Brand.night, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 12, elevation: 2 },
  emojiCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 22 },
  rowBody: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, fontWeight: '800', color: Brand.ink },
  rowSub: { fontSize: 12.5, fontWeight: '600', color: Brand.inkSoft, marginTop: 1 },
  note: { fontSize: 12, color: Brand.inkMute, textAlign: 'center', marginTop: 12 },
});
