import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImagePlus, Sparkles } from 'lucide-react-native';

import { Brand, Radius, Touch, Type } from '../../constants/brand';
import { supabase, SUPABASE_URL } from '../../lib/supabase';
import { adminRequestUpload, adminSetHomeBackground } from '../../lib/homeBackgroundAdmin';
import { FeaturedError } from '../../lib/featuredAdmin';
import {
  BACKGROUND_BUCKET,
  BACKGROUND_MAX_BYTES,
  GALAXY,
  backgroundImageUrl,
  extensionForMime,
  guessMime,
  sizeAdvice,
  validateBackgroundFile,
  type HomeBackground,
} from '../../lib/homeBackgroundLogic';
import {
  announceHomeBackgroundChanged,
  fetchHomeBackground,
  loadStoredHomeBackground,
} from '../../lib/homeBackgroundStore';

interface Props {
  adminCode?: string;
}

interface Picked {
  uri: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
}

type Step = null | 'verifying' | 'uploading' | 'applying';
const STEP_TEXT: Record<Exclude<Step, null>, string> = {
  verifying: 'Autorisation de l’envoi…',
  uploading: 'Envoi de l’image…',
  applying: 'Mise à jour de l’accueil…',
};

const confirm = (title: string, text: string, onYes: () => void) => {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${text}`)) onYes();
    return;
  }
  Alert.alert(title, text, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Confirmer', onPress: onYes },
  ]);
};

export default function HomeBackgroundAdminPanel({ adminCode }: Props) {
  const [current, setCurrent] = useState<HomeBackground>(GALAXY);
  const [loaded, setLoaded] = useState(false);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [step, setStep] = useState<Step>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const busy = step !== null;

  const refresh = useCallback(async () => {
    const stored = await loadStoredHomeBackground();
    setCurrent(stored);
    const fresh = await fetchHomeBackground();
    if (fresh) setCurrent(fresh);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const fail = (err: unknown) =>
    setNotice({ kind: 'error', text: err instanceof FeaturedError ? err.message : 'Opération impossible pour le moment.' });

  if (!adminCode) {
    return (
      <View style={styles.box}>
        <Text style={styles.boxText}>Reconnecte-toi à l'admin pour changer le fond de l'accueil.</Text>
      </View>
    );
  }

  const choose = async () => {
    if (busy) return;
    setNotice(null);
    try {
      // Le sélecteur du système ne demande aucune autorisation d'accès à la galerie
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      const mimeType = guessMime(asset.uri, asset.mimeType) ?? '';
      // La taille annoncée par le sélecteur n'est pas toujours fournie : on la lit sur le fichier lui-même
      let size = asset.fileSize ?? null;
      if (size == null) {
        const res = await fetch(asset.uri);
        size = (await res.blob()).size;
      }
      const problem = validateBackgroundFile({ mimeType, size });
      if (problem) {
        setPicked(null);
        setNotice({ kind: 'error', text: problem });
        return;
      }
      setPicked({ uri: asset.uri, mimeType, size: size as number, width: asset.width, height: asset.height });
      const advice = sizeAdvice(asset.width, asset.height);
      if (advice) setNotice({ kind: 'error', text: advice });
    } catch {
      setNotice({ kind: 'error', text: 'Impossible d’ouvrir la galerie.' });
    }
  };

  const apply = async () => {
    if (!picked || busy) return;
    const ext = extensionForMime(picked.mimeType);
    if (!ext) return;
    setNotice(null);
    try {
      setStep('verifying');
      const ticket = await adminRequestUpload(supabase as any, adminCode, ext);

      setStep('uploading');
      const response = await fetch(picked.uri);
      const body: any = Platform.OS === 'web' ? await response.blob() : await response.arrayBuffer();
      const { error } = await supabase.storage
        .from(BACKGROUND_BUCKET)
        .upload(ticket.path, body, { contentType: picked.mimeType, upsert: false });
      if (error) {
        setNotice({ kind: 'error', text: 'L’envoi de l’image a échoué : vérifie ta connexion et réessaie.' });
        return;
      }

      setStep('applying');
      await adminSetHomeBackground(supabase as any, adminCode, 'image', ticket.path);
      setPicked(null);
      announceHomeBackgroundChanged();
      await refresh();
      setNotice({ kind: 'ok', text: 'Le nouveau fond est affiché sur l’accueil.' });
    } catch (err) {
      fail(err);
    } finally {
      setStep(null);
    }
  };

  const backToGalaxy = () =>
    confirm('Revenir au thème Galaxy ?', 'L’image actuelle ne sera plus affichée sur l’accueil.', async () => {
      setNotice(null);
      setStep('applying');
      try {
        await adminSetHomeBackground(supabase as any, adminCode, 'galaxy');
        announceHomeBackgroundChanged();
        await refresh();
        setPicked(null);
        setNotice({ kind: 'ok', text: 'Le thème Galaxy est de retour sur l’accueil.' });
      } catch (err) {
        fail(err);
      } finally {
        setStep(null);
      }
    });

  const currentUrl = backgroundImageUrl(SUPABASE_URL, current);

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.h}>Fond de l'accueil</Text>
      <Text style={styles.intro}>
        Choisis l'image affichée derrière « Pour voir la ville en rose » et la barre de recherche. Elle se met à jour
        directement dans l'application, sans nouvelle version.
      </Text>

      {notice && (
        <View style={[styles.notice, notice.kind === 'error' ? styles.noticeError : styles.noticeOk]}>
          <Text style={[styles.noticeText, notice.kind === 'error' && styles.noticeTextError]}>{notice.text}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Fond actuel</Text>
        {!loaded ? (
          <ActivityIndicator color={Brand.primary} />
        ) : currentUrl ? (
          <>
            <Image source={{ uri: currentUrl }} style={styles.preview} resizeMode="cover" accessibilityLabel="Aperçu du fond actuel" />
            <Text style={styles.meta}>Image personnalisée</Text>
            <Pressable style={[styles.secondary, busy && styles.disabled]} disabled={busy} onPress={backToGalaxy} accessibilityRole="button">
              <Sparkles size={16} color={Brand.ink} strokeWidth={2} />
              <Text style={styles.secondaryText}>Revenir au thème Galaxy</Text>
            </Pressable>
          </>
        ) : (
          <>
            <View style={[styles.preview, styles.galaxyPreview]}>
              <Text style={styles.galaxyText}>Thème Galaxy</Text>
            </View>
            <Text style={styles.meta}>Le thème d'origine est affiché.</Text>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{picked ? 'Aperçu du nouveau fond' : 'Changer le fond'}</Text>
        {picked ? (
          <>
            <Image source={{ uri: picked.uri }} style={styles.preview} resizeMode="cover" accessibilityLabel="Aperçu de l'image choisie" />
            <Text style={styles.meta}>
              {extensionForMime(picked.mimeType)?.toUpperCase()} · {(picked.size / (1024 * 1024)).toFixed(2).replace('.', ',')} Mo
              {picked.width && picked.height ? ` · ${picked.width}×${picked.height}` : ''}
            </Text>
            <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={apply} accessibilityRole="button">
              {busy ? (
                <View style={styles.row}>
                  <ActivityIndicator color={Brand.white} />
                  <Text style={styles.primaryText}>{step ? STEP_TEXT[step] : ''}</Text>
                </View>
              ) : (
                <Text style={styles.primaryText}>Afficher sur l'accueil</Text>
              )}
            </Pressable>
            <Pressable style={[styles.link, busy && styles.disabled]} disabled={busy} onPress={choose}>
              <Text style={styles.linkText}>Choisir une autre image</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={choose} accessibilityRole="button">
              <View style={styles.row}>
                <ImagePlus size={18} color={Brand.white} strokeWidth={2} />
                <Text style={styles.primaryText}>Choisir une image</Text>
              </View>
            </Pressable>
            {busy && step && <Text style={styles.meta}>{STEP_TEXT[step]}</Text>}
          </>
        )}
        <Text style={styles.tip}>
          JPEG, PNG ou WebP · {Math.round(BACKGROUND_MAX_BYTES / (1024 * 1024))} Mo au maximum · format paysage conseillé
          (4:3), au moins 1200 px de large. Un voile violet est ajouté pour garder le texte lisible : les images
          sombres ou colorées donnent le meilleur résultat.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 60, gap: 12 },
  h: { fontSize: Type.title2, fontWeight: '800', color: Brand.ink },
  intro: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft },
  box: { padding: 24, alignItems: 'center' },
  boxText: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft, textAlign: 'center', paddingVertical: 8 },
  notice: { borderRadius: Radius.md, padding: 12 },
  noticeOk: { backgroundColor: Brand.primarySoft },
  noticeError: { backgroundColor: Brand.primarySofter },
  noticeText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  noticeTextError: { color: Brand.primaryDeep },
  card: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 16, gap: 10 },
  cardTitle: { fontSize: Type.title3, fontWeight: '700', color: Brand.ink },
  preview: { width: '100%', aspectRatio: 4 / 3, borderRadius: Radius.lg, backgroundColor: Brand.night },
  galaxyPreview: { alignItems: 'center', justifyContent: 'center' },
  galaxyText: { color: Brand.white, fontSize: Type.title3, fontWeight: '800' },
  meta: { fontSize: Type.small, fontWeight: '600', color: Brand.inkSoft },
  tip: { fontSize: Type.small, fontWeight: '500', color: Brand.inkSoft },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.white },
  secondary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 16 },
  secondaryText: { fontSize: Type.body, fontWeight: '700', color: Brand.ink },
  link: { minHeight: Touch.min, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: Type.body, fontWeight: '700', color: Brand.inkSoft },
  disabled: { opacity: 0.6 },
});
