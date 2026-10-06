import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  LogOut,
  Search,
  Plus,
  Trash2,
  Edit3,
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
import dataset from '../constants/dataset.json';
import { getStoredPartners, saveStoredPartners } from '../lib/partnersStore';
import { dataStore } from '../lib/dataStore';
import {
  isAddressInCategory,
  getCategorySpotCount,
  classifyAddress,
} from '../lib/categoryResolver';

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

interface AdminPortalModalProps {
  visible: boolean;
  onClose: () => void;
  onLogout?: () => void;
}

export default function AdminPortalModal({ visible, onClose, onLogout }: AdminPortalModalProps) {
  const [activeTab, setActiveTab] = useState<'spots' | 'editSpot' | 'categories' | 'events' | 'partners'>('spots');

  // Spots Data & Filters State
  const [spots, setSpots] = useState<any[]>(dataset.addresses || []);
  const [loadingSpots, setLoadingSpots] = useState(false);
  const [spotSearchQuery, setSpotSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');

  // Edit / Create Spot Form State
  const [editingSpotId, setEditingSpotId] = useState<string | null>(null);
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
  const [catFormColor, setCatFormColor] = useState('#C52824');
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

  // Deletion Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    visible: boolean;
    type: 'spot' | 'event' | 'category' | 'partner';
    id: string;
    name: string;
  }>({ visible: false, type: 'spot', id: '', name: '' });

  useEffect(() => {
    if (visible) {
      fetchSpots();
      fetchEvents();
      fetchCategories();
      fetchPartners();
    }
  }, [visible]);

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const { data, error } = await supabase.from('categories').select('*').order('name', { ascending: true });
      if (!error && data && data.length > 0) {
        setCategories(data);
        dataStore.notifyCategoriesChanged(data);
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

  // Fetch Spots from Supabase DB (fallback to dataset.json)
  const fetchSpots = async () => {
    try {
      setLoadingSpots(true);
      const { data, error } = await supabase.from('addresses').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setSpots(data);
        dataStore.notifyAddressesChanged(data);
      } else {
        setSpots(dataset.addresses || []);
      }
    } catch (e) {
      console.warn('Fetch spots error:', e);
      setSpots(dataset.addresses || []);
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
        dataStore.notifyEventsChanged(data);
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
  const handleOpenEditSpot = (spot?: any) => {
    const defaultCatId = categories[0]?.id || dataset.categories?.[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958';
    if (spot) {
      setEditingSpotId(spot.id);
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
    } else {
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
        let { error } = await supabase.from('addresses').update(record).eq('id', editingSpotId);
        if (error && error.message?.includes('full_description')) {
          delete record.full_description;
          const retry = await supabase.from('addresses').update(record).eq('id', editingSpotId);
          error = retry.error;
        }
        if (error && (error.message?.includes('category_id') || error.message?.includes('uuid'))) {
          record.category_id = categories[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958';
          const retry = await supabase.from('addresses').update(record).eq('id', editingSpotId);
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
        let { error } = await supabase.from('addresses').insert(record);
        if (error && error.message?.includes('full_description')) {
          delete record.full_description;
          const retry = await supabase.from('addresses').insert(record);
          error = retry.error;
        }
        if (error && (error.message?.includes('category_id') || error.message?.includes('uuid'))) {
          record.category_id = categories[0]?.id || 'e6134429-8d6e-5d84-bf4e-884e016df958';
          const retry = await supabase.from('addresses').insert(record);
          error = retry.error;
        }
        if (error) throw error;
        showAlert('Succès', `L'adresse "${formTitle}" a été créée et publiée.`);
      }

      await fetchSpots();
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
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
      setCatFormColor(cat.color || '#C52824');
      setCatFormIcon(cat.icon_name || 'UtensilsCrossed');
    } else {
      setEditingCatId(null);
      setCatFormName('');
      setCatFormSlug('');
      setCatFormColor('#C52824');
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
        const { error } = await supabase.from('categories').update(catObj).eq('id', editingCatId);
        if (error) throw error;
        showAlert('Catégorie mise à jour', `La catégorie "${catFormName}" a été modifiée.`);
      } else {
        (catObj as any).id = generateUUID();
        const { error } = await supabase.from('categories').insert(catObj);
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
    setDeleteConfirmModal({ visible: false, type: 'spot', id: '', name: '' });
    try {
      if (type === 'spot') {
        // Optimistic UI update: remove from local state immediately
        setSpots(prev => prev.filter(s => s.id !== id));
        const { data, error } = await supabase.from('addresses').delete().eq('id', id).select();
        if (error) throw error;
        if (!data || data.length === 0) {
          showAlert(
            'Suppression locale',
            `L'adresse "${name}" a été retirée de la liste locale.\n\nNote : Supabase n'a pas pu la supprimer dans le cloud car les règles RLS restreignent la suppression directe. Exécutez le script SQL fourni dans le SQL Editor Supabase pour autoriser la suppression distante.`
          );
        } else {
          showAlert('Suppression réussie', `L'adresse "${name}" a été définitivement supprimée.`);
        }
        await fetchSpots();
      } else if (type === 'event') {
        setEvents(prev => prev.filter(e => e.id !== id));
        const { error } = await supabase.from('events').delete().eq('id', id).select();
        if (error) throw error;
        showAlert('Suppression réussie', `L'événement "${name}" a été supprimé.`);
        await fetchEvents();
      } else if (type === 'category') {
        setCategories(prev => prev.filter(c => c.id !== id));
        const { error } = await supabase.from('categories').delete().eq('id', id).select();
        if (error) throw error;
        showAlert('Suppression réussie', `La catégorie "${name}" a été supprimée.`);
        await fetchCategories();
      } else if (type === 'partner') {
        const updated = partners.filter(p => p.id !== id);
        setPartners(updated);
        saveStoredPartners(updated);
        await supabase.from('sponsored_partners').delete().eq('id', id);
        showAlert('Suppression réussie', `Le partenaire a été supprimé.`);
        await fetchPartners();
      }
    } catch (e: any) {
      showAlert('Erreur lors de la suppression', e.message);
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
        let { error } = await supabase.from('events').update(record).eq('id', editingEventId);
        if (error && error.message?.includes('address_id')) {
          delete record.address_id;
          const retry = await supabase.from('events').update(record).eq('id', editingEventId);
          error = retry.error;
        }
        if (error) throw error;
        showAlert('Succès', `L'événement "${eventFormTitle}" a été mis à jour.`);
      } else {
        record.id = generateUUID();
        let { error } = await supabase.from('events').insert(record);
        if (error && error.message?.includes('address_id')) {
          delete record.address_id;
          const retry = await supabase.from('events').insert(record);
          error = retry.error;
        }
        if (error) throw error;
        showAlert('Succès', `L'événement "${eventFormTitle}" a été créé avec succès.`);
      }

      await fetchEvents();
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('eventsChanged'));
      }
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
          'Un ancien trigger de notifications cherche la table "user_push_tokens".\n\nVeuillez exécuter le script SQL "fix_user_push_tokens.sql" dans votre éditeur Supabase pour nettoyer les triggers et recréer la table.'
        );
      } else {
        showAlert('Erreur enregistrement événement', e.message);
      }
    } finally {
      setIsUploading(false);
    }
  };

  // ── Sponsoring Partners Management (Top Netflix) ──
  const fetchPartners = async () => {
    try {
      setLoadingPartners(true);
      const { data, error } = await supabase
        .from('sponsored_partners')
        .select('*')
        .order('rank_position', { ascending: true });
      if (!error && data && data.length > 0) {
        setPartners(data);
        saveStoredPartners(data);
      } else {
        const stored = getStoredPartners();
        setPartners(stored);
      }
    } catch (e) {
      console.warn('Fetch partners error:', e);
      setPartners(getStoredPartners());
    } finally {
      setLoadingPartners(false);
    }
  };

  const handleSavePartner = async () => {
    if (!partnerFormTitle.trim()) {
      showAlert('Titre requis', 'Veuillez saisir le nom du partenaire.');
      return;
    }
    try {
      setIsSubmittingPartner(true);
      const rank = parseInt(partnerFormRank || '1', 10);
      const price = parseFloat(partnerFormPrice || '150');
      const days = parseInt(partnerFormDays || '30', 10);
      const notifyHours = parseInt(partnerFormNotifyHours || '24', 10);

      const startsAt = new Date();
      const endsAt = new Date(Date.now() + days * 86400000);

      const record: any = {
        title: partnerFormTitle.trim(),
        subtitle: partnerFormSubtitle.trim() || `Offre exclusive membre - ${price}€ de privilèges`,
        image_url: partnerFormImage.trim() || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=800',
        badge_text: rank <= 3 ? `TOP #${rank} PARTENAIRE` : 'PARTENAIRE OFFICIEL',
        sponsorship_tier: rank === 1 ? 'platinum' : (rank <= 3 ? 'gold' : 'silver'),
        price_paid: price,
        rank_position: rank,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        notify_interval_hours: notifyHours,
        is_active: true,
        spot_id: partnerFormSpotId || null,
      };
      record.id = generateUUID();

      const { data: inserted, error } = await supabase.from('sponsored_partners').insert(record).select();
      if (error) {
        // Local fallback if offline or restricted by RLS
        const updated = [...partners, record].sort((a, b) => (a.rank_position || 1) - (b.rank_position || 1));
        setPartners(updated);
        saveStoredPartners(updated);
        showAlert('Partenaire enregistré', `Le partenaire "${partnerFormTitle}" a été enregistré localement (exécutez le script SQL fourni pour activer l'écriture directe dans Supabase).`);
      } else if (inserted && inserted.length > 0) {
        const updated = [...partners, inserted[0]].sort((a, b) => (a.rank_position || 1) - (b.rank_position || 1));
        setPartners(updated);
        saveStoredPartners(updated);
        showAlert('Partenaire sponsorisé ajouté', `Le partenaire "${partnerFormTitle}" a été classé Top ${rank} (${price}€ pour ${days} jours).`);
      }

      await fetchPartners();
      setPartnerFormTitle('');
      setPartnerFormSubtitle('');
      setPartnerFormImage('');
      setPartnerFormSpotId(null);
      setPartnerFormSpotName('');
      setPartnerAddressSearch('');
    } catch (err: any) {
      showAlert('Enregistrement local', 'Le partenaire a été enregistré et synchronisé localement.');
      fetchPartners();
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
      await supabase.from('sponsored_partners').update({ is_active: nextVal }).eq('id', partner.id);
    } catch (e) {
      console.warn(e);
    }
  };

  // ── Filtered Spots & Events Lists ──
  const filteredSpots = spots.filter(s => {
    if (spotSearchQuery) {
      const q = spotSearchQuery.toLowerCase();
      const nameMatch = (s.title || s.name || '').toLowerCase().includes(q);
      const addrMatch = (s.address || '').toLowerCase().includes(q);
      if (!nameMatch && !addrMatch) return false;
    }
    if (selectedCategoryFilter !== 'all' && !isAddressInCategory(s, selectedCategoryFilter)) {
      return false;
    }
    return true;
  });

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
      <View style={styles.modalOverlay}>
        {/* Header Admin Neo-Brutalist */}
        <SafeAreaView edges={['top']} style={{ backgroundColor: '#FAF5EF' }}>
          <View style={styles.adminHeader}>
            <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]} onPress={onClose}>
              <ChevronLeft size={22} color="#1E293B" strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.headerTitle}>
              <Text style={{ color: '#C52824' }}>t </Text>Portail Admin
            </Text>
            <Pressable style={({ pressed }) => [styles.iconBtn, pressed && styles.btnPressed]} onPress={onLogout}>
              <LogOut size={18} color="#C52824" strokeWidth={2.5} />
            </Pressable>
          </View>
        </SafeAreaView>

        {/* Tab Selector Bar (Horizontally scrollable on mobile) */}
        <View style={styles.tabBar}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBarScroll}>
            <Pressable style={[styles.tabBtn, activeTab === 'spots' && styles.tabBtnActive]} onPress={() => setActiveTab('spots')}>
              <MapPin size={14} color={activeTab === 'spots' ? '#C52824' : '#64748B'} strokeWidth={2.2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'spots' && styles.tabBtnTextActive]}>Adresses ({spots.length})</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'editSpot' && styles.tabBtnActive]} onPress={() => handleOpenEditSpot()}>
              {editingSpotId ? (
                <Edit3 size={14} color={activeTab === 'editSpot' ? '#C52824' : '#64748B'} strokeWidth={2.2} style={{ marginRight: 6 }} />
              ) : (
                <Plus size={14} color={activeTab === 'editSpot' ? '#C52824' : '#64748B'} strokeWidth={2.2} style={{ marginRight: 6 }} />
              )}
              <Text style={[styles.tabBtnText, activeTab === 'editSpot' && styles.tabBtnTextActive]}>
                {editingSpotId ? 'Édition' : 'Créer'}
              </Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'categories' && styles.tabBtnActive]} onPress={() => setActiveTab('categories')}>
              <Tag size={14} color={activeTab === 'categories' ? '#C52824' : '#64748B'} strokeWidth={2.2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'categories' && styles.tabBtnTextActive]}>Catégories</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'events' && styles.tabBtnActive]} onPress={() => setActiveTab('events')}>
              <Calendar size={14} color={activeTab === 'events' ? '#C52824' : '#64748B'} strokeWidth={2.2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'events' && styles.tabBtnTextActive]}>Événements</Text>
            </Pressable>
            <Pressable style={[styles.tabBtn, activeTab === 'partners' && styles.tabBtnActive]} onPress={() => setActiveTab('partners')}>
              <Sparkles size={14} color={activeTab === 'partners' ? '#C52824' : '#64748B'} strokeWidth={2.2} style={{ marginRight: 6 }} />
              <Text style={[styles.tabBtnText, activeTab === 'partners' && styles.tabBtnTextActive]}>Top Partenaires ({partners.length})</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Main Content Area */}
        <View style={{ flex: 1, backgroundColor: '#FAF5EF' }}>

          {/* ── TAB 1: SPOTS MANAGEMENT (List / Search / Filter / Delete) ── */}
          {activeTab === 'spots' && (
            <View style={{ flex: 1, paddingHorizontal: 16 }}>
              {/* Search & Category Filter Section */}
              <View style={styles.searchSection}>
                <View style={styles.searchInputContainer}>
                  <Search size={18} color="#64748B" style={{ marginRight: 8 }} />
                  <TextInput
                    placeholder="Rechercher une adresse par nom ou rue..."
                    placeholderTextColor="#94A3B8"
                    value={spotSearchQuery}
                    onChangeText={setSpotSearchQuery}
                    style={styles.searchInput}
                  />
                  {spotSearchQuery.length > 0 && (
                    <Pressable onPress={() => setSpotSearchQuery('')}>
                      <X size={16} color="#64748B" />
                    </Pressable>
                  )}
                </View>

                {/* Category Pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPillsRow}>
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

              {loadingSpots ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                  <ActivityIndicator size="large" color="#C52824" />
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 60, gap: 12 }} showsVerticalScrollIndicator={false}>
                  <View style={styles.listHeaderRow}>
                    <Text style={styles.listHeaderCount}>{filteredSpots.length} adresses affichées</Text>
                    <Pressable style={styles.addInlineBtn} onPress={() => handleOpenEditSpot()}>
                      <Plus size={16} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.addInlineBtnText}>Ajouter</Text>
                    </Pressable>
                  </View>

                  {filteredSpots.map(spot => (
                    <View key={spot.id} style={styles.spotCard}>
                      <Image
                        source={{ uri: spot.image_url || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200' }}
                        style={styles.spotCardImage}
                      />
                      <View style={styles.spotCardBody}>
                        <Text style={styles.spotCardTitle} numberOfLines={1}>{spot.title || spot.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <MapPin size={11} color="#64748B" />
                          <Text style={styles.spotCardAddress} numberOfLines={1}>{spot.address || spot.location || 'Toulouse'}</Text>
                        </View>
                        <View style={styles.spotCardBadgeRow}>
                          <View style={styles.miniBadge}>
                            <Text style={styles.miniBadgeText}>
                              {categories.find(c => c.id === spot.category_id)?.name || categories.find(c => c.id === classifyAddress(spot))?.name || 'Adresse'}
                            </Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Star size={11} color="#E5A93B" fill="#E5A93B" />
                            <Text style={styles.spotCardRating}>{spot.rating || '4.8'}</Text>
                          </View>
                        </View>
                      </View>

                      {/* Card Action Buttons */}
                      <View style={styles.spotCardActions}>
                        <Pressable style={styles.actionBtnEdit} onPress={() => handleOpenEditSpot(spot)}>
                          <Edit3 size={16} color="#1E293B" strokeWidth={2.5} />
                        </Pressable>
                        <Pressable
                          style={styles.actionBtnDelete}
                          onPress={() => setDeleteConfirmModal({ visible: true, type: 'spot', id: spot.id, name: spot.title || spot.name })}
                        >
                          <Trash2 size={16} color="#C52824" strokeWidth={2.5} />
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* ── TAB 2: EDIT / CREATE SPOT FORM ── */}
          {activeTab === 'editSpot' && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
              <View style={styles.formContainer}>
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
                      <ImageIcon size={24} color="#94A3B8" />
                      <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>Aucune image</Text>
                    </View>
                  )}
                  <Pressable style={styles.uploadBtn} onPress={handleUploadCoverImage} disabled={isUploading}>
                    {isUploading ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Upload size={18} color="#FFFFFF" strokeWidth={2.5} />}
                    <Text style={styles.uploadBtnText}>Téléverser image</Text>
                  </Pressable>
                </View>

                {/* Form Fields */}
                <Text style={styles.inputLabel}>Nom de l'établissement *</Text>
                <TextInput style={styles.input} value={formTitle} onChangeText={setFormTitle} placeholder="Ex: Mizuki Ramen" placeholderTextColor="#94A3B8" />

                <Text style={styles.inputLabel}>Catégorie *</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
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
                    style={[styles.input, { flex: 1 }]}
                    value={formAddress}
                    onChangeText={setFormAddress}
                    placeholder="Ex: 54 Rue Peyrolières, 31000 Toulouse"
                    placeholderTextColor="#94A3B8"
                  />
                  <Pressable style={styles.geocodeBtn} onPress={handleGeocodeFormAddress} disabled={isGeocoding}>
                    {isGeocoding ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Compass size={14} color="#FFFFFF" />
                        <Text style={styles.geocodeBtnText}>BAN</Text>
                      </View>
                    )}
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Latitude (GPS)</Text>
                    <TextInput style={styles.input} value={formLat} onChangeText={setFormLat} keyboardType="numeric" placeholder="43.6001" placeholderTextColor="#94A3B8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Longitude (GPS)</Text>
                    <TextInput style={styles.input} value={formLng} onChangeText={setFormLng} keyboardType="numeric" placeholder="1.4409" placeholderTextColor="#94A3B8" />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Quartier / Secteur</Text>
                <TextInput style={styles.input} value={formLocation} onChangeText={setFormLocation} placeholder="Ex: Capitole / Carmes" placeholderTextColor="#94A3B8" />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Téléphone</Text>
                    <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="05 61 23 45 67" placeholderTextColor="#94A3B8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Site Web</Text>
                    <TextInput style={styles.input} value={formWebsite} onChangeText={setFormWebsite} placeholder="https://..." placeholderTextColor="#94A3B8" />
                  </View>
                </View>

                <Text style={styles.inputLabel}>Description courte</Text>
                <TextInput style={styles.input} value={formDescription} onChangeText={setFormDescription} multiline numberOfLines={2} placeholder="Courte accroche..." placeholderTextColor="#94A3B8" />

                <Text style={styles.inputLabel}>Description complète (Avis Petit Tou)</Text>
                <TextInput style={[styles.input, { height: 90, textAlignVertical: 'top' }]} value={formFullDescription} onChangeText={setFormFullDescription} multiline numberOfLines={4} placeholder="L'avis complet du Petit Tou..." placeholderTextColor="#94A3B8" />

                {/* Gallery Management Section */}
                <View style={styles.galleryManagerSection}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={styles.inputLabel}>Galerie de photos ({formGalleryUrls.length})</Text>
                    <Pressable style={styles.addPhotoSmallBtn} onPress={handleAddGalleryPhoto} disabled={isUploading}>
                      <Plus size={14} color="#FFFFFF" strokeWidth={2.5} />
                      <Text style={styles.addPhotoSmallBtnText}>Ajouter photo</Text>
                    </Pressable>
                  </View>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                    {formGalleryUrls.map((url, idx) => (
                      <View key={idx} style={styles.galleryThumbWrapper}>
                        <Image source={{ uri: url }} style={styles.galleryThumb} />
                        <Pressable style={styles.deleteThumbBtn} onPress={() => handleRemoveGalleryPhoto(idx)}>
                          <X size={12} color="#FFFFFF" strokeWidth={3} />
                        </Pressable>
                      </View>
                    ))}
                    {formGalleryUrls.length === 0 && (
                      <Text style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>Aucune photo dans la galerie.</Text>
                    )}
                  </ScrollView>
                </View>

                {/* Submit Action Button */}
                <Pressable style={styles.saveSubmitBtn} onPress={handleSaveSpot} disabled={isUploading}>
                  {isUploading ? (
                    <ActivityIndicator color="#FFFFFF" size="small" />
                  ) : (
                    <Text style={styles.saveSubmitBtnText}>{editingSpotId ? 'Enregistrer les modifications →' : 'Publier l\'adresse →'}</Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          )}

          {/* ── TAB 3: CATEGORIES MANAGEMENT (List / Create / Edit / Delete) ── */}
          {activeTab === 'categories' && (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
              {/* Category Form */}
              <View style={styles.formContainer}>
                <Text style={styles.formSectionTitle}>{editingCatId ? 'Modifier la catégorie' : 'Ajouter une nouvelle catégorie'}</Text>
                
                <Text style={styles.inputLabel}>Nom de la catégorie *</Text>
                <TextInput
                  style={styles.input}
                  value={catFormName}
                  onChangeText={setCatFormName}
                  placeholder="Ex: Brunch & Douceurs"
                  placeholderTextColor="#94A3B8"
                />

                <Text style={styles.inputLabel}>Slug (Identifiant unique)</Text>
                <TextInput
                  style={styles.input}
                  value={catFormSlug}
                  onChangeText={setCatFormSlug}
                  placeholder="Ex: brunch-douceurs"
                  placeholderTextColor="#94A3B8"
                />

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Couleur Hex (#Hex)</Text>
                    <TextInput style={styles.input} value={catFormColor} onChangeText={setCatFormColor} placeholder="#C52824" placeholderTextColor="#94A3B8" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Icône Lucide</Text>
                    <TextInput style={styles.input} value={catFormIcon} onChangeText={setCatFormIcon} placeholder="Coffee" placeholderTextColor="#94A3B8" />
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
                  const spotCount = getCategorySpotCount(spots, cat.id);
                  return (
                    <View key={cat.id} style={styles.catAdminCard}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                        <View style={[styles.catIconCircle, { backgroundColor: `${cat.color || '#C52824'}20` }]}>
                          <Tag size={20} color={cat.color || '#C52824'} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.catAdminTitle}>{cat.name}</Text>
                          <Text style={styles.catAdminSub}>Slug: {cat.slug || cat.id} • {spotCount} adresses</Text>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 6 }}>
                        <Pressable style={styles.editActionBtn} onPress={() => handleOpenEditCategory(cat)}>
                          <Edit3 size={14} color="#1E293B" />
                        </Pressable>
                        <Pressable
                          style={styles.deleteActionBtn}
                          onPress={() => setDeleteConfirmModal({ visible: true, type: 'category', id: cat.id, name: cat.name })}
                        >
                          <Trash2 size={14} color="#C52824" />
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
                  <Calendar size={13} color={eventTabFilter === 'all' ? '#1E293B' : '#64748B'} style={{ marginRight: 6 }} />
                  <Text style={[styles.eventTabPillText, eventTabFilter === 'all' && styles.eventTabPillTextActive]}>
                    Tous ({events.length})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.eventTabPill, eventTabFilter === 'upcoming' && styles.eventTabPillActive]}
                  onPress={() => setEventTabFilter('upcoming')}
                >
                  <Clock size={13} color={eventTabFilter === 'upcoming' ? '#1E293B' : '#64748B'} style={{ marginRight: 6 }} />
                  <Text style={[styles.eventTabPillText, eventTabFilter === 'upcoming' && styles.eventTabPillTextActive]}>
                    À venir ({upcomingCount})
                  </Text>
                </Pressable>
                <Pressable
                  style={[styles.eventTabPill, eventTabFilter === 'archived' && styles.eventTabPillActive]}
                  onPress={() => setEventTabFilter('archived')}
                >
                  <Archive size={13} color={eventTabFilter === 'archived' ? '#1E293B' : '#64748B'} style={{ marginRight: 6 }} />
                  <Text style={[styles.eventTabPillText, eventTabFilter === 'archived' && styles.eventTabPillTextActive]}>
                    Archivés ({archivedCount})
                  </Text>
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 60, gap: 12 }} showsVerticalScrollIndicator={false}>
                {/* Event Form Box */}
                <View style={styles.formContainer}>
                  <Text style={styles.formSectionTitle}>{editingEventId ? 'Modifier l\'événement' : 'Créer un événement'}</Text>
                  
                  <TextInput style={styles.input} value={eventFormTitle} onChangeText={setEventFormTitle} placeholder="Titre de l'événement *" placeholderTextColor="#94A3B8" />
                  <TextInput style={styles.input} value={eventFormDesc} onChangeText={setEventFormDesc} placeholder="Description *" placeholderTextColor="#94A3B8" multiline />
                  
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput style={[styles.input, { flex: 1 }]} value={eventFormDate} onChangeText={setEventFormDate} placeholder="Date (AAAA-MM-JJ ou JJ/MM/AAAA) *" placeholderTextColor="#94A3B8" />
                    <TextInput style={[styles.input, { flex: 1 }]} value={eventFormTime} onChangeText={setEventFormTime} placeholder="Heure (ex: 19:00)" placeholderTextColor="#94A3B8" />
                  </View>

                  {/* Raccourcis date rapide */}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8, alignItems: 'center' }}>
                    <Text style={{ fontSize: 11, color: '#64748B', marginRight: 2 }}>Raccourcis :</Text>
                    <Pressable
                      style={{ backgroundColor: '#F1F5F9', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                      onPress={() => setQuickDate(0)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Aujourd'hui</Text>
                    </Pressable>
                    <Pressable
                      style={{ backgroundColor: '#F1F5F9', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                      onPress={() => setQuickDate(1)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Demain</Text>
                    </Pressable>
                    <Pressable
                      style={{ backgroundColor: '#F1F5F9', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                      onPress={() => setQuickDate(7)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Dans 7 j</Text>
                    </Pressable>
                    <Pressable
                      style={{ backgroundColor: '#F1F5F9', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                      onPress={() => setQuickDate(30)}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '600', color: '#334155' }}>Dans 1 mois</Text>
                    </Pressable>
                  </View>

                  <TextInput style={styles.input} value={eventFormLocation} onChangeText={setEventFormLocation} placeholder="Lieu *" placeholderTextColor="#94A3B8" />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput style={[styles.input, { flex: 1 }]} value={eventFormPrice} onChangeText={setEventFormPrice} keyboardType="numeric" placeholder="Tarif (€)" placeholderTextColor="#94A3B8" />
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={eventFormMaxPlaces}
                      onChangeText={setEventFormMaxPlaces}
                      keyboardType="numeric"
                      placeholder="Places max (ex: 50)"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>

                  <TextInput
                    style={styles.input}
                    value={eventFormBookingUrl}
                    onChangeText={setEventFormBookingUrl}
                    placeholder="Lien de réservation (https://...)"
                    placeholderTextColor="#94A3B8"
                    autoCapitalize="none"
                    keyboardType="url"
                  />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <Pressable style={[styles.saveSubmitBtn, { flex: 1 }]} onPress={handleSaveEvent} disabled={isUploading}>
                      <Text style={styles.saveSubmitBtnText}>{editingEventId ? 'Mettre à jour l\'événement →' : 'Publier l\'événement →'}</Text>
                    </Pressable>
                    {editingEventId && (
                      <Pressable
                        style={[styles.saveSubmitBtn, { backgroundColor: '#94A3B8', paddingHorizontal: 16 }]}
                        onPress={() => handleOpenEditEvent(null)}
                      >
                        <Text style={styles.saveSubmitBtnText}>Annuler</Text>
                      </Pressable>
                    )}
                  </View>
                </View>

                {/* Events List */}
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B', marginTop: 12 }}>
                  {filteredEvents.length} événements {eventTabFilter === 'all' ? 'au total' : eventTabFilter === 'upcoming' ? 'à venir' : 'passés (archivés)'}
                </Text>

                {filteredEvents.map(evt => (
                  <View key={evt.id} style={styles.spotCard}>
                    <View style={styles.spotCardBody}>
                      <Text style={styles.spotCardTitle}>{evt.title}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Calendar size={11} color="#64748B" />
                        <Text style={styles.spotCardAddress}>{evt.event_date} à {evt.event_time} - {evt.location}</Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        <Text style={styles.spotCardRating}>{evt.price ? `${evt.price} €` : 'Gratuit'}</Text>
                        {evt.max_places ? (
                          <Text style={{ fontSize: 11, color: '#8B5CF6', fontWeight: '700', backgroundColor: '#EDE9FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            {evt.max_places} places
                          </Text>
                        ) : null}
                        {evt.booking_url ? (
                          <Text style={{ fontSize: 11, color: '#0891B2', fontWeight: '700', backgroundColor: '#ECFEFF', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                            Lien réservation
                          </Text>
                        ) : null}
                      </View>
                    </View>
                    <View style={styles.spotCardActions}>
                      <Pressable
                        style={styles.actionBtnEdit}
                        onPress={() => handleOpenEditEvent(evt)}
                      >
                        <Edit3 size={16} color="#4F46E5" strokeWidth={2.5} />
                      </Pressable>
                      <Pressable
                        style={styles.actionBtnDelete}
                        onPress={() => setDeleteConfirmModal({ visible: true, type: 'event', id: evt.id, name: evt.title })}
                      >
                        <Trash2 size={16} color="#C52824" strokeWidth={2.5} />
                      </Pressable>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}

          {/* ── TAB 5: TOP PARTENAIRES (STYLE NETFLIX) ── */}
          {activeTab === 'partners' && (
            <ScrollView style={{ flex: 1, padding: 16 }} contentContainerStyle={{ paddingBottom: 60 }}>
              <View style={styles.formCard}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <Sparkles size={22} color="#E5A93B" />
                  <Text style={styles.sectionHeaderTitle}>Nouveau Partenaire Sponsorisé (Top Netflix)</Text>
                </View>
                <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>
                  Les partenaires apparaîtront dans le carrousel Top 1..10 de la page d'accueil classés par rang et prix payé.
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
                      color: partnerFormSpotId ? '#1E293B' : '#94A3B8',
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
                        <X size={14} color="#94A3B8" />
                      </Pressable>
                    )}
                    <MapPin size={16} color="#C52824" />
                  </View>
                </Pressable>

                {showPartnerAddressDropdown && (
                  <View
                    style={{
                      borderWidth: 2,
                      borderColor: '#1E293B',
                      borderRadius: 12,
                      backgroundColor: '#FAF5EF',
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
                        borderBottomColor: '#1E293B',
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        backgroundColor: '#FFFFFF',
                        gap: 8,
                      }}
                    >
                      <Search size={16} color="#C52824" />
                      <TextInput
                        autoFocus
                        placeholder={`Rechercher parmi ${spots.length} adresses…`}
                        placeholderTextColor="#94A3B8"
                        value={partnerAddressSearch}
                        onChangeText={setPartnerAddressSearch}
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: '#1E293B',
                          fontWeight: '600',
                          height: 36,
                        }}
                        autoCapitalize="none"
                        autoCorrect={false}
                      />
                      {partnerAddressSearch.length > 0 && (
                        <Pressable hitSlop={8} onPress={() => setPartnerAddressSearch('')}>
                          <X size={13} color="#94A3B8" />
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
                                borderBottomColor: '#F1F5F9',
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
                                    borderColor: isSelected ? '#C52824' : '#E2E8F0',
                                  }}
                                />
                              ) : (
                                <View
                                  style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 8,
                                    backgroundColor: '#F1F5F9',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <MapPin size={14} color="#94A3B8" />
                                </View>
                              )}
                              <View style={{ flex: 1 }}>
                                <Text
                                  style={{
                                    fontSize: 13,
                                    fontWeight: '800',
                                    color: isSelected ? '#C52824' : '#1E293B',
                                  }}
                                  numberOfLines={1}
                                >
                                  {spotName}
                                </Text>
                                {(s.address || s.location) && (
                                  <Text
                                    style={{
                                      fontSize: 11,
                                      color: '#64748B',
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
                                <CheckCircle size={18} color="#C52824" />
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
                          <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>
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
                      borderColor: '#10B981',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 6,
                    }}
                  >
                    <CheckCircle size={14} color="#10B981" />
                    <Text style={{ fontSize: 12, color: '#065F46', fontWeight: '700', flex: 1 }} numberOfLines={1}>
                      Lié à : {partnerFormSpotName}
                    </Text>
                  </View>
                )}

                <Text style={[styles.inputLabel, { marginTop: 14 }]}>Nom du partenaire / commerce *</Text>
                <TextInput
                  placeholder="Ex: Le Bibent, Brasserie Flo…"
                  placeholderTextColor="#94A3B8"
                  value={partnerFormTitle}
                  onChangeText={setPartnerFormTitle}
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>Sous-titre / Offre exclusive</Text>
                <TextInput
                  placeholder="Ex: 1 Coupe de champagne offerte pour tout repas..."
                  placeholderTextColor="#94A3B8"
                  value={partnerFormSubtitle}
                  onChangeText={setPartnerFormSubtitle}
                  style={styles.input}
                />

                <Text style={styles.inputLabel}>URL de l'image de couverture (HD)</Text>
                <TextInput
                  placeholder="https://..."
                  placeholderTextColor="#94A3B8"
                  value={partnerFormImage}
                  onChangeText={setPartnerFormImage}
                  style={styles.input}
                />

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Rang Top (1..10)</Text>
                    <TextInput
                      placeholder="1"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
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
                      placeholderTextColor="#94A3B8"
                      value={partnerFormPrice}
                      onChangeText={setPartnerFormPrice}
                      style={styles.input}
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Durée (jours)</Text>
                    <TextInput
                      placeholder="30"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
                      value={partnerFormDays}
                      onChangeText={setPartnerFormDays}
                      style={styles.input}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.inputLabel}>Fréquence notifs (heures)</Text>
                    <TextInput
                      placeholder="24"
                      keyboardType="numeric"
                      placeholderTextColor="#94A3B8"
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
                    {isSubmittingPartner ? 'Enregistrement...' : 'Classer et mettre en avant'}
                  </Text>
                </Pressable>
              </View>

              {/* Partners List */}
              <View style={{ marginTop: 20 }}>
                <Text style={[styles.sectionHeaderTitle, { marginBottom: 12 }]}>
                  Classement Actif des Partenaires ({partners.length})
                </Text>

                {partners.map((p, idx) => (
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
                      <Text style={[styles.partnerStatusText, { color: p.is_active ? '#065F46' : '#EF4444' }]}>
                        {p.is_active ? 'Actif' : 'Inactif'}
                      </Text>
                    </Pressable>
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
                  <AlertTriangle size={32} color="#C52824" />
                  <Text style={styles.confirmTitle}>Confirmation de suppression</Text>
                </View>
                <Text style={styles.confirmMessage}>
                  Voulez-vous vraiment supprimer définitivement{'\n'}
                  <Text style={{ fontWeight: '900', color: '#C52824' }}>"{deleteConfirmModal.name}"</Text> ?{'\n\n'}
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
  modalOverlay: {
    flex: 1,
    backgroundColor: '#FAF5EF',
  },
  adminHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.06)',
    backgroundColor: '#FAF5EF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  btnPressed: {
    opacity: 0.75,
  },
  tabBar: {
    backgroundColor: '#FFFFFF',
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
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#C52824',
    fontWeight: '800',
  },
  searchSection: {
    paddingVertical: 12,
    gap: 10,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
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
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  catPillActive: {
    backgroundColor: '#C52824',
    shadowColor: '#C52824',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  catPillTextActive: {
    color: '#FFFFFF',
  },
  listHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginVertical: 4,
  },
  listHeaderCount: {
    fontSize: 13,
    fontWeight: '800',
    color: '#64748B',
  },
  addInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10B981',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  addInlineBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  spotCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    gap: 12,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
  },
  spotCardImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  spotCardBody: {
    flex: 1,
    gap: 3,
  },
  spotCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  spotCardAddress: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  spotCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 3,
  },
  miniBadge: {
    backgroundColor: '#F1F5F9',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  spotCardRating: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  spotCardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtnEdit: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDelete: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 4,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 13,
    fontWeight: '600',
    color: '#1E293B',
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
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
  },
  coverPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#C52824',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: '#C52824',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  geocodeBtn: {
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  geocodeBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  galleryManagerSection: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addPhotoSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  addPhotoSmallBtnText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  galleryThumbWrapper: {
    position: 'relative',
    width: 60,
    height: 60,
  },
  galleryThumb: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  deleteThumbBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#C52824',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  saveSubmitBtn: {
    backgroundColor: '#C52824',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#C52824',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  saveSubmitBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  eventTabRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  eventTabPill: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  eventTabPillActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  eventTabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  eventTabPillTextActive: {
    color: '#1E293B',
    fontWeight: '800',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
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
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    gap: 14,
    shadowColor: '#0F172A',
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
    fontWeight: '900',
    color: '#1E293B',
    flex: 1,
  },
  confirmMessage: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    lineHeight: 20,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#C52824',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#C52824',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 2,
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  catAdminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    shadowColor: '#0F172A',
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
    fontWeight: '800',
    color: '#1E293B',
  },
  catAdminSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  toggleSwitchBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSwitchBtnActive: {
    backgroundColor: '#E5A93B',
    borderColor: '#E5A93B',
  },
  toggleSwitchBtnActiveNew: {
    backgroundColor: '#C52824',
    borderColor: '#C52824',
  },
  toggleSwitchText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#1E293B',
    textAlign: 'center',
  },
  toggleSwitchTextActive: {
    color: '#FFFFFF',
  },
  editActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },

  formCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 3,
    gap: 12,
  },
  sectionHeaderTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
  },

  // ── PARTNERS STYLES ──
  partnerAdminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  partnerRankBadge: {
    backgroundColor: '#C52824',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginRight: 6,
  },
  partnerRankText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  partnerThumb: {
    width: 52,
    height: 52,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
  },
  partnerTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1E293B',
  },
  partnerSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  partnerMeta: {
    fontSize: 11,
    color: '#D97706',
    fontWeight: '700',
    marginTop: 2,
  },
  partnerStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  partnerActivePill: {
    backgroundColor: '#D1FAE5',
  },
  partnerInactivePill: {
    backgroundColor: '#FEE2E2',
  },
  partnerStatusText: {
    fontSize: 11,
    fontWeight: '800',
  },
});
