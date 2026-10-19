import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { AlertTriangle, Check, Edit3, Repeat, Trash2, X } from 'lucide-react-native';
import { Brand, Radius, Touch, Type } from '../../constants/brand';
import {
  addDays,
  expandOccurrences,
  formatDateFr,
  weekdayLabel,
  type PartnerEventRow,
} from '../../lib/agendaOccurrences.ts';
import {
  AgendaError,
  adminDeletePartnerEvent,
  adminListPartnerEvents,
  adminSavePartnerEvent,
} from '../../lib/partnerEventsStore';

interface Props {
  adminCode?: string;
  spots: any[];
  onCountChange?: (count: number) => void;
}

interface Form {
  id: string | null;
  isActive: boolean;
  spotId: string;
  spotQuery: string;
  title: string;
  description: string;
  startDate: string;
  startTime: string;
  endTime: string;
  repeat: boolean;
  until: string;
  location: string;
  link: string;
}

const EMPTY_FORM: Form = {
  id: null,
  isActive: true,
  spotId: '',
  spotQuery: '',
  title: '',
  description: '',
  startDate: '',
  startTime: '19:00',
  endTime: '',
  repeat: false,
  until: '',
  location: '',
  link: '',
};

function localTodayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export default function AgendaAdminPanel({ adminCode, spots, onCountChange }: Props) {
  const [events, setEvents] = useState<PartnerEventRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState<Form>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const today = useMemo(localTodayIso, []);

  const spotsById = useMemo(() => new Map(spots.map((s) => [s.id, s])), [spots]);

  const fail = (err: unknown) =>
    setNotice({
      kind: 'error',
      text: err instanceof AgendaError ? err.message : 'Agenda indisponible pour le moment.',
    });

  const reload = useCallback(async () => {
    if (!adminCode) return;
    setLoading(true);
    try {
      const rows = await adminListPartnerEvents(adminCode);
      setEvents(rows);
      onCountChange?.(rows.length);
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
        <Text style={styles.boxText}>Reconnecte-toi à l'admin pour gérer l'agenda.</Text>
      </View>
    );
  }

  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));

  const matches = form.spotQuery.trim().length >= 2 && !form.spotId
    ? spots
        .filter((s) => (s.title || s.name || '').toLowerCase().includes(form.spotQuery.trim().toLowerCase()))
        .slice(0, 6)
    : [];

  const startEdit = (ev: PartnerEventRow) => {
    setNotice(null);
    setConfirmId(null);
    const spot = spotsById.get(ev.spot_id);
    setForm({
      id: ev.id,
      isActive: ev.is_active,
      spotId: ev.spot_id,
      spotQuery: spot ? spot.title || spot.name || '' : '',
      title: ev.title,
      description: ev.description ?? '',
      startDate: ev.start_date,
      startTime: ev.start_time,
      endTime: ev.end_time ?? '',
      repeat: !!ev.repeat_weekly_until,
      until: ev.repeat_weekly_until ?? '',
      location: ev.location_override ?? '',
      link: ev.link_url ?? '',
    });
  };

  const save = async (override?: { event: PartnerEventRow; isActive: boolean }) => {
    setNotice(null);
    setSaving(true);
    try {
      const draft = override
        ? { ...override.event, is_active: override.isActive }
        : {
            ...(form.id ? { id: form.id } : {}),
            spot_id: form.spotId,
            title: form.title,
            description: form.description,
            start_date: form.startDate,
            start_time: form.startTime,
            end_time: form.endTime || null,
            repeat_weekly_until: form.repeat ? form.until || null : null,
            location_override: form.location,
            link_url: form.link,
            is_active: form.isActive,
          };
      await adminSavePartnerEvent(adminCode, draft as any);
      if (!override) {
        setNotice({ kind: 'ok', text: form.id ? 'Date modifiée.' : 'Date ajoutée.' });
        setForm(EMPTY_FORM);
      }
      await reload();
    } catch (err) {
      fail(err);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setNotice(null);
    setConfirmId(null);
    try {
      const count = await adminDeletePartnerEvent(adminCode, id);
      setNotice(
        count > 0
          ? { kind: 'ok', text: 'Date retirée.' }
          : { kind: 'error', text: "Rien n'a été retiré : cette date n'existe plus." }
      );
      if (form.id === id) setForm(EMPTY_FORM);
      await reload();
    } catch (err) {
      fail(err);
    }
  };

  const sorted = [...events].sort((a, b) => {
    const aDone = (a.repeat_weekly_until ?? a.start_date) < today;
    const bDone = (b.repeat_weekly_until ?? b.start_date) < today;
    if (aDone !== bDone) return aDone ? 1 : -1;
    return a.start_date.localeCompare(b.start_date);
  });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {notice && (
        <View style={[styles.notice, notice.kind === 'error' ? styles.noticeError : styles.noticeOk]}>
          <Text style={[styles.noticeText, notice.kind === 'error' && styles.noticeTextError]}>{notice.text}</Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{form.id ? 'Modifier la date' : 'Ajouter une date'}</Text>

        <Text style={styles.label}>Adresse</Text>
        <TextInput
          style={styles.input}
          value={form.spotQuery}
          onChangeText={(t) => set({ spotQuery: t, spotId: '' })}
          placeholder="Cherche une adresse du guide…"
          placeholderTextColor={Brand.inkSoft}
        />
        {form.spotId ? (
          <Text style={styles.picked}>Adresse choisie</Text>
        ) : (
          matches.map((s) => (
            <Pressable
              key={s.id}
              style={styles.match}
              onPress={() => set({ spotId: s.id, spotQuery: s.title || s.name || '' })}
            >
              <Text style={styles.matchText} numberOfLines={1}>{s.title || s.name}</Text>
            </Pressable>
          ))
        )}

        <Text style={styles.label}>Titre</Text>
        <TextInput style={styles.input} value={form.title} onChangeText={(t) => set({ title: t })} placeholder="Happy hour, soirée jeux…" placeholderTextColor={Brand.inkSoft} />

        <Text style={styles.label}>Description (facultatif)</Text>
        <TextInput style={[styles.input, styles.multiline]} value={form.description} onChangeText={(t) => set({ description: t })} multiline placeholderTextColor={Brand.inkSoft} />

        <View style={styles.row}>
          <View style={styles.col}>
            <Text style={styles.label}>Date (AAAA-MM-JJ)</Text>
            <TextInput style={styles.input} value={form.startDate} onChangeText={(t) => set({ startDate: t })} placeholder="2026-10-22" placeholderTextColor={Brand.inkSoft} autoCapitalize="none" />
          </View>
          <View style={styles.colSmall}>
            <Text style={styles.label}>Début</Text>
            <TextInput style={styles.input} value={form.startTime} onChangeText={(t) => set({ startTime: t })} placeholder="19:00" placeholderTextColor={Brand.inkSoft} autoCapitalize="none" />
          </View>
          <View style={styles.colSmall}>
            <Text style={styles.label}>Fin</Text>
            <TextInput style={styles.input} value={form.endTime} onChangeText={(t) => set({ endTime: t })} placeholder="23:00" placeholderTextColor={Brand.inkSoft} autoCapitalize="none" />
          </View>
        </View>

        <Pressable style={styles.toggle} onPress={() => set({ repeat: !form.repeat })} accessibilityRole="checkbox" accessibilityState={{ checked: form.repeat }}>
          <View style={[styles.box2, form.repeat && styles.box2On]}>
            {form.repeat && <Check size={14} color={Brand.white} strokeWidth={2} />}
          </View>
          <Text style={styles.toggleText}>Répéter chaque semaine</Text>
        </Pressable>
        {form.repeat && (
          <>
            <Text style={styles.label}>Jusqu'au (AAAA-MM-JJ, inclus)</Text>
            <TextInput style={styles.input} value={form.until} onChangeText={(t) => set({ until: t })} placeholder="2026-12-17" placeholderTextColor={Brand.inkSoft} autoCapitalize="none" />
          </>
        )}

        <Text style={styles.label}>Lieu précis (facultatif)</Text>
        <TextInput style={styles.input} value={form.location} onChangeText={(t) => set({ location: t })} placeholder="Par défaut : l'adresse de la fiche" placeholderTextColor={Brand.inkSoft} />

        <Text style={styles.label}>Lien (facultatif)</Text>
        <TextInput style={styles.input} value={form.link} onChangeText={(t) => set({ link: t })} placeholder="https://…" placeholderTextColor={Brand.inkSoft} autoCapitalize="none" />

        <Pressable style={[styles.primary, saving && styles.disabled]} disabled={saving} onPress={() => save()}>
          <Text style={styles.primaryText}>
            {saving ? 'Enregistrement…' : form.id ? 'Enregistrer les modifications' : 'Ajouter à l\'agenda'}
          </Text>
        </Pressable>
        {form.id && (
          <Pressable style={styles.link} onPress={() => setForm(EMPTY_FORM)}>
            <Text style={styles.linkText}>Annuler la modification</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.listTitle}>Dates de l'agenda ({events.length})</Text>
      {loading && <Text style={styles.boxText}>Chargement…</Text>}
      {!loading && events.length === 0 && <Text style={styles.boxText}>Aucune date pour le moment.</Text>}

      {sorted.map((ev) => {
        const spot = spotsById.get(ev.spot_id);
        const lastDate = ev.repeat_weekly_until ?? ev.start_date;
        const done = lastDate < today;
        const next = expandOccurrences([ev], today, addDays(today, 400))[0]?.occurrenceDate;
        return (
          <View key={ev.id} style={[styles.item, !ev.is_active && styles.itemOff]}>
            <View style={styles.itemHead}>
              <Text style={styles.itemTitle} numberOfLines={2}>{ev.title}</Text>
              <Pressable
                style={[styles.pill, ev.is_active ? styles.pillOn : styles.pillOff]}
                onPress={() => save({ event: ev, isActive: !ev.is_active })}
                accessibilityLabel={ev.is_active ? 'Désactiver cette date' : 'Activer cette date'}
              >
                <Text style={[styles.pillText, ev.is_active && styles.pillTextOn]}>{ev.is_active ? 'Actif' : 'Inactif'}</Text>
              </Pressable>
            </View>

            {spot ? (
              <Text style={styles.itemSpot} numberOfLines={1}>{spot.title || spot.name}</Text>
            ) : (
              <View style={styles.warn}>
                <AlertTriangle size={14} color={Brand.primaryDeep} strokeWidth={2} />
                <Text style={styles.warnText}>Adresse introuvable</Text>
              </View>
            )}

            <Text style={styles.itemMeta}>
              {done ? 'Terminé' : next ? `Prochaine : ${formatDateFr(next)}` : formatDateFr(ev.start_date)} · {ev.start_time}
              {ev.end_time ? `–${ev.end_time}` : ''}
            </Text>
            {ev.repeat_weekly_until && ev.repeat_weekly_until > ev.start_date && (
              <View style={styles.tag}>
                <Repeat size={12} color={Brand.primaryDeep} strokeWidth={2} />
                <Text style={styles.tagText}>chaque {weekdayLabel(ev.start_date)} jusqu'au {formatDateFr(ev.repeat_weekly_until)}</Text>
              </View>
            )}

            {confirmId === ev.id ? (
              <View style={styles.confirm}>
                <Text style={styles.confirmText}>Retirer cette date ?</Text>
                <Pressable style={styles.confirmYes} onPress={() => remove(ev.id)}><Text style={styles.confirmYesText}>Oui, retirer</Text></Pressable>
                <Pressable style={styles.confirmNo} onPress={() => setConfirmId(null)}><X size={16} color={Brand.ink} strokeWidth={2} /></Pressable>
              </View>
            ) : (
              <View style={styles.actions}>
                <Pressable style={styles.iconBtn} onPress={() => startEdit(ev)} accessibilityLabel="Modifier cette date">
                  <Edit3 size={16} color={Brand.ink} strokeWidth={2} />
                </Pressable>
                <Pressable style={[styles.iconBtn, styles.iconBtnDanger]} onPress={() => setConfirmId(ev.id)} accessibilityLabel="Retirer cette date">
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
  box: { padding: 24, alignItems: 'center' },
  boxText: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft, textAlign: 'center', paddingVertical: 8 },
  notice: { borderRadius: Radius.md, padding: 12 },
  noticeOk: { backgroundColor: Brand.primarySoft },
  noticeError: { backgroundColor: Brand.primarySofter },
  noticeText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  noticeTextError: { color: Brand.primaryDeep },
  card: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 16, gap: 6 },
  cardTitle: { fontSize: Type.title3, fontWeight: '700', color: Brand.ink, marginBottom: 6 },
  label: { fontSize: Type.small, fontWeight: '700', color: Brand.ink, marginTop: 8 },
  input: {
    minHeight: Touch.min,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Brand.line,
    backgroundColor: Brand.bg,
    paddingHorizontal: 14,
    fontSize: Type.body,
    fontWeight: '500',
    color: Brand.ink,
  },
  multiline: { minHeight: 72, paddingTop: 12, textAlignVertical: 'top' },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 2 },
  colSmall: { flex: 1 },
  picked: { fontSize: Type.small, fontWeight: '700', color: Brand.primaryDeep },
  match: { minHeight: Touch.min, justifyContent: 'center', paddingHorizontal: 14, borderRadius: Radius.md, backgroundColor: Brand.primarySoft },
  matchText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: Touch.min },
  box2: { width: 24, height: 24, borderRadius: Radius.sm, borderWidth: 2, borderColor: Brand.line, alignItems: 'center', justifyContent: 'center' },
  box2On: { backgroundColor: Brand.primaryDeep, borderColor: Brand.primaryDeep },
  toggleText: { fontSize: Type.body, fontWeight: '600', color: Brand.ink },
  primary: { minHeight: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  primaryText: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.white },
  disabled: { opacity: 0.6 },
  link: { minHeight: Touch.min, alignItems: 'center', justifyContent: 'center' },
  linkText: { fontSize: Type.body, fontWeight: '700', color: Brand.inkSoft },
  listTitle: { fontSize: Type.title3, fontWeight: '700', color: Brand.ink, marginTop: 8 },
  item: { backgroundColor: Brand.white, borderRadius: Radius.lg, padding: 14, gap: 6 },
  itemOff: { opacity: 0.65 },
  itemHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  itemTitle: { flex: 1, fontSize: Type.bodyLg, fontWeight: '800', color: Brand.ink },
  itemSpot: { fontSize: Type.small, fontWeight: '600', color: Brand.inkSoft },
  itemMeta: { fontSize: Type.small, fontWeight: '600', color: Brand.ink },
  pill: { minHeight: Touch.min, paddingHorizontal: 14, borderRadius: Radius.pill, justifyContent: 'center', borderWidth: 1, borderColor: Brand.line },
  pillOn: { backgroundColor: Brand.primarySoft, borderColor: Brand.primarySoft },
  pillOff: { backgroundColor: Brand.bg },
  pillText: { fontSize: Type.small, fontWeight: '700', color: Brand.inkSoft },
  pillTextOn: { color: Brand.primaryDeep },
  warn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  warnText: { fontSize: Type.small, fontWeight: '700', color: Brand.primaryDeep },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: Brand.primarySoft, borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  tagText: { fontSize: Type.caption, fontWeight: '700', color: Brand.primaryDeep },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  iconBtn: { width: Touch.min, height: Touch.min, borderRadius: Radius.md, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
  iconBtnDanger: { backgroundColor: Brand.primarySoft },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  confirmText: { flex: 1, fontSize: Type.small, fontWeight: '700', color: Brand.ink },
  confirmYes: { minHeight: Touch.min, paddingHorizontal: 16, borderRadius: Radius.pill, backgroundColor: Brand.primaryDeep, justifyContent: 'center' },
  confirmYesText: { fontSize: Type.small, fontWeight: '700', color: Brand.white },
  confirmNo: { width: Touch.min, height: Touch.min, borderRadius: Radius.pill, backgroundColor: Brand.bg, alignItems: 'center', justifyContent: 'center' },
});
