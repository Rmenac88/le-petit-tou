import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Lightbulb, X } from 'lucide-react-native';

import { Brand, Font } from '../constants/brand';
import { discoveryStore } from '../lib/discoveryStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/** Limites identiques à celles du serveur (politique « Insertion bornee », migration 006). */
const MAX = { title: 120, address: 200, comment: 1000 } as const;

/**
 * « Proposer une adresse » : la suggestion part à l'équipe (table place_suggestions, jamais lisible depuis l'appli).
 * 5 suggestions par jour et par téléphone (migration 023) ; purgées après 24 mois (018).
 */
export default function SuggestPlaceModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setAddress('');
    setComment('');
    setError(null);
    setSent(false);
  }, [visible]);

  const send = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await discoveryStore.suggestNewPlace({ title, address, comment });
      if (!res.success) {
        setError(/Limite atteinte/i.test(res.error ?? '')
          ? 'Tu as déjà envoyé 5 propositions aujourd’hui. Merci ! Réessaie demain.'
          : res.error && /nom/i.test(res.error) ? res.error : 'L’envoi n’a pas abouti. Vérifie ta connexion et réessaie.');
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Lightbulb size={20} color={Brand.primaryDeep} />
              <Text style={styles.title}>Proposer une adresse</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
              <X size={20} color={Brand.inkSoft} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {sent ? (
              <View style={styles.done}>
                <Text style={styles.doneTitle}>Merci, c’est envoyé !</Text>
                <Text style={styles.text}>L’équipe va aller tester l’adresse. Si elle plaît, elle rejoindra le guide.</Text>
                <Pressable style={styles.btn} onPress={onClose} accessibilityRole="button">
                  <Text style={styles.btnText}>Fermer</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.text}>Une pépite toulousaine qui manque au guide ? Dis-nous tout.</Text>
                <Text style={styles.label}>Nom de l’adresse *</Text>
                <TextInput style={styles.input} value={title} onChangeText={setTitle} maxLength={MAX.title}
                  placeholder="Ex. Le Café des Arts" placeholderTextColor={Brand.inkMute} accessibilityLabel="Nom de l’adresse" />
                <Text style={styles.label}>Adresse ou quartier</Text>
                <TextInput style={styles.input} value={address} onChangeText={setAddress} maxLength={MAX.address}
                  placeholder="Ex. Rue des Filatiers, Carmes" placeholderTextColor={Brand.inkMute} accessibilityLabel="Adresse ou quartier" />
                <Text style={styles.label}>Pourquoi tu l’aimes</Text>
                <TextInput style={[styles.input, styles.multi]} value={comment} onChangeText={setComment} maxLength={MAX.comment}
                  multiline placeholder="Ce qu’on y trouve, le prix, l’ambiance…" placeholderTextColor={Brand.inkMute}
                  accessibilityLabel="Pourquoi tu l’aimes" />
                <Text style={styles.counter}>{comment.length}/{MAX.comment}</Text>
                {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
                <Pressable style={[styles.btn, (busy || !title.trim()) && styles.btnOff]} onPress={send}
                  disabled={busy || !title.trim()} accessibilityRole="button">
                  {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnText}>Envoyer</Text>}
                </Pressable>
                <Text style={styles.small}>
                  N’indique pas de données personnelles. La proposition est rattachée à l’identifiant anonyme de ton
                  téléphone et effacée au bout de 24 mois, ou avant avec « Effacer mes données ».
                </Text>
              </>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43, 29, 70, 0.65)', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '90%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Brand.line,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: Font.display, fontSize: 20, color: Brand.ink },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 8 },
  text: { fontSize: 14, color: Brand.ink, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '800', color: Brand.ink, marginTop: 6 },
  input: {
    minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: Brand.line, paddingHorizontal: 14,
    fontSize: 15, color: Brand.ink, backgroundColor: Brand.bg,
  },
  multi: { minHeight: 96, paddingTop: 12, textAlignVertical: 'top' },
  counter: { fontSize: 11.5, color: Brand.inkSoft, textAlign: 'right' },
  error: { fontSize: 13, fontWeight: '600', color: Brand.primaryInk },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center', marginTop: 6 },
  btnOff: { opacity: 0.5 },
  btnText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  small: { fontSize: 12, color: Brand.inkSoft, lineHeight: 18, marginTop: 4 },
  done: { gap: 12, paddingVertical: 8 },
  doneTitle: { fontFamily: Font.display, fontSize: 20, color: Brand.ink },
});
