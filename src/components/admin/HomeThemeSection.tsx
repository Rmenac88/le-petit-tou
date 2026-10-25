import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Palette } from 'lucide-react-native';

import { Brand, Radius, Touch, Type } from '../../constants/brand';
import { supabase } from '../../lib/supabase';
import { adminResetHomeTheme, adminSetHomeTheme, ThemeError } from '../../lib/homeThemeAdmin';
import { announceHomeThemeChanged, fetchHomeTheme, loadStoredHomeTheme } from '../../lib/homeThemeStore';
import {
  DEFAULT_THEME,
  THEME_PRESETS,
  THEME_SWATCHES,
  THEME_TEXT_LIMITS,
  normalizeHex,
  parseHomeTheme,
  applyPreset,
  resolveTheme,
  sameLook,
  sameTheme,
  validateThemeDraft,
  type HomeTheme,
} from '../../lib/homeThemeLogic';
import BrandSwitch from '../BrandSwitch';
import Stars from '../Stars';
import { confirmAction } from './confirmAction';

type Slot = 'bg' | 'bg2' | 'accent' | 'text';
const SLOTS: { id: Slot; label: string }[] = [
  { id: 'bg', label: 'Fond' },
  { id: 'bg2', label: 'Dégradé' },
  { id: 'accent', label: 'Accent' },
  { id: 'text', label: 'Texte' },
];

type TextKey = 'name' | 'line1' | 'line2' | 'subtitle';
const TEXT_FIELDS: { key: TextKey; label: string; hint?: string }[] = [
  { key: 'line1', label: 'Première ligne du titre' },
  { key: 'line2', label: 'Seconde ligne (couleur d’accent)' },
  { key: 'subtitle', label: 'Sous-titre' },
  { key: 'name', label: 'Nom du thème', hint: 'Pour te repérer, il n’est pas affiché dans l’appli.' },
];

interface Props {
  adminCode: string;
}

/**
 * « Thème de l'année » : couleurs, étoiles et phrases du haut de l'accueil, avec aperçu en direct. Les couleurs de
 * texte trop proches du fond sont corrigées à l'affichage (jamais d'accueil illisible) ; l'enregistrement est refusé
 * si aucun texte ne peut être lu sur le fond choisi.
 */
