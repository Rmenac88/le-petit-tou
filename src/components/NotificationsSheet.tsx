import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Bell, X } from 'lucide-react-native';
import { Brand, Radius, Touch, Type } from '../constants/brand';
import {
  disablePush,
  enablePush,
  loadPushState,
  openSystemSettings,
  updatePushPrefs,
  type PushState,
} from '../lib/pushRegistration';
import { DEFAULT_PREFS, type NotificationPrefs } from '../lib/pushPrefs.ts';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * Réglage des notifications. Rien n'est demandé tant que la personne n'appuie pas sur « Activer ».
 * Deux catégories seulement ; aucune notification publicitaire de partenaire.
 */
export default function NotificationsSheet({ visible, onClose }: Props) {
  const [state, setState] = useState<PushState | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const s = await loadPushState();
    setState(s);
    setPrefs(s.prefs);
  }, []);

  useEffect(() => {
    if (visible) {
      setMessage(null);
      refresh();
    }
  }, [visible, refresh]);

  const activate = async () => {
    setBusy(true);
    setMessage(null);
    const result = await enablePush(prefs);
    if (!result.ok) {
      setMessage(
        result.reason === 'denied'
          ? "Les notifications sont refusées. Tu peux les autoriser dans les réglages du téléphone."
          : result.reason === 'unavailable'
          ? 'Les notifications ne sont pas encore disponibles.'
          : "Impossible d'activer les notifications pour le moment. Réessaie dans un instant."
      );
    }
    await refresh();
    setBusy(false);
  };

  const deactivate = async () => {
    setBusy(true);
    setMessage(null);
    if (!(await disablePush())) setMessage('Impossible de désactiver pour le moment. Réessaie.');
    await refresh();
    setBusy(false);
  };

  const change = async (patch: Partial<NotificationPrefs>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (state?.enabled && !(await updatePushPrefs(next))) {
      setPrefs(prefs);
      setMessage("Le changement n'a pas pu être enregistré. Réessaie.");
    }
  };

  const renderBody = () => {
    if (!state) return <ActivityIndicator color={Brand.primaryDeep} style={styles.loader} />;

    if (state.availability !== 'ready') {
      return (
        <Text style={styles.text}>
          Les notifications sont disponibles dans l'appli installée sur ton téléphone.
        </Text>
      );
    }

    if (state.permission === 'denied') {
      return (
        <>
          <Text style={styles.text}>
            Les notifications sont refusées pour Le Petit Tou. Autorise-les dans les réglages du téléphone pour les recevoir.
          </Text>
          <Pressable style={styles.primary} onPress={openSystemSettings} accessibilityLabel="Ouvrir les réglages du téléphone">
            <Text style={styles.primaryText}>Ouvrir les réglages</Text>
          </Pressable>
        </>
      );
    }

    return (
      <>
        <Text style={styles.text}>
          Reçois un message quand l'association organise quelque chose ou ajoute de nouvelles adresses. Tu choisis ce que tu reçois, et tu peux tout arrêter ici à tout moment.
        </Text>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Les événements de l'association</Text>
            <Text style={styles.rowSub}>Soirées, lancements, rendez-vous.</Text>
          </View>
          <Switch
            value={prefs.events}
            onValueChange={(v) => change({ events: v })}
            trackColor={{ false: Brand.line, true: Brand.primaryDeep }}
            thumbColor={Brand.white}
            accessibilityLabel="Recevoir les événements de l'association"
          />
        </View>

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Les nouvelles adresses</Text>
            <Text style={styles.rowSub}>Quand le guide s'enrichit.</Text>
          </View>
          <Switch
            value={prefs.spots}
            onValueChange={(v) => change({ spots: v })}
            trackColor={{ false: Brand.line, true: Brand.primaryDeep }}
            thumbColor={Brand.white}
            accessibilityLabel="Recevoir les nouvelles adresses"
          />
        </View>

        {state.enabled ? (
          <Pressable style={styles.secondary} onPress={deactivate} disabled={busy} accessibilityLabel="Désactiver les notifications">
            <Text style={styles.secondaryText}>Désactiver les notifications</Text>
          </Pressable>
        ) : (
          <Pressable style={[styles.primary, busy && styles.disabled]} onPress={activate} disabled={busy} accessibilityLabel="Activer les notifications">
            <Text style={styles.primaryText}>{busy ? 'Activation…' : 'Activer les notifications'}</Text>
          </Pressable>
        )}

        <Text style={styles.fine}>Aucune notification publicitaire de partenaire n'est envoyée.</Text>
      </>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} accessibilityLabel="Fermer" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerTitle}>
              <Bell size={20} color={Brand.primaryDeep} strokeWidth={2} />
              <Text style={styles.title}>Notifications</Text>
            </View>
            <Pressable style={styles.close} onPress={onClose} accessibilityLabel="Fermer">
              <X size={20} color={Brand.ink} strokeWidth={2} />
            </Pressable>
          </View>
          {renderBody()}
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(26, 26, 34, 0.45)' },
  backdropPress: { flex: 1 },
  sheet: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    padding: 20,
    paddingBottom: 36,
    gap: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: Type.title2, fontWeight: '800', color: Brand.ink },
  close: { width: Touch.min, height: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft, lineHeight: 21 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: Touch.min, paddingVertical: 6 },
  rowText: { flex: 1 },
  rowTitle: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.ink },
  rowSub: { fontSize: Type.small, fontWeight: '500', color: Brand.inkSoft, marginTop: 2 },
  primary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  primaryText: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.white },
  secondary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.line, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  secondaryText: { fontSize: Type.body, fontWeight: '700', color: Brand.ink },
  disabled: { opacity: 0.6 },
  fine: { fontSize: Type.caption, fontWeight: '500', color: Brand.inkSoft, textAlign: 'center' },
  message: { fontSize: Type.small, fontWeight: '600', color: Brand.primaryDeep },
  loader: { paddingVertical: 24 },
});
