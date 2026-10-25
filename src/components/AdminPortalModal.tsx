import React, { useState, useEffect, useRef, useMemo, useCallback, useDeferredValue } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  LogOut,
  Search,
  Plus,
  Trash2,
  Edit3,
  ArrowUp,
  ArrowDown,
  Upload,
  Calendar,
  MapPin,
  Check,
  X,
  Sparkles,
  Utensils,
  Coffee,
  ShoppingBag,
  Compass,
  Trophy,
  Filter,
  CheckCircle,
  AlertTriangle,
  RefreshCw,
  Home,
  Clock,
  Phone,
  Globe,
  Tag,
  Archive,
  Link as LinkIcon,
  Star,
  Image as ImageIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { createAdminDb } from '../lib/adminApi';
import { emitAppEvent } from '../lib/appEvents';
import { ADMIN_IDLE_LOCK_MS } from '../constants/config';
import dataset from '../constants/dataset.json';
import { getStoredPartners, saveStoredPartners } from '../lib/partnersStore';
import { appCache } from '../lib/dataCache';
import { getOptimizedImageUrl } from '../lib/imageOptimizer';
import {
  SPOT_LIST_COLUMNS,
  categoryLabelFor,
  filterSpotsByQuery,
  removeSpot,
  upsertSpot,
} from '../lib/adminSpotsLogic';
import {
  isAddressInCategory,
  getCategorySpotCount,
  classifyAddress,
} from '../lib/categoryResolver';

