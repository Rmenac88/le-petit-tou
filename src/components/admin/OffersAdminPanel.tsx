import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Edit3, Minus, Plus, Search, Trash2, X } from 'lucide-react-native';

import { Brand, Radius, Touch, Type } from '../../constants/brand';
import { supabase } from '../../lib/supabase';
import { adminDeleteOffer, adminListOffers, adminSaveOffer, OffersError, type AdminOffer } from '../../lib/offersAdmin';
import { DEMO_OFFER_IDS, OFFER_CATEGORIES, normalizeOffer, type Offer } from '../../lib/offersLogic';
import { discountCardsStore } from '../../lib/discountCardsStore';
import { searchSpots } from '../../lib/spotSearch';
import { addDays } from '../../lib/agendaOccurrences.ts';
import { todayIso } from '../../lib/upcomingEvents';
import BrandSwitch from '../BrandSwitch';
import OfferCard from '../offers/OfferCard';

interface Props {
  adminCode?: string;
  spots: any[];
  onCountChange?: (count: number) => void;
}

interface Form {
  id: string;
  title: string;
  discountValue: string;
  subtitle: string;
  category: string;
  description: string;
  terms: string;
  maxUses: number;
  validUntil: string;
  colorIndex: number;
  visualUrl: string;
  partnerId: string;
  sortOrder: string;
  isActive: boolean;
}

/** Couples de couleurs proposés (fond du ticket) : toutes lisibles avec le texte choisi automatiquement. */
const PALETTES: { name: string; primary: string; secondary: string }[] = [
  { name: 'Rose Petit Tou', primary: '#C93049', secondary: '#8E1F37' },
  { name: 'Nuit', primary: '#2B1D46', secondary: '#3A235C' },
  { name: 'Soleil', primary: '#F2B835', secondary: '#B45309' },
  { name: 'Menthe', primary: '#1FA67A', secondary: '#0C5B41' },
  { name: 'Violet', primary: '#6C4AB6', secondary: '#3A235C' },
  { name: 'Bordeaux', primary: '#A82840', secondary: '#5C0F0C' },
  { name: 'Ardoise', primary: '#6A6A78', secondary: '#1A1A22' },
  { name: 'Océan', primary: '#2563EB', secondary: '#1E3A8A' },
];

const EMPTY: Form = {
  id: '', title: '', discountValue: '', subtitle: '', category: 'food', description: '', terms: '', maxUses: 5,
  validUntil: '', colorIndex: 0, visualUrl: '', partnerId: '', sortOrder: '0', isActive: true,
};

const paletteIndexFor = (primary: string | null) => Math.max(0, PALETTES.findIndex((p) => p.primary.toLowerCase() === (primary ?? '').toLowerCase()));

