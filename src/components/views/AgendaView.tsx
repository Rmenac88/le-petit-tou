import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MapPin, Repeat } from 'lucide-react-native';
import { Brand, Radius, Touch, Type } from '../../constants/brand';
import dataset from '../../constants/dataset.json';
import { PLACEHOLDER_PHOTO } from '../../constants/placeholder';
import { supabase } from '../../lib/supabase';
import { getOptimizedImageUrl } from '../../lib/imageOptimizer';
import {
  buildDayStrip,
  clampSelectedDay,
  expandOccurrences,
  formatDateFr,
  weekdayLabel,
  type Occurrence,
  type PartnerEventRow,
} from '../../lib/agendaOccurrences.ts';
import { AgendaError, fetchPublicPartnerEvents } from '../../lib/partnerEventsStore';
import AddressDetailModal, { SpotDetail } from '../AddressDetailModal';
import ProfileButton from '../ProfileButton';
import DayStrip from './agenda/DayStrip';

const DAYS_SHOWN = 14;

/** Jour calendaire de l'appareil (YYYY-MM-DD), sans passer par l'UTC. */
function localTodayIso(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

function capitalizeFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

interface AgendaViewProps {
  onToggleDock?: (visible: boolean) => void;
  onSelectSpot?: (spotId: string) => void;
  onOpenProfile?: () => void;
}

export default function AgendaView({ onToggleDock, onSelectSpot, onOpenProfile }: AgendaViewProps) {
  const [today, setToday] = useState(localTodayIso);
  const todayRef = useRef(today);
  todayRef.current = today;
  const days = useMemo(() => buildDayStrip(today, DAYS_SHOWN), [today]);

  const [events, setEvents] = useState<PartnerEventRow[]>([]);
  const [spots, setSpots] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(today);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [detail, setDetail] = useState<SpotDetail | null>(null);

  useEffect(() => {
    onToggleDock?.(!detail);
  }, [detail, onToggleDock]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const rows = await fetchPublicPartnerEvents(today);
      const local = new Map<string, any>((dataset.addresses as any[]).map((a) => [a.id, a]));
      const ids = Array.from(new Set(rows.map((r) => r.spot_id)));
      const missing = ids.filter((id) => !local.has(id));
      if (missing.length > 0 && supabase) {
        try {
          const { data } = await supabase.from('addresses').select('*').in('id', missing);
          (data ?? []).forEach((a: any) => local.set(a.id, a));
        } catch {
          // adresses introuvables : les cartes correspondantes seront simplement omises
        }
      }
      setSpots(Object.fromEntries(ids.filter((id) => local.has(id)).map((id) => [id, local.get(id)])));
      setEvents(rows);
    } catch (err) {
      setErrorMessage(err instanceof AgendaError ? err.message : 'Agenda indisponible pour le moment.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    load();
  }, [load]);

  // Retour au premier plan : nouveau jour => on repart d'aujourd'hui ; même jour => on recharge
  // pour voir les dates ajoutées entre-temps.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      const now = localTodayIso();
      if (now !== todayRef.current) {
        setToday(now); // recharge via load (dépend de today)
        setSelectedDay((d) => clampSelectedDay(d, now));
      } else {
        load();
      }
    });
    return () => sub.remove();
  }, [load]);

  // occurrences des 14 jours, uniquement pour les adresses connues
  const allOccurrences = useMemo(
    () =>
      expandOccurrences(events, days[0], days[days.length - 1]).filter(
        (o) => !!spots[o.event.spot_id]
      ),
    [events, spots, days]
  );

  const categories = useMemo(() => {
    const ids = new Set(allOccurrences.map((o) => spots[o.event.spot_id].category_id));
    return (dataset.categories as any[]).filter((c) => ids.has(c.id));
  }, [allOccurrences, spots]);

  const visible = useMemo(
    () =>
      allOccurrences.filter(
        (o) => !categoryId || spots[o.event.spot_id].category_id === categoryId
      ),
    [allOccurrences, spots, categoryId]
  );
  const markedDays = useMemo(() => new Set(visible.map((o) => o.occurrenceDate)), [visible]);
  const dayItems = visible.filter((o) => o.occurrenceDate === selectedDay);

  const openDetail = (spot: any) => {
    const gallery = spot.gallery_urls || [];
    setDetail({
      ...spot,
      category: (dataset.categories as any[]).find((c) => c.id === spot.category_id)?.name,
      description: spot.full_description || spot.description,
      full_description: spot.full_description || spot.description,
      breadcrumbs: spot.breadcrumbs || [],
      tags: spot.tags || [],
      photos: spot.image_url ? [spot.image_url, ...gallery] : gallery,
      phone: spot.telephone || spot.phone || '',
      website: spot.site_web || spot.website || '',
      hours: spot.horaires || spot.hours || '',
    });
  };

  const renderCard = (o: Occurrence) => {
    const spot = spots[o.event.spot_id];
    const time = o.event.end_time ? `${o.event.start_time} – ${o.event.end_time}` : o.event.start_time;
    return (
      <Pressable
        key={`${o.event.id}-${o.occurrenceDate}`}
        style={styles.card}
        onPress={() => openDetail(spot)}
        accessibilityLabel={`${o.event.title}, ${spot.title}, ${time}`}
      >
        <Image
          source={{ uri: spot.image_url ? getOptimizedImageUrl(spot.image_url, 300) : PLACEHOLDER_PHOTO }}
          style={styles.cardImage}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
        />
        <View style={styles.cardBody}>
          <Text style={styles.cardTime}>{time}</Text>
          <Text style={styles.cardTitle} numberOfLines={2}>{o.event.title}</Text>
          <Text style={styles.cardSpot} numberOfLines={1}>{spot.title}</Text>
          <View style={styles.cardMeta}>
            <MapPin size={14} color={Brand.inkSoft} strokeWidth={2} />
            <Text style={styles.cardLocation} numberOfLines={1}>
              {o.event.location_override || spot.address || spot.location || 'Toulouse'}
            </Text>
          </View>
          {o.isRecurring && (
            <View style={styles.tag}>
              <Repeat size={12} color={Brand.primaryDeep} strokeWidth={2} />
              <Text style={styles.tagText}>chaque {weekdayLabel(o.occurrenceDate)}</Text>
            </View>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Agenda</Text>
            <Text style={styles.subtitle}>Les dates des adresses partenaires.</Text>
          </View>
          {onOpenProfile && <ProfileButton onPress={onOpenProfile} />}
        </View>

        <DayStrip days={days} selected={selectedDay} markedDays={markedDays} onSelect={setSelectedDay} />

        {categories.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            {[{ id: null as string | null, name: 'Tout' }, ...categories].map((c) => {
              const active = categoryId === c.id;
              return (
                <Pressable
                  key={c.id ?? 'all'}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategoryId(c.id)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{c.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        <Text style={styles.dayTitle}>{capitalizeFirst(formatDateFr(selectedDay))}</Text>

        {loading ? (
          <View style={styles.list}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.card, styles.skeleton]} />
            ))}
          </View>
        ) : errorMessage ? (
          <View style={styles.stateBox}>
            <Text style={styles.stateTitle}>{errorMessage}</Text>
            <Pressable style={styles.retry} onPress={load} accessibilityLabel="Réessayer">
              <Text style={styles.retryText}>Réessayer</Text>
            </Pressable>
          </View>
        ) : dayItems.length === 0 ? (
          <View style={styles.stateBox}>
            <Image
              source={require('../../../assets/images/logo-transparent.png')}
              style={styles.stateLogo}
              contentFit="contain"
            />
            <Text style={styles.stateTitle}>Rien de prévu ce jour-là</Text>
            <Text style={styles.stateSub}>Essaie un autre jour du bandeau.</Text>
          </View>
        ) : (
          <View style={styles.list}>{dayItems.map(renderCard)}</View>
        )}
      </ScrollView>

      {detail && (
        <AddressDetailModal
          spot={detail}
          onClose={() => setDetail(null)}
          onGoToMap={(spotId) => {
            setDetail(null);
            onSelectSpot?.(spotId);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  scroll: { paddingTop: 12, paddingBottom: 150 },
  header: { paddingHorizontal: 20, marginBottom: 16, flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontSize: Type.title2, fontWeight: '800', color: Brand.ink },
  subtitle: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft, marginTop: 4 },
  chips: { paddingHorizontal: 20, gap: 8, paddingTop: 16 },
  chip: {
    minHeight: Touch.min,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    backgroundColor: Brand.white,
    borderWidth: 1,
    borderColor: Brand.line,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: Brand.primaryDeep, borderColor: Brand.primaryDeep },
  chipText: { fontSize: Type.small, fontWeight: '700', color: Brand.ink },
  chipTextActive: { color: Brand.white },
  dayTitle: {
    fontSize: Type.title3,
    fontWeight: '700',
    color: Brand.ink,
    paddingHorizontal: 20,
    marginTop: 20,
    marginBottom: 12,
  },
  list: { paddingHorizontal: 20, gap: 12 },
  card: {
    flexDirection: 'row',
    gap: 14,
    backgroundColor: Brand.white,
    borderRadius: Radius.lg,
    padding: 12,
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  skeleton: { height: 112, backgroundColor: Brand.line, shadowOpacity: 0 },
  cardImage: { width: 88, height: 88, borderRadius: Radius.md, backgroundColor: Brand.line },
  cardBody: { flex: 1, gap: 2, justifyContent: 'center' },
  cardTime: { fontSize: Type.small, fontWeight: '800', color: Brand.primaryDeep },
  cardTitle: { fontSize: Type.bodyLg, fontWeight: '800', color: Brand.ink },
  cardSpot: { fontSize: Type.small, fontWeight: '600', color: Brand.inkSoft },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  cardLocation: { flex: 1, fontSize: Type.caption, fontWeight: '500', color: Brand.inkSoft },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: Brand.primarySoft,
    borderRadius: Radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 6,
  },
  tagText: { fontSize: Type.caption, fontWeight: '700', color: Brand.primaryDeep },
  stateBox: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 24, gap: 8 },
  stateLogo: { width: 72, height: 74, opacity: 0.9, marginBottom: 4 },
  stateTitle: { fontSize: Type.bodyLg, fontWeight: '700', color: Brand.ink, textAlign: 'center' },
  stateSub: { fontSize: Type.body, fontWeight: '500', color: Brand.inkSoft, textAlign: 'center' },
  retry: {
    minHeight: Touch.min,
    paddingHorizontal: 24,
    borderRadius: Radius.pill,
    backgroundColor: Brand.primaryDeep,
    justifyContent: 'center',
    marginTop: 8,
  },
  retryText: { fontSize: Type.body, fontWeight: '700', color: Brand.white },
});
