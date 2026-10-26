import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, ArrowDown, ArrowUp, Check, Edit3, Plus, Search, Trash2, X } from 'lucide-react-native';

import { Brand, Radius, Touch, Type } from '../../constants/brand';
import { supabase } from '../../lib/supabase';
import {
  adminDeleteFeatured,
  adminListFeatured,
  adminSaveFeatured,
  FeaturedError,
} from '../../lib/featuredAdmin';
import {
  describePeriod,
  featuredStatus,
  FEATURED_LABEL_MAX,
  planMove,
  validateFeaturedDraft,
  type FeaturedRow,
} from '../../lib/featuredLogic';
import { announceFeaturedChanged } from '../../lib/featuredStore';
import { searchSpots } from '../../lib/spotSearch';
import { todayIso } from '../../lib/upcomingEvents';

interface Props {
  adminCode?: string;
  spots: any[];
  onCountChange?: (count: number) => void;
}

interface Form {
  id: string;
  spotId: string;
  position: string;
  label: string;
  startsOn: string;
  endsOn: string;
  isActive: boolean;
}

const STATUS_LABEL = { live: 'En ligne', scheduled: 'Programmé', ended: 'Terminé', inactive: 'Masqué' } as const;

export default function FeaturedAdminPanel({ adminCode, spots, onCountChange }: Props) {
  const [rows, setRows] = useState<FeaturedRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<Form | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const today = useMemo(() => todayIso(), []);

  const spotsById = useMemo(() => new Map(spots.map((s) => [String(s.id), s])), [spots]);
  const featuredIds = useMemo(() => new Set(rows.map((r) => r.spot_id)), [rows]);
  const results = useMemo(() => searchSpots(spots, query, 8), [spots, query]);

  const fail = (err: unknown) =>
    setNotice({ kind: 'error', text: err instanceof FeaturedError ? err.message : 'Opération impossible pour le moment.' });

  const reload = useCallback(async () => {
    if (!adminCode) return;
    setLoading(true);
    try {
      const list = await adminListFeatured(supabase as any, adminCode);
      setRows(list);
      onCountChange?.(list.length);
    } catch (err) {
      fail(err);
    } finally {
      setLoading(false);
    }
  }, [adminCode, onCountChange]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!adminCode) {
    return (
      <View style={styles.box}>
        <Text style={styles.boxText}>Reconnecte-toi à l'admin pour gérer les chouchous du Petit Tou.</Text>
      </View>
    );
  }

  const afterChange = async (okText?: string) => {
    announceFeaturedChanged(); // l'accueil se rafraîchit tout de suite
    await reload();
    if (okText) setNotice({ kind: 'ok', text: okText });
  };

  /** Ajout direct depuis la recherche : en ligne tout de suite, en dernière position, sans date de fin. */
  const addFromSearch = async (spot: any) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await adminSaveFeatured(supabase as any, adminCode, { spot_id: String(spot.id) });
      setQuery('');
      await afterChange(`« ${spot.title || spot.name} » est maintenant un chouchou du Petit Tou.`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (r: FeaturedRow) => {
    setNotice(null);
    setConfirmId(null);
    setForm({
      id: r.id,
      spotId: r.spot_id,
      position: String(r.position),
      label: r.label ?? '',
      startsOn: r.starts_on ?? '',
      endsOn: r.ends_on ?? '',
      isActive: r.is_active,
    });
  };

  const saveForm = async () => {
    if (!form || busy) return;
    const problem = validateFeaturedDraft(form);
    if (problem) {
      setNotice({ kind: 'error', text: problem });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      await adminSaveFeatured(supabase as any, adminCode, {
        id: form.id,
        spot_id: form.spotId,
        position: form.position.trim() || null,
        label: form.label.trim() || null,
        starts_on: form.startsOn.trim() || null,
        ends_on: form.endsOn.trim() || null,
        is_active: form.isActive,
      });
      setForm(null);
      await afterChange('Modifications enregistrées.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (r: FeaturedRow) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await adminSaveFeatured(supabase as any, adminCode, {
        id: r.id,
        spot_id: r.spot_id,
        position: r.position,
        label: r.label,
        starts_on: r.starts_on,
        ends_on: r.ends_on,
        is_active: !r.is_active,
      });
      await afterChange();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const move = async (r: FeaturedRow, direction: -1 | 1) => {
    const plan = planMove(rows, r.id, direction);
    if (plan.length === 0 || busy) return;
    setBusy(true);
    setNotice(null);
    try {
      for (const u of plan) {
        const target = rows.find((x) => x.id === u.id)!;
        await adminSaveFeatured(supabase as any, adminCode, {
          id: target.id,
          spot_id: target.spot_id,
          position: u.position,
          label: target.label,
          starts_on: target.starts_on,
          ends_on: target.ends_on,
          is_active: target.is_active,
        });
      }
      await afterChange();
    } catch (err) {
      fail(err);
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setConfirmId(null);
    setNotice(null);
    setBusy(true);
    try {
      const count = await adminDeleteFeatured(supabase as any, adminCode, id);
      if (form?.id === id) setForm(null);
      await afterChange(count > 0 ? 'Retiré des chouchous du Petit Tou.' : "Rien n'a été retiré : il n'existe plus.");
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));
  const ordered = [...rows].sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={styles.h}>Les chouchous du Petit Tou</Text>
      <Text style={styles.intro}>
        Une sélection éditoriale affichée tout en bas de l'accueil. Cherche une adresse du guide et ajoute-la d'un
        appui ; règle ensuite l'ordre et les dates d'affichage.
      </Text>

      {notice && (
        <View style={[styles.notice, notice.kind === 'error' ? styles.noticeError : styles.noticeOk]}>
          <Text style={[styles.noticeText, notice.kind === 'error' && styles.noticeTextError]}>{notice.text}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ajouter une adresse</Text>
        <View style={styles.searchRow}>
          <Search size={16} color={Brand.inkSoft} strokeWidth={2} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Cherche un établissement du guide…"
            placeholderTextColor={Brand.inkSoft}
            autoCorrect={false}
            accessibilityLabel="Rechercher une adresse à ajouter aux chouchous"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Effacer la recherche">
              <X size={16} color={Brand.inkSoft} strokeWidth={2} />
            </Pressable>
          )}
        </View>
        {query.trim().length >= 2 && results.length === 0 && <Text style={styles.boxText}>Aucune adresse trouvée.</Text>}
        {results.map((s) => {
          const already = featuredIds.has(String(s.id));
          return (
            <View key={s.id} style={styles.result}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle} numberOfLines={1}>{s.title || s.name}</Text>
                <Text style={styles.resultMeta} numberOfLines={1}>{s.location || s.address || 'Toulouse'}</Text>
              </View>
              {already ? (
                <View style={styles.doneTag}>
                  <Check size={14} color={Brand.primaryDeep} strokeWidth={2} />
                  <Text style={styles.doneTagText}>Déjà ajouté</Text>
                </View>
              ) : (
                <Pressable
                  style={[styles.addBtn, busy && styles.disabled]}
                  onPress={() => addFromSearch(s)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Ajouter ${s.title || s.name} aux chouchous du Petit Tou`}
                >
                  <Plus size={16} color={Brand.white} strokeWidth={2} />
                  <Text style={styles.addBtnText}>Ajouter</Text>
                </Pressable>
              )}
            </View>
          );
        })}
      </View>

      {form && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Modifier « {spotsById.get(form.spotId)?.title || spotsById.get(form.spotId)?.name || 'adresse introuvable'} »</Text>

          <Text style={styles.label}>Mention (facultatif, {FEATURED_LABEL_MAX} caractères)</Text>
          <TextInput style={styles.input} value={form.label} onChangeText={(t) => set({ label: t })} maxLength={FEATURED_LABEL_MAX}
            placeholder="Coup de cœur de novembre" placeholderTextColor={Brand.inkSoft} />

          <View style={styles.row}>
            <View style={styles.colSmall}>
              <Text style={styles.label}>Ordre</Text>
              <TextInput style={styles.input} value={form.position} onChangeText={(t) => set({ position: t })} keyboardType="number-pad"
                placeholder="10" placeholderTextColor={Brand.inkSoft} />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Début (AAAA-MM-JJ)</Text>
              <TextInput style={styles.input} value={form.startsOn} onChangeText={(t) => set({ startsOn: t })} autoCapitalize="none"
                placeholder="tout de suite" placeholderTextColor={Brand.inkSoft} />
            </View>
            <View style={styles.col}>
              <Text style={styles.label}>Fin (inclus)</Text>
              <TextInput style={styles.input} value={form.endsOn} onChangeText={(t) => set({ endsOn: t })} autoCapitalize="none"
                placeholder="sans fin" placeholderTextColor={Brand.inkSoft} />
            </View>
          </View>

          <Pressable style={styles.toggle} onPress={() => set({ isActive: !form.isActive })} accessibilityRole="checkbox"
            accessibilityState={{ checked: form.isActive }}>
            <View style={[styles.box2, form.isActive && styles.box2On]}>
              {form.isActive && <Check size={14} color={Brand.white} strokeWidth={2} />}
            </View>
            <Text style={styles.toggleText}>Affiché sur l'accueil</Text>
          </Pressable>

          <Pressable style={[styles.primary, busy && styles.disabled]} disabled={busy} onPress={saveForm}>
            {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>Enregistrer</Text>}
          </Pressable>
          <Pressable style={styles.link} onPress={() => setForm(null)}>
            <Text style={styles.linkText}>Annuler</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.listTitle}>Dans l'ordre d'affichage ({rows.length})</Text>
      {loading && rows.length === 0 && <ActivityIndicator color={Brand.primary} />}
      {!loading && rows.length === 0 && <Text style={styles.boxText}>Aucun chouchou pour le moment : la section reste masquée sur l'accueil.</Text>}

      {ordered.map((r, index) => {
        const spot = spotsById.get(r.spot_id);
        const status = featuredStatus(r, today);
        return (
          <View key={r.id} style={[styles.item, status !== 'live' && styles.itemOff]}>
            <View style={styles.itemHead}>
              <Text style={styles.itemTitle} numberOfLines={2}>{spot ? spot.title || spot.name : 'Adresse introuvable'}</Text>
              <View style={[styles.pill, status === 'live' ? styles.pillOn : styles.pillOff]}>
                <Text style={[styles.pillText, status === 'live' && styles.pillTextOn]}>{STATUS_LABEL[status]}</Text>
              </View>
            </View>
            {!spot && (
              <View style={styles.warn}>
                <AlertTriangle size={14} color={Brand.primaryDeep} strokeWidth={2} />
                <Text style={styles.warnText}>Cette adresse n'est plus dans le guide : retire-la.</Text>
              </View>
            )}
            {r.label ? <Text style={styles.itemLabel}>« {r.label} »</Text> : null}
            <Text style={styles.itemMeta}>Ordre {r.position} · {describePeriod(r, today)}</Text>

            {confirmId === r.id ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmText}>Retirer des chouchous du Petit Tou ?</Text>
                <Pressable style={styles.confirmYes} onPress={() => remove(r.id)}>
                  <Text style={styles.confirmYesText}>Oui, retirer</Text>
                </Pressable>
                <Pressable style={styles.confirmNo} onPress={() => setConfirmId(null)} accessibilityLabel="Annuler">
                  <X size={16} color={Brand.ink} strokeWidth={2} />
                </Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable style={[styles.iconBtn, index === 0 && styles.disabled]} disabled={index === 0 || busy} onPress={() => move(r, -1)} accessibilityLabel="Monter d'un cran">
                  <ArrowUp size={16} color={Brand.ink} strokeWidth={2} />
                </Pressable>
                <Pressable style={[styles.iconBtn, index === ordered.length - 1 && styles.disabled]} disabled={index === ordered.length - 1 || busy} onPress={() => move(r, 1)} accessibilityLabel="Descendre d'un cran">
                  <ArrowDown size={16} color={Brand.ink} strokeWidth={2} />
                </Pressable>
                <Pressable style={styles.pillBtn} onPress={() => toggleActive(r)} disabled={busy} accessibilityLabel={r.is_active ? 'Masquer' : 'Afficher'}>
                  <Text style={styles.pillBtnText}>{r.is_active ? 'Masquer' : 'Afficher'}</Text>
                </Pressable>
                <Pressable style={styles.iconBtn} onPress={() => startEdit(r)} accessibilityLabel="Modifier">
                  <Edit3 size={16} color={Brand.ink} strokeWidth={2} />
                </Pressable>
                <Pressable style={[styles.iconBtn, styles.iconBtnDanger]} onPress={() => setConfirmId(r.id)} accessibilityLabel="Retirer">
                  <Trash2 size={16} color={Brand.primaryDeep} strokeWidth={2} />
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
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
  noticeTextError: { color: Brand.primaryInk },
  card: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 16, gap: 8 },
  cardTitle: { fontSize: Type.title3, fontWeight: '700', color: Brand.ink },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: Touch.min, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.bg, paddingHorizontal: 14,
  },
  searchInput: { flex: 1, minHeight: Touch.min, fontSize: Type.body, fontWeight: '500', color: Brand.ink },
  result: {
    flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: Touch.min, paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: Brand.line,
  },
  resultTitle: { fontSize: Type.body, fontWeight: '700', color: Brand.ink },
  resultMeta: { fontSize: Type.small, fontWeight: '500', color: Brand.inkSoft },
  addBtn: {
    minHeight: Touch.min, paddingHorizontal: 14, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep,
    flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center',
  },
  addBtnText: { fontSize: Type.small, fontWeight: '700', color: Brand.white },
  doneTag: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Brand.primarySoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  doneTagText: { fontSize: Type.caption, fontWeight: '700', color: Brand.primaryDeep },
  label: { fontSize: Type.small, fontWeight: '700', color: Brand.ink, marginTop: 6 },
  input: {
    minHeight: Touch.min, borderRadius: Radius.md, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.bg,
    paddingHorizontal: 14, fontSize: Type.body, fontWeight: '500', color: Brand.ink,
  },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 2 },
  colSmall: { flex: 1 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: Touch.min },
  box2: { width: 24, height: 24, borderRadius: Radius.sm, borderWidth: 2, borderColor: Brand.line, alignItems: 'center', justifyContent: 'center' },
  box2On: { backgroundColor: Brand.primaryDeep, borderColor: Brand.primaryDeep },
  toggleText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  primary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.white },
  disabled: { opacity: 0.5 },
  link: { minHeight: Touch.min, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: Type.body, fontWeight: '700', color: Brand.inkSoft },
  listTitle: { fontSize: Type.title3, fontWeight: '700', color: Brand.ink, marginTop: 8 },
  item: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 14, gap: 6 },
  itemOff: { opacity: 0.7 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontSize: Type.bodyLg, fontWeight: '800', color: Brand.ink },
  itemLabel: { fontSize: Type.small, fontWeight: '700', color: Brand.primaryDeep },
  itemMeta: { fontSize: Type.small, fontWeight: '600', color: Brand.inkSoft },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 1, borderColor: Brand.line },
  pillOn: { backgroundColor: Brand.primarySoft, borderColor: Brand.primarySoft },
  pillOff: { backgroundColor: Brand.bg },
  pillText: { fontSize: Type.caption, fontWeight: '700', color: Brand.inkSoft },
  pillTextOn: { color: Brand.primaryDeep },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnText: { flex: 1, fontSize: Type.small, fontWeight: '700', color: Brand.primaryDeep },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  iconBtn: { width: Touch.min, height: Touch.min, borderRadius: Radius.md, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { backgroundColor: Brand.primarySoft },
  pillBtn: { minHeight: Touch.min, paddingHorizontal: 14, borderRadius: Radius.pill, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  pillBtnText: { fontSize: Type.small, fontWeight: '700', color: Brand.ink },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  confirmText: { flex: 1, fontSize: Type.small, fontWeight: '700', color: Brand.ink },
  confirmYes: { minHeight: Touch.min, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, justifyContent: 'center' },
  confirmYesText: { fontSize: Type.small, fontWeight: '700', color: Brand.white },
  confirmNo: { width: Touch.min, height: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
});
