import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Brand } from '../../constants/brand';
import { supabase } from '../../lib/supabase';
import {
  adminPushStats,
  adminSendPush,
  PUSH_BODY_MAX,
  PUSH_TITLE_MAX,
  type PushStats,
} from '../../lib/pushAdmin';

interface Props {
  adminCode?: string;
}

const show = (title: string, text: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${text}`);
  else Alert.alert(title, text);
};

export default function PushAdminPanel({ adminCode }: Props) {
  const [stats, setStats] = useState<PushStats | null>(null);
  const [statsError, setStatsError] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const loadStats = useCallback(async () => {
    const res = await adminPushStats(supabase as any, adminCode ?? '');
    if (res.ok) {
      setStats(res.stats);
      setStatsError('');
    } else {
      setStatsError(res.message);
    }
  }, [adminCode]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      const res = await adminSendPush(supabase as any, adminCode ?? '', title, body);
      if (!res.ok) {
        show('Annonce non envoyée', res.message);
        return;
      }
      setTitle('');
      setBody('');
      show(
        'Annonce programmée',
        `${res.recipients} appareil(s) inscrit(s) la recevront dans la minute, sauf entre 21h et 8h (elle part alors le matin).`
      );
      loadStats();
    } finally {
      setSending(false);
    }
  };

  const confirmSend = () => {
    const text = `Envoyer « ${title.trim()} » à tous les appareils inscrits aux notifications ?`;
    if (Platform.OS === 'web') {
      if (window.confirm(text)) send();
      return;
    }
    Alert.alert('Confirmer l’envoi', text, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Envoyer', onPress: send },
    ]);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.h}>Notifications</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Appareils inscrits</Text>
        {stats ? (
          <>
            <Text style={styles.big}>{stats.devices}</Text>
            <Text style={styles.small}>iPhone : {stats.ios} · Android : {stats.android}</Text>
            <Text style={styles.small}>Messages en attente : {stats.pendingMessages}</Text>
            <Text style={styles.small}>
              7 derniers jours :{' '}
              {Object.keys(stats.deliveries7d).length === 0
                ? 'aucun envoi'
                : Object.entries(stats.deliveries7d).map(([k, v]) => `${k} ${v}`).join(' · ')}
            </Text>
          </>
        ) : statsError ? (
          <Text style={styles.error}>{statsError}</Text>
        ) : (
          <ActivityIndicator color={Brand.primary} />
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.label}>Envoyer une annonce</Text>
        <Text style={styles.small}>
          Les événements, dates d’agenda et nouvelles adresses partent automatiquement. Ici : une annonce libre
          (fermeture exceptionnelle, nouveauté…).
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Titre"
          placeholderTextColor={Brand.inkSoft}
          value={title}
          onChangeText={setTitle}
          maxLength={PUSH_TITLE_MAX}
          accessibilityLabel="Titre de l’annonce"
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Message"
          placeholderTextColor={Brand.inkSoft}
          value={body}
          onChangeText={setBody}
          maxLength={PUSH_BODY_MAX}
          multiline
          accessibilityLabel="Message de l’annonce"
        />
        <Text style={styles.small}>{body.length}/{PUSH_BODY_MAX}</Text>
        <Pressable
          style={[styles.btn, (sending || !title.trim() || !body.trim()) && { opacity: 0.5 }]}
          onPress={confirmSend}
          disabled={sending || !title.trim() || !body.trim()}
          accessibilityRole="button"
        >
          {sending ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.btnText}>Envoyer l’annonce</Text>}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14 },
  h: { fontSize: 20, fontWeight: '800', color: Brand.ink },
  card: { backgroundColor: Brand.white, borderRadius: 16, padding: 16, gap: 8, borderWidth: 1, borderColor: Brand.line },
  label: { fontSize: 14, fontWeight: '700', color: Brand.ink },
  big: { fontSize: 32, fontWeight: '800', color: Brand.primaryDeep },
  small: { fontSize: 13, color: Brand.inkSoft },
  error: { fontSize: 13, color: Brand.primaryDeep },
  input: {
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: Brand.ink,
    minHeight: 44,
  },
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  btn: { minHeight: 44, borderRadius: 12, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: Brand.white, fontSize: 15, fontWeight: '700' },
});