export default function HomeThemeSection({ adminCode }: Props) {
  const [current, setCurrent] = useState<HomeTheme>(DEFAULT_THEME);
  const [draft, setDraft] = useState<HomeTheme>(DEFAULT_THEME);
  const [loaded, setLoaded] = useState(false);
  const [slot, setSlot] = useState<Slot>('bg');
  const [hexInput, setHexInput] = useState(DEFAULT_THEME.bg);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const touched = useRef(false);

  const hexOf = useCallback((theme: HomeTheme, s: Slot) => (s === 'bg2' ? theme.bg2 ?? '' : theme[s]), []);

  // Dernier thème connu tout de suite, puis thème frais ; ce que l'admin a déjà modifié n'est jamais écrasé.
  useEffect(() => {
    let alive = true;
    const apply = (theme: HomeTheme) => {
      if (!alive) return;
      setCurrent(theme);
      if (!touched.current) {
        setDraft(theme);
        setHexInput(hexOf(theme, 'bg'));
      }
    };
    loadStoredHomeTheme().then(apply);
    fetchHomeTheme().then((fresh) => {
      if (fresh) apply(fresh);
      if (alive) setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [hexOf]);

  const resolved = useMemo(() => resolveTheme(draft), [draft]);
  const dirty = !sameTheme(draft, current);

  const change = (patch: Partial<HomeTheme>) => {
    touched.current = true;
    setNotice(null);
    setDraft((d) => ({ ...d, ...patch }));
  };

  const pickSlot = (next: Slot) => {
    setSlot(next);
    setHexInput(hexOf(draft, next));
  };

  const setColor = (hex: string) => {
    setHexInput(hex);
    if (slot === 'bg2' && hex.trim() === '') {
      change({ bg2: null });
      return;
    }
    const valid = normalizeHex(hex);
    if (valid) change({ [slot]: valid } as Partial<HomeTheme>);
  };

  const usePreset = (preset: HomeTheme) => {
    change(applyPreset(draft, preset));
    setHexInput(hexOf(preset, slot));
  };

  const save = async () => {
    if (busy) return;
    const problem = validateThemeDraft(draft);
    if (problem) {
      setNotice({ kind: 'error', text: problem });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const setting = await adminSetHomeTheme(supabase as any, adminCode, draft);
      const saved = parseHomeTheme(setting);
      setCurrent(saved);
      setDraft(saved);
      touched.current = false;
      announceHomeThemeChanged();
      setNotice({ kind: 'ok', text: `Le thème « ${saved.name} » est affiché sur l’accueil.` });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof ThemeError ? err.message : 'Opération impossible pour le moment.' });
    } finally {
      setBusy(false);
    }
  };

  const reset = () =>
    confirmAction('Revenir au thème d’origine ?', 'Les couleurs et les phrases du haut de l’accueil retrouvent leur aspect d’origine (violet « Galaxy »).', async () => {
      setBusy(true);
      setNotice(null);
      try {
        await adminResetHomeTheme(supabase as any, adminCode);
        setCurrent(DEFAULT_THEME);
        setDraft(DEFAULT_THEME);
        setHexInput(hexOf(DEFAULT_THEME, slot));
        touched.current = false;
        announceHomeThemeChanged();
        setNotice({ kind: 'ok', text: 'Le thème d’origine est de retour sur l’accueil.' });
      } catch (err) {
        setNotice({ kind: 'error', text: err instanceof ThemeError ? err.message : 'Opération impossible pour le moment.' });
      } finally {
        setBusy(false);
      }
    });

  const hexInvalid = hexInput.trim() !== '' && !normalizeHex(hexInput);

  return (
    <View style={styles.wrap}>
      <View style={styles.titleRow}>
        <Palette size={20} color={Brand.ink} strokeWidth={2} />
        <Text style={styles.h}>Thème de l'année</Text>
      </View>
      <Text style={styles.intro}>
        Change les couleurs, les étoiles et les phrases du haut de l'accueil. Le changement apparaît dans l'application
        sans nouvelle version. Les autres écrans gardent les couleurs de la marque.
      </Text>

      {notice && (
        <View style={[styles.notice, notice.kind === 'error' ? styles.noticeError : styles.noticeOk]} accessibilityLiveRegion="polite">
          <Text style={[styles.noticeText, notice.kind === 'error' && styles.noticeTextError]}>{notice.text}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Aperçu</Text>
        <View style={[styles.hero, { backgroundColor: resolved.backgrounds[0] }]} accessibilityLabel="Aperçu du haut de l'accueil">
          {resolved.backgrounds.length > 1 && (
            <LinearGradient
              pointerEvents="none"
              colors={[resolved.backgrounds[0], resolved.backgrounds[1]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          )}
          {resolved.showStars && <Stars />}
          <Text style={[styles.heroTitle, { color: resolved.titleColor }]} numberOfLines={1}>{draft.line1}</Text>
          <Text style={[styles.heroTitle, { color: resolved.accentColor }]} numberOfLines={1}>{draft.line2}</Text>
          <Text style={[styles.heroSub, { color: resolved.subtitleColor }]} numberOfLines={2}>{draft.subtitle}</Text>
          <View style={styles.fakeSearch}>
            <View style={styles.fakeBadge} />
            <Text style={styles.fakeSearchText} numberOfLines={1}>Rechercher une adresse...</Text>
          </View>
        </View>
        {resolved.adjusted && (
          <Text style={styles.warn}>Une couleur de texte était trop proche du fond : elle est ajustée automatiquement pour rester lisible.</Text>
        )}
        {!loaded && <ActivityIndicator color={Brand.primary} />}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Point de départ</Text>
        <Text style={styles.hint}>Change les couleurs et les étoiles ; tes phrases sont conservées.</Text>
        <View style={styles.chips}>
          {THEME_PRESETS.map((preset) => {
            const active = sameLook(draft, preset);
            return (
              <Pressable
                key={preset.name}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => usePreset(preset)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`Thème ${preset.name}`}
              >
                <View style={[styles.dot, { backgroundColor: preset.bg }]} />
                <View style={[styles.dot, styles.dotOverlap, { backgroundColor: preset.accent }]} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{preset.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Couleurs</Text>
        <View style={styles.chips}>
          {SLOTS.map((s) => {
            const value = hexOf(draft, s.id);
            const active = slot === s.id;
            return (
              <Pressable
                key={s.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => pickSlot(s.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.dot, styles.dotLine, { backgroundColor: value || Brand.white }]} />
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>
          {slot === 'bg2' ? 'Fin du dégradé (vide = fond uni)' : `Couleur « ${SLOTS.find((s) => s.id === slot)?.label.toLowerCase()} »`}
        </Text>
        <TextInput
          style={[styles.input, hexInvalid && styles.inputInvalid]}
          value={hexInput}
          onChangeText={setColor}
          placeholder="#2B1D46"
          placeholderTextColor={Brand.inkMute}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          accessibilityLabel="Code couleur"
        />
        {hexInvalid && <Text style={styles.inputError}>Format attendu : # suivi de 6 caractères (par exemple #2B1D46).</Text>}

        <View style={styles.swatches}>
          {THEME_SWATCHES.map((hex) => {
            const selected = normalizeHex(hexInput) === hex;
            return (
              <Pressable
                key={hex}
                style={[styles.swatch, { backgroundColor: hex }, selected && styles.swatchSelected]}
                onPress={() => setColor(hex)}
                accessibilityRole="button"
                accessibilityLabel={`Couleur ${hex}`}
                accessibilityState={{ selected }}
              />
            );
          })}
        </View>
        {slot === 'bg2' && draft.bg2 !== null && (
          <Pressable style={styles.link} onPress={() => setColor('')} accessibilityRole="button">
            <Text style={styles.linkText}>Retirer le dégradé</Text>
          </Pressable>
        )}

        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={styles.label}>Étoiles</Text>
            <Text style={styles.hint}>Visibles seulement sur un fond sombre.</Text>
          </View>
          <BrandSwitch value={draft.stars} onValueChange={(v) => change({ stars: v })} accessibilityLabel="Afficher les étoiles" />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Phrases</Text>
        {TEXT_FIELDS.map((f) => (
          <View key={f.key} style={styles.field}>
            <View style={styles.fieldHead}>
              <Text style={styles.label}>{f.label}</Text>
              <Text style={styles.count}>{draft[f.key].length}/{THEME_TEXT_LIMITS[f.key]}</Text>
            </View>
            <TextInput
              style={styles.input}
              value={draft[f.key]}
              onChangeText={(t) => change({ [f.key]: t.slice(0, THEME_TEXT_LIMITS[f.key]) } as Partial<HomeTheme>)}
              maxLength={THEME_TEXT_LIMITS[f.key]}
              accessibilityLabel={f.label}
            />
            {f.hint && <Text style={styles.hint}>{f.hint}</Text>}
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.primary, (busy || !dirty) && styles.disabled]}
        disabled={busy || !dirty}
        onPress={save}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>{dirty ? 'Enregistrer le thème' : 'Aucune modification'}</Text>}
      </Pressable>
      {!sameTheme(current, DEFAULT_THEME) && (
        <Pressable style={[styles.secondary, busy && styles.disabled]} disabled={busy} onPress={reset} accessibilityRole="button">
          <Text style={styles.secondaryText}>Revenir au thème d'origine</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  h: { fontSize: Type.title2, fontWeight: '800', color: Brand.ink },
  intro: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft },
  notice: { borderRadius: Radius.md, padding: 12 },
  noticeOk: { backgroundColor: Brand.primarySoft },
  noticeError: { backgroundColor: Brand.primarySofter },
  noticeText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  noticeTextError: { color: Brand.primaryInk },
  card: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 16, gap: 10 },
  cardTitle: { fontSize: Type.title3, fontWeight: '700', color: Brand.ink },
  hero: { borderRadius: 22, padding: 18, overflow: 'hidden', gap: 2 },
  heroTitle: { fontSize: 24, fontWeight: '800', lineHeight: 28 },
  heroSub: { fontSize: Type.small, fontWeight: '500', marginTop: 6 },
  fakeSearch: {
    marginTop: 14,
    height: 40,
    borderRadius: 14,
    backgroundColor: Brand.bg,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
  },
  fakeBadge: { width: 24, height: 24, borderRadius: 9, backgroundColor: Brand.primaryDeep },
  fakeSearchText: { flex: 1, minWidth: 0, fontSize: Type.caption, fontWeight: '700', color: Brand.inkSoft },
  warn: { fontSize: Type.small, fontWeight: '600', color: Brand.inkSoft },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 40,
    borderRadius: Radius.pill,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.bg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: { backgroundColor: Brand.primarySoft, borderColor: Brand.primaryDeep },
  chipText: { fontSize: Type.small, fontWeight: '700', color: Brand.ink },
  chipTextActive: { color: Brand.primaryInk },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  dotOverlap: { marginLeft: -12 },
  dotLine: { width: 18, height: 18, borderRadius: 9 },
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
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(0,0,0,0.15)' },
  swatchSelected: { borderWidth: 3, borderColor: Brand.primaryDeep },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  switchText: { flex: 1, minWidth: 0 },
  field: { gap: 6 },
  fieldHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  count: { fontSize: Type.caption, fontWeight: '600', color: Brand.inkSoft },
  primary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  primaryText: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.white },
  secondary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  secondaryText: { fontSize: Type.body, fontWeight: '700', color: Brand.ink },
  link: { minHeight: Touch.min, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: Type.body, fontWeight: '700', color: Brand.inkSoft },
  disabled: { opacity: 0.6 },
});
