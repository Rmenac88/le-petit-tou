import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Bell, ChevronLeft, ChevronRight, RotateCcw, ShieldCheck } from 'lucide-react-native';

import { Brand, Font } from '../../constants/brand';
import dataset from '../../constants/dataset.json';
import { appCache } from '../../lib/dataCache';
import { discoveryStore, type DiscoveryStats } from '../../lib/discoveryStore';
import { userListsStore } from '../../lib/userListsStore';
import AppleWalletCard from '../AppleWalletCard';
import AddressDetailModal, { SpotDetail } from '../AddressDetailModal';
import MyListsSection from '../lists/MyListsSection';
import NotificationSettingsModal from '../NotificationSettingsModal';
import PrivacyPolicyModal from '../PrivacyPolicyModal';
import ProgressionBanner from './home/ProgressionBanner';

interface Props {
  onBack: () => void;
  onSelectSpot?: (spotId: string) => void;
  onToggleDock?: (visible: boolean) => void;
}

/** Espace profil : niveau et points, carte Petit Tou, listes personnelles et réglages. */
export default function ProfileView({ onBack, onSelectSpot, onToggleDock }: Props) {
  const [stats, setStats] = useState<DiscoveryStats>(discoveryStore.getStats());
  const [isFlipped, setIsFlipped] = useState(false);
  const [detail, setDetail] = useState<SpotDetail | null>(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  useEffect(() => discoveryStore.subscribe((s) => setStats(s)), []);
  useEffect(() => {
    onToggleDock?.(!detail);
  }, [detail, onToggleDock]);

  const addresses = useMemo(() => {
    const source: any[] = appCache.get<any[]>('addresses') ?? (dataset.addresses as any[]);
    return new Map<string, any>(source.map((a) => [String(a.id), a]));
  }, []);

  // Une adresse supprimée du guide disparaît des listes
  useEffect(() => {
    if (addresses.size > 500) userListsStore.purge(new Set(addresses.keys()));
  }, [addresses]);

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

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Retour">
          <ChevronLeft size={22} color={Brand.ink} />
        </Pressable>
        <Text style={styles.title}>Mon profil</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* la bannière porte sa propre marge latérale (16) : on la compense pour l'aligner sur le reste de la page (20) */}
        <View style={styles.bannerWrap}>
          <ProgressionBanner discoveryStats={stats} />
        </View>

        <View style={styles.cardBlock}>
          <AppleWalletCard activeSkin="sidereal" onFlipChange={setIsFlipped} />
          <View style={styles.hint}>
            <RotateCcw size={13} color={Brand.inkSoft} style={{ marginRight: 5 }} />
            <Text style={styles.hintText}>{isFlipped ? 'Toucher pour voir le recto' : 'Toucher pour retourner la carte'}</Text>
          </View>
        </View>

        <MyListsSection addresses={addresses} onOpenSpot={openDetail} />

        <Text style={styles.sectionTitle}>Réglages</Text>
        <View style={styles.settings}>
          <Pressable style={styles.settingRow} onPress={() => setShowNotifs(true)} accessibilityRole="button">
            <Bell size={18} color={Brand.ink} />
            <Text style={styles.settingText}>Notifications</Text>
            <ChevronRight size={18} color={Brand.inkMute} />
          </Pressable>
          <Pressable style={[styles.settingRow, styles.settingRowLast]} onPress={() => setShowPrivacy(true)} accessibilityRole="button">
            <ShieldCheck size={18} color={Brand.ink} />
            <Text style={styles.settingText}>Confidentialité et RGPD</Text>
            <ChevronRight size={18} color={Brand.inkMute} />
          </Pressable>
        </View>
        <View style={styles.seal}>
          <ShieldCheck size={14} color={Brand.successDeep} strokeWidth={2} style={{ marginRight: 6 }} />
          <Text style={styles.sealText}>Mémorisé sur cet appareil</Text>
        </View>
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
      <NotificationSettingsModal visible={showNotifs} onClose={() => setShowNotifs(false)} />
      <PrivacyPolicyModal visible={showPrivacy} onClose={() => setShowPrivacy(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Brand.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 6 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: Brand.white, borderWidth: 1, borderColor: Brand.line, alignItems: 'center', justifyContent: 'center' },
  title: { fontFamily: Font.display, fontSize: 26, color: Brand.ink },
  scroll: { paddingHorizontal: 20, paddingBottom: 150, gap: 16 },
  bannerWrap: { marginHorizontal: -16 },
  cardBlock: { alignItems: 'center', marginTop: 6, marginBottom: 10 },
  hint: { flexDirection: 'row', alignItems: 'center', marginTop: 16, backgroundColor: Brand.white, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 24, borderWidth: 1.5, borderColor: Brand.line },
  hintText: { fontSize: 12, fontWeight: '700', color: Brand.inkSoft },
  sectionTitle: { fontFamily: Font.display, fontSize: 20, color: Brand.ink, marginTop: 8 },
  settings: { backgroundColor: Brand.white, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: Brand.line, marginTop: -4 },
  settingRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, minHeight: 56, borderBottomWidth: 1, borderBottomColor: Brand.line },
  settingRowLast: { borderBottomWidth: 0 },
  settingText: { flex: 1, fontSize: 15, fontWeight: '700', color: Brand.ink },
  seal: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  sealText: { fontSize: 12, color: '#4A4A58', fontWeight: '600' },
});
