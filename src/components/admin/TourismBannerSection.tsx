import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CalendarDays } from 'lucide-react-native';

import { Brand, Radius, Touch, Type } from '../../constants/brand';
import { supabase } from '../../lib/supabase';
import { adminSetTourismBanner, TourismBannerError } from '../../lib/tourismBannerAdmin';
import { announceTourismBannerChanged, fetchTourismUrl, loadStoredTourismUrl } from '../../lib/tourismBannerStore';
import { DEFAULT_TOURISM_URL, TOURISM_URL_MAX, validateTourismUrl } from '../../lib/tourismBannerLogic';
import { confirmAction } from './confirmAction';

interface Props {
  adminCode: string;
}

/**
 * « Bannière Office de tourisme » : le bouton de l'accueil renvoie vers l'adresse saisie ici (agenda officiel par défaut).
 * Le serveur revérifie tout (code admin, https, longueur) ; ici on refuse d'avance ce qui serait refusé, avec un message clair.
 */
export default function TourismBannerSection({ adminCode }: Props) {
  const [current, setCurrent] = useState<string>(DEFAULT_TOURISM_URL);
  const [draft, setDraft] = useState<string>(DEFAULT_TOURISM_URL);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const touched = useRef(false);

  // Dernier lien connu tout de suite, puis lien frais ; ce que l'admin a déjà tapé n'est jamais écrasé.
  useEffect(() => {
    let alive = true;
    const apply = (url: string) => {
      if (!alive) return;
      setCurrent(url);
      if (!touched.current) setDraft(url);
    };
    loadStoredTourismUrl().then(apply);
    fetchTourismUrl().then((fresh) => {
      if (fresh) apply(fresh);
    });
    return () => {
      alive = false;
    };
  }, []);

  const check = validateTourismUrl(draft);
  const invalid = !check.ok;
  const effective = check.ok ? check.url ?? DEFAULT_TOURISM_URL : null;
  const dirty = effective !== null && effective !== current;

  const save = async (rawUrl: string, okText: string) => {
    setBusy(true);
    setNotice(null);
    try {
      await adminSetTourismBanner(supabase as any, adminCode, rawUrl);
      announceTourismBannerChanged();
      const fresh = await fetchTourismUrl();
      const url = fresh ?? (rawUrl.trim() ? (validateTourismUrl(rawUrl) as any).url : DEFAULT_TOURISM_URL);
      touched.current = false;
      setCurrent(url);
      setDraft(url);
      setNotice({ kind: 'ok', text: okText });
    } catch (e) {
      setNotice({ kind: 'error', text: e instanceof TourismBannerError ? e.message : 'Enregistrement impossible. Réessaie.' });
    } finally {
      setBusy(false);
    }
  };

  const onSave = () => {
    if (!check.ok) return;
    save(check.url ?? '', 'Le bouton de l’accueil renvoie maintenant vers cette adresse.');
  };

  const onReset = () =>
    confirmAction('Remettre le lien par défaut ?', 'Le bouton renverra vers l’agenda officiel de l’Office de tourisme de Toulouse.', () =>
      save('', 'Le lien par défaut est de retour.')
    );

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <CalendarDays size={20} color={Brand.primaryDeep} strokeWidth={2} />
        <Text style={styles.h}>Bannière Office de tourisme</Text>
      </View>
      <Text style={styles.intro}>
        Le bouton « L'agenda de Toulouse » de l'accueil renvoie vers l'adresse ci-dessous. L'Office de tourisme peut y mettre
        la page de son choix : le changement est visible tout de suite dans l'appli.
      </Text>

      {notice && (
        <View style={[styles.notice, notice.kind === 'error' ? styles.noticeError : styles.noticeOk]} accessibilityLiveRegion="polite">
          <Text style={[styles.noticeText, notice.kind === 'error' && styles.noticeTextError]}>{notice.text}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.label}>Adresse du lien</Text>
        <TextInput
          style={[styles.input, invalid && styles.inputInvalid]}
          value={draft}
          onChangeText={(t) => {
            touched.current = true;
            setNotice(null);
            setDraft(t);
          }}
          placeholder={DEFAULT_TOURISM_URL}
          placeholderTextColor={Brand.inkMute}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          maxLength={TOURISM_URL_MAX + 20}
          accessibilityLabel="Adresse du lien de la bannière Office de tourisme"
        />
        {!check.ok && <Text style={styles.inputError}>{check.error}</Text>}
        <Text style={styles.hint}>
          Adresse complète qui commence par https://. Champ vide = agenda officiel de l'Office de tourisme.
        </Text>

        <Pressable
          style={[styles.primary, (busy || invalid || !dirty) && styles.disabled]}
          onPress={onSave}
          disabled={busy || invalid || !dirty}
          accessibilityRole="button"
          accessibilityLabel="Enregistrer le lien de la bannière"
        >
          {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>Enregistrer</Text>}
        </Pressable>

        {current !== DEFAULT_TOURISM_URL && (
          <Pressable style={styles.link} onPress={onReset} disabled={busy} accessibilityRole="button">
            <Text style={styles.linkText}>Remettre le lien par défaut</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h: { fontSize: Type.title2, fontWeight: '800', color: Brand.ink },
  intro: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft },
  notice: { borderRadius: Radius.md, padding: 12 },
  noticeOk: { backgroundColor: Brand.primarySoft },
  noticeError: { backgroundColor: Brand.primarySofter },
  noticeText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  noticeTextError: { color: Brand.primaryInk },
  card: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 16, gap: 10 },
  label: { fontSize: Type.small, fontWeight: '700', color: Brand.ink },
  hint: { fontSize: Type.caption, fontWeight: '500', color: Brand.inkSoft },
  input: {
    minHeight: Touch.min,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: Brand.bg,
    paddingHorizontal: 12,
    fontSize: Type.body,
    fontWeight: '600',
    color: Brand.ink,
  },
  inputInvalid: { borderColor: Brand.primaryDeep },
  inputError: { fontSize: Type.caption, fontWeight: '600', color: Brand.primaryInk },
  primary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.white },
  link: { minHeight: Touch.min, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: Type.body, fontWeight: '700', color: Brand.inkSoft },
  disabled: { opacity: 0.6 },
});
