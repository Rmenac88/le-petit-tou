import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyRound, X } from 'lucide-react-native';

import { Brand, Font } from '../constants/brand';
import { supabase } from '../lib/supabase';
import { authService } from '../lib/authService';
import { replaceDeviceId } from '../lib/deviceIdentity';
import { decideRestore, formatRecoveryCode, parseRecoveryCode, type ProfileFootprint } from '../lib/recoveryLogic';
import { discoveryStore } from '../lib/discoveryStore';
import { discountCardsStore } from '../lib/discountCardsStore';
import { clearDeviceLikedSpotIds } from '../lib/likesStore';
import { userListsStore } from '../lib/userListsStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const message = (title: string, text: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${text}`);
  else Alert.alert(title, text);
};

/** Ce que le serveur connaît du profil saisi (null = injoignable). Lecture seule. */
async function footprintOf(deviceId: string): Promise<ProfileFootprint | null> {
  try {
    const [d, l, li] = await Promise.all([
      supabase.rpc('get_my_discoveries', { p_device_id: deviceId }),
      supabase.rpc('get_my_likes', { p_device_id: deviceId }),
      supabase.rpc('get_my_lists', { p_device_id: deviceId }),
    ]);
    if (d.error && l.error && li.error) return null;
    const discoveries = Array.isArray(d.data) ? d.data.length : Array.isArray(d.data?.rows) ? d.data.rows.length : 0;
    const likes = Array.isArray(l.data?.spot_ids) ? l.data.spot_ids.length : 0;
    const lists = Array.isArray(li.data?.data?.lists) ? li.data.data.lists.length : 0;
    return { discoveries, likes, lists };
  } catch {
    return null;
  }
}

/**
 * « Mon code de récupération » : affiche l'identifiant anonyme de l'installation (à noter), et permet d'en saisir un
 * autre pour retrouver un profil sur un nouveau téléphone. Aucun compte, aucune donnée personnelle.
 */
export default function RecoveryCodeModal({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [code, setCode] = useState('');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setInput('');
    setError(null);
    setRevealed(false);
    authService.getUserId().then((id) => setCode(formatRecoveryCode(id))).catch(() => setCode(''));
  }, [visible]);

  const restore = async () => {
    setError(null);
    const target = parseRecoveryCode(input);
    setBusy(true);
    try {
      const current = await authService.getUserId();
      const decision = decideRestore(input, current, target ? await footprintOf(target) : null);
      if (!decision.ok) {
        setError(decision.error);
        return;
      }
      // Le profil actuel de ce téléphone est remplacé : copies locales vidées, puis nouvel identifiant
      await userListsStore.quiesceSync();
      await discoveryStore.resetLocal();
      await discountCardsStore.resetLocal();
      await clearDeviceLikedSpotIds();
      await userListsStore.resetLocal();
      await replaceDeviceId(decision.deviceId);
      await authService.adoptDeviceIdentity(decision.deviceId);
      onClose();
      message('Profil retrouvé', 'Ferme complètement l’application puis rouvre-la : tes likes, listes et points reviennent.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <KeyRound size={20} color={Brand.primaryDeep} />
              <Text style={styles.title}>Code de récupération</Text>
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
            <Text style={styles.text}>
              Note ce code quelque part de sûr. Sur un nouveau téléphone, ou après avoir réinstallé l’appli, il te permet de
              retrouver tes likes, tes listes et tes points.
            </Text>

            <Pressable
              style={styles.codeBox}
              onPress={() => setRevealed((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={revealed ? 'Masquer le code' : 'Afficher le code'}
            >
              <Text style={styles.code} selectable={revealed}>
                {code ? (revealed ? code : '••••••••-••••-••••-••••-••••••••••••') : '…'}
              </Text>
              <Text style={styles.codeHint}>{revealed ? 'Appuie pour masquer' : 'Appuie pour afficher'}</Text>
            </Pressable>
            <Text style={styles.warn}>
              Garde-le pour toi : quiconque le connaît peut ouvrir ton profil. Pour faire effacer un profil perdu, envoie ce
              code à contact@lepetittou.net.
            </Text>

            <Text style={styles.section}>Retrouver un autre profil</Text>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="Colle ou tape ton code"
              placeholderTextColor={Brand.inkMute}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={48}
              accessibilityLabel="Code de récupération à restaurer"
            />
            {error && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
            <Pressable
              style={[styles.btn, (busy || !input.trim()) && styles.btnOff]}
              onPress={restore}
              disabled={busy || !input.trim()}
              accessibilityRole="button"
            >
              {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnText}>Retrouver ce profil</Text>}
            </Pressable>
            <Text style={styles.small}>
              Le profil actuel de ce téléphone est remplacé. Note d’abord son code si tu veux pouvoir y revenir.
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43, 29, 70, 0.65)', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: { backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: Brand.line,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: Font.display, fontSize: 20, color: Brand.ink },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 12 },
  text: { fontSize: 14, color: Brand.ink, lineHeight: 20 },
  codeBox: { backgroundColor: Brand.primarySoft, borderRadius: 14, padding: 14, alignItems: 'center', gap: 4 },
  code: { fontSize: 15, fontWeight: '800', color: Brand.primaryInk, letterSpacing: 0.5, textAlign: 'center', fontVariant: ['tabular-nums'] },
  codeHint: { fontSize: 12, fontWeight: '600', color: Brand.inkSoft },
  warn: { fontSize: 12.5, lineHeight: 18, color: Brand.inkSoft },
  section: { fontSize: 12, fontWeight: '800', color: Brand.inkSoft, marginTop: 8, textTransform: 'uppercase', letterSpacing: 0.9 },
  input: {
    minHeight: 48, borderRadius: 12, borderWidth: 1.5, borderColor: Brand.line, paddingHorizontal: 14,
    fontSize: 15, color: Brand.ink, backgroundColor: Brand.bg,
  },
  error: { fontSize: 13, fontWeight: '600', color: Brand.primaryInk },
  btn: { minHeight: 48, borderRadius: 12, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center' },
  btnOff: { opacity: 0.5 },
  btnText: { color: Brand.white, fontSize: 15, fontWeight: '800' },
  small: { fontSize: 12, color: Brand.inkSoft, lineHeight: 18 },
});
