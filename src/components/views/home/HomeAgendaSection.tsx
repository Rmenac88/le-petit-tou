import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MapPin, Repeat } from 'lucide-react-native';

import { Brand, Radius, Type } from '../../../constants/brand';
import { PLACEHOLDER_PHOTO } from '../../../constants/placeholder';
import { dayChipLabel, weekdayLabel, type PartnerEventRow } from '../../../lib/agendaOccurrences.ts';
import { fetchPublicPartnerEvents } from '../../../lib/partnerEventsStore';
import { getOptimizedImageUrl } from '../../../lib/imageOptimizer';
import { upcomingPartnerOccurrences } from '../../../lib/homeLogic.ts';
import homeStyles from './homeStyles';

interface Props {
  /** Toutes les adresses du guide (les dates ne sont affichées que pour une adresse connue). */
  addresses: any[];
  onSeeAll: () => void;
  onOpenSpot: (address: any) => void;
}

/** Jour calendaire de l'appareil (YYYY-MM-DD), sans passer par l'UTC. */
function localTodayIso(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Aperçu de l'agenda des partenaires sur l'accueil : les prochaines dates (14 jours). La section n'apparaît que s'il y en
 * a au moins une ; « Voir tout » ouvre l'onglet Agenda.
 */
export default function HomeAgendaSection({ addresses, onSeeAll, onOpenSpot }: Props) {
  const [events, setEvents] = useState<PartnerEventRow[]>([]);
  const [today, setToday] = useState(localTodayIso);

  const load = useCallback(async () => {
    try {
      const day = localTodayIso();
      setToday(day);
      setEvents(await fetchPublicPartnerEvents(day));
    } catch {
      // Agenda indisponible : la section reste simplement masquée
    }
  }, []);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => sub.remove();
  }, [load]);

  const byId = useMemo(() => new Map<string, any>(addresses.map((a) => [String(a.id), a])), [addresses]);
  const occurrences = useMemo(
    () => upcomingPartnerOccurrences(events, today, new Set(byId.keys()), 14, 8),
    [events, today, byId]
  );

  if (occurrences.length === 0) return null;

  return (
    <>
      <View style={homeStyles.sectionHeader}>
        <Text style={homeStyles.sectionTitle}>Agenda des partenaires</Text>
        <Pressable onPress={onSeeAll} hitSlop={{ top: 14, bottom: 14, left: 12, right: 12 }} accessibilityRole="button">
          <Text style={homeStyles.seeAllText}>Voir tout</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={homeStyles.cardsScroll}>
        {occurrences.map((o) => {
          const spot = byId.get(String(o.event.spot_id));
          const chip = dayChipLabel(o.occurrenceDate);
          const isToday = o.occurrenceDate === today;
          const time = o.event.end_time ? `${o.event.start_time} – ${o.event.end_time}` : o.event.start_time;
          return (
            <Pressable
              key={`${o.event.id}-${o.occurrenceDate}`}
              style={styles.card}
              onPress={() => onOpenSpot(spot)}
              accessibilityRole="button"
              accessibilityLabel={`${o.event.title}, ${spot.title}, ${time}`}
            >
              <Image
                source={{ uri: spot.image_url ? getOptimizedImageUrl(spot.image_url, 400) : PLACEHOLDER_PHOTO }}
                style={styles.image}
                contentFit="cover"
                transition={150}
                cachePolicy="memory-disk"
              />
              <View style={[styles.dateChip, isToday && styles.dateChipToday]}>
                <Text style={[styles.dateChipWeekday, isToday && styles.dateChipTextToday]}>{isToday ? "auj." : chip.weekday}</Text>
                <Text style={[styles.dateChipDay, isToday && styles.dateChipTextToday]}>{chip.day}</Text>
              </View>
              <View style={styles.body}>
                <Text style={styles.time}>{time}</Text>
                <Text style={styles.title} numberOfLines={2}>{o.event.title}</Text>
                <Text style={styles.spot} numberOfLines={1}>{spot.title}</Text>
                <View style={styles.meta}>
                  {o.isRecurring ? (
                    <>
                      <Repeat size={12} color={Brand.primaryDeep} strokeWidth={2} />
                      <Text style={styles.metaText} numberOfLines={1}>chaque {weekdayLabel(o.occurrenceDate)}</Text>
                    </>
                  ) : (
                    <>
                      <MapPin size={12} color={Brand.inkSoft} strokeWidth={2} />
                      <Text style={styles.metaText} numberOfLines={1}>
                        {o.event.location_override || spot.location || 'Toulouse'}
                      </Text>
                    </>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 250,
    backgroundColor: Brand.white,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    shadowColor: Brand.night,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  image: { width: '100%', height: 110, backgroundColor: Brand.line },
  dateChip: {
    position: 'absolute',
    top: 10,
    left: 10,
    minWidth: 48,
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 14,
    backgroundColor: Brand.white,
    alignItems: 'center',
  },
  dateChipToday: { backgroundColor: Brand.primaryDeep },
  dateChipWeekday: { fontSize: 11, fontWeight: '700', color: Brand.inkSoft, textTransform: 'uppercase' },
  dateChipDay: { fontSize: 18, fontWeight: '800', color: Brand.ink, lineHeight: 21 },
  dateChipTextToday: { color: Brand.white },
  body: { padding: 14, gap: 2 },
  time: { fontSize: Type.small, fontWeight: '800', color: Brand.primaryDeep },
  title: { fontSize: Type.bodyLg, fontWeight: '800', color: Brand.ink, minHeight: 40 },
  spot: { fontSize: Type.small, fontWeight: '600', color: Brand.inkSoft },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  metaText: { flex: 1, fontSize: Type.caption, fontWeight: '600', color: Brand.inkSoft },
});
