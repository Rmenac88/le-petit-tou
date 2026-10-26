import React, { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';

import { Brand, Font } from '../constants/brand';
import { enablePush } from '../lib/pushNotifications';
import { DEFAULT_PUSH_PREFERENCES, PUSH_OPTIONS, hasAnyPushChoice, type PushPreferences } from '../lib/pushLogic';
import BrandSwitch from './BrandSwitch';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Proposé une seule fois, au tout premier lancement : l'utilisateur choisit ce qu'il veut recevoir, puis le système
 * demande l'autorisation. « Plus tard » ne demande rien (les réglages restent accessibles à tout moment).
 */
export default function NotificationWelcomeModal({ visible, onClose }: Props) {
  const [prefs, setPrefs] = useState<PushPreferences>(DEFAULT_PUSH_PREFERENCES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const wantsAny = hasAnyPushChoice(prefs);

  const confirm = async () => {
    if (busy) return;
    if (!wantsAny) {
      onClose();
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await enablePush(prefs);
      if (res.ok) onClose();
      else setError(res.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} bounces={false}>
            <View style={styles.iconCircle}>
              <Bell size={26} color={Brand.primaryDeep} strokeWidth={2.2} />
            </View>
            <Text style={styles.title}>On reste en contact ?</Text>
            <Text style={styles.subtitle}>
              Choisis ce que tu veux recevoir. Peu de messages, jamais la nuit (21 h – 8 h).
            </Text>

            <View style={styles.options}>
              {PUSH_OPTIONS.map((o) => (
                <View key={o.key} style={styles.option}>
                  <Text style={styles.emoji}>{o.emoji}</Text>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{o.label}</Text>
                    <Text style={styles.optionHint}>{o.hint}</Text>
                  </View>
                  <BrandSwitch
                    value={prefs[o.key]}
                    onValueChange={(v) => setPrefs((p) => ({ ...p, [o.key]: v }))}
                    disabled={busy}
                    accessibilityLabel={o.label}
                  />
                </View>
              ))}
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={confirm}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [styles.primary, !wantsAny && styles.primaryQuiet, pressed && styles.pressed]}
            >
              {busy ? (
                <ActivityIndicator color={Brand.white} />
              ) : (
                <Text style={[styles.primaryText, !wantsAny && styles.primaryQuietText]}>
                  {wantsAny ? 'Activer les notifications' : 'Continuer sans notifications'}
                </Text>
              )}
            </Pressable>
            <Pressable onPress={onClose} disabled={busy} accessibilityRole="button" style={styles.later} hitSlop={8}>
              <Text style={styles.laterText}>Plus tard</Text>
            </Pressable>
            <Text style={styles.footnote}>Tu pourras changer d’avis à tout moment dans les réglages.</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 29, 70, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '88%',
    backgroundColor: Brand.white,
    borderRadius: 28,
    shadowColor: '#2B1D46',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 28,
    elevation: 12,
  },
  content: { padding: 24, alignItems: 'center' },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Brand.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: Font.display, fontSize: 24, color: Brand.ink, marginTop: 14, textAlign: 'center' },
  subtitle: { fontSize: 14, lineHeight: 20, color: Brand.inkSoft, marginTop: 6, textAlign: 'center' },
  options: { alignSelf: 'stretch', marginTop: 18, gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Brand.bg,
    borderRadius: 18,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
  },
  emoji: { fontSize: 22, width: 30, textAlign: 'center' },
  optionText: { flex: 1, minWidth: 0 },
  optionLabel: { fontSize: 15, fontWeight: '700', color: Brand.ink },
  optionHint: { fontSize: 12.5, lineHeight: 17, color: Brand.inkSoft, marginTop: 1 },
  error: { alignSelf: 'stretch', marginTop: 14, fontSize: 13, lineHeight: 18, color: Brand.primaryDeep, textAlign: 'center' },
  primary: {
    alignSelf: 'stretch',
    minHeight: 52,
    marginTop: 20,
    borderRadius: 16,
    backgroundColor: Brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryQuiet: { backgroundColor: Brand.bg },
  primaryText: { color: Brand.white, fontSize: 16, fontWeight: '800' },
  primaryQuietText: { color: Brand.inkSoft },
  pressed: { opacity: 0.85 },
  later: { minHeight: 44, justifyContent: 'center', marginTop: 4 },
  laterText: { fontSize: 14, fontWeight: '700', color: Brand.inkSoft },
  footnote: { fontSize: 12, lineHeight: 17, color: Brand.inkMute, textAlign: 'center' },
});
