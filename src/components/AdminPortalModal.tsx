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
  QrCode,
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
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import dataset from '../constants/dataset.json';

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
  onLogout: () => void;
}

export default function AdminPortalModal({ visible, onClose, onLogout }: AdminPortalModalProps) {
  const [activeTab, setActiveTab] = useState<'spots' | 'editSpot' | 'categories' | 'events' | 'scanner'>('spots');

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
  const [formCategory, setFormCategory] = useState('cat_gourmand');
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
  const [eventTabFilter, setEventTabFilter] = useState<'upcoming' | 'archived'>('upcoming');

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
  const [showSpotSelectorModal, setShowSpotSelectorModal] = useState(false);

  // Deletion Confirmation Modal State
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    visible: boolean;
    type: 'spot' | 'event' | 'category';
    id: string;
    name: string;
  }>({ visible: false, type: 'spot', id: '', name: '' });

  // Ticket Scanner State
  const [scannerTicketNum, setScannerTicketNum] = useState('');
  const [scanResult, setScanResult] = useState<{ status: 'success' | 'scanned_already' | 'invalid'; message: string } | null>(null);

  useEffect(() => {
    if (visible) {
      fetchSpots();
      fetchEvents();
      fetchCategories();
    }
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

  // Fetch Spots from Supabase DB (fallback to dataset.json)
  const fetchSpots = async () => {
    try {
      setLoadingSpots(true);
      const { data, error } = await supabase.from('addresses').select('*').order('created_at', { ascending: false });
      if (!error && data && data.length > 0) {
        setSpots(data);
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
        showAlert('Géocodage réussi 🎯', `Coordonnées BAN trouvées : (${coords[1].toFixed(5)}, ${coords[0].toFixed(5)})`);
      } else {
        showAlert('Géocodage introuvable ⚠️', 'Aucune coordonnée BAN trouvée. Veuillez vérifier l\'adresse.');
      }
    } catch (e: any) {
      showAlert('Erreur de géocodage', e.message);
    } finally {
      setIsGeocoding(false);
    }
  };

  // ── Open Spot Form (New or Edit) ──
  const handleOpenEditSpot = (spot?: any) => {
    if (spot) {
      setEditingSpotId(spot.id);
      setFormTitle(spot.title || '');
      setFormDescription(spot.description || '');
      setFormFullDescription(spot.full_description || spot.description || '');
      setFormCategory(spot.category_id || 'cat_gourmand');
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
      setFormCategory('cat_gourmand');
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

      const record: any = {
        title: formTitle.trim(),
        description: formDescription.trim(),
        full_description: formFullDescription.trim() || formDescription.trim(),
        category_id: formCategory,
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
        const { error } = await supabase.from('addresses').update(record).eq('id', editingSpotId);
        if (error) throw error;
        showAlert('Succès 🟢', `L'adresse "${formTitle}" a été mise à jour avec succès.`);
      } else {
        // Insert new record
        const cleanSlug = formTitle.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40);
        record.id = `spot-${cleanSlug}-${Date.now().toString(36)}`;
        record.slug = cleanSlug;
        record.is_recommended = true;
        record.is_new = true;
        const { error } = await supabase.from('addresses').insert(record);
        if (error) throw error;
        showAlert('Succès 🟢', `L'adresse "${formTitle}" a été créée et publiée.`);
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
        showAlert('Image mise à jour 📸', 'La photo de couverture a été téléversée sur Supabase Storage.');
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
        showAlert('Photo ajoutée 📸', 'Une nouvelle photo a été ajoutée à la galerie.');
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
        showAlert('Catégorie mise à jour 🏷️', `La catégorie "${catFormName}" a été modifiée.`);
      } else {
        const newId = `cat_${Date.now()}`;
        const { error } = await supabase.from('categories').insert({ id: newId, ...catObj });
        if (error) throw error;
        showAlert('Catégorie créée 🏷️', `La catégorie "${catFormName}" a été ajoutée avec succès.`);
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
        const { error } = await supabase.from('addresses').delete().eq('id', id);
        if (error) throw error;
        showAlert('Suppression réussie 🗑️', `L'adresse "${name}" a été supprimée.`);
        fetchSpots();
      } else if (type === 'event') {
        const { error } = await supabase.from('events').delete().eq('id', id);
        if (error) throw error;
        showAlert('Suppression réussie 🗑️', `L'événement "${name}" a été supprimé.`);
        fetchEvents();
      } else if (type === 'category') {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) throw error;
        showAlert('Suppression réussie 🗑️', `La catégorie "${name}" a été supprimée.`);
        fetchCategories();
      }
    } catch (e: any) {
      showAlert('Erreur lors de la suppression', e.message);
    }
  };

  // ── Save / Update Event ──
  const handleSaveEvent = async () => {
    if (!eventFormTitle.trim() || !eventFormDate.trim()) {
      showAlert('Champs requis', 'Veuillez saisir au moins le Titre et la Date de l\'événement.');
      return;
    }
    try {
      setIsUploading(true);
      const record: any = {
        title: eventFormTitle.trim(),
        description: eventFormDesc.trim(),
        event_date: eventFormDate.trim(),
        event_time: eventFormTime.trim() || '19:00',
        location: eventFormLocation.trim() || 'Toulouse',
        price: parseFloat(eventFormPrice || '0'),
        image_url: eventFormImageUrl.trim(),
        address_id: eventFormSpotId || null,
      };

      if (editingEventId) {
        const { error } = await supabase.from('events').update(record).eq('id', editingEventId);
        if (error) throw error;
        showAlert('Succès 🎫', `L'événement "${eventFormTitle}" a été mis à jour.`);
      } else {
        const { error } = await supabase.from('events').insert(record);
        if (error) throw error;
        showAlert('Succès 🎫', `L'événement "${eventFormTitle}" a été créé.`);
      }

      await fetchEvents();
      setEditingEventId(null);
      setEventFormTitle('');
      setEventFormDesc('');
      setEventFormDate('');
      setEventFormTime('19:00');
      setEventFormLocation('');
      setEventFormPrice('0');
      setEventFormImageUrl('');
      setEventFormSpotId(null);
    } catch (e: any) {
      showAlert('Erreur enregistrement événement', e.message);
    } finally {
      setIsUploading(false);
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
    if (selectedCategoryFilter !== 'all' && s.category_id !== selectedCategoryFilter) {
      return false;
    }
    return true;
  });

  const todayStr = new Date().toISOString().split('T')[0];
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

        {/* Tab Selector Bar */}
        <View style={styles.tabBar}>
          <Pressable style={[styles.tabBtn, activeTab === 'spots' && styles.tabBtnActive]} onPress={() => setActiveTab('spots')}>
            <Text style={[styles.tabBtnText, activeTab === 'spots' && styles.tabBtnTextActive]}>🏠 Adresses ({spots.length})</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, activeTab === 'editSpot' && styles.tabBtnActive]} onPress={() => handleOpenEditSpot()}>
            <Text style={[styles.tabBtnText, activeTab === 'editSpot' && styles.tabBtnTextActive]}>
              {editingSpotId ? '✏️ Édition' : '➕ Créer'}
            </Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, activeTab === 'categories' && styles.tabBtnActive]} onPress={() => setActiveTab('categories')}>
            <Text style={[styles.tabBtnText, activeTab === 'categories' && styles.tabBtnTextActive]}>🏷️ Catégories ({categories.length})</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, activeTab === 'events' && styles.tabBtnActive]} onPress={() => setActiveTab('events')}>
            <Text style={[styles.tabBtnText, activeTab === 'events' && styles.tabBtnTextActive]}>🎫 Événements</Text>
          </Pressable>
          <Pressable style={[styles.tabBtn, activeTab === 'scanner' && styles.tabBtnActive]} onPress={() => setActiveTab('scanner')}>
            <Text style={[styles.tabBtnText, activeTab === 'scanner' && styles.tabBtnTextActive]}>📷 Scanner</Text>
          </Pressable>
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
                  {[
                    { id: 'all', name: 'Toutes' },
                    { id: 'cat_gourmand', name: 'Gourmand 🍴' },
                    { id: 'cat_trinquer', name: 'Trinquer 🍷' },
                    { id: 'cat_shopping', name: 'Shopping 🛍️' },
                    { id: 'cat_culture', name: 'Culture 🎨' },
                    { id: 'cat_viepratique', name: 'Vie Pratique 🏠' },
                  ].map(cat => (
                    <Pressable
                      key={cat.id}
                      style={[styles.catPill, selectedCategoryFilter === cat.id && styles.catPillActive]}
                      onPress={() => setSelectedCategoryFilter(cat.id)}
                    >
                      <Text style={[styles.catPillText, selectedCategoryFilter === cat.id && styles.catPillTextActive]}>{cat.name}</Text>
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
                        <Text style={styles.spotCardAddress} numberOfLines={1}>📍 {spot.address || spot.location || 'Toulouse'}</Text>
                        <View style={styles.spotCardBadgeRow}>
                          <View style={styles.miniBadge}>
                            <Text style={styles.miniBadgeText}>
                              {spot.category_id === 'cat_gourmand' ? 'Gourmand' : spot.category_id === 'cat_trinquer' ? 'Trinquer' : 'Shopping'}
                            </Text>
                          </View>
                          <Text style={styles.spotCardRating}>★ {spot.rating || '4.8'}</Text>
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
                  {editingSpotId ? '✏️ Modifier l\'adresse' : '➕ Créer une nouvelle adresse'}
                </Text>

                {/* Cover Image Manager */}
                <Text style={styles.inputLabel}>Photo de couverture *</Text>
                <View style={styles.coverImageRow}>
                  {formCoverUrl ? (
                    <Image source={{ uri: formCoverUrl }} style={styles.coverPreview} />
                  ) : (
                    <View style={styles.coverPlaceholder}>
                      <Text style={{ fontSize: 24 }}>🖼️</Text>
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
                  {[
                    { id: 'cat_gourmand', name: 'Gourmand 🍴' },
                    { id: 'cat_trinquer', name: 'Trinquer 🍷' },
                    { id: 'cat_shopping', name: 'Shopping 🛍️' },
                    { id: 'cat_culture', name: 'Culture 🎨' },
                    { id: 'cat_viepratique', name: 'Vie Pratique 🏠' },
                  ].map(c => (
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
                    {isGeocoding ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.geocodeBtnText}>🎯 BAN</Text>}
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
                <Text style={styles.formSectionTitle}>{editingCatId ? '✏️ Modifier la catégorie' : '➕ Ajouter une nouvelle catégorie'}</Text>
                
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
                    <Text style={styles.saveSubmitBtnText}>{editingCatId ? 'Enregistrer 🏷️' : 'Créer la catégorie 🏷️'}</Text>
                  </Pressable>
                </View>
              </View>

              {/* Categories List */}
              <Text style={[styles.formSectionTitle, { marginTop: 20, marginBottom: 10 }]}>Toutes les catégories ({categories.length})</Text>
              
              <View style={{ gap: 10 }}>
                {categories.map((cat: any) => {
                  const spotCount = spots.filter(s => s.category_id === cat.id || s.category_id === cat.slug).length;
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
              {/* Filter Row: Upcoming vs Archived */}
              <View style={styles.eventTabRow}>
                <Pressable
                  style={[styles.eventTabPill, eventTabFilter === 'upcoming' && styles.eventTabPillActive]}
                  onPress={() => setEventTabFilter('upcoming')}
                >
                  <Text style={[styles.eventTabPillText, eventTabFilter === 'upcoming' && styles.eventTabPillTextActive]}>📅 À venir</Text>
                </Pressable>
                <Pressable
                  style={[styles.eventTabPill, eventTabFilter === 'archived' && styles.eventTabPillActive]}
                  onPress={() => setEventTabFilter('archived')}
                >
                  <Text style={[styles.eventTabPillText, eventTabFilter === 'archived' && styles.eventTabPillTextActive]}>🗄️ Archivés (Passés)</Text>
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={{ paddingBottom: 60, gap: 12 }} showsVerticalScrollIndicator={false}>
                {/* Event Form Box */}
                <View style={styles.formContainer}>
                  <Text style={styles.formSectionTitle}>{editingEventId ? '✏️ Modifier l\'événement' : '➕ Créer un événement'}</Text>
                  
                  <TextInput style={styles.input} value={eventFormTitle} onChangeText={setEventFormTitle} placeholder="Titre de l'événement *" placeholderTextColor="#94A3B8" />
                  <TextInput style={styles.input} value={eventFormDesc} onChangeText={setEventFormDesc} placeholder="Description *" placeholderTextColor="#94A3B8" multiline />
                  
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <TextInput style={[styles.input, { flex: 1 }]} value={eventFormDate} onChangeText={setEventFormDate} placeholder="Date (AAAA-MM-JJ) *" placeholderTextColor="#94A3B8" />
                    <TextInput style={[styles.input, { flex: 1 }]} value={eventFormTime} onChangeText={setEventFormTime} placeholder="Heure (ex: 19:00)" placeholderTextColor="#94A3B8" />
                  </View>

                  <TextInput style={styles.input} value={eventFormLocation} onChangeText={setEventFormLocation} placeholder="Lieu *" placeholderTextColor="#94A3B8" />
                  <TextInput style={styles.input} value={eventFormPrice} onChangeText={setEventFormPrice} keyboardType="numeric" placeholder="Tarif (€)" placeholderTextColor="#94A3B8" />

                  <Pressable style={styles.saveSubmitBtn} onPress={handleSaveEvent} disabled={isUploading}>
                    <Text style={styles.saveSubmitBtnText}>{editingEventId ? 'Mettre à jour l\'événement →' : 'Publier l\'événement →'}</Text>
                  </Pressable>
                </View>

                {/* Events List */}
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#1E293B', marginTop: 12 }}>
                  {filteredEvents.length} événements {eventTabFilter === 'upcoming' ? 'à venir' : 'passés (archivés)'}
                </Text>

                {filteredEvents.map(evt => (
                  <View key={evt.id} style={styles.spotCard}>
                    <View style={styles.spotCardBody}>
                      <Text style={styles.spotCardTitle}>{evt.title}</Text>
                      <Text style={styles.spotCardAddress}>📅 {evt.event_date} à {evt.event_time} - {evt.location}</Text>
                      <Text style={styles.spotCardRating}>{evt.price ? `${evt.price} €` : 'Gratuit'}</Text>
                    </View>
                    <View style={styles.spotCardActions}>
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

          {/* ── TAB 4: SCANNER ── */}
          {activeTab === 'scanner' && (
            <View style={{ flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
              <View style={styles.scannerCard}>
                <QrCode size={48} color="#C52824" />
                <Text style={{ fontSize: 16, fontWeight: '800', color: '#1E293B' }}>Validation de billet QR Code</Text>
                <TextInput
                  placeholder="#PT2026-XXXXXXXX"
                  placeholderTextColor="#94A3B8"
                  value={scannerTicketNum}
                  onChangeText={setScannerTicketNum}
                  style={styles.input}
                  autoCapitalize="characters"
                />
                <Pressable
                  style={styles.saveSubmitBtn}
                  onPress={() => {
                    if (scannerTicketNum.trim()) {
                      showAlert('Billet validé 🟢', `Le billet ${scannerTicketNum.trim().toUpperCase()} a été scanné avec succès.`);
                      setScannerTicketNum('');
                    }
                  }}
                >
                  <Text style={styles.saveSubmitBtnText}>Valider le billet ✓</Text>
                </Pressable>
              </View>
            </View>
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
                    <Text style={styles.deleteBtnText}>Supprimer 🗑️</Text>
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
    paddingVertical: 12,
    borderBottomWidth: 2.5,
    borderBottomColor: '#1E293B',
    backgroundColor: '#FAF5EF',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    boxShadow: '2px 2px 0px #1E293B',
  },
  btnPressed: {
    transform: [{ translateY: 1 }],
    boxShadow: '1px 1px 0px #1E293B',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2.5,
    borderBottomColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabBtnActive: {
    backgroundColor: '#FAF5EF',
    borderColor: '#1E293B',
    boxShadow: '2px 2px 0px #1E293B',
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#1E293B',
  },
  searchSection: {
    paddingVertical: 12,
    gap: 8,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    boxShadow: '2px 2px 0px #1E293B',
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  categoryPillsRow: {
    gap: 8,
    paddingVertical: 4,
  },
  catPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
  },
  catPillActive: {
    backgroundColor: '#C52824',
    borderColor: '#1E293B',
  },
  catPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
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
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    boxShadow: '2px 2px 0px #1E293B',
  },
  addInlineBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  spotCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 10,
    gap: 12,
    alignItems: 'center',
    boxShadow: '3px 3px 0px #1E293B',
  },
  spotCardImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  spotCardBody: {
    flex: 1,
    gap: 2,
  },
  spotCardTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
  },
  spotCardAddress: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  spotCardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  miniBadge: {
    backgroundColor: '#FAF5EF',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  miniBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1E293B',
  },
  spotCardRating: {
    fontSize: 11,
    fontWeight: '800',
    color: '#E5A93B',
  },
  spotCardActions: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtnEdit: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    backgroundColor: '#FAF5EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionBtnDelete: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formContainer: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    gap: 10,
    boxShadow: '4px 4px 0px #1E293B',
  },
  formSectionTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
    marginTop: 4,
  },
  input: {
    backgroundColor: '#FAF5EF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  coverImageRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  coverPreview: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1E293B',
  },
  coverPlaceholder: {
    width: 70,
    height: 70,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FAF5EF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#C52824',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    boxShadow: '2px 2px 0px #1E293B',
  },
  uploadBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  geocodeBtn: {
    backgroundColor: '#3B82F6',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    boxShadow: '2px 2px 0px #1E293B',
  },
  geocodeBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  galleryManagerSection: {
    backgroundColor: '#FAF5EF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 10,
    padding: 10,
    marginTop: 6,
  },
  addPhotoSmallBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#10B981',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  addPhotoSmallBtnText: {
    fontSize: 10,
    fontWeight: '900',
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
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#1E293B',
  },
  deleteThumbBtn: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#C52824',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  saveSubmitBtn: {
    backgroundColor: '#C52824',
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
    boxShadow: '3px 3px 0px #1E293B',
  },
  saveSubmitBtnText: {
    fontSize: 14,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  eventTabRow: {
    flexDirection: 'row',
    gap: 10,
    marginVertical: 12,
  },
  eventTabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  eventTabPillActive: {
    backgroundColor: '#E5A93B',
    boxShadow: '2px 2px 0px #1E293B',
  },
  eventTabPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  eventTabPillTextActive: {
    color: '#1E293B',
  },
  scannerCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 14,
    width: '100%',
    maxWidth: 320,
    boxShadow: '4px 4px 0px #1E293B',
  },
  confirmBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(30,41,59,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  confirmBox: {
    backgroundColor: '#FAF5EF',
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 340,
    gap: 14,
    boxShadow: '6px 6px 0px #1E293B',
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
    fontWeight: '700',
    color: '#1E293B',
    lineHeight: 18,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#C52824',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    boxShadow: '2px 2px 0px #1E293B',
  },
  deleteBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  catAdminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    boxShadow: '3px 3px 0px #1E293B',
  },
  catIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  catAdminTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: '#1E293B',
  },
  catAdminSub: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  toggleSwitchBtn: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleSwitchBtnActive: {
    backgroundColor: '#E5A93B',
    borderColor: '#1E293B',
  },
  toggleSwitchBtnActiveNew: {
    backgroundColor: '#C52824',
    borderColor: '#1E293B',
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
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FAF5EF',
    borderWidth: 1.5,
    borderColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteActionBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FEE2E2',
    borderWidth: 1.5,
    borderColor: '#C52824',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
