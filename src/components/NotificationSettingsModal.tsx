import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Bell, X } from 'lucide-react-native';

import { Brand } from '../constants/brand';
import {
  disablePush,
  enablePush,
  getPushState,
  updatePushPreferences,
  type PushState,
} from '../lib/pushNotifications';
import { DEFAULT_PUSH_PREFERENCES, type PushPreferences } from '../lib/pushLogic';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const message = (title: string, text: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${text}`);
  else Alert.alert(title, text);
};

const OPTIONS: { key: keyof PushPreferences; label: string; hint: string }[] = [
  { key: 'notify_events', label: 'Événements', hint: 'Un nouvel événement est publié.' },
  { key: 'notify_agenda', label: 'Agenda des partenaires', hint: 'Une nouvelle date est ajoutée à l’agenda.' },
  { key: 'notify_new_spots', label: 'Nouvelles adresses', hint: 'Des adresses viennent d’arriver dans le guide.' },
];

export default function NotificationSettingsModal({ visible, onClose }: Props) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);

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
        <SafeAreaView style={styles.safe}>
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

            <ScrollView contentContainerStyle={styles.body}>
              {!state ? (
                <ActivityIndicator color={Brand.primary} />
              ) : !state.supported ? (
                <Text style={styles.text}>
                  Les notifications sont disponibles dans l’application installée sur ton téléphone.
                </Text>
              ) : (
                <>
                  <View style={styles.row}>
                    <View style={styles.rowText}>
                      <Text style={styles.label}>Recevoir les notifications</Text>
                      <Text style={styles.hint}>Peu de messages, jamais la nuit (21 h – 8 h).</Text>
                    </View>
                    <Switch
                      value={state.enabled}
                      onValueChange={toggleMaster}
                      disabled={busy || state.permission === 'blocked'}
                      trackColor={{ true: Brand.primary, false: Brand.line }}
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
                  {OPTIONS.map((o) => (
                    <View key={o.key} style={styles.row}>
                      <View style={styles.rowText}>
                        <Text style={styles.label}>{o.label}</Text>
                        <Text style={styles.hint}>{o.hint}</Text>
                      </View>
                      <Switch
                        value={prefs[o.key]}
                        onValueChange={(v) => toggleOption(o.key, v)}
                        disabled={busy}
                        trackColor={{ true: Brand.primary, false: Brand.line }}
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
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(43, 29, 70, 0.65)', justifyContent: 'flex-end' },
  safe: { justifyContent: 'flex-end' },
  sheet: { backgroundColor: Brand.white, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '85%' },
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
  title: { fontSize: 18, fontWeight: '700', color: Brand.ink },
  body: { padding: 20, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56, gap: 12 },
  rowText: { flex: 1 },
  label: { fontSize: 15, fontWeight: '600', color: Brand.ink },
  hint: { fontSize: 13, color: Brand.inkSoft, marginTop: 2 },
  section: { fontSize: 13, fontWeight: '700', color: Brand.inkSoft, marginTop: 16, textTransform: 'uppercase', letterSpacing: 0.8 },
  text: { fontSize: 14, color: Brand.ink, lineHeight: 20 },
  small: { fontSize: 12, color: Brand.inkSoft, marginTop: 16, lineHeight: 18 },
  notice: { backgroundColor: Brand.primarySoft, borderRadius: 12, padding: 14, gap: 10, marginTop: 8 },
  btn: { minHeight: 44, borderRadius: 12, backgroundColor: Brand.primary, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
});
