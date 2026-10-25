import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Bell, X } from 'lucide-react-native';

import { Brand, Font } from '../constants/brand';
import BrandSwitch from './BrandSwitch';
import {
  disablePush,
  enablePush,
  getPushState,
  updatePushPreferences,
  type PushState,
} from '../lib/pushNotifications';
import { DEFAULT_PUSH_PREFERENCES, PUSH_OPTIONS, type PushPreferences } from '../lib/pushLogic';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const message = (title: string, text: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${text}`);
  else Alert.alert(title, text);
};

export default function NotificationSettingsModal({ visible, onClose }: Props) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const insets = useSafeAreaInsets();

  const refresh = useCallback(async () => {
    setState(await getPushState());
  }, []);

  useEffect(() => {
    if (visible) refresh();
  }, [visible, refresh]);

  const prefs = state?.prefs ?? DEFAULT_PUSH_PREFERENCES;

  const toggleMaster = async (next: boolean) => {
    if (busy || !state) return;
    setBusy(true);
    try {
      const res = next ? await enablePush(prefs) : await disablePush();
      if (!res.ok) message('Notifications', res.message);
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const toggleOption = async (key: keyof PushPreferences, value: boolean) => {
    if (busy || !state) return;
    const next = { ...prefs, [key]: value };
    setState({ ...state, prefs: next });
    if (!state.enabled) return;
    setBusy(true);
    try {
      const res = await updatePushPreferences(next);
      if (!res.ok) {
        message('Notifications', res.message);
        await refresh();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={styles.safe}>
          <View style={styles.sheet}>
            <View style={styles.header}>
              <View style={styles.titleRow}>
                <Bell size={20} color={Brand.primaryDeep} />
                <Text style={styles.title}>Notifications</Text>
              </View>
              <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fermer">
                <X size={20} color={Brand.inkSoft} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]} showsVerticalScrollIndicator={false}>
              {!state ? (
                <ActivityIndicator color={Brand.primary} />
              ) : !state.supported ? (
                <Text style={styles.text}>
                  Les notifications sont disponibles dans l’application installée sur ton téléphone.
                </Text>
              ) : (
                <>
                  <View style={[styles.card, styles.masterCard]}>
                    <View style={styles.bellCircle}>
                      <Bell size={20} color={Brand.primaryDeep} strokeWidth={2.2} />
                    </View>
                    <View style={styles.rowText}>
                      <Text style={styles.label}>Recevoir les notifications</Text>
                      <Text style={styles.hint}>Peu de messages, jamais la nuit (21 h – 8 h).</Text>
                    </View>
                    <BrandSwitch
                      value={state.enabled}
                      onValueChange={toggleMaster}
                      disabled={busy || state.permission === 'blocked'}
                      accessibilityLabel="Recevoir les notifications"
                    />
                  </View>

                  {state.permission === 'blocked' && (
                    <View style={styles.notice}>
                      <Text style={styles.text}>
                        Les notifications sont bloquées dans les réglages de ton téléphone.
                      </Text>
                      <Pressable
                        style={styles.btn}
                        onPress={() => Linking.openSettings().catch(() => {})}
                        accessibilityRole="button"
                      >
                        <Text style={styles.btnText}>Ouvrir les réglages</Text>
                      </Pressable>
                    </View>
                  )}

                  <Text style={styles.section}>Me prévenir quand…</Text>
                  {PUSH_OPTIONS.map((o) => (
                    <View key={o.key} style={[styles.card, !state.enabled && styles.cardOff]}>
                      <Text style={styles.emoji}>{o.emoji}</Text>
                      <View style={styles.rowText}>
                        <Text style={styles.label}>{o.label}</Text>
                        <Text style={styles.hint}>{o.hint}</Text>
                      </View>
                      <BrandSwitch
                        value={prefs[o.key]}
                        onValueChange={(v) => toggleOption(o.key, v)}
                        disabled={busy}
                        accessibilityLabel={o.label}
                      />
                    </View>
                  ))}

                  <Text style={styles.small}>
                    Ton choix est enregistré avec l’identifiant aléatoire de ton téléphone. Tu peux l’arrêter ici à tout moment ;
                    « Effacer mes données » supprime aussi ce choix.
                  </Text>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43, 29, 70, 0.65)', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  safe: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '88%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: Brand.line,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  title: { fontFamily: Font.display, fontSize: 20, color: Brand.ink },
  body: { paddingHorizontal: 20, paddingTop: 16, gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.bg,
    borderRadius: 18,
    paddingVertical: 14,
    paddingLeft: 14,
    paddingRight: 12,
  },
  masterCard: { backgroundColor: Brand.primarySoft },
  cardOff: { opacity: 0.7 },
  bellCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Brand.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 22, width: 30, textAlign: 'center' },
  rowText: { flex: 1, minWidth: 0 },
  label: { fontSize: 15, fontWeight: '700', color: Brand.ink },
  hint: { fontSize: 12.5, lineHeight: 17, color: Brand.inkSoft, marginTop: 2 },
  section: { fontSize: 12, fontWeight: '800', color: Brand.inkSoft, marginTop: 10, marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.9 },
  text: { fontSize: 14, color: Brand.ink, lineHeight: 20 },
  small: { fontSize: 12, color: Brand.inkSoft, marginTop: 16, lineHeight: 18 },
  notice: { backgroundColor: Brand.primarySoft, borderRadius: 12, padding: 14, gap: 10, marginTop: 8 },
  btn: { minHeight: 44, borderRadius: 12, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
});
