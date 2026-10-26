import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Brand, Font } from '../../constants/brand';
import { LIST_EMOJIS, MAX_NAME_LENGTH, type UserList } from '../../lib/userListsLogic';
import { userListsStore } from '../../lib/userListsStore';

interface Props {
  visible: boolean;
  /** Liste à modifier ; absente : création. */
  list?: UserList | null;
  onClose: () => void;
  /** Appelé après une création ou une modification réussie. */
  onSaved?: (list: UserList) => void;
}

/** Création / modification d'une liste personnelle (nom + pastille). */
export default function ListEditorModal({ visible, list, onClose, onSaved }: Props) {
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState<string>(LIST_EMOJIS[0]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(list?.name ?? '');
    setEmoji(list?.emoji ?? LIST_EMOJIS[0]);
    setError('');
    setBusy(false);
  }, [visible, list]);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const res = list ? await userListsStore.renameList(list.id, name, emoji) : await userListsStore.createList(name, emoji);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    const saved = 'list' in res ? res.list : userListsStore.getState().lists.find((l) => l.id === list?.id);
    if (saved) onSaved?.(saved);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={styles.card}>
          <Text style={styles.title}>{list ? 'Modifier la liste' : 'Nouvelle liste'}</Text>

          <Text style={styles.label}>Nom</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={(t) => {
              setName(t);
              if (error) setError('');
            }}
            placeholder="Ex : Brunchs du dimanche"
            placeholderTextColor={Brand.inkSoft}
            maxLength={MAX_NAME_LENGTH}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <Text style={styles.counter}>{name.trim().length}/{MAX_NAME_LENGTH}</Text>

          <Text style={styles.label}>Pastille</Text>
          <View style={styles.emojiRow}>
            {LIST_EMOJIS.map((e) => (
              <Pressable
                key={e}
                style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}
                onPress={() => setEmoji(e)}
                accessibilityRole="button"
                accessibilityLabel={`Pastille ${e}`}
                accessibilityState={{ selected: emoji === e }}
              >
                <Text style={styles.emoji}>{e}</Text>
              </Pressable>
            ))}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnGhost]} onPress={onClose} accessibilityRole="button">
              <Text style={styles.btnGhostText}>Annuler</Text>
            </Pressable>
            <Pressable style={[styles.btn, styles.btnPrimary, busy && { opacity: 0.7 }]} onPress={save} disabled={busy} accessibilityRole="button">
              {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnPrimaryText}>{list ? 'Enregistrer' : 'Créer'}</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43, 29, 70, 0.65)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  card: { width: '100%', maxWidth: 400, backgroundColor: Brand.white, borderRadius: 28, padding: 22 },
  title: { fontFamily: Font.display, fontSize: 22, color: Brand.ink, marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '800', color: Brand.inkSoft, textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 8, marginBottom: 6 },
  input: {
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: Brand.ink,
  },
  counter: { alignSelf: 'flex-end', fontSize: 11, color: Brand.inkMute, marginTop: 4 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emojiBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: 'transparent' },
  emojiBtnActive: { backgroundColor: Brand.primarySoft, borderColor: Brand.primary },
  emoji: { fontSize: 22 },
  error: { marginTop: 12, fontSize: 13, lineHeight: 18, color: Brand.primaryInk, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  btn: { flex: 1, minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnGhost: { backgroundColor: Brand.bg },
  btnGhostText: { fontSize: 15, fontWeight: '700', color: Brand.inkSoft },
  btnPrimary: { backgroundColor: Brand.primaryDeep },
  btnPrimaryText: { fontSize: 15, fontWeight: '800', color: Brand.white },
});
