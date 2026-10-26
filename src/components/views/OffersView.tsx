import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, Font } from '../../constants/brand';
import dataset from '../../constants/dataset.json';
import { appCache } from '../../lib/dataCache';
import { discountCardsStore, type OffersStatus } from '../../lib/discountCardsStore';
import { OFFER_CATEGORIES, countByCategory, filterOffers, type Offer, type OfferFilter } from '../../lib/offersLogic';
import ProfileButton from '../ProfileButton';
import OfferCard from '../offers/OfferCard';
import OfferDetailSheet from '../offers/OfferDetailSheet';

interface Props {
  onSelectSpot?: (spotId: string) => void;
  onOpenProfile?: () => void;
  onToggleDock?: (visible: boolean) => void;
}

/** Onglet « - % » : toutes les offres et réductions des adresses partenaires, par catégorie. */
export default function OffersView({ onSelectSpot, onOpenProfile, onToggleDock }: Props) {
  const [offers, setOffers] = useState<Offer[]>(discountCardsStore.getCards());
  const [status, setStatus] = useState<OffersStatus>(discountCardsStore.getStatus());
  const [filter, setFilter] = useState<OfferFilter>('all');
  const [open, setOpen] = useState<Offer | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    discountCardsStore.start();
    return discountCardsStore.subscribe((cards, s) => {
      setOffers(cards.slice());
      setStatus(s);
    });
  }, []);
  useEffect(() => {
    onToggleDock?.(!open);
  }, [open, onToggleDock]);

  const knownSpotIds = useMemo(() => {
    const source: any[] = appCache.get<any[]>('addresses') ?? (dataset.addresses as any[]);
    return new Set(source.map((a) => String(a.id)));
  }, []);

  const counts = useMemo(() => countByCategory(offers), [offers]);
  const visible = useMemo(() => filterOffers(offers, filter), [offers, filter]);
  // une catégorie sans offre disparaît des puces (sauf « Tout »), et on repasse sur « Tout » si elle se vide
  const chips = useMemo(
    () => [{ id: 'all' as OfferFilter, label: 'Tout' }, ...OFFER_CATEGORIES.filter((c) => counts[c.id] > 0)],
    [counts]
  );
  useEffect(() => {
    if (filter !== 'all' && counts[filter] === 0) setFilter('all');
  }, [counts, filter]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    setNow(Date.now());
    await discountCardsStore.syncWithSupabase();
    setRefreshing(false);
  }, []);

  const header = (
    <View>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Offres</Text>
          <Text style={styles.subtitle}>Les bons plans de nos adresses partenaires.</Text>
        </View>
        {onOpenProfile && <ProfileButton onPress={onOpenProfile} />}
      </View>
      {offers.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} keyboardShouldPersistTaps="handled">
          {chips.map((c) => {
            const active = filter === c.id;
            return (
              <Pressable
                key={c.id}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(c.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {c.label} <Text style={[styles.chipCount, active && styles.chipTextActive]}>{counts[c.id]}</Text>
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );

  const empty =
    status === 'loading' || status === 'idle' ? (
      <View style={styles.state}>
        <ActivityIndicator color={Brand.primaryDeep} />
      </View>
    ) : status === 'error' ? (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>Offres indisponibles pour le moment</Text>
        <Text style={styles.stateSub}>Vérifie ta connexion puis réessaie.</Text>
        <Pressable style={styles.retry} onPress={refresh} accessibilityRole="button">
          <Text style={styles.retryText}>Réessayer</Text>
        </Pressable>
      </View>
    ) : (
      <View style={styles.state}>
        <Image source={require('../../../assets/images/logo-transparent.png')} style={styles.stateLogo} contentFit="contain" />
        <Text style={styles.stateTitle}>Pas d'offre pour le moment</Text>
        <Text style={styles.stateSub}>Les réductions de nos adresses partenaires apparaîtront ici.</Text>
      </View>
    );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={visible}
        keyExtractor={(o) => o.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
        renderItem={({ item }) => <OfferCard offer={item} nowMs={now} onPress={() => setOpen(item)} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Brand.primaryDeep} colors={[Brand.primaryDeep]} />}
        initialNumToRender={6}
        windowSize={7}
      />

      <OfferDetailSheet
        offer={open}
        nowMs={now}
        canOpenSpot={!!open?.partner_id && knownSpotIds.has(open.partner_id)}
        onOpenSpot={(id) => onSelectSpot?.(id)}
        onClose={() => setOpen(null)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 150, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  headerText: { flex: 1, minWidth: 0 },
  title: { fontFamily: Font.display, fontSize: 28, color: Brand.ink },
  subtitle: { fontSize: 14, fontWeight: '500', color: Brand.inkSoft, marginTop: 2 },
  chips: { gap: 8, paddingBottom: 16, paddingRight: 8 },
  chip: { minHeight: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: Brand.white, borderWidth: 1, borderColor: Brand.line, justifyContent: 'center' },
  chipActive: { backgroundColor: Brand.primaryDeep, borderColor: Brand.primaryDeep },
  chipText: { fontSize: 13.5, fontWeight: '700', color: Brand.ink },
  chipTextActive: { color: Brand.white },
  chipCount: { fontWeight: '600', color: Brand.inkSoft },
  state: { alignItems: 'center', paddingTop: 48, paddingHorizontal: 28, gap: 8 },
  stateLogo: { width: 72, height: 74, opacity: 0.9, marginBottom: 4 },
  stateTitle: { fontSize: 17, fontWeight: '800', color: Brand.ink, textAlign: 'center' },
  stateSub: { fontSize: 14, lineHeight: 20, fontWeight: '500', color: Brand.inkSoft, textAlign: 'center' },
  retry: { marginTop: 8, minHeight: 44, paddingHorizontal: 24, borderRadius: 22, backgroundColor: Brand.primaryDeep, justifyContent: 'center' },
  retryText: { fontSize: 15, fontWeight: '800', color: Brand.white },
});