import { Brand } from '../constants/brand';
import AgendaAdminPanel from './admin/AgendaAdminPanel';
import PushAdminPanel from './admin/PushAdminPanel';
import FeaturedAdminPanel from './admin/FeaturedAdminPanel';
import HomeBackgroundAdminPanel from './admin/HomeBackgroundAdminPanel';
import OffersAdminPanel from './admin/OffersAdminPanel';
const generateUUID = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const normalizeDate = (input: string): string | null => {
  const trimmed = (input || '').trim();
  if (!trimmed) return null;

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!isNaN(d.getTime())) return trimmed;
  }

  // Format DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const frMatch = trimmed.match(/^(\d{1,2})[\/\.-](\d{1,2})[\/\.-](\d{4})$/);
  if (frMatch) {
    const day = frMatch[1].padStart(2, '0');
    const month = frMatch[2].padStart(2, '0');
    const year = frMatch[3];
    const iso = `${year}-${month}-${day}`;
    const d = new Date(iso);
    if (!isNaN(d.getTime())) return iso;
  }

  // Generic date parsing
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed).toISOString().split('T')[0];
  }

  return null;
};

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const uploadMediaToSupabase = async (
  uri: string,
  bucket: string,
  folder: string,
  mimeType: string = 'image/jpeg'
): Promise<string> => {
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${mimeType.split('/')[1] || 'jpg'}`;

  if (Platform.OS === 'web') {
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, blob, { contentType: mimeType, upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  } else {
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, arrayBuffer, { contentType: mimeType, upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  }
};

// ── Ligne de la liste des adresses ──
// Composant mémorisé : taper dans la recherche ou changer d'onglet ne refait pas le rendu des lignes déjà affichées.
// La liste est virtualisée (FlatList) : seules les lignes visibles existent, au lieu de 790 cartes avec leurs images.
interface SpotRowProps {
  spot: any;
  label: string;
  onEdit: (spot: any) => void;
  onDelete: (spot: any) => void;
}

/** Délai avant les téléchargements : laisse l'animation d'ouverture et le premier affichage se terminer. */
const PORTAL_OPEN_SETTLE_MS = 350;

const SPOT_ROW_PLACEHOLDER = 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200';

const SpotRow = React.memo(function SpotRow({ spot, label, onEdit, onDelete }: SpotRowProps) {
  return (
    <View style={styles.spotCard}>
      <ExpoImage
        source={{ uri: getOptimizedImageUrl(spot.image_url || SPOT_ROW_PLACEHOLDER, 160) }}
        style={styles.spotCardImage}
        contentFit="cover"
        transition={0}
        cachePolicy="memory-disk"
        recyclingKey={String(spot.id)}
      />
      <View style={styles.spotCardBody}>
        <Text style={styles.spotCardTitle} numberOfLines={1}>{spot.title || spot.name}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <MapPin size={11} color={Brand.inkSoft} />
          <Text style={styles.spotCardAddress} numberOfLines={1}>{spot.address || spot.location || 'Toulouse'}</Text>
        </View>
        <View style={styles.spotCardBadgeRow}>
          <View style={styles.miniBadge}>
            <Text style={styles.miniBadgeText}>{label}</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <Star size={11} color={Brand.chouchou} fill={Brand.chouchou} />
            <Text style={styles.spotCardRating}>{spot.rating || '4.8'}</Text>
          </View>
        </View>
      </View>

      <View style={styles.spotCardActions}>
        <Pressable accessibilityRole="button" accessibilityLabel="Modifier" style={styles.actionBtnEdit} onPress={() => onEdit(spot)}>
          <Edit3 size={16} color={Brand.ink} strokeWidth={2} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Supprimer" style={styles.actionBtnDelete} onPress={() => onDelete(spot)}>
          <Trash2 size={16} color={Brand.primaryDeep} strokeWidth={2} />
        </Pressable>
      </View>
    </View>
  );
});

const spotKey = (spot: any) => String(spot.id);
const SpotSeparator = () => <View style={{ height: 12 }} />;

interface AdminPortalModalProps {
  visible: boolean;
  /** Code admin vérifié, gardé en mémoire par l'écran d'accueil (jamais stocké). */
  adminCode?: string;
  onClose: () => void;
  onLogout?: () => void;
  /** Appelé dès qu'une écriture du catalogue réussit : l'accueil se rafraîchit alors UNE fois, à la fermeture. */
  onCatalogChanged?: () => void;
}

export default function AdminPortalModal({ visible, adminCode, onClose, onLogout, onCatalogChanged }: AdminPortalModalProps) {
  // Toutes les écritures du catalogue passent par la fonction serveur admin_write (code vérifié côté base)
  const onCatalogChangedRef = useRef(onCatalogChanged);
  onCatalogChangedRef.current = onCatalogChanged;
  const adminDb = useMemo(
    () =>
      createAdminDb(adminCode ?? '', {
        rpc: (fn, args) =>
          Promise.resolve(supabase.rpc(fn, args)).then((res: any) => {
            if (fn === 'admin_write' && res?.data?.ok === true) onCatalogChangedRef.current?.();
            return res;
          }),
      }),
    [adminCode]
  );

  // Verrouillage automatique : le code admin ne reste jamais en mémoire plus de 15 min sans activité
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetIdleLock = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => (onLogout ?? onClose)(), ADMIN_IDLE_LOCK_MS);
  }, [onLogout, onClose]);
  useEffect(() => {
    if (!visible) return;
    resetIdleLock();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [visible, resetIdleLock]);
  const [agendaCount, setAgendaCount] = useState(0);
  const [featuredCount, setFeaturedCount] = useState(0);
  const [offersCount, setOffersCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'spots' | 'editSpot' | 'categories' | 'events' | 'partners' | 'agenda' | 'notifs' | 'featured' | 'offers' | 'background'>('spots');

  // Spots Data & Filters State
  // Affichage immédiat : dernière liste connue de l'appli, sinon adresses embarquées. La base actualise ensuite.
  const [spots, setSpots] = useState<any[]>(() => appCache.get<any[]>('addresses') ?? (dataset.addresses as any[]) ?? []);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [spotSearchQuery, setSpotSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Edit / Create Spot Form State
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
  const editingSpotIdRef = useRef<string | null>(null);
  const [spotDetail, setSpotDetail] = useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; id: string | null }>({ status: 'idle', id: null });
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFullDescription, setFormFullDescription] = useState('');
  const [formCategory, setFormCategory] = useState<string>(
    dataset.categories?.[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958'
  );
  const [formAddress, setFormAddress] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formWebsite, setFormWebsite] = useState('');
  const [formPriceLevel, setFormPriceLevel] = useState('€€');
  const [formRating, setFormRating] = useState('4.8');
  const [formLat, setFormLat] = useState('');
  const [formLng, setFormLng] = useState('');
  const [formCoverUrl, setFormCoverUrl] = useState('');
  const [formGalleryUrls, setFormGalleryUrls] = useState<string[]>([]);
  const [formIsRecommended, setFormIsRecommended] = useState(false);
  const [formIsNew, setFormIsNew] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);

  // Categories Data State
  const [categories, setCategories] = useState<any[]>(dataset.categories || []);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [catFormName, setCatFormName] = useState('');
  const [catFormSlug, setCatFormSlug] = useState('');
  const [catFormColor, setCatFormColor] = useState<string>(Brand.primary);
  const [catFormIcon, setCatFormIcon] = useState('UtensilsCrossed');

  // Events Data & Filters State
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [eventTabFilter, setEventTabFilter] = useState<'all' | 'upcoming' | 'archived'>('all');

  // Edit / Create Event Form State
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventFormTitle, setEventFormTitle] = useState('');
  const [eventFormDesc, setEventFormDesc] = useState('');
  const [eventFormDate, setEventFormDate] = useState('');
  const [eventFormTime, setEventFormTime] = useState('19:00');
  const [eventFormLocation, setEventFormLocation] = useState('');
  const [eventFormPrice, setEventFormPrice] = useState('0');
  const [eventFormImageUrl, setEventFormImageUrl] = useState('');
  const [eventFormSpotId, setEventFormSpotId] = useState<string | null>(null);
  const [eventFormBookingUrl, setEventFormBookingUrl] = useState('');
  const [eventFormMaxPlaces, setEventFormMaxPlaces] = useState('');
  const [showSpotSelectorModal, setShowSpotSelectorModal] = useState(false);

  // Sponsored Partners (Top Sponsoring Netflix) State
  const [partners, setPartners] = useState<any[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(false);
  const [partnerFormTitle, setPartnerFormTitle] = useState('');
  const [partnerFormSubtitle, setPartnerFormSubtitle] = useState('');
  const [partnerFormImage, setPartnerFormImage] = useState('');
  const [partnerFormRank, setPartnerFormRank] = useState('1');
  const [partnerFormPrice, setPartnerFormPrice] = useState('150');
  const [partnerFormDays, setPartnerFormDays] = useState('30');
  const [partnerFormNotifyHours, setPartnerFormNotifyHours] = useState('24');
  const [partnerFormSpotId, setPartnerFormSpotId] = useState<string | null>(null);
  const [partnerFormSpotName, setPartnerFormSpotName] = useState('');
  const [partnerAddressSearch, setPartnerAddressSearch] = useState('');
  const [showPartnerAddressDropdown, setShowPartnerAddressDropdown] = useState(false);
  const [isSubmittingPartner, setIsSubmittingPartner] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const partnersScrollRef = useRef<ScrollView>(null);

  // Deletion Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    visible: boolean;
    type: 'spot' | 'event' | 'category' | 'partner';
    id: string;
    name: string;
  }>({ visible: false, type: 'spot', id: '', name: '' });

  // Les téléchargements démarrent une fois l'animation d'ouverture du portail terminée (≈ 300 ms) et ne sont plus
  // diffusés à l'appli : elle se rafraîchit une seule fois à la fermeture si le catalogue a changé.
  // (Pas d'InteractionManager : une animation en boucle ailleurs dans l'appli le bloquerait indéfiniment.)
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => {
      fetchSpots();
      fetchEvents();
      fetchCategories();
      fetchPartners();
    }, PORTAL_OPEN_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [visible]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
      if (!error && data && data.length > 0) {
        setCategories(data);
      } else {
        setCategories(dataset.categories || []);
      }
    } catch (e) {
      console.warn('Fetch categories error:', e);
      setCategories(dataset.categories || []);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Liste des adresses : colonnes légères seulement (≈ 60 Ko transférés au lieu de 400 Ko, 310 Ko lus au lieu de 1,6 Mo).
  // En cas d'échec la liste déjà affichée est conservée.
  const fetchSpots = async () => {
    try {
      setLoadingSpots(true);
      const { data, error } = await supabase.from('addresses').select(SPOT_LIST_COLUMNS).order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setSpots(data);
      }
    } catch (e) {
      console.warn('Fetch spots error:', e);
    } finally {
      setLoadingSpots(false);
    }
  };

  // Fetch Events from Supabase DB
  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const { data, error } = await supabase.from('events').select('*').order('event_date', { ascending: true });
      if (!error && data) {
        setEvents(data);
      }
    } catch (e) {
      console.warn('Fetch events error:', e);
    } finally {
      setLoadingEvents(false);
    }
  };

  // ── BAN Geocoding for Form Address ──
  const handleGeocodeFormAddress = async () => {
    const query = formAddress || `${formTitle}, Toulouse`;
    if (!query.trim()) {
      showAlert('Adresse requise', 'Veuillez saisir une adresse avant de géocoder.');
      return;
    }
    try {
      setIsGeocoding(true);
      const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`);
      const data = await res.json();
      if (data && data.features && data.features.length > 0) {
        const coords = data.features[0].geometry.coordinates;
        setFormLat(coords[1].toFixed(6));
        setFormLng(coords[0].toFixed(6));
        const foundAddr = data.features[0].properties.label;
        if (foundAddr && (!formAddress || formAddress === 'Toulouse')) {
          setFormAddress(foundAddr);
        }
        showAlert('Géocodage réussi', `Coordonnées BAN trouvées : (${coords[1].toFixed(5)}, ${coords[0].toFixed(5)})`);
      } else {
        showAlert('Géocodage introuvable', 'Aucune coordonnée BAN trouvée. Veuillez vérifier l\'adresse.');
      }
    } catch (e: any) {
      showAlert('Erreur de géocodage', e.message);
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── Open Spot Form (New or Edit) ──
  const fillSpotForm = (spot: any) => {
    const defaultCatId = categories[0]?.id || dataset.categories?.[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958';
    setFormTitle(spot.title || '');
    setFormDescription(spot.description || '');
    setFormFullDescription(spot.full_description || spot.description || '');
    setFormCategory(spot.category_id || classifyAddress(spot) || defaultCatId);
    setFormAddress(spot.address || '');
    setFormLocation(spot.location || '');
    setFormPhone(spot.telephone || '');
    setFormWebsite(spot.site_web || '');
    setFormPriceLevel(spot.price_level || '€€');
    setFormRating(spot.rating ? spot.rating.toString() : '4.8');
    setFormLat(spot.lat ? spot.lat.toString() : '');
    setFormLng(spot.lng ? spot.lng.toString() : '');
    setFormCoverUrl(spot.image_url || '');
    setFormGalleryUrls(spot.gallery_urls || []);
    setFormIsRecommended(!!spot.is_recommended);
    setFormIsNew(!!spot.is_new);
  };

  // La liste ne contient que des colonnes légères : la fiche COMPLÈTE est lue en base avant toute modification.
  // Tant qu'elle n'est pas arrivée le formulaire est verrouillé, sinon un enregistrement effacerait les descriptions
  // et la galerie absentes de la liste.
  const loadSpotDetail = async (id: string) => {
    setSpotDetail({ status: 'loading', id });
    try {
      const { data, error } = await supabase.from('addresses').select('*').eq('id', id).maybeSingle();
      if (error || !data) throw error ?? new Error('introuvable');
      if (editingSpotIdRef.current !== id) return; // l'admin est passé à une autre fiche entre-temps
      fillSpotForm(data);
      setSpotDetail({ status: 'ready', id });
    } catch (e) {
      if (editingSpotIdRef.current === id) setSpotDetail({ status: 'error', id });
    }
  };

  const handleOpenEditSpot = (spot?: any) => {
    const defaultCatId = categories[0]?.id || dataset.categories?.[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958';
    if (spot) {
      editingSpotIdRef.current = spot.id;
      setEditingSpotId(spot.id);
      fillSpotForm(spot); // aperçu immédiat avec ce que la liste connaît déjà
      loadSpotDetail(spot.id);
    } else {
      editingSpotIdRef.current = null;
      setSpotDetail({ status: 'idle', id: null });
      setEditingSpotId(null);
      setFormTitle('');
      setFormDescription('');
      setFormFullDescription('');
      setFormCategory(defaultCatId);
      setFormAddress('');
      setFormLocation('');
      setFormPhone('');
      setFormWebsite('');
      setFormPriceLevel('€€');
      setFormRating('4.8');
      setFormLat('');
      setFormLng('');
      setFormCoverUrl('');
      setFormGalleryUrls([]);
      setFormIsRecommended(false);
      setFormIsNew(false);
    }
    setActiveTab('editSpot');
  };

  // ── Save / Update Spot ──
  const handleSaveSpot = async () => {
    if (!formTitle.trim()) {
      showAlert('Champ requis', 'Veuillez saisir au moins le Nom de l\'établissement.');
      return;
    }
    if (editingSpotId && spotDetail.status !== 'ready') {
      showAlert('Fiche non chargée', 'La fiche complète n\'est pas encore chargée : patiente un instant ou touche « Réessayer ».');
      return;
    }
    try {
      setIsUploading(true);

      const latVal = formLat ? parseFloat(formLat) : 43.6047;
      const lngVal = formLng ? parseFloat(formLng) : 1.4442;
      const ratingVal = formRating ? parseFloat(formRating) : 4.8;

      // Ensure category_id is a valid UUID
      let validCatId = formCategory;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(validCatId);
      if (!isUUID) {
        const found = categories.find(c => 
          c.id === validCatId || 
          c.slug === validCatId || 
          (c.name && c.name.toLowerCase().includes(validCatId.toLowerCase()))
        );
        if (found && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(found.id)) {
          validCatId = found.id;
        } else {
          validCatId = categories[0]?.id || dataset.categories?.[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958';
        }
      }

      const record: any = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        full_description: formFullDescription.trim() || formDescription.trim(),
        category_id: validCatId,
        address: formAddress.trim(),
        location: formLocation.trim() || 'Toulouse Centre',
        telephone: formPhone.trim(),
        site_web: formWebsite.trim(),
        price_level: formPriceLevel,
        rating: ratingVal,
        lat: isNaN(latVal) ? null : latVal,
        lng: isNaN(lngVal) ? null : lngVal,
        image_url: formCoverUrl || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&auto=format&fit=crop',
        gallery_urls: formGalleryUrls,
        is_recommended: formIsRecommended,
        is_new: formIsNew,
      };

      if (editingSpotId) {
        // Update existing record
        let { error } = await adminDb.from('addresses').update(record).eq('id', editingSpotId);
        if (error && error.message?.includes('full_description')) {
          delete record.full_description;
          const retry = await adminDb.from('addresses').update(record).eq('id', editingSpotId);
          error = retry.error;
        }
        if (error && (error.message?.includes('category_id') || error.message?.includes('uuid'))) {
          record.category_id = categories[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958';
          const retry = await adminDb.from('addresses').update(record).eq('id', editingSpotId);
          error = retry.error;
        }
        if (error) throw error;
        showAlert('Succès', `L'adresse "${formTitle}" a été mise à jour avec succès.`);
      } else {
        // Insert new record (generate valid UUID compliant with Postgres type)
        const cleanSlug = formTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40);
        record.id = generateUUID();
        record.slug = cleanSlug;
        record.is_recommended = true;
        record.is_new = true;
        let { error } = await adminDb.from('addresses').insert(record);
        if (error && error.message?.includes('full_description')) {
          delete record.full_description;
          const retry = await adminDb.from('addresses').insert(record);
          error = retry.error;
        }
        if (error && (error.message?.includes('category_id') || error.message?.includes('uuid'))) {
          record.category_id = categories[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958';
          const retry = await adminDb.from('addresses').insert(record);
          error = retry.error;
        }
        if (error) throw error;
        showAlert('Succès', `L'adresse "${formTitle}" a été créée et publiée.`);
      }

      // Liste mise à jour sur place avec la fiche enregistrée : pas de nouveau téléchargement de toute la table
      setSpots((prev) => upsertSpot(prev, { ...record, id: editingSpotId ?? record.id }));
      setActiveTab('spots');
    } catch (e: any) {
      showAlert('Erreur d\'enregistrement', e.message);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Image Upload Handlers ──
  const handleUploadCoverImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission requise', 'Accès à la galerie requis pour importer une image.');
      return;
    }
    try {
      setIsUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const publicUrl = await uploadMediaToSupabase(result.assets[0].uri, 'etablissements', 'covers', 'image/jpeg');
        setFormCoverUrl(publicUrl);
        showAlert('Image mise à jour', 'La photo de couverture a été téléversée sur Supabase Storage.');
      }
    } catch (e: any) {
      showAlert('Erreur téléversement', e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleAddGalleryPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission requise', 'Accès à la galerie requis.');
      return;
    }
    try {
      setIsUploading(true);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const publicUrl = await uploadMediaToSupabase(result.assets[0].uri, 'etablissements', 'gallery', 'image/jpeg');
        setFormGalleryUrls(prev => [...prev, publicUrl]);
        showAlert('Photo ajoutée', 'Une nouvelle photo a été ajoutée à la galerie.');
      }
    } catch (e: any) {
      showAlert('Erreur téléversement', e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveGalleryPhoto = (indexToRemove: number) => {
    setFormGalleryUrls(prev => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // ── Category Handlers ──
  const handleOpenEditCategory = (cat?: any) => {
    if (cat) {
      setEditingCatId(cat.id);
      setCatFormName(cat.name || '');
      setCatFormSlug(cat.slug || cat.id || '');
      setCatFormColor(cat.color || Brand.primary);
      setCatFormIcon(cat.icon_name || 'UtensilsCrossed');
    } else {
      setEditingCatId(null);
      setCatFormName('');
      setCatFormSlug('');
      setCatFormColor(Brand.primary);
      setCatFormIcon('UtensilsCrossed');
    }
  };

  const handleSaveCategory = async () => {
    if (!catFormName.trim()) {
      showAlert('Champ requis', 'Veuillez saisir le Nom de la catégorie.');
      return;
    }
    try {
      setIsUploading(true);
      const slugVal = catFormSlug.trim() || catFormName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const catObj = {
        name: catFormName.trim(),
        slug: slugVal,
        color: catFormColor,
        icon_name: catFormIcon,
      };

      if (editingCatId) {
        const { error } = await adminDb.from('categories').update(catObj).eq('id', editingCatId);
        if (error) throw error;
        showAlert('Catégorie mise à jour', `La catégorie "${catFormName}" a été modifiée.`);
      } else {
        (catObj as any).id = generateUUID();
        const { error } = await adminDb.from('categories').insert(catObj);
        if (error) throw error;
        showAlert('Catégorie créée', `La catégorie "${catFormName}" a été ajoutée avec succès.`);
      }

      await fetchCategories();
      setEditingCatId(null);
      setCatFormName('');
      setCatFormSlug('');
    } catch (e: any) {
      showAlert('Erreur catégorie', e.message);
    } finally {
      setIsUploading(false);
    }
  };

  // ── Delete Confirmation Handlers ──
  const handleConfirmDelete = async () => {
    const { type, id, name } = deleteConfirmModal;
    const before = { spots, events, categories };
    setDeleteConfirmModal({ visible: false, type: 'spot', id: '', name: '' });
    try {
      if (type === 'spot') {
        // Optimistic UI update: remove from local state immediately
        setSpots(prev => removeSpot(prev, id));
        const { data, error } = await adminDb.from('addresses').delete().eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          showAlert(
            'Adresse introuvable',
            `L'adresse "${name}" n'existe plus côté serveur : elle a été retirée de la liste locale.`
          );
        } else {
          showAlert('Suppression réussie', `L'adresse "${name}" a été définitivement supprimée.`);
        }
      } else if (type === 'event') {
        setEvents(prev => prev.filter(e => e.id !== id));
        const { error } = await adminDb.from('events').delete().eq('id', id).select();
        if (error) throw error;
        showAlert('Suppression réussie', `L'événement "${name}" a été supprimé.`);
        await fetchEvents();
      } else if (type === 'category') {
        setCategories(prev => prev.filter(c => c.id !== id));
        const { error } = await adminDb.from('categories').delete().eq('id', id).select();
        if (error) throw error;
        showAlert('Suppression réussie', `La catégorie "${name}" a été supprimée.`);
        await fetchCategories();
      } else if (type === 'partner') {
        const { data, error } = await adminDb.from('sponsored_partners').delete().eq('id', id).select();
        if (error) throw error;
        let removedRemotely = !!(data && data.length > 0);
        if (!removedRemotely) {
          // 0 ligne supprimée : soit il n'existait qu'en local, soit le serveur a refusé
          const { data: stillThere } = await supabase.from('sponsored_partners').select('id').eq('id', id);
          if (stillThere && stillThere.length > 0) {
            showAlert(
              'Suppression impossible',
              `"${name}" n'a pas pu être retiré côté serveur. Rien n'a été modifié.`
            );
            return;
          }
          removedRemotely = true;
        }
        const list = sortedPartners();
        const remaining = list.filter((p) => p.id !== id);
        reportPartnerSyncFailures(await commitPartnerOrder(remaining, list));
        if (editingPartnerId === id) resetPartnerForm();
        showAlert('Partenaire retiré', `"${name}" a été retiré du Top. Le classement a été renuméroté.`);
      }
    } catch (e: any) {
      showAlert('Erreur lors de la suppression', e.message);
      // Retrait optimiste annulé : l'élément est toujours en base, la liste doit le montrer à nouveau (même hors ligne)
      if (type === 'spot') setSpots(before.spots);
      else if (type === 'event') setEvents(before.events);
      else if (type === 'category') setCategories(before.categories);
    }
  };

  // ── Event Handlers ──
  const handleOpenEditEvent = (evt?: any) => {
    if (evt) {
      setEditingEventId(evt.id);
      setEventFormTitle(evt.title || '');
      setEventFormDesc(evt.description || '');
      setEventFormDate(evt.event_date || '');
      setEventFormTime(evt.event_time || '19:00');
      setEventFormLocation(evt.location || '');
      setEventFormPrice(evt.price !== undefined && evt.price !== null ? String(evt.price) : '0');
      setEventFormImageUrl(evt.image_url || '');
      setEventFormSpotId(evt.address_id || null);
      setEventFormBookingUrl(evt.booking_url || '');
      setEventFormMaxPlaces(evt.max_places !== undefined && evt.max_places !== null ? String(evt.max_places) : '');
    } else {
      setEditingEventId(null);
      setEventFormTitle('');
      setEventFormDesc('');
      setEventFormDate('');
      setEventFormTime('19:00');
      setEventFormLocation('');
      setEventFormPrice('0');
      setEventFormImageUrl('');
      setEventFormSpotId(null);
      setEventFormBookingUrl('');
      setEventFormMaxPlaces('');
    }
  };

  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const iso = d.toISOString().split('T')[0];
    setEventFormDate(iso);
  };

  // ── Save / Update Event ──
  const handleSaveEvent = async () => {
    if (!eventFormTitle.trim()) {
      showAlert('Titre requis', 'Veuillez saisir au moins le Titre de l\'événement.');
      return;
    }
    const cleanDate = normalizeDate(eventFormDate);
    if (!cleanDate) {
      showAlert(
        'Format de date requis',
        'Veuillez saisir une date valide au format AAAA-MM-JJ (ex: 2026-10-15) ou JJ/MM/AAAA (ex: 15/10/2026). Vous pouvez aussi utiliser les raccourcis sous le champ.'
      );
      return;
    }
    try {
      setIsUploading(true);
      const parsedPrice = parseFloat((eventFormPrice || '0').toString().replace(',', '.').replace(/[^0-9.]/g, ''));
      const validPrice = isNaN(parsedPrice) ? 0 : parsedPrice;
      const parsedMaxPlaces = eventFormMaxPlaces.trim() ? parseInt(eventFormMaxPlaces.trim(), 10) : null;

      const record: any = {
        title: eventFormTitle.trim(),
        description: eventFormDesc.trim() || 'Événement Le Petit Tou',
        event_date: cleanDate,
        event_time: eventFormTime.trim() || '19:00',
        location: eventFormLocation.trim() || 'Toulouse',
        price: validPrice,
        image_url: eventFormImageUrl.trim() || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=800',
        booking_url: eventFormBookingUrl.trim() || 'https://www.phoenix-egalite-des-chances.com',
        max_places: !isNaN(parsedMaxPlaces as number) && parsedMaxPlaces !== null ? parsedMaxPlaces : null,
      };
      if (eventFormSpotId) {
        record.address_id = eventFormSpotId;
      }

      if (editingEventId) {
        let { error } = await adminDb.from('events').update(record).eq('id', editingEventId);
        if (error && error.message?.includes('address_id')) {
          delete record.address_id;
          const retry = await adminDb.from('events').update(record).eq('id', editingEventId);
          error = retry.error;
        }
        if (error) throw error;
        showAlert('Succès', `L'événement "${eventFormTitle}" a été mis à jour.`);
      } else {
        record.id = generateUUID();
        let { error } = await adminDb.from('events').insert(record);
        if (error && error.message?.includes('address_id')) {
          delete record.address_id;
          const retry = await adminDb.from('events').insert(record);
          error = retry.error;
        }
        if (error) throw error;
        showAlert('Succès', `L'événement "${eventFormTitle}" a été créé avec succès.`);
      }

      await fetchEvents();
      emitAppEvent('eventsChanged');
      setEditingEventId(null);
      setEventFormTitle('');
      setEventFormDesc('');
      setEventFormDate('');
      setEventFormTime('19:00');
      setEventFormLocation('');
      setEventFormPrice('0');
      setEventFormImageUrl('');
      setEventFormSpotId(null);
      setEventFormBookingUrl('');
      setEventFormMaxPlaces('');
    } catch (e: any) {
      if (e.message?.includes('user_push_tokens')) {
        showAlert(
          'Mise à jour SQL requise',
          'Un ancien trigger de notifications cherche la table "user_push_tokens".\n\nSupprime ce trigger dans Supabase (Database > Triggers, table events). Ne relance pas fix_user_push_tokens.sql sans lire docs/audit : il est neutralisé.'
        );
      } else {
        showAlert('Erreur enregistrement événement', e.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // ── Sponsoring Partners Management (Top Netflix) ──
  const fetchPartners = async (): Promise<any[]> => {
    try {
      setLoadingPartners(true);
      const { data, error } = await supabase
        .from('sponsored_partners')
        .select('*')
        .order('rank_position', { ascending: true });
      if (!error && data) {
        setPartners(data);
        saveStoredPartners(data);
        return data;
      }
      const stored = getStoredPartners();
      setPartners(stored);
      return stored;
    } catch (e) {
      console.warn('Fetch partners error:', e);
      const stored = getStoredPartners();
      setPartners(stored);
      return stored;
    } finally {
      setLoadingPartners(false);
    }
  };

  const partnerBadge = (rank: number) => ({
    badge_text: rank <= 3 ? `TOP #${rank} PARTENAIRE` : 'PARTENAIRE OFFICIEL',
    sponsorship_tier: rank === 1 ? 'platinum' : rank <= 3 ? 'gold' : 'silver',
  });

  /**
   * Renumérote 1..n dans l'ordre donné, met à jour l'affichage local puis Supabase
   * (uniquement les lignes dont le rang change). Renvoie les titres refusés par la base.
   */
  const commitPartnerOrder = async (ordered: any[], before: any[]): Promise<string[]> => {
    const previousRank = new Map(before.map((p) => [p.id, p.rank_position]));
    const renumbered = ordered.map((p, i) => ({ ...p, rank_position: i + 1, ...partnerBadge(i + 1) }));
    setPartners(renumbered);
    saveStoredPartners(renumbered);
    const failed: string[] = [];
    for (const p of renumbered) {
      if (previousRank.get(p.id) === p.rank_position) continue;
      const { data, error } = await adminDb
        .from('sponsored_partners')
        .update({ rank_position: p.rank_position, badge_text: p.badge_text, sponsorship_tier: p.sponsorship_tier })
        .eq('id', p.id)
        .select();
      if (error || !data || data.length === 0) failed.push(p.title);
    }
    return failed;
  };

  const sortedPartners = () => [...partners].sort((a, b) => (a.rank_position || 999) - (b.rank_position || 999));

  const reportPartnerSyncFailures = (failed: string[]) => {
    if (failed.length === 0) return;
    showAlert(
      'Enregistré sur cet appareil seulement',
      `Le serveur a refusé la modification pour : ${failed.join(', ')}.\n\nCode admin refusé, trop de tentatives récentes ou migration 006 non appliquée. Les autres appareils ne verront pas ce changement.`
    );
  };

  const handleMovePartner = async (partner: any, direction: -1 | 1) => {
    const list = sortedPartners();
    const i = list.findIndex((p) => p.id === partner.id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    reportPartnerSyncFailures(await commitPartnerOrder(next, list));
  };

  const resetPartnerForm = () => {
    setEditingPartnerId(null);
    setPartnerFormTitle('');
    setPartnerFormSubtitle('');
    setPartnerFormImage('');
    setPartnerFormRank('1');
    setPartnerFormPrice('150');
    setPartnerFormDays('30');
    setPartnerFormNotifyHours('24');
    setPartnerFormSpotId(null);
    setPartnerFormSpotName('');
    setPartnerAddressSearch('');
  };

  const handleOpenEditPartner = (p: any) => {
    setEditingPartnerId(p.id);
    setPartnerFormTitle(p.title || '');
    setPartnerFormSubtitle(p.subtitle || '');
    setPartnerFormImage(p.image_url || '');
    setPartnerFormRank(String(p.rank_position || 1));
    setPartnerFormPrice(String(p.price_paid ?? 150));
    setPartnerFormNotifyHours(String(p.notify_interval_hours ?? 24));
    setPartnerFormSpotId(p.spot_id || null);
    const linked = spots.find((sp) => sp.id === p.spot_id);
    setPartnerFormSpotName(linked ? linked.title || linked.name || '' : '');
    setTimeout(() => partnersScrollRef.current?.scrollTo({ y: 0, animated: true }), 50);
  };

  const handleSavePartner = async () => {
    if (!partnerFormTitle.trim()) {
      showAlert('Titre requis', 'Veuillez saisir le nom du partenaire.');
      return;
    }
    try {
      setIsSubmittingPartner(true);
      const rank = Math.max(1, parseInt(partnerFormRank || '1', 10) || 1);
      const price = parseFloat(partnerFormPrice || '150');
      const days = parseInt(partnerFormDays || '30', 10);
      const notifyHours = parseInt(partnerFormNotifyHours || '24', 10);
      const base = {
        title: partnerFormTitle.trim(),
        subtitle: partnerFormSubtitle.trim(),
        image_url: partnerFormImage.trim() || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
        price_paid: price,
        notify_interval_hours: notifyHours,
        spot_id: partnerFormSpotId || null,
      };
      const current = sortedPartners();
      let record: any;
      let failed: string[] = [];

      if (editingPartnerId) {
        const existing = current.find((p) => p.id === editingPartnerId);
        const startsAt = existing?.starts_at ? new Date(existing.starts_at) : new Date();
        const fields = { ...base, ends_at: new Date(startsAt.getTime() + days * 86400000).toISOString() };
        record = { ...existing, ...fields };
        const { data, error } = await adminDb
          .from('sponsored_partners')
          .update(fields)
          .eq('id', editingPartnerId)
          .select();
        if (error || !data || data.length === 0) failed.push(base.title);
      } else {
        const startsAt = new Date();
        record = {
          ...base,
          ...partnerBadge(rank),
          rank_position: rank,
          starts_at: startsAt.toISOString(),
          ends_at: new Date(Date.now() + days * 86400000).toISOString(),
          is_active: true,
          id: generateUUID(),
        };
        const { data, error } = await adminDb.from('sponsored_partners').insert(record).select();
        if (error || !data || data.length === 0) failed.push(base.title);
      }

      // Place le partenaire au rang demandé, les autres se décalent
      const others = current.filter((p) => p.id !== record.id);
      const ordered = [...others];
      ordered.splice(Math.min(rank - 1, others.length), 0, record);
      const before = editingPartnerId ? current : [...current, { ...record, rank_position: null }];
      failed = failed.concat(await commitPartnerOrder(ordered, before));

      const wasEditing = !!editingPartnerId;
      resetPartnerForm();
      if (failed.length > 0) {
        reportPartnerSyncFailures(Array.from(new Set(failed)));
      } else {
        showAlert(wasEditing ? 'Partenaire modifié' : 'Partenaire ajouté', `"${base.title}" est maintenant classé n°${Math.min(rank, ordered.length)}.`);
      }
    } catch (err: any) {
      showAlert('Erreur', err?.message || "Impossible d'enregistrer le partenaire.");
    } finally {
      setIsSubmittingPartner(false);
    }
  };

  const handleTogglePartnerActive = async (partner: any) => {
    try {
      const nextVal = !partner.is_active;
      const updated = partners.map(p => p.id === partner.id ? { ...p, is_active: nextVal } : p);
      setPartners(updated);
      saveStoredPartners(updated);
      const { data, error } = await adminDb.from('sponsored_partners').update({ is_active: nextVal }).eq('id', partner.id).select();
      if (error || !data || data.length === 0) reportPartnerSyncFailures([partner.title]);
    } catch (e) {
      console.warn(e);
    }
  };

  // ── Filtered Spots & Events Lists ──
  // Le filtre de catégorie ne se recalcule que s'il change ; la recherche utilise une valeur différée pour que la
  // saisie reste fluide pendant que la liste se met à jour.
  const deferredSpotQuery = useDeferredValue(spotSearchQuery);
  const spotsInCategory = useMemo(
    () => (selectedCategoryFilter === 'all' ? spots : spots.filter((s) => isAddressInCategory(s, selectedCategoryFilter))),
    [spots, selectedCategoryFilter]
  );
  const filteredSpots = useMemo(() => filterSpotsByQuery(spotsInCategory, deferredSpotQuery), [spotsInCategory, deferredSpotQuery]);
  // Nombre d'adresses par catégorie : calculé seulement quand l'onglet Catégories est ouvert, et une seule fois
  // par liste (et non à chaque lettre tapée dans le formulaire).
  const onCategoriesTab = activeTab === 'categories';
  const categorySpotCounts = useMemo(
    () => (onCategoriesTab ? new Map<string, number>(categories.map((c: any) => [c.id, getCategorySpotCount(spots, c.id)])) : null),
    [onCategoriesTab, categories, spots]
  );
  // Fiche en cours de chargement (ou illisible) : le formulaire reste verrouillé, voir loadSpotDetail
  const spotFormLocked = !!editingSpotId && spotDetail.status !== 'ready';
  const categoryNamesById = useMemo(
    () => new Map<string, string>(categories.map((c: any) => [String(c.id), String(c.name)])),
    [categories]
  );

  // Rappels stables pour les lignes mémorisées (ils lisent toujours la dernière version des fonctions)
  const openEditRef = useRef(handleOpenEditSpot);
  openEditRef.current = handleOpenEditSpot;
  const onEditSpot = useCallback((spot: any) => openEditRef.current(spot), []);
  const onDeleteSpot = useCallback(
    (spot: any) => setDeleteConfirmModal({ visible: true, type: 'spot', id: spot.id, name: spot.title || spot.name }),
    []
  );
  const renderSpotItem = useCallback(
    ({ item }: { item: any }) => (
      <SpotRow
        spot={item}
        label={categoryLabelFor(item, categoryNamesById, (s) => classifyAddress(s) as string | undefined)}
        onEdit={onEditSpot}
        onDelete={onDeleteSpot}
      />
    ),
    [categoryNamesById, onEditSpot, onDeleteSpot]
  );

  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingCount = events.filter(e => e.event_date >= todayStr).length;
  const archivedCount = events.filter(e => e.event_date < todayStr).length;
  const filteredEvents = events.filter(e => {
    if (eventSearchQuery) {
      const q = eventSearchQuery.toLowerCase();
      const matchTitle = (e.title || '').toLowerCase().includes(q);
      const matchLoc = (e.location || '').toLowerCase().includes(q);
      if (!matchTitle && !matchLoc) return false;
    }
    const isPast = e.event_date < todayStr;
    if (eventTabFilter === 'upcoming' && isPast) return false;
    if (eventTabFilter === 'archived' && !isPast) return false;
    return true;
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.modalOverlay} onTouchStart={resetIdleLock}>
        {/* Header Admin Neo-Brutalist */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: Brand.bg }}>
          <View style={styles.adminHeader}>
            <Pressable accessibilityRole="button" accessibilityLabel="Retour" style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]} onPress={onClose}>
              <ChevronLeft size={22} color={Brand.ink} strokeWidth={2} />
            </Pressable>
            <Text style={styles.headerTitle}>
              <Text style={{ color: Brand.primaryDeep }}>t </Text>Portail Admin
            </Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Se déconnecter" style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]} onPress={onLogout}>
              <LogOut size={18} color={Brand.primaryDeep} strokeWidth={2} />
            </Pressable>
          </View>
        </SafeAreaView>

        {/* Tab Selector Bar (Horizontally scrollable on mobile) */}
        <View style={styles.tabBar}>
          <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
            <Pressable style={[styles.tabBtn, activeTab === 'spots' && styles.tabBtnActive]} onPress={() => setActiveTab('spots')}>
              <MapPin size={14} color={activeTab === 'spots' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'spots' && styles.tabBtnTextActive]}>Adresses ({spots.length})</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'editSpot' && styles.tabBtnActive]} onPress={() => handleOpenEditSpot()}>
              {editingSpotId ? (
                <Edit3 size={14} color={activeTab === 'editSpot' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              ) : (
                <Plus size={14} color={activeTab === 'editSpot' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.tabBtnText, activeTab === 'editSpot' && styles.tabBtnTextActive]}>
                {editingSpotId ? 'Édition' : 'Créer'}
              </Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'categories' && styles.tabBtnActive]} onPress={() => setActiveTab('categories')}>
              <Tag size={14} color={activeTab === 'categories' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'categories' && styles.tabBtnTextActive]}>Catégories</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'events' && styles.tabBtnActive]} onPress={() => setActiveTab('events')}>
              <Calendar size={14} color={activeTab === 'events' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'events' && styles.tabBtnTextActive]}>Événements</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'partners' && styles.tabBtnActive]} onPress={() => setActiveTab('partners')}>
              <Sparkles size={14} color={activeTab === 'partners' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'partners' && styles.tabBtnTextActive]}>Top Partenaires ({partners.length})</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'notifs' && styles.tabBtnActive]} onPress={() => setActiveTab('notifs')}>
              <Text style={[styles.tabBtnText, activeTab === 'notifs' && styles.tabBtnTextActive]}>Notifications</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'agenda' && styles.tabBtnActive]} onPress={() => setActiveTab('agenda')}>
              <Calendar size={14} color={activeTab === 'agenda' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'agenda' && styles.tabBtnTextActive]}>Agenda ({agendaCount})</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'featured' && styles.tabBtnActive]} onPress={() => setActiveTab('featured')}>
              <Star size={14} color={activeTab === 'featured' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'featured' && styles.tabBtnTextActive]}>Chouchous du Petit Tou ({featuredCount})</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'offers' && styles.tabBtnActive]} onPress={() => setActiveTab('offers')}>
              <Tag size={14} color={activeTab === 'offers' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'offers' && styles.tabBtnTextActive]}>Offres ({offersCount})</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'background' && styles.tabBtnActive]} onPress={() => setActiveTab('background')}>
              <Sparkles size={14} color={activeTab === 'background' ? Brand.primary : Brand.inkSoft} strokeWidth={2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'background' && styles.tabBtnTextActive]}>Apparence</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Main Content Area */}
        <View style={{ flex: 1, backgroundColor: Brand.bg }}>

          {/* ── TAB 1: SPOTS MANAGEMENT (List / Search / Filter / Delete) ── */}
          {activeTab === 'spots' && (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              {/* Search & Category Filter Section */}
              <View style={styles.searchSection}>
                <View style={styles.searchInputContainer}>
                  <Search size={18} color={Brand.inkSoft} style={{ marginRight: 8 }} />
                  <TextInput
                    placeholder="Rechercher une adresse par nom ou rue..."
                    placeholderTextColor={Brand.inkSoft}
                    value={spotSearchQuery}
                    onChangeText={setSpotSearchQuery}
                    style={styles.searchInput}
                  />
                  {spotSearchQuery.length > 0 && (
                    <Pressable onPress={() => setSpotSearchQuery('')}>
                      <X size={16} color={Brand.inkSoft} />
                    </Pressable>
                  )}
                </View>

                {/* Category Pills */}
                <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsRow}>
                  <Pressable
                    style={[styles.catPill, selectedCategoryFilter === 'all' && styles.catPillActive]}
                    onPress={() => setSelectedCategoryFilter('all')}
                  >
                    <Text style={[styles.catPillText, selectedCategoryFilter === 'all' && styles.catPillTextActive]}>
                      Toutes ({spots.length})
                    </Text>
                  </Pressable>
                  {categories.map(cat => (
                    <Pressable
                      key={cat.id}
                      style={[styles.catPill, selectedCategoryFilter === cat.id && styles.catPillActive]}
                      onPress={() => setSelectedCategoryFilter(cat.id)}
                    >
                      <Text style={[styles.catPillText, selectedCategoryFilter === cat.id && styles.catPillTextActive]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {loadingSpots && spots.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={Brand.primaryDeep} />
                </View>
              ) : (
                <FlatList
                  data={filteredSpots as any[]}
                  keyExtractor={spotKey}
                  renderItem={renderSpotItem}
                  ItemSeparatorComponent={SpotSeparator}
                  ListHeaderComponentStyle={{ marginBottom: 12 }}
                  ListHeaderComponent={
                    <View style={styles.listHeaderRow}>
                      <Text style={styles.listHeaderCount}>
                        {filteredSpots.length} adresses affichées{loadingSpots ? ' · actualisation…' : ''}
                      </Text>
                      <Pressable style={styles.addInlineBtn} onPress={() => handleOpenEditSpot()}>
                        <Plus size={16} color={Brand.white} strokeWidth={2} />
                        <Text style={styles.addInlineBtnText}>Ajouter</Text>
                      </Pressable>
                    </View>
                  }
                  contentContainerStyle={{ paddingBottom: 60 }}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  initialNumToRender={8}
                  maxToRenderPerBatch={8}
                  updateCellsBatchingPeriod={40}
                  windowSize={7}
                  removeClippedSubviews={Platform.OS === 'android'}
                />
              )}
            </View>
          )}

          {/* ── TAB 2: EDIT / CREATE SPOT FORM ── */}
          {activeTab === 'editSpot' && (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
              {spotFormLocked && (
                <View style={styles.detailBanner}>
                  {spotDetail.status === 'error' ? (
                    <>
                      <Text style={styles.detailBannerText}>Fiche complète indisponible : vérifie ta connexion.</Text>
                      <Pressable style={styles.detailRetryBtn} onPress={() => editingSpotId && loadSpotDetail(editingSpotId)}>
                        <RefreshCw size={14} color={Brand.white} strokeWidth={2} />
                        <Text style={styles.detailRetryText}>Réessayer</Text>
                      </Pressable>
                    </>
                  ) : (
                    <>
                      <ActivityIndicator size="small" color={Brand.primaryDeep} />
                      <Text style={styles.detailBannerText}>Chargement de la fiche complète…</Text>
                    </>
                  )}
                </View>
              )}
              <View style={[styles.formContainer, spotFormLocked && { opacity: 0.55, pointerEvents: 'none' }]}>
                <Text style={styles.formSectionTitle}>
                  {editingSpotId ? 'Modifier l\'adresse' : 'Créer une nouvelle adresse'}
                </Text>

                {/* Cover Image Manager */}
                <Text style={styles.inputLabel}>Photo de couverture *</Text>
                <View style={styles.coverImageRow}>
                  {formCoverUrl ? (
                    <Image source={{ uri: formCoverUrl }} style={styles.coverPreview} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <ImageIcon size={24} color={Brand.inkMute} />
                      <Text style={{ fontSize: 12, color: Brand.inkSoft, fontWeight: '700' }}>Aucune image</Text>
                    </View>
                  )}
                  <Pressable style={styles.uploadBtn} onPress={handleUploadCoverImage} disabled={isUploading}>
                    {isUploading ? <ActivityIndicator color={Brand.white} size="small" /> : <Upload size={18} color={Brand.white} strokeWidth={2} />}
                    <Text style={styles.uploadBtnText}>Téléverser image</Text>
                  </Pressable>
                </View>

                {/* Form Fields */}
                <Text style={styles.inputLabel}>Nom de l'établissement *</Text>
                <TextInput style={styles.input} value={formTitle} onChangeText={setFormTitle} placeholder="Ex: Mizuki Ramen" placeholderTextColor={Brand.inkSoft} />

                <Text style={styles.inputLabel}>Catégorie *</Text>
                <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
                  {categories.map(c => (
                    <Pressable
                      key={c.id}
                      style={[styles.catPill, formCategory === c.id && styles.catPillActive]}
                      onPress={() => setFormCategory(c.id)}
                    >
                      <Text style={[styles.catPillText, formCategory === c.id && styles.catPillTextActive]}>{c.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                <Text style={styles.inputLabel}>Adresse postale exacte *</Text>
                <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                  <TextInput
                    style={[styles.input, styles.inputHalf]}
                    value={formAddress}
                    onChangeText={setFormAddress}
                    placeholder="Ex: 54 Rue Peyrolières, 31000 Toulouse"
                    placeholderTextColor={Brand.inkSoft}
                  />
                  <Pressable style={styles.geocodeBtn} onPress={handleGeocodeFormAddress} disabled={isGeocoding}>
                    {isGeocoding ? (
                      <ActivityIndicator size="small" color={Brand.white} />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Compass size={14} color={Brand.white} />
                        <Text style={styles.geocodeBtnText}>BAN</Text>
                      </View>
                    )}
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Latitude (GPS)</Text>
                    <TextInput style={styles.input} value={formLat} onChangeText={setFormLat} keyboardType="numeric" placeholder="43.6001" placeholderTextColor={Brand.inkSoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Longitude (GPS)</Text>
                    <TextInput style={styles.input} value={formLng} onChangeText={setFormLng} keyboardType="numeric" placeholder="1.4409" placeholderTextColor={Brand.inkSoft} />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Quartier / Secteur</Text>
                <TextInput style={styles.input} value={formLocation} onChangeText={setFormLocation} placeholder="Ex: Capitole / Carmes" placeholderTextColor={Brand.inkSoft} />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Téléphone</Text>
                    <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="05 61 23 45 67" placeholderTextColor={Brand.inkSoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Site Web</Text>
                    <TextInput style={styles.input} value={formWebsite} onChangeText={setFormWebsite} placeholder="https://..." placeholderTextColor={Brand.inkSoft} />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Description courte</Text>
                <TextInput style={styles.input} value={formDescription} onChangeText={setFormDescription} multiline numberOfLines={2} placeholder="Courte accroche..." placeholderTextColor={Brand.inkSoft} />

                <Text style={styles.inputLabel}>Description complète (Avis Petit Tou)</Text>
                <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} value={formFullDescription} onChangeText={setFormFullDescription} multiline numberOfLines={4} placeholder="L'avis complet du Petit Tou..." placeholderTextColor={Brand.inkSoft} />

                {/* Gallery Management Section */}
                <View style={styles.galleryManagerSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.inputLabel}>Galerie de photos ({formGalleryUrls.length})</Text>
                    <Pressable style={styles.addPhotoSmallBtn} onPress={handleAddGalleryPhoto} disabled={isUploading}>
                      <Plus size={14} color={Brand.white} strokeWidth={2} />
                      <Text style={styles.addPhotoSmallBtnText}>Ajouter photo</Text>
                    </Pressable>
                  </View>

                  <ScrollView horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {formGalleryUrls.map((url, idx) => (
                      <View key={idx} style={styles.galleryThumbWrapper}>
                        <Image source={{ uri: url }} style={styles.galleryThumb} />
                        <Pressable style={styles.deleteThumbBtn} onPress={() => handleRemoveGalleryPhoto(idx)}>
                          <X size={12} color={Brand.white} strokeWidth={2} />
                        </Pressable>
                      </View>
                    ))}
                    {formGalleryUrls.length === 0 && (
                      <Text style={{ fontSize: 12, color: Brand.inkSoft, fontStyle: 'italic' }}>Aucune photo dans la galerie.</Text>
                    )}
                  </ScrollView>
                </View>

                {/* Submit Action Button */}
                <Pressable style={styles.saveSubmitBtn} onPress={handleSaveSpot} disabled={isUploading || spotFormLocked}>
                  {isUploading ? (
                    <ActivityIndicator color={Brand.white} size="small" />
                  ) : (
                    <Text style={styles.saveSubmitBtnText}>{editingSpotId ? 'Enregistrer les modifications →' : 'Publier l\'adresse →'}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* ── TAB 3: CATEGORIES MANAGEMENT (List / Create / Edit / Delete) ── */}
          {activeTab === 'categories' && (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
              {/* Category Form */}
              <View style={styles.formContainer}>
                <Text style={styles.formSectionTitle}>{editingCatId ? 'Modifier la catégorie' : 'Ajouter une nouvelle catégorie'}</Text>
                
                <Text style={styles.inputLabel}>Nom de la catégorie *</Text>
                <TextInput
                  style={styles.input}
                  value={catFormName}
                  onChangeText={setCatFormName}
                  placeholder="Ex: Brunch & Douceurs"
                  placeholderTextColor={Brand.inkSoft}
                />

                <Text style={styles.inputLabel}>Slug (Identifiant unique)</Text>
                <TextInput
                  style={styles.input}
                  value={catFormSlug}
                  onChangeText={setCatFormSlug}
                  placeholder="Ex: brunch-douceurs"
                  placeholderTextColor={Brand.inkSoft}
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Couleur Hex (#Hex)</Text>
                    <TextInput style={styles.input} value={catFormColor} onChangeText={setCatFormColor} placeholder={Brand.primary} placeholderTextColor={Brand.inkSoft} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Icône Lucide</Text>
                    <TextInput style={styles.input} value={catFormIcon} onChangeText={setCatFormIcon} placeholder="Coffee" placeholderTextColor={Brand.inkSoft} />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  {editingCatId && (
                    <Pressable style={styles.cancelBtn} onPress={() => handleOpenEditCategory(null)}>
                      <Text style={styles.cancelBtnText}>Annuler</Text>
                    </Pressable>
                  )}
                  <Pressable style={[styles.saveSubmitBtn, { flex: 1 }]} onPress={handleSaveCategory} disabled={isUploading}>
                    <Text style={styles.saveSubmitBtnText}>{editingCatId ? 'Enregistrer les modifications' : 'Créer la catégorie'}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Categories List */}
              <Text style={[styles.formSectionTitle, { marginTop: 20, marginBottom: 10 }]}>Toutes les catégories ({categories.length})</Text>
              
              <View style={{ gap: 10 }}>
                {categories.map((cat: any) => {
                  const spotCount = categorySpotCounts?.get(cat.id) ?? 0;
                  return (
                    <View key={cat.id} style={styles.catAdminCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View style={[styles.catIconCircle, { backgroundColor: `${cat.color || Brand.primary}20` }]}>
                          <Tag size={20} color={cat.color || Brand.primary} />
                        </View>
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <Text style={styles.catAdminTitle} numberOfLines={2}>{cat.name}</Text>
                          <Text style={styles.catAdminSub} numberOfLines={1}>Slug: {cat.slug || cat.id} • {spotCount} adresse{spotCount > 1 ? 's' : ''}</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable accessibilityRole="button" accessibilityLabel="Modifier" style={styles.editActionBtn} onPress={() => handleOpenEditCategory(cat)}>
                          <Edit3 size={14} color={Brand.ink} />
                        </Pressable>
                        <Pressable accessibilityRole="button" accessibilityLabel="Supprimer"
                          style={styles.deleteActionBtn}
                          onPress={() => setDeleteConfirmModal({ visible: true, type: 'category', id: cat.id, name: cat.name })}
                        >
                          <Trash2 size={14} color={Brand.primaryDeep} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>
            </ScrollView>
          )}

          {/* ── TAB 4: EVENTS MANAGEMENT (Upcoming / Archived / Create) ── */}
          {activeTab === 'events' && (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              {/* Filter Row: All vs Upcoming vs Archived */}
              <View style={styles.eventTabRow}>
                <Pressable
                  style={[styles.eventTabPill, eventTabFilter === 'all' && styles.eventTabPillActive]}
                  onPress={() => setEventTabFilter('all')}
                >
                  <Calendar size={13} color={eventTabFilter === 'all' ? Brand.ink : Brand.inkSoft} style={{ marginRight: 6 }} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.eventTabPillText, eventTabFilter === 'all' && styles.eventTabPillTextActive]}>
                    Tous ({events.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.eventTabPill, eventTabFilter === 'upcoming' && styles.eventTabPillActive]}
                  onPress={() => setEventTabFilter('upcoming')}
                >
                  <Clock size={13} color={eventTabFilter === 'upcoming' ? Brand.ink : Brand.inkSoft} style={{ marginRight: 6 }} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.eventTabPillText, eventTabFilter === 'upcoming' && styles.eventTabPillTextActive]}>
                    À venir ({upcomingCount})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.eventTabPill, eventTabFilter === 'archived' && styles.eventTabPillActive]}
                  onPress={() => setEventTabFilter('archived')}
                >
                  <Archive size={13} color={eventTabFilter === 'archived' ? Brand.ink : Brand.inkSoft} style={{ marginRight: 6 }} />
                  <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.eventTabPillText, eventTabFilter === 'archived' && styles.eventTabPillTextActive]}>
                    Archivés ({archivedCount})
                  </Text>
                </Pressable>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 60, gap: 12 }} showsVerticalScrollIndicator={false}>
                {/* Event Form Box */}
                <View style={styles.formContainer}>
                  <Text style={styles.formSectionTitle}>{editingEventId ? 'Modifier l\'événement' : 'Créer un événement'}</Text>
                  
                  <TextInput style={styles.input} value={eventFormTitle} onChangeText={setEventFormTitle} placeholder="Titre de l'événement *" placeholderTextColor={Brand.inkSoft} />
                  <TextInput style={styles.input} value={eventFormDesc} onChangeText={setEventFormDesc} placeholder="Description *" placeholderTextColor={Brand.inkSoft} multiline />
                  
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput style={[styles.input, styles.inputHalf]} value={eventFormDate} onChangeText={setEventFormDate} placeholder="Date (JJ/MM/AAAA) *" placeholderTextColor={Brand.inkSoft} />
                    <TextInput style={[styles.input, styles.inputHalf]} value={eventFormTime} onChangeText={setEventFormTime} placeholder="Heure (19:00)" placeholderTextColor={Brand.inkSoft} />
                  </View>

                  {/* Raccourcis date rapide */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 12, color: Brand.inkSoft, marginRight: 2 }}>Raccourcis :</Text>
                    <Pressable
                      style={{ backgroundColor: '#F5F0F2', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: Brand.line }}
                      onPress={() => setQuickDate(0)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#3A3A48' }}>Aujourd'hui</Text>
                    </Pressable>
                    <Pressable
                      style={{ backgroundColor: '#F5F0F2', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: Brand.line }}
                      onPress={() => setQuickDate(1)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#3A3A48' }}>Demain</Text>
                    </Pressable>
                    <Pressable
                      style={{ backgroundColor: '#F5F0F2', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: Brand.line }}
                      onPress={() => setQuickDate(7)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#3A3A48' }}>Dans 7 j</Text>
                    </Pressable>
                    <Pressable
                      style={{ backgroundColor: '#F5F0F2', paddingVertical: 9, paddingHorizontal: 11, borderRadius: 14, borderWidth: 1, borderColor: Brand.line }}
                      onPress={() => setQuickDate(30)}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '600', color: '#3A3A48' }}>Dans 1 mois</Text>
                    </Pressable>
                  </View>

                  <TextInput style={styles.input} value={eventFormLocation} onChangeText={setEventFormLocation} placeholder="Lieu *" placeholderTextColor={Brand.inkSoft} />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput style={[styles.input, styles.inputHalf]} value={eventFormPrice} onChangeText={setEventFormPrice} keyboardType="numeric" placeholder="Tarif (€)" placeholderTextColor={Brand.inkSoft} />
                    <TextInput
                      style={[styles.input, styles.inputHalf]}
                      value={eventFormMaxPlaces}
                      onChangeText={setEventFormMaxPlaces}
                      keyboardType="numeric"
                      placeholder="Places max (ex: 50)"
                      placeholderTextColor={Brand.inkSoft}
                    />
                  </View>

                  <TextInput
                    style={styles.input}
                    value={eventFormBookingUrl}
                    onChangeText={setEventFormBookingUrl}
                    placeholder="Lien de réservation (https://...)"
                    placeholderTextColor={Brand.inkSoft}
                    autoCapitalize="none"
                    keyboardType="url"
                  />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable style={[styles.saveSubmitBtn, { flex: 1 }]} onPress={handleSaveEvent} disabled={isUploading}>
                      <Text style={styles.saveSubmitBtnText}>{editingEventId ? 'Mettre à jour l\'événement →' : 'Publier l\'événement →'}</Text>
                    </Pressable>
                    {editingEventId && (
                      <Pressable
                        style={[styles.saveSubmitBtn, { backgroundColor: Brand.inkMute, paddingHorizontal: 16 }]}
                        onPress={() => handleOpenEditEvent(null)}
                      >
                        <Text style={styles.saveSubmitBtnText}>Annuler</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Events List */}
                <Text style={{ fontSize: 14, fontWeight: '800', color: Brand.ink, marginTop: 12 }}>
                  {filteredEvents.length} {filteredEvents.length > 1 ? 'événements' : 'événement'} {eventTabFilter === 'all' ? 'au total' : eventTabFilter === 'upcoming' ? 'à venir' : filteredEvents.length > 1 ? 'passés (archivés)' : 'passé (archivé)'}
                </Text>

                {filteredEvents.map(evt => (
                  <View key={evt.id} style={styles.spotCard}>
                    <View style={styles.spotCardBody}>
                      <Text style={styles.spotCardTitle}>{evt.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} color={Brand.inkSoft} />
                        <Text style={styles.spotCardAddress}>{evt.event_date} à {evt.event_time} - {evt.location}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        <Text style={styles.spotCardRating}>{evt.price ? `${evt.price} €` : 'Gratuit'}</Text>
                        {evt.max_places ? (
                          <Text style={{ fontSize: 12, color: Brand.violet, fontWeight: '700', backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            {evt.max_places} places
                          </Text>
                        ) : null}
                        {evt.booking_url ? (
                          <Text style={{ fontSize: 12, color: '#0891B2', fontWeight: '700', backgroundColor: '#ECFEFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            Lien réservation
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.spotCardActions}>
                      <Pressable accessibilityRole="button" accessibilityLabel="Modifier"
                        style={styles.actionBtnEdit}
                        onPress={() => handleOpenEditEvent(evt)}
                      >
                        <Edit3 size={16} color="#4F46E5" strokeWidth={2} />
                      </Pressable>
                      <Pressable accessibilityRole="button" accessibilityLabel="Supprimer"
                        style={styles.actionBtnDelete}
                        onPress={() => setDeleteConfirmModal({ visible: true, type: 'event', id: evt.id, name: evt.title })}
                      >
                        <Trash2 size={16} color={Brand.primaryDeep} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── TAB 5: TOP PARTENAIRES (STYLE NETFLIX) ── */}
          {activeTab === 'notifs' && <PushAdminPanel adminCode={adminCode} />}
          {activeTab === 'agenda' && (
            <AgendaAdminPanel adminCode={adminCode} spots={spots} onCountChange={setAgendaCount} />
          )}
          {activeTab === 'featured' && (
            <FeaturedAdminPanel adminCode={adminCode} spots={spots} onCountChange={setFeaturedCount} />
          )}
          {activeTab === 'offers' && <OffersAdminPanel adminCode={adminCode} spots={spots} onCountChange={setOffersCount} />}
          {activeTab === 'background' && <HomeBackgroundAdminPanel adminCode={adminCode} />}

          {activeTab === 'partners' && (
            <ScrollView ref={partnersScrollRef} keyboardShouldPersistTaps="handled" style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 60 }}>
              <View style={styles.formCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Sparkles size={22} color={Brand.chouchou} />
                  <Text style={styles.sectionHeaderTitle}>{editingPartnerId ? 'Modifier le partenaire' : 'Nouveau partenaire du Top'}</Text>
                </View>
                <Text style={{ fontSize: 13, color: Brand.inkSoft, marginBottom: 16 }}>
                  Les partenaires actifs apparaissent dans le Top de la page d'accueil, dans l'ordre du rang. Changer le rang décale les autres partenaires automatiquement.
                </Text>

                {/* ── Sélecteur d'adresse existante avec moteur de recherche ── */}
                <Text style={styles.inputLabel}>
                  Lier à une adresse existante du Petit Tou
                </Text>
                <Pressable
                  style={[
                    styles.input,
                    {
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: 0,
                      height: 46,
                    },
                  ]}
                  onPress={() => setShowPartnerAddressDropdown((v) => !v)}
                >
                  <Text
                    style={{
                      flex: 1,
                      fontSize: 14,
                      color: partnerFormSpotId ? Brand.ink : Brand.inkSoft,
                      fontWeight: partnerFormSpotId ? '700' : '400',
                    }}
                    numberOfLines={1}
                  >
                    {partnerFormSpotId
                      ? partnerFormSpotName
                      : 'Sélectionner une adresse…'}
                  </Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {partnerFormSpotId && (
                      <Pressable
                        hitSlop={10}
                        onPress={(e) => {
                          e.stopPropagation();
                          setPartnerFormSpotId(null);
                          setPartnerFormSpotName('');
                          setPartnerAddressSearch('');
                        }}
                      >
                        <X size={14} color={Brand.inkMute} />
                      </Pressable>
                    )}
                    <MapPin size={16} color={Brand.primaryDeep} />
                  </View>
                </Pressable>

                {showPartnerAddressDropdown && (
                  <View
                    style={{
                      borderWidth: 2,
                      borderColor: Brand.ink,
                      borderRadius: 12,
                      backgroundColor: Brand.bg,
                      marginTop: 4,
                      overflow: 'hidden',
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 4 },
                      shadowOpacity: 0.18,
                      shadowRadius: 8,
                      elevation: 8,
                      zIndex: 999,
                    }}
                  >
                    {/* Barre de recherche interne */}
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        borderBottomWidth: 2,
                        borderBottomColor: Brand.ink,
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: Brand.white,
                        gap: 8,
                      }}
                    >
                      <Search size={16} color={Brand.primaryDeep} />
                      <TextInput
                        autoFocus
                        placeholder={`Rechercher parmi ${spots.length} adresses…`}
                        placeholderTextColor={Brand.inkSoft}
                        value={partnerAddressSearch}
                        onChangeText={setPartnerAddressSearch}
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: Brand.ink,
                          fontWeight: '600',
                          height: 36,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {partnerAddressSearch.length > 0 && (
                        <Pressable hitSlop={8} onPress={() => setPartnerAddressSearch('')}>
                          <X size={13} color={Brand.inkMute} />
                        </Pressable>
                      )}
                    </View>

                    {/* Liste filtrée */}
                    <ScrollView
                      style={{ maxHeight: 260 }}
                      keyboardShouldPersistTaps="handled"
                      nestedScrollEnabled
                    >
                      {spots
                        .filter((s) => {
                          const q = partnerAddressSearch.toLowerCase();
                          if (!q) return true;
                          return (
                            (s.title || s.name || '').toLowerCase().includes(q) ||
                            (s.address || '').toLowerCase().includes(q) ||
                            (s.location || '').toLowerCase().includes(q)
                          );
                        })
                        .slice(0, 60)
                        .map((s, idx) => {
                          const spotName = s.title || s.name || '—';
                          const isSelected = partnerFormSpotId === s.id;
                          return (
                            <Pressable
                              key={s.id || idx}
                              onPress={() => {
                                setPartnerFormSpotId(s.id);
                                setPartnerFormSpotName(spotName);
                                if (!partnerFormTitle.trim()) {
                                  setPartnerFormTitle(spotName);
                                }
                                if (!partnerFormImage.trim() && s.image_url) {
                                  setPartnerFormImage(s.image_url);
                                }
                                setShowPartnerAddressDropdown(false);
                                setPartnerAddressSearch('');
                              }}
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                paddingVertical: 10,
                                paddingHorizontal: 14,
                                backgroundColor: isSelected ? '#FFF0F0' : 'transparent',
                                borderBottomWidth: 1,
                                borderBottomColor: '#F5F0F2',
                                gap: 10,
                              }}
                            >
                              {/* Miniature */}
                              {s.image_url ? (
                                <Image
                                  source={{ uri: s.image_url }}
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    borderWidth: 1.5,
                                    borderColor: isSelected ? Brand.primary : Brand.line,
                                  }}
                                />
                              ) : (
                                <View
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    backgroundColor: '#F5F0F2',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <MapPin size={14} color={Brand.inkMute} />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: '800',
                                    color: isSelected ? Brand.primary : Brand.ink,
                                  }}
                                  numberOfLines={1}
                                >
                                  {spotName}
                                </Text>
                                {(s.address || s.location) && (
                                  <Text
                                    style={{
                                      fontSize: 12,
                                      color: Brand.inkSoft,
                                      fontWeight: '500',
                                      marginTop: 1,
                                    }}
                                    numberOfLines={1}
                                  >
                                    {s.address || s.location}
                                  </Text>
                                )}
                              </View>
                              {isSelected && (
                                <CheckCircle size={18} color={Brand.primaryDeep} />
                              )}
                            </Pressable>
                          );
                        })}
                      {spots.filter((s) => {
                        const q = partnerAddressSearch.toLowerCase();
                        if (!q) return true;
                        return (
                          (s.title || s.name || '').toLowerCase().includes(q) ||
                          (s.address || '').toLowerCase().includes(q)
                        );
                      }).length === 0 && (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                          <Text style={{ color: Brand.inkSoft, fontSize: 13, fontWeight: '600' }}>
                            Aucune adresse trouvée pour "{partnerAddressSearch}"
                          </Text>
                        </View>
                      )}
                    </ScrollView>
                  </View>
                )}

                {partnerFormSpotId && (
                  <View
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 6,
                      marginBottom: 2,
                      backgroundColor: '#F0FDF4',
                      borderWidth: 1.5,
                      borderColor: '#1FA67A',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <CheckCircle size={14} color="#1FA67A" />
                    <Text style={{ fontSize: 12, color: '#065F46', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      Lié à : {partnerFormSpotName}
                    </Text>
                  </View>
                )}

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>Nom du partenaire / commerce *</Text>
                <TextInput
                  placeholder="Ex: Le Bibent, Brasserie Flo…"
                  placeholderTextColor={Brand.inkSoft}
                  value={partnerFormTitle}
                  onChangeText={setPartnerFormTitle}
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>Description affichée aux utilisateurs (facultatif)</Text>
                <TextInput
                  placeholder="Ex: Brasserie historique, place du Capitole"
                  placeholderTextColor={Brand.inkSoft}
                  value={partnerFormSubtitle}
                  onChangeText={setPartnerFormSubtitle}
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>URL de l'image de couverture (HD)</Text>
                <TextInput
                  placeholder="https://..."
                  placeholderTextColor={Brand.inkSoft}
                  value={partnerFormImage}
                  onChangeText={setPartnerFormImage}
                  style={styles.input}
                />

                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Rang Top (1..10)</Text>
                    <TextInput
                      placeholder="1"
                      keyboardType="numeric"
                      placeholderTextColor={Brand.inkSoft}
                      value={partnerFormRank}
                      onChangeText={setPartnerFormRank}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Montant payé (€)</Text>
                    <TextInput
                      placeholder="150"
                      keyboardType="numeric"
                      placeholderTextColor={Brand.inkSoft}
                      value={partnerFormPrice}
                      onChangeText={setPartnerFormPrice}
                      style={styles.input}
                    />
                  </View>
                </View>
                <Text style={styles.fieldNote}>Le montant payé est interne : il n'est jamais affiché aux utilisateurs.</Text>

                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-end' }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Durée (jours)</Text>
                    <TextInput
                      placeholder="30"
                      keyboardType="numeric"
                      placeholderTextColor={Brand.inkSoft}
                      value={partnerFormDays}
                      onChangeText={setPartnerFormDays}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Notifs (toutes les… h)</Text>
                    <TextInput
                      placeholder="24"
                      keyboardType="numeric"
                      placeholderTextColor={Brand.inkSoft}
                      value={partnerFormNotifyHours}
                      onChangeText={setPartnerFormNotifyHours}
                      style={styles.input}
                    />
                  </View>
                </View>

                <Pressable
                  disabled={isSubmittingPartner}
                  style={({ pressed }) => [
                    styles.saveSubmitBtn,
                    { opacity: isSubmittingPartner ? 0.7 : 1, marginTop: 8 },
                    pressed && styles.btnPressed,
                  ]}
                  onPress={handleSavePartner}
                >
                  <Text style={styles.saveSubmitBtnText}>
                    {isSubmittingPartner ? 'Enregistrement...' : editingPartnerId ? 'Enregistrer les modifications' : 'Ajouter au Top'}
                  </Text>
                </Pressable>
                {editingPartnerId && (
                  <Pressable style={[styles.partnerCancelEdit]} onPress={resetPartnerForm}>
                    <Text style={styles.partnerCancelEditText}>Annuler la modification</Text>
                  </Pressable>
                )}
              </View>

              {/* Partners List */}
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionHeaderTitle, { marginBottom: 12 }]}>
                  Classement Actif des Partenaires ({partners.length})
                </Text>

                {partners.length === 0 && (
                  <Text style={{ fontSize: 14, color: Brand.inkSoft, textAlign: 'center', paddingVertical: 24 }}>
                    Aucun partenaire dans le Top pour le moment.
                  </Text>
                )}
                {sortedPartners().map((p, idx, arr) => (
                  <View key={p.id || idx} style={styles.partnerAdminCard}>
                    <View style={styles.partnerRankBadge}>
                      <Text style={styles.partnerRankText}>#{p.rank_position || idx + 1}</Text>
                    </View>
                    <Image source={{ uri: p.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800' }} style={styles.partnerThumb} />
                    <View style={{ flex: 1, paddingHorizontal: 10 }}>
                      <Text style={styles.partnerTitle}>{p.title}</Text>
                      <Text style={styles.partnerSub} numberOfLines={1}>{p.subtitle}</Text>
                      <Text style={styles.partnerMeta}>{p.price_paid || 0} € • Push: {p.notify_interval_hours || 24}h</Text>
                    </View>
                    <Pressable
                      style={[styles.partnerStatusPill, p.is_active ? styles.partnerActivePill : styles.partnerInactivePill]}
                      onPress={() => handleTogglePartnerActive(p)}
                    >
                      <Text style={[styles.partnerStatusText, { color: p.is_active ? '#065F46' : Brand.primary }]}>
                        {p.is_active ? 'Actif' : 'Inactif'}
                      </Text>
                    </Pressable>

                    <View style={styles.partnerActions}>
                      <Pressable
                        style={[styles.partnerActionBtn, idx === 0 && styles.partnerActionBtnDisabled]}
                        disabled={idx === 0}
                        onPress={() => handleMovePartner(p, -1)}
                        accessibilityLabel="Monter dans le classement"
                      >
                        <ArrowUp size={16} color={Brand.ink} strokeWidth={2} />
                      </Pressable>
                      <Pressable
                        style={[styles.partnerActionBtn, idx === arr.length - 1 && styles.partnerActionBtnDisabled]}
                        disabled={idx === arr.length - 1}
                        onPress={() => handleMovePartner(p, 1)}
                        accessibilityLabel="Descendre dans le classement"
                      >
                        <ArrowDown size={16} color={Brand.ink} strokeWidth={2} />
                      </Pressable>
                      <Pressable
                        style={styles.partnerActionBtn}
                        onPress={() => handleOpenEditPartner(p)}
                        accessibilityLabel="Modifier le partenaire"
                      >
                        <Edit3 size={16} color={Brand.ink} strokeWidth={2} />
                      </Pressable>
                      <Pressable
                        style={[styles.partnerActionBtn, styles.partnerActionBtnDanger]}
                        onPress={() => setDeleteConfirmModal({ visible: true, type: 'partner', id: p.id, name: p.title })}
                        accessibilityLabel="Retirer le partenaire"
                      >
                        <Trash2 size={16} color={Brand.primaryDeep} strokeWidth={2} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}


        </View>

        {/* ── DELETION CONFIRMATION MODAL ── */}
        {deleteConfirmModal.visible && (
          <Modal transparent animationType="fade" visible={deleteConfirmModal.visible}>
            <View style={styles.confirmBackdrop}>
              <View style={styles.confirmBox}>
                <View style={styles.confirmHeader}>
                  <AlertTriangle size={32} color={Brand.primaryDeep} />
                  <Text style={styles.confirmTitle}>Confirmation de suppression</Text>
                </View>
                <Text style={styles.confirmMessage}>
                  Voulez-vous vraiment supprimer définitivement{'\n'}
                  <Text style={{ fontWeight: '800', color: Brand.primaryDeep }}>"{deleteConfirmModal.name}"</Text> ?{'\n\n'}
                  Cette action est irréversible.
                </Text>
                <View style={styles.confirmActions}>
                  <Pressable style={styles.cancelBtn} onPress={() => setDeleteConfirmModal({ visible: false, type: 'spot', id: '', name: '' })}>
                    <Text style={styles.cancelBtnText}>Annuler</Text>
                  </Pressable>
                  <Pressable style={styles.deleteBtn} onPress={handleConfirmDelete}>
                    <Text style={styles.deleteBtnText}>Supprimer</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  partnerActions: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3E7DB',
  },
  partnerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F0F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  partnerActionBtnDisabled: {
    opacity: 0.35,
  },
  partnerActionBtnDanger: {
    backgroundColor: Brand.primarySoft,
  },
  partnerCancelEdit: {
    alignSelf: 'center',
    paddingVertical: 12,
  },
  partnerCancelEditText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Brand.bg,
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: Brand.bg,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: Brand.ink,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Brand.white,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  btnPressed: {
    opacity: 0.75,
  },
  tabBar: {
    backgroundColor: Brand.white,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    maxHeight: 56,
  },
  tabBarScroll: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    alignItems: 'center',
  },
  tabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 12,
    backgroundColor: Brand.bg,
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: Brand.white,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  tabBtnTextActive: {
    color: Brand.primaryDeep,
    fontWeight: '800',
  },
  searchSection: {
    paddingVertical: 12,
    gap: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.white,
    borderRadius: 20,
    paddingHorizontal: 14,
    height: 46,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.ink,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  categoryPillsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  catPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 24,
    backgroundColor: Brand.white,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  catPillActive: {
    backgroundColor: Brand.primaryDeep,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  catPillTextActive: {
    color: Brand.white,
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  listHeaderCount: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.successDeep, // le blanc dessus atteint 4,9:1 (3,1:1 avec l'ancien vert)
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: Brand.successDeep,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  addInlineBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.white,
  },
  spotCard: {
    flexDirection: 'row',
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 12,
    gap: 12,
    alignItems: 'center',
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  detailBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF6E5',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  detailBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: Brand.ink },
  detailRetryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Brand.primaryDeep,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  detailRetryText: { color: Brand.white, fontSize: 12, fontWeight: '800' },
  spotCardImage: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: '#F5F0F2',
  },
  spotCardBody: {
    flex: 1,
    gap: 3,
  },
  spotCardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
  },
  spotCardAddress: {
    fontSize: 12,
    fontWeight: '600',
    color: Brand.inkSoft,
  },
  spotCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  miniBadge: {
    backgroundColor: '#F5F0F2',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  miniBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A4A58',
  },
  spotCardRating: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ratingInk,
  },
  spotCardActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtnEdit: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F0F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDelete: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Brand.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 18,
    gap: 12,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#4A4A58',
    marginTop: 4,
  },
  fieldNote: {
    fontSize: 11.5,
    lineHeight: 16,
    color: Brand.inkSoft,
    marginTop: -4,
  },
  // deux champs côte à côte : minWidth 0, sinon sur le web le second dépasse de la carte
  inputHalf: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: Brand.ink,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  coverImageRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  coverPreview: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#F5F0F2',
  },
  coverPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: '#F5F0F2',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Brand.primaryDeep,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.white,
  },
  geocodeBtn: {
    backgroundColor: Brand.violet,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: Brand.violet,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  geocodeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.white,
  },
  galleryManagerSection: {
    backgroundColor: Brand.bg,
    borderRadius: 20,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: Brand.line,
  },
  addPhotoSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#1FA67A',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addPhotoSmallBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.white,
  },
  galleryThumbWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  galleryThumb: {
    width: 60,
    height: 60,
    borderRadius: 12,
    backgroundColor: '#F5F0F2',
  },
  deleteThumbBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Brand.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Brand.white,
  },
  saveSubmitBtn: {
    backgroundColor: Brand.primaryDeep,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 3,
  },
  saveSubmitBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.white,
  },
  eventTabRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  eventTabPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: Brand.bg,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  eventTabPillActive: {
    backgroundColor: Brand.white,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  eventTabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.inkSoft,
  },
  eventTabPillTextActive: {
    color: Brand.ink,
    fontWeight: '800',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(43, 29, 70, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      } as any,
    }),
  },
  confirmBox: {
    backgroundColor: Brand.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 14,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 10,
  },
  confirmHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
    flex: 1,
  },
  confirmMessage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#4A4A58',
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F5F0F2',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4A4A58',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: Brand.primaryDeep,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 2,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: Brand.white,
  },
  catAdminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 14,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  catIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  catAdminTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
  },
  catAdminSub: {
    fontSize: 12,
    color: Brand.inkSoft,
    fontWeight: '600',
  },
  toggleSwitchBtn: {
    flex: 1,
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSwitchBtnActive: {
    backgroundColor: Brand.chouchou,
    borderColor: Brand.chouchou,
  },
  toggleSwitchBtnActiveNew: {
    backgroundColor: Brand.primaryDeep,
    borderColor: Brand.primary,
  },
  toggleSwitchText: {
    fontSize: 12,
    fontWeight: '700',
    color: Brand.ink,
    textAlign: 'center',
  },
  toggleSwitchTextActive: {
    color: Brand.white,
  },
  editActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F0F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Brand.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },

  formCard: {
    backgroundColor: Brand.white,
    borderRadius: 20,
    padding: 18,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Brand.ink,
  },

  // ── PARTNERS STYLES ──
  partnerAdminCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    backgroundColor: Brand.white,
    borderRadius: 18,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  partnerRankBadge: {
    backgroundColor: Brand.primaryDeep,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  partnerRankText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 12,
  },
  partnerThumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#F5F0F2',
  },
  partnerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.ink,
  },
  partnerSub: {
    fontSize: 12,
    color: Brand.inkSoft,
    fontWeight: '600',
  },
  partnerMeta: {
    fontSize: 12,
    color: '#D97706',
    fontWeight: '700',
    marginTop: 2,
  },
  partnerStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  partnerActivePill: {
    backgroundColor: '#D1FAE5',
  },
  partnerInactivePill: {
    backgroundColor: Brand.primarySoft,
  },
  partnerStatusText: {
    fontSize: 12,
    fontWeight: '700',
  },
});