export default function OffersAdminPanel({ adminCode, spots, onCountChange }: Props) {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [spotQuery, setSpotQuery] = useState('');
  const today = useMemo(() => todayIso(), []);

  const spotsById = useMemo(() => new Map(spots.map((s) => [String(s.id), s])), [spots]);
  const spotResults = useMemo(() => searchSpots(spots, spotQuery, 6), [spots, spotQuery]);

  const fail = (err: unknown) =>
    setNotice({ kind: 'error', text: err instanceof OffersError ? err.message : 'Opération impossible pour le moment.' });

  const reload = useCallback(async () => {
    if (!adminCode) return;
    setLoading(true);
    try {
      const list = await adminListOffers(supabase as any, adminCode);
      setOffers(list);
      onCountChange?.(list.filter((o) => o.is_active && !o.expired && !DEMO_OFFER_IDS.has(o.id)).length);
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
        <Text style={styles.boxText}>Reconnecte-toi à l'admin pour gérer les offres.</Text>
      </View>
    );
  }

  const set = (patch: Partial<Form>) => setForm((f) => (f ? { ...f, ...patch } : f));

  const startNew = () => {
    setNotice(null);
    setConfirmId(null);
    setSpotQuery('');
    setForm({ ...EMPTY });
  };
  const startEdit = (o: AdminOffer) => {
    setNotice(null);
    setConfirmId(null);
    setSpotQuery('');
    setForm({
      id: o.id, title: o.title, discountValue: o.discount_value, subtitle: o.subtitle ?? '', category: o.category,
      description: o.description ?? '', terms: o.terms ?? '', maxUses: o.max_uses, validUntil: o.valid_until_date ?? '',
      colorIndex: paletteIndexFor(o.card_color_primary), visualUrl: o.visual_url ?? '', partnerId: o.partner_id ?? '',
      sortOrder: String(o.sort_order ?? 0), isActive: o.is_active,
    });
  };

  const afterChange = async (okText: string) => {
    await reload();
    discountCardsStore.start();
    discountCardsStore.syncWithSupabase(); // l'onglet « - % » de l'appli se met à jour tout de suite
    setNotice({ kind: 'ok', text: okText });
  };

  const draftProblem = (f: Form): string | null => {
    if (!f.title.trim()) return 'Donne un nom à l\'offre (ex. le nom de l\'établissement).';
    if (!f.discountValue.trim()) return 'Indique l\'avantage (ex. -20% ou 1 café offert).';
    if (f.validUntil.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(f.validUntil.trim())) return 'La date de fin s\'écrit AAAA-MM-JJ (ex. 2027-03-31).';
    if (f.visualUrl.trim() && !/^https:\/\/\S+$/i.test(f.visualUrl.trim())) return 'L\'image doit être une adresse commençant par https://';
    if (f.sortOrder.trim() && !/^-?\d{1,3}$/.test(f.sortOrder.trim())) return 'L\'ordre est un nombre (0 par défaut, plus petit = plus haut).';
    return null;
  };

  const save = async () => {
    if (!form || busy) return;
    const problem = draftProblem(form);
    if (problem) {
      setNotice({ kind: 'error', text: problem });
      return;
    }
    const palette = PALETTES[form.colorIndex] ?? PALETTES[0];
    setBusy(true);
    setNotice(null);
    try {
      await adminSaveOffer(supabase as any, adminCode, {
        id: form.id || undefined,
        title: form.title, discount_value: form.discountValue, subtitle: form.subtitle, category: form.category,
        description: form.description, terms: form.terms, max_uses: form.maxUses,
        card_color_primary: palette.primary, card_color_secondary: palette.secondary,
        visual_url: form.visualUrl.trim(), partner_id: form.partnerId, valid_until: form.validUntil.trim(),
        sort_order: form.sortOrder.trim() || '0', is_active: form.isActive,
      });
      setForm(null);
      await afterChange(form.id ? 'Offre enregistrée.' : 'Offre ajoutée : elle apparaît dans l\'onglet « - % ».');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (o: AdminOffer) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await adminDeleteOffer(supabase as any, adminCode, o.id);
      setConfirmId(null);
      await afterChange(`« ${o.title} » a été supprimée.`);
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (o: AdminOffer) => {
    if (busy) return;
    setBusy(true);
    setNotice(null);
    try {
      await adminSaveOffer(supabase as any, adminCode, {
        id: o.id, title: o.title, discount_value: o.discount_value, subtitle: o.subtitle, category: o.category,
        badge_label: o.badge_label, description: o.description, terms: o.terms, max_uses: o.max_uses,
        card_color_primary: o.card_color_primary, card_color_secondary: o.card_color_secondary, visual_url: o.visual_url,
        partner_id: o.partner_id, valid_until: o.valid_until_date, sort_order: o.sort_order, is_active: !o.is_active,
      });
      await afterChange(o.is_active ? 'Offre masquée.' : 'Offre affichée.');
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  };

  const status = (o: AdminOffer): { label: string; tone: 'on' | 'off' } => {
    if (DEMO_OFFER_IDS.has(o.id)) return { label: 'Exemple (non affichée)', tone: 'off' };
    if (o.expired) return { label: 'Expirée', tone: 'off' };
    if (!o.is_active) return { label: 'Masquée', tone: 'off' };
    return { label: 'En ligne', tone: 'on' };
  };

  const preview: Offer | null = form
    ? normalizeOffer({
        id: 'apercu', title: form.title || 'Nom de l\'offre', discount_value: form.discountValue || '-20%', subtitle: form.subtitle,
        category: form.category, max_uses: form.maxUses, card_color_primary: (PALETTES[form.colorIndex] ?? PALETTES[0]).primary,
        card_color_secondary: (PALETTES[form.colorIndex] ?? PALETTES[0]).secondary, valid_until: form.validUntil && /^\d{4}-\d{2}-\d{2}$/.test(form.validUntil) ? `${form.validUntil}T22:00:00Z` : null,
      }, 0)
    : null;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.h}>Offres et réductions</Text>
      <Text style={styles.intro}>
        Les offres affichées dans l'onglet « - % » de l'appli. Chaque téléphone peut en utiliser un nombre limité de fois.
      </Text>

      {notice && (
        <View style={[styles.notice, notice.kind === 'error' ? styles.noticeError : styles.noticeOk]}>
          <Text style={[styles.noticeText, notice.kind === 'error' && styles.noticeTextError]}>{notice.text}</Text>
        </View>
      )}

      {form ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>{form.id ? 'Modifier l\'offre' : 'Nouvelle offre'}</Text>

          {preview && (
            <View style={{ marginVertical: 6 }}>
              <Text style={styles.label}>Aperçu (tel que dans l'appli)</Text>
              <View pointerEvents="none">
                <OfferCard offer={preview} nowMs={Date.now()} onPress={() => {}} />
              </View>
            </View>
          )}

          <Text style={styles.label}>Nom de l'offre *</Text>
          <TextInput style={styles.input} value={form.title} onChangeText={(t) => set({ title: t })} placeholder="Ex : Chez Un" placeholderTextColor={Brand.inkSoft} maxLength={80} />

          <Text style={styles.label}>Avantage *</Text>
          <TextInput style={styles.input} value={form.discountValue} onChangeText={(t) => set({ discountValue: t })} placeholder="Ex : -20% sur l'addition" placeholderTextColor={Brand.inkSoft} maxLength={40} />

          <Text style={styles.label}>Sous-titre</Text>
          <TextInput style={styles.input} value={form.subtitle} onChangeText={(t) => set({ subtitle: t })} placeholder="Ex : Capitole • Brasserie" placeholderTextColor={Brand.inkSoft} maxLength={80} />

          <Text style={styles.label}>Catégorie</Text>
          <View style={styles.pills}>
            {OFFER_CATEGORIES.map((c) => (
              <Pressable key={c.id} style={[styles.pill, form.category === c.id && styles.pillOn]} onPress={() => set({ category: c.id })} accessibilityRole="button" accessibilityState={{ selected: form.category === c.id }}>
                <Text style={[styles.pillText, form.category === c.id && styles.pillTextOn]}>{c.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Description</Text>
          <TextInput style={[styles.input, styles.multiline]} value={form.description} onChangeText={(t) => set({ description: t })} placeholder="En quelques mots : ce que comprend l'offre" placeholderTextColor={Brand.inkSoft} multiline maxLength={400} />

          <Text style={styles.label}>Conditions</Text>
          <TextInput style={[styles.input, styles.multiline]} value={form.terms} onChangeText={(t) => set({ terms: t })} placeholder="Ex : valable du mardi au samedi, hors formules" placeholderTextColor={Brand.inkSoft} multiline maxLength={400} />

          <Text style={styles.label}>Utilisations par téléphone</Text>
          <View style={styles.stepper}>
            <Pressable style={styles.stepBtn} onPress={() => set({ maxUses: Math.max(1, form.maxUses - 1) })} accessibilityRole="button" accessibilityLabel="Moins"><Minus size={18} color={Brand.ink} /></Pressable>
            <Text style={styles.stepValue}>{form.maxUses}</Text>
            <Pressable style={styles.stepBtn} onPress={() => set({ maxUses: Math.min(99, form.maxUses + 1) })} accessibilityRole="button" accessibilityLabel="Plus"><Plus size={18} color={Brand.ink} /></Pressable>
          </View>

          <Text style={styles.label}>Valable jusqu'au (inclus)</Text>
          <TextInput style={styles.input} value={form.validUntil} onChangeText={(t) => set({ validUntil: t })} placeholder="AAAA-MM-JJ — vide = sans date de fin" placeholderTextColor={Brand.inkSoft} autoCapitalize="none" maxLength={10} />
          <View style={styles.pills}>
            {[['+30 jours', 30], ['+3 mois', 90], ['+1 an', 365]].map(([label, days]) => (
              <Pressable key={String(label)} style={styles.pill} onPress={() => set({ validUntil: addDays(today, Number(days)) })} accessibilityRole="button">
                <Text style={styles.pillText}>{label}</Text>
              </Pressable>
            ))}
            <Pressable style={styles.pill} onPress={() => set({ validUntil: '' })} accessibilityRole="button"><Text style={styles.pillText}>Sans date</Text></Pressable>
          </View>

          <Text style={styles.label}>Couleurs</Text>
          <View style={styles.swatches}>
            {PALETTES.map((p, i) => (
              <Pressable key={p.name} onPress={() => set({ colorIndex: i })} accessibilityRole="button" accessibilityLabel={p.name} accessibilityState={{ selected: form.colorIndex === i }}
                style={[styles.swatch, { backgroundColor: p.primary }, form.colorIndex === i && styles.swatchOn]}>
                {form.colorIndex === i && <Check size={18} color="#FFFFFF" strokeWidth={3} />}
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Image (facultatif, https)</Text>
          <TextInput style={styles.input} value={form.visualUrl} onChangeText={(t) => set({ visualUrl: t })} placeholder="https://…" placeholderTextColor={Brand.inkSoft} autoCapitalize="none" autoCorrect={false} />

          <Text style={styles.label}>Adresse du guide (facultatif)</Text>
          {form.partnerId ? (
            <View style={styles.chosen}>
              <Text style={styles.chosenText} numberOfLines={1}>{spotsById.get(form.partnerId)?.title || spotsById.get(form.partnerId)?.name || 'Adresse du guide'}</Text>
              <Pressable onPress={() => set({ partnerId: '' })} hitSlop={8} accessibilityRole="button" accessibilityLabel="Retirer l'adresse"><X size={18} color={Brand.inkSoft} /></Pressable>
            </View>
          ) : (
            <>
              <View style={styles.searchRow}>
                <Search size={16} color={Brand.inkSoft} />
                <TextInput style={styles.searchInput} value={spotQuery} onChangeText={setSpotQuery} placeholder="Cherche l'établissement…" placeholderTextColor={Brand.inkSoft} />
              </View>
              {spotResults.map((s) => (
                <Pressable key={s.id} style={styles.result} onPress={() => { set({ partnerId: String(s.id) }); setSpotQuery(''); }} accessibilityRole="button">
                  <Text style={styles.resultTitle} numberOfLines={1}>{s.title || s.name}</Text>
                  <Text style={styles.resultMeta} numberOfLines={1}>{s.location || s.address || ''}</Text>
                </Pressable>
              ))}
            </>
          )}

          <Text style={styles.label}>Ordre d'affichage</Text>
          <TextInput style={[styles.input, { maxWidth: 140 }]} value={form.sortOrder} onChangeText={(t) => set({ sortOrder: t })} keyboardType="numbers-and-punctuation" placeholder="0" placeholderTextColor={Brand.inkSoft} maxLength={4} />
          <Text style={styles.hint}>Plus le nombre est petit, plus l'offre est en haut (0 par défaut).</Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleText}>Afficher dans l'appli</Text>
            <BrandSwitch value={form.isActive} onValueChange={(v) => set({ isActive: v })} accessibilityLabel="Afficher dans l'appli" />
          </View>

          <Pressable style={[styles.primary, busy && styles.disabled]} onPress={save} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color={Brand.white} /> : <Text style={styles.primaryText}>{form.id ? 'Enregistrer' : 'Ajouter l\'offre'}</Text>}
          </Pressable>
          <Pressable style={styles.link} onPress={() => setForm(null)} accessibilityRole="button"><Text style={styles.linkText}>Annuler</Text></Pressable>
        </View>
      ) : (
        <Pressable style={styles.newBtn} onPress={startNew} accessibilityRole="button">
          <Plus size={18} color={Brand.white} strokeWidth={2.6} />
          <Text style={styles.newBtnText}>Nouvelle offre</Text>
        </Pressable>
      )}

      <Text style={styles.listTitle}>Toutes les offres ({offers.length})</Text>
      {loading && offers.length === 0 ? <ActivityIndicator color={Brand.primaryDeep} style={{ marginTop: 12 }} /> : null}
      {!loading && offers.length === 0 && !notice ? <Text style={styles.boxText}>Aucune offre pour le moment.</Text> : null}

      {offers.map((o) => {
        const st = status(o);
        const demo = DEMO_OFFER_IDS.has(o.id);
        return (
          <View key={o.id} style={[styles.item, st.tone === 'off' && styles.itemOff]}>
            <View style={styles.itemHead}>
              <Text style={styles.itemTitle} numberOfLines={2}>{o.title}</Text>
              <View style={[styles.statusPill, st.tone === 'on' ? styles.statusOn : styles.statusOff]}>
                <Text style={[styles.statusText, st.tone === 'on' && styles.statusTextOn]}>{st.label}</Text>
              </View>
            </View>
            <Text style={styles.itemValue}>{o.discount_value}</Text>
            <Text style={styles.itemMeta}>
              {o.uses_total} utilisation{o.uses_total > 1 ? 's' : ''} • {o.max_uses} max par téléphone{o.valid_until_date ? ` • jusqu'au ${o.valid_until_date}` : ''}
            </Text>
            {demo ? <Text style={styles.warnText}>Offre d'exemple : elle n'est jamais affichée dans l'appli. Supprime-la ou remplace-la par une vraie offre.</Text> : null}

            {confirmId === o.id ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmText}>Supprimer aussi ses {o.uses_total} utilisation(s) enregistrée(s) ?</Text>
                <Pressable style={styles.confirmYes} onPress={() => remove(o)} disabled={busy} accessibilityRole="button"><Text style={styles.confirmYesText}>Supprimer</Text></Pressable>
                <Pressable style={styles.confirmNo} onPress={() => setConfirmId(null)} accessibilityRole="button" accessibilityLabel="Annuler"><X size={16} color={Brand.ink} /></Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                {!demo && !o.expired && (
                  <View style={styles.inlineSwitch}>
                    <Text style={styles.inlineSwitchText}>{o.is_active ? 'Visible' : 'Masquée'}</Text>
                    <BrandSwitch value={o.is_active} onValueChange={() => toggleActive(o)} disabled={busy} accessibilityLabel={`Afficher ${o.title}`} />
                  </View>
                )}
                <Pressable style={styles.iconBtn} onPress={() => startEdit(o)} accessibilityRole="button" accessibilityLabel={`Modifier ${o.title}`}><Edit3 size={16} color={Brand.ink} /></Pressable>
                <Pressable style={[styles.iconBtn, styles.iconBtnDanger]} onPress={() => setConfirmId(o.id)} accessibilityRole="button" accessibilityLabel={`Supprimer ${o.title}`}><Trash2 size={16} color={Brand.primaryDeep} /></Pressable>
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
  content: { padding: 16, paddingBottom: 80, gap: 12 },
  h: { fontSize: Type.title2, fontWeight: '800', color: Brand.ink },
  intro: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft },
  box: { padding: 24, alignItems: 'center' },
  boxText: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft, textAlign: 'center', paddingVertical: 8 },
  notice: { borderRadius: Radius.md, padding: 12 },
  noticeOk: { backgroundColor: Brand.primarySoft },
  noticeError: { backgroundColor: Brand.primarySofter },
  noticeText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  noticeTextError: { color: Brand.primaryInk },
  newBtn: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  newBtnText: { fontSize: Type.bodyLg, fontWeight: '800', color: Brand.white },
  card: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 16, gap: 8 },
  cardTitle: { fontSize: Type.title3, fontWeight: '700', color: Brand.ink },
  label: { fontSize: Type.small, fontWeight: '700', color: Brand.ink, marginTop: 8 },
  hint: { fontSize: Type.caption, fontWeight: '500', color: Brand.inkSoft },
  input: { minHeight: Touch.min, borderRadius: Radius.md, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.bg, paddingHorizontal: 14, fontSize: Type.body, fontWeight: '500', color: Brand.ink },
  multiline: { minHeight: 84, paddingTop: 12, textAlignVertical: 'top' },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { minHeight: 40, paddingHorizontal: 14, borderRadius: Radius.pill, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.bg, justifyContent: 'center' },
  pillOn: { backgroundColor: Brand.primaryDeep, borderColor: Brand.primaryDeep },
  pillText: { fontSize: Type.small, fontWeight: '700', color: Brand.ink },
  pillTextOn: { color: Brand.white },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  stepBtn: { width: Touch.min, height: Touch.min, borderRadius: Radius.md, backgroundColor: Brand.bg, borderWidth: 1, borderColor: Brand.line, alignItems: 'center', justifyContent: 'center' },
  stepValue: { minWidth: 36, textAlign: 'center', fontSize: Type.title3, fontWeight: '800', color: Brand.ink },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  swatchOn: { borderColor: Brand.ink },
  chosen: { minHeight: Touch.min, borderRadius: Radius.md, backgroundColor: Brand.primarySoft, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chosenText: { flex: 1, fontSize: Type.body, fontWeight: '700', color: Brand.ink },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: Touch.min, borderRadius: Radius.md, borderWidth: 1, borderColor: Brand.line, backgroundColor: Brand.bg, paddingHorizontal: 14 },
  searchInput: { flex: 1, minHeight: Touch.min, fontSize: Type.body, fontWeight: '500', color: Brand.ink },
  result: { minHeight: Touch.min, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Brand.line, justifyContent: 'center' },
  resultTitle: { fontSize: Type.body, fontWeight: '700', color: Brand.ink },
  resultMeta: { fontSize: Type.small, fontWeight: '500', color: Brand.inkSoft },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: Touch.min, marginTop: 6 },
  toggleText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  primary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  primaryText: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.white },
  disabled: { opacity: 0.5 },
  link: { minHeight: Touch.min, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: Type.body, fontWeight: '700', color: Brand.inkSoft },
  listTitle: { fontSize: Type.title3, fontWeight: '700', color: Brand.ink, marginTop: 8 },
  item: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 14, gap: 6 },
  itemOff: { opacity: 0.75 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontSize: Type.bodyLg, fontWeight: '800', color: Brand.ink },
  itemValue: { fontSize: Type.body, fontWeight: '800', color: Brand.primaryDeep },
  itemMeta: { fontSize: Type.small, fontWeight: '600', color: Brand.inkSoft },
  statusPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radius.pill },
  statusOn: { backgroundColor: '#E7F5EF' },
  statusOff: { backgroundColor: Brand.bg },
  statusText: { fontSize: Type.caption, fontWeight: '800', color: Brand.inkSoft },
  statusTextOn: { color: '#0C5B41' },
  warnText: { fontSize: Type.small, fontWeight: '700', color: Brand.primaryInk },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  inlineSwitch: { flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 'auto' },
  inlineSwitchText: { fontSize: Type.small, fontWeight: '700', color: Brand.inkSoft },
  iconBtn: { width: Touch.min, height: Touch.min, borderRadius: Radius.md, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { backgroundColor: Brand.primarySoft },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  confirmText: { flex: 1, fontSize: Type.small, fontWeight: '700', color: Brand.ink },
  confirmYes: { minHeight: Touch.min, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, justifyContent: 'center' },
  confirmYesText: { fontSize: Type.small, fontWeight: '700', color: Brand.white },
  confirmNo: { width: Touch.min, height: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
});
