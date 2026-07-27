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
  Switch,
} from 'react-native';
import { GlassView } from 'expo-glass-effect';
import {
  Building,
  LogOut,
  MapPin,
  Heart,
  Bell,
  ChevronRight,
  ChevronLeft,
  TrendingUp,
  PlusCircle,
  Eye,
  Apple,
  User,
  Settings,
  Calendar,
  X,
  QrCode,
  FileText,
  AlertTriangle,
  Key,
  Check,
  Upload,
  Link as LinkIcon,
  Utensils,
  Coffee,
  ShoppingBag,
  Sparkles,
  Compass,
  Trophy,
} from 'lucide-react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';

WebBrowser.maybeCompleteAuthSession();

type UserRole = 'visitor' | 'business';

// Safe Alert wrapper to prevent runtime crashes on web browser
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
  } else {
    Alert.alert(title, message);
  }
};

// Persist admin session in memory and localStorage (avoids auto-logout on state/auth change or page reload)
let globalIsAdminAuthenticated = false;

const persistAdminAuth = (isAuthenticated: boolean) => {
  try {
    globalIsAdminAuthenticated = isAuthenticated;
    if (Platform.OS === 'web') {
      if (isAuthenticated) {
        window.localStorage.setItem('LPT_ADMIN_AUTH', 'true');
      } else {
        window.localStorage.removeItem('LPT_ADMIN_AUTH');
      }
    }
  } catch (e) {
    console.log('Admin persistence error:', e);
  }
};

const getPersistedAdminAuth = (): boolean => {
  try {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem('LPT_ADMIN_AUTH') === 'true';
    }
  } catch (e) {}
  return globalIsAdminAuthenticated;
};

// Configure notifications presentation when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Retrieve or generate unique device identifier (persistent)
const getOrCreateDeviceId = async (): Promise<string> => {
  try {
    if (Platform.OS === 'web') {
      let id = window.localStorage.getItem('LPT_DEVICE_ID');
      if (!id) {
        id = 'web-' + Math.random().toString(36).substring(2, 15);
        window.localStorage.setItem('LPT_DEVICE_ID', id);
      }
      return id;
    } else {
      let id = await SecureStore.getItemAsync('LPT_DEVICE_ID');
      if (!id) {
        id = 'mobile-' + Platform.OS + '-' + Math.random().toString(36).substring(2, 15);
        await SecureStore.setItemAsync('LPT_DEVICE_ID', id);
      }
      return id;
    }
  } catch (e) {
    return 'fallback-device-' + Math.random().toString(36).substring(2, 10);
  }
};

// Request notification permission and get Expo Push Token
const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    return 'ExponentPushToken[mock-web-token-' + Math.random().toString(36).substring(2, 10) + ']';
  }

  let token = null;
  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notifications!');
      return null;
    }

    try {
      // Find EAS Project ID if configured
      const projectId = 
        Constants.expoConfig?.extra?.eas?.projectId ?? 
        Constants.easConfig?.projectId;

      const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
      token = tokenData.data;
    } catch (e) {
      console.warn("Could not retrieve real Expo Push Token (no EAS configuration). Using mock fallback.", e);
      // Fallback secure mock token to make the features testable without app signing
      token = 'ExponentPushToken[mock-native-' + Platform.OS + '-' + Math.random().toString(36).substring(2, 10) + ']';
    }
  } else {
    // Simulator mock fallback to test SQL triggers and UI settings
    token = 'ExponentPushToken[mock-simulator-' + Platform.OS + '-' + Math.random().toString(36).substring(2, 10) + ']';
  }

  return token;
};

// Upload a file (image or video) to Supabase Storage and return its public URL
const uploadMediaToSupabase = async (
  uri: string,
  bucket: string,
  folder: string,
  mimeType: string = 'image/jpeg'
): Promise<string> => {
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2)}.${mimeType.split('/')[1] || 'jpg'}`;

  if (Platform.OS === 'web') {
    // On web, fetch the blob from the object URL
    const response = await fetch(uri);
    const blob = await response.blob();
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, blob, { contentType: mimeType, upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  } else {
    // Native: use ArrayBuffer from fetch
    const response = await fetch(uri);
    const arrayBuffer = await response.arrayBuffer();
    const { data, error } = await supabase.storage.from(bucket).upload(fileName, arrayBuffer, { contentType: mimeType, upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  }
};

const PT_SPOTS = [
  { id: '1', name: "Pont Neuf Crêperie", lat: 43.5999, lng: 1.4406, cat: 'food', desc: "Crêpes artisanales au bord de la Garonne." },
  { id: '2', name: "Place du Capitole Café", lat: 43.6044, lng: 1.4435, cat: 'shopping', desc: "Le café mythique historique de Toulouse." },
  { id: '3', name: "Carmes Tapas Bar", lat: 43.5965, lng: 1.4455, cat: 'food', desc: "Meilleurs tapas toulousains ambiance chaleureuse." },
  { id: '4', name: "Saint-Cyprien Concept Store", lat: 43.5985, lng: 1.4325, cat: 'shopping', desc: "Boutique créateur écoresponsable." }
];

const MOCK_EVENTS = [
  { id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', title: "Soirée de lancement du guide 2026", description: "Soirée exclusive pour découvrir les nouvelles adresses sélectionnées par l'association.", event_date: '2026-05-24', event_time: '19:00', location: 'Quai de la Daurade, Toulouse', price: 25.00 },
  { id: 'f6e5d4c3-b2a1-0f9e-8d7c-6b5a4f3e2d1c', title: "Toulouse à Table !", description: "Grand banquet toulousain partagé en plein cœur de la ville rose.", event_date: '2026-06-15', event_time: '12:00', location: 'Divers lieux, Toulouse', price: 15.00 }
];

export default function ProfileView({
  onChangeTab,
  onFocusSpot,
  onToggleDock,
}: {
  onChangeTab?: (tab: any) => void;
  onFocusSpot?: (spotId: string) => void;
  onToggleDock?: (visible: boolean) => void;
}) {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  
  // Real database interaction states
  const [likedSpotIds, setLikedSpotIds] = useState<string[]>([]);
  const [visitedSpotIds, setVisitedSpotIds] = useState<string[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<any | null>(null);
  
  // DB Connection Diagnostic State
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [dbErrorMsg, setDbErrorMsg] = useState<string | null>(null);

  // Auth Form States
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Profile Setup States
  const [name, setName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [role, setRole] = useState<UserRole>('visitor');
  const [location, setLocation] = useState('');

  // Admin Portal & Scanner States
  const [showAdminCodeModal, setShowAdminCodeModal] = useState(false);
  const [adminCodeInput, setAdminCodeInput] = useState('');
  const [showAdminPortal, setShowAdminPortal] = useState(getPersistedAdminAuth());
  const setAdminPortalWithPersist = (val: boolean) => {
    persistAdminAuth(val);
    setShowAdminPortal(val);
  };
  const [activeAdminTab, setActiveAdminTab] = useState<'scanner' | 'addSpot' | 'addEvent'>('scanner');

  // Push Notifications Settings States
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [notifyNewEvents, setNotifyNewEvents] = useState(true);
  const [notifyNewSpots, setNotifyNewSpots] = useState(false);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  
  // Scanner Validation
  const [scannerTicketNum, setScannerTicketNum] = useState('');
  const [scanResult, setScanResult] = useState<{ status: 'success' | 'scanned_already' | 'invalid'; message: string } | null>(null);

  // Forms to Add Address / Spot
  const [spotName, setSpotName] = useState('');
  const [spotCategory, setSpotCategory] = useState('food');
  const [spotAmbiance, setSpotAmbiance] = useState('cosy');
  const [spotLat, setSpotLat] = useState('');
  const [spotLng, setSpotLng] = useState('');
  const [spotDesc, setSpotDesc] = useState('');
  const [spotPriceMin, setSpotPriceMin] = useState('10');
  const [spotPriceMax, setSpotPriceMax] = useState('35');
  const [spotImageUrl, setSpotImageUrl] = useState('');
  const [spotVideoUrl, setSpotVideoUrl] = useState('');
  const [spotRating, setSpotRating] = useState('4.5');
  const [spotReviewCount, setSpotReviewCount] = useState('0');

  // Forms to Add Event
  const [eventTitle, setEventTitle] = useState('');
  const [eventDescField, setEventDescField] = useState('');
  const [eventDateField, setEventDateField] = useState('');
  const [eventTimeField, setEventTimeField] = useState('');
  const [eventLocationField, setEventLocationField] = useState('');
  const [eventPriceField, setEventPriceField] = useState('');
  const [eventImageUrl, setEventImageUrl] = useState('');
  const [eventMaxParticipants, setEventMaxParticipants] = useState('100');

  // Spot success modal
  const [spotSuccessModal, setSpotSuccessModal] = useState<{ visible: boolean; name: string }>({ visible: false, name: '' });
  const spotSuccessScale = React.useRef(new Animated.Value(0.6)).current;
  const spotSuccessOpacity = React.useRef(new Animated.Value(0)).current;
  const spotPinBounce = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (spotSuccessModal.visible) {
      spotSuccessScale.setValue(0.6);
      spotSuccessOpacity.setValue(0);
      spotPinBounce.setValue(0);
      Animated.parallel([
        Animated.spring(spotSuccessScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
        Animated.timing(spotSuccessOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(spotPinBounce, { toValue: -10, duration: 350, useNativeDriver: true }),
            Animated.timing(spotPinBounce, { toValue: 0, duration: 350, useNativeDriver: true }),
            Animated.delay(800),
          ])
        ).start();
      });
    }
  }, [spotSuccessModal.visible]);
  // Event success modal
  const [eventSuccessModal, setEventSuccessModal] = useState<{ visible: boolean; title: string }>({ visible: false, title: '' });
  const eventSuccessScale = React.useRef(new Animated.Value(0.6)).current;
  const eventSuccessOpacity = React.useRef(new Animated.Value(0)).current;
  const eventTicketBounce = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (eventSuccessModal.visible) {
      eventSuccessScale.setValue(0.6);
      eventSuccessOpacity.setValue(0);
      eventTicketBounce.setValue(0);
      Animated.parallel([
        Animated.spring(eventSuccessScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
        Animated.timing(eventSuccessOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        Animated.loop(
          Animated.sequence([
            Animated.timing(eventTicketBounce, { toValue: -10, duration: 350, useNativeDriver: true }),
            Animated.timing(eventTicketBounce, { toValue: 0, duration: 350, useNativeDriver: true }),
            Animated.delay(800),
          ])
        ).start();
      });
    }
  }, [eventSuccessModal.visible]);

  // Admin code error modal
  const [adminCodeError, setAdminCodeError] = useState<{ visible: boolean; message: string }>({ visible: false, message: '' });
  const adminErrorScale = React.useRef(new Animated.Value(0.6)).current;
  const adminErrorOpacity = React.useRef(new Animated.Value(0)).current;
  const adminErrorShake = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (adminCodeError.visible) {
      adminErrorScale.setValue(0.6);
      adminErrorOpacity.setValue(0);
      adminErrorShake.setValue(0);
      Animated.parallel([
        Animated.spring(adminErrorScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true }),
        Animated.timing(adminErrorOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start(() => {
        Animated.sequence([
          Animated.timing(adminErrorShake, { toValue: 10, duration: 80, useNativeDriver: true }),
          Animated.timing(adminErrorShake, { toValue: -10, duration: 80, useNativeDriver: true }),
          Animated.timing(adminErrorShake, { toValue: 6, duration: 80, useNativeDriver: true }),
          Animated.timing(adminErrorShake, { toValue: -6, duration: 80, useNativeDriver: true }),
          Animated.timing(adminErrorShake, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]).start();
      });
    }
  }, [adminCodeError.visible]);

  // Animate scan laser line
  const scanLineAnim = React.useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (activeAdminTab === 'scanner' && showAdminPortal) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 200,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 1200,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scanLineAnim.setValue(0);
    }
  }, [activeAdminTab, showAdminPortal]);

  // Handlers for Cancellation
  const handleCancelBooking = async (ticket: any) => {
    if (Platform.OS === 'web') {
      const confirmed = window.confirm(`Voulez-vous vraiment annuler votre réservation pour "${ticket.event?.title || 'cet événement'}" ?`);
      if (confirmed) executeCancel(ticket);
    } else {
      Alert.alert(
        "Annuler la réservation",
        `Voulez-vous vraiment annuler votre réservation pour "${ticket.event?.title || 'cet événement'}" ?`,
        [
          { text: "Non", style: "cancel" },
          { text: "Oui, annuler", style: "destructive", onPress: () => executeCancel(ticket) }
        ]
      );
    }
  };

  const executeCancel = async (ticket: any) => {
    try {
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('id', ticket.id);

      if (error) throw error;

      showAlert("Réservation annulée ❌", "Votre billet a bien été supprimé et votre place a été libérée.");
      setSelectedTicket(null);
      if (session?.user?.id) {
        fetchUserStats(session.user.id);
      }
    } catch (e: any) {
      showAlert("Erreur", "Impossible d'annuler la réservation : " + e.message);
    }
  };

  // Handlers for Admin validation
  const handleValidateTicket = async (ticketNum: string) => {
    if (!ticketNum.trim()) {
      showAlert("Erreur", "Veuillez saisir ou scanner un numéro de billet.");
      return;
    }
    try {
      const { data: regs, error } = await supabase
        .from('event_registrations')
        .select('*, events(*)')
        .eq('ticket_number', ticketNum.trim().toUpperCase());

      if (error) throw error;

      if (!regs || regs.length === 0) {
        setScanResult({
          status: 'invalid',
          message: `Billet invalide !\nAucun enregistrement trouvé pour le code : ${ticketNum.trim().toUpperCase()}`
        });
        return;
      }

      const ticket = regs[0];
      if (ticket.payment_status === 'scanned') {
        setScanResult({
          status: 'scanned_already',
          message: `Billet Déjà Scanné ❌\nÉvénement : ${ticket.events?.title || 'Événement'}\nCode : ${ticket.ticket_number}`
        });
      } else {
        // Update scanned status in database
        const { error: updateError } = await supabase
          .from('event_registrations')
          .update({ payment_status: 'scanned' })
          .eq('id', ticket.id);

        if (updateError) throw updateError;

        setScanResult({
          status: 'success',
          message: `Billet Validé avec Succès ! 🟢\nÉvénement : ${ticket.events?.title || 'Événement'}\nCode : ${ticket.ticket_number}`
        });

        // Refresh stats
        if (session?.user?.id) {
          fetchUserStats(session.user.id);
        }
      }
    } catch (e: any) {
      setScanResult({
        status: 'invalid',
        message: "Erreur lors de la validation : " + e.message
      });
    }
  };

  // Automatic geocoding using Nominatim (OpenStreetMap)
  const geocodeAddress = async (nameOrAddress: string): Promise<{lat: number, lng: number} | null> => {
    try {
      let query = nameOrAddress.trim();
      
      // If query does not mention Toulouse, append it to focus search in Toulouse area
      if (!query.toLowerCase().includes('toulouse')) {
        query += ', Toulouse';
      }
      
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'LePetitTou/1.0 (antigravity; ryadhabdelmalek)'
        }
      });
      const data = await response.json();
      
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon)
        };
      }
    } catch (err) {
      console.log('DEBUG: Geocoding failed, using Capitole fallback.', err);
    }
    return null;
  };

  // Image and Video Picking/Uploading States
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);

  const handlePickAndUpload = async (mediaType: 'image' | 'video') => {
    // 1. Ask permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert("Permission requise 📸", "Nous avons besoin d'accéder à votre galerie pour importer un média.");
      return;
    }

    try {
      if (mediaType === 'image') {
        setIsUploadingImage(true);
      } else {
        setIsUploadingVideo(true);
      }

      // 2. Launch Image Picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === 'image' ? ImagePicker.MediaTypeOptions.Images : ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const uri = asset.uri;
        const mimeType = asset.mimeType || (mediaType === 'image' ? 'image/jpeg' : 'video/mp4');
        
        // 3. Upload to Supabase Storage Bucket 'media' in folder 'spots'
        const publicUrl = await uploadMediaToSupabase(uri, 'media', 'spots', mimeType);
        
        if (mediaType === 'image') {
          setSpotImageUrl(publicUrl);
          showAlert("Importation réussie 📸", "L'image a bien été stockée sur Supabase Storage.");
        } else {
          setSpotVideoUrl(publicUrl);
          showAlert("Importation réussie 🎥", "La vidéo a bien été stockée sur Supabase Storage.");
        }
      }
    } catch (err: any) {
      console.warn("Upload error:", err);
      showAlert(
        "Erreur d'importation", 
        "Impossible d'importer le fichier. Vérifiez que vous avez bien créé un bucket public nommé 'media' dans le Storage de votre console Supabase.\n\nDétail : " + err.message
      );
    } finally {
      setIsUploadingImage(false);
      setIsUploadingVideo(false);
    }
  };

  // Handlers to Add Spot
  const handleAddSpot = async () => {
    if (!spotName || !spotDesc) {
      showAlert("Champs manquants", "Veuillez remplir au minimum le Nom et la Description.");
      return;
    }
    try {
      // 1. Geocode dynamically using the address/name entered
      const coords = await geocodeAddress(spotName);
      const finalLat = coords ? coords.lat : 43.6047;
      const finalLng = coords ? coords.lng : 1.4442;

      const uniqueSuffix = Math.random().toString(36).substring(2, 7);
      const cleanName = spotName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 40);
      const customId = `${cleanName}-${uniqueSuffix}`;
      const { error } = await supabase
        .from('spots')
        .insert({
          id: customId,
          name: spotName,
          category: spotCategory,
          ambiance: spotAmbiance,
          lat: finalLat,
          lng: finalLng,
          price_min: parseInt(spotPriceMin) || 10,
          price_max: parseInt(spotPriceMax) || 50,
          description: spotDesc,
          image_url: spotImageUrl || null,
          video_url: spotVideoUrl || null,
          average_rating: parseFloat(spotRating) || 4.5,
          review_count: parseInt(spotReviewCount) || 0,
          is_open_now: true
        });

      if (error) throw error;

      const publishedName = spotName;
      setSpotName(''); setSpotLat(''); setSpotLng(''); setSpotDesc('');
      setSpotImageUrl(''); setSpotVideoUrl(''); setSpotRating('4.5'); setSpotReviewCount('0');
      setSpotSuccessModal({ visible: true, name: publishedName });
    } catch (e: any) {
      showAlert("Erreur", "Impossible d'ajouter l'adresse : " + e.message);
    }
  };

  // Flexible Date Parsing function (supports DD/MM/YY, DD/MM/YYYY, YYYY-MM-DD, etc.)
  const parseFlexibleDate = (input: string): string => {
    const clean = input.replace(/\s+/g, '').replace(/\//g, '-');
    const parts = clean.split('-');
    if (parts.length !== 3) {
      throw new Error("La date doit comporter 3 parties séparées par / ou - (ex: 19/05/2026)");
    }

    let day = '';
    let month = '';
    let year = '';

    // Cas 1 : YYYY-MM-DD
    if (parts[0].length === 4) {
      year = parts[0];
      month = parts[1];
      day = parts[2];
    } 
    // Cas 2 : DD-MM-YYYY
    else if (parts[2].length === 4) {
      day = parts[0];
      month = parts[1];
      year = parts[2];
    }
    // Cas 3 : DD-MM-YY (ex: 19-05-27 ou 19-05-26)
    else if (parts[0].length <= 2 && parts[2].length <= 2) {
      day = parts[0];
      month = parts[1];
      year = parts[2];
      if (year.length === 2) {
        year = '20' + year; // Suppose 20XX
      }
    } else {
      throw new Error("Date invalide (format non reconnu)");
    }

    // Normalisation
    day = day.padStart(2, '0');
    month = month.padStart(2, '0');

    // Validation basique
    const d = parseInt(day);
    const m = parseInt(month);
    const y = parseInt(year);
    if (isNaN(d) || isNaN(m) || isNaN(y) || d < 1 || d > 31 || m < 1 || m > 12 || y < 1900 || y > 2100) {
      throw new Error("Date invalide (valeurs hors limites)");
    }

    return `${year}-${month}-${day}`;
  };

  // Handlers to Add Event
  const handleAddEvent = async () => {
    if (!eventTitle || !eventDescField || !eventDateField || !eventTimeField || !eventLocationField) {
      showAlert("Champs manquants", "Veuillez remplir : Titre, Description, Date, Heure et Lieu.");
      return;
    }
    try {
      // Parse et valide la date flexiblement
      const formattedDate = parseFlexibleDate(eventDateField);

      const { error } = await supabase
        .from('events')
        .insert({
          title: eventTitle,
          description: eventDescField,
          event_date: formattedDate,
          event_time: eventTimeField,
          location: eventLocationField,
          price: parseFloat(eventPriceField || '0'),
          image_url: eventImageUrl || null,
          max_participants: parseInt(eventMaxParticipants) || 100
        });

      if (error) throw error;

      const publishedTitle = eventTitle;
      setEventTitle(''); setEventDescField(''); setEventDateField('');
      setEventTimeField(''); setEventLocationField(''); setEventPriceField('');
      setEventImageUrl(''); setEventMaxParticipants('100');
      setEventSuccessModal({ visible: true, title: publishedTitle });
    } catch (e: any) {
      showAlert("Erreur", "Impossible de créer l'événement : " + e.message);
    }
  };

  const setupPushNotifications = async (currentUserId: string | null) => {
    try {
      const devId = await getOrCreateDeviceId();
      setDeviceId(devId);

      const token = await registerForPushNotificationsAsync();
      if (!token) return;
      setPushToken(token);

      // Check if device settings already exist in DB
      const { data, error } = await supabase
        .from('user_push_tokens')
        .select('*')
        .eq('device_id', devId)
        .single();

      if (!error && data) {
        // Sync local React settings with database
        setNotifyNewEvents(data.notify_new_events);
        setNotifyNewSpots(data.notify_new_spots);
        
        // Update user_id reference if user just logged in
        if (currentUserId && data.user_id !== currentUserId) {
          await supabase
            .from('user_push_tokens')
            .update({ user_id: currentUserId, push_token: token })
            .eq('device_id', devId);
        }
      } else {
        // Insert new token preferences entry in database
        await supabase
          .from('user_push_tokens')
          .upsert({
            device_id: devId,
            user_id: currentUserId || null,
            push_token: token,
            notify_new_events: notifyNewEvents,
            notify_new_spots: notifyNewSpots,
          });
      }
    } catch (e) {
      console.warn("setupPushNotifications error:", e);
    }
  };

  const handleTogglePreference = async (type: 'events' | 'spots', val: boolean) => {
    if (type === 'events') {
      setNotifyNewEvents(val);
    } else {
      setNotifyNewSpots(val);
    }

    try {
      const devId = deviceId || await getOrCreateDeviceId();
      if (!devId) return;

      const updates: any = {};
      if (type === 'events') {
        updates.notify_new_events = val;
      } else {
        updates.notify_new_spots = val;
      }

      await supabase
        .from('user_push_tokens')
        .update(updates)
        .eq('device_id', devId);
    } catch (e) {
      console.warn("Error updating notification settings:", e);
    }
  };

  // Input Focus States
  const [focusedInput, setFocusedInput] = useState<string | null>(null);

  useEffect(() => {
    // Diagnose Database Connection
    const testConnection = async () => {
      try {
        if (!supabase) {
          setDbStatus('error');
          setDbErrorMsg("Le client Supabase n'est pas initialisé (clés manquantes).");
          return;
        }
        const { error } = await supabase.from('categories').select('id').limit(1);
        if (error) throw error;
        setDbStatus('connected');
        setDbErrorMsg(null);
      } catch (err: any) {
        console.warn('Supabase test connection failed:', err);
        setDbStatus('error');
        setDbErrorMsg(err.message || "Erreur de connexion réseau ou table 'categories' absente.");
      }
    };
    testConnection();

    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }: any) => {
        setSession(session);
        setupPushNotifications(session ? session.user.id : null);
        if (session) {
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
        }
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: any, session: any) => {
        setSession(session);
        setupPushNotifications(session ? session.user.id : null);
        if (session) {
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      });

      return () => subscription.unsubscribe();
    } else {
      setupPushNotifications(null);
      setLoading(false);
    }
  }, []);

  const isAnyOverlayActive = !!(
    selectedTicket ||
    showAdminCodeModal ||
    showAdminPortal ||
    spotSuccessModal.visible ||
    eventSuccessModal.visible ||
    adminCodeError.visible
  );

  useEffect(() => {
    if (onToggleDock) {
      onToggleDock(!isAnyOverlayActive);
    }
  }, [isAnyOverlayActive, onToggleDock]);

  const fetchUserStats = async (userId: string) => {
    try {
      const { data: favs } = await supabase
        .from('user_favorites')
        .select('spot_id')
        .eq('user_id', userId);
      if (favs) setLikedSpotIds(favs.map((f: any) => f.spot_id));

      const { data: visits } = await supabase
        .from('user_visits')
        .select('spot_id')
        .eq('user_id', userId);
      if (visits) setVisitedSpotIds(visits.map((v: any) => v.spot_id));

      // Fetch user tickets/registrations
      const { data: regs } = await supabase
        .from('event_registrations')
        .select('*')
        .eq('user_id', userId);

      if (regs) {
        // Try fetching events from DB
        try {
          const { data: dbEvents } = await supabase
            .from('events')
            .select('*');

          if (dbEvents && dbEvents.length > 0) {
            const formatted = regs.map((r: any) => {
              const ev = dbEvents.find((e: any) => e.id === r.event_id) || MOCK_EVENTS.find(e => e.id === r.event_id);
              return {
                ...r,
                event: ev
              };
            });
            setTickets(formatted);
            return;
          }
        } catch (e) {
          // Fallback to local
        }

        // Fallback matching
        const formatted = regs.map((r: any) => ({
          ...r,
          event: MOCK_EVENTS.find(e => e.id === r.event_id) || {
            title: "Soirée de lancement du guide 2026",
            event_date: '2026-05-24',
            event_time: '19:00',
            location: 'Quai de la Daurade, Toulouse',
            price: 25.00
          }
        }));
        setTickets(formatted);
      }
    } catch (e) {
      console.warn('Error fetching user stats:', e);
    }
  };

  const fetchProfile = async (userId: string) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.log('DEBUG: fetchProfile error:', error.message);
        setProfile(null);
      } else {
        console.log('DEBUG: fetchProfile succès, data:', data);
        setProfile(data);
        if (data) {
          setName(data.name || '');
          setRole(data.role || 'visitor');
          setBusinessName(data.business_name || '');
          fetchUserStats(userId); // Fetch favorite and visit statistics in background
        }
      }
    } catch (err: any) {
      console.log('DEBUG: fetchProfile catch err:', err.message);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    console.log('DEBUG: handleSignIn appelé avec email:', email);
    if (!email || !password) {
      console.log('DEBUG: Champs vides');
      showAlert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        console.log('DEBUG: Erreur Supabase SignIn:', error.message);
        throw error;
      }
      console.log('DEBUG: Connexion réussie, session:', data.session?.user.id);
    } catch (err: any) {
      console.log('DEBUG: Catch Erreur SignIn:', err.message);
      showAlert('Erreur de connexion', err.message || 'Impossible de se connecter.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    console.log('DEBUG: handleSignUp appelé avec email:', email);
    if (!email || !password) {
      console.log('DEBUG: Champs vides');
      showAlert('Erreur', 'Veuillez renseigner votre email et mot de passe.');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });
      if (error) {
        console.log('DEBUG: Erreur Supabase SignUp:', error.message);
        throw error;
      }
      console.log('DEBUG: Inscription réussie, utilisateur:', data.user?.id);
      
      // Auto-login to bypass manual login steps
      console.log('DEBUG: Connexion automatique post-inscription...');
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        console.log('DEBUG: Échec connexion automatique:', signInError.message);
        showAlert('Inscription réussie', 'Compte créé avec succès. Veuillez vous connecter.');
        setIsSignUp(false);
      } else {
        console.log('DEBUG: Connexion automatique réussie !');
      }
    } catch (err: any) {
      console.log('DEBUG: Catch Erreur SignUp:', err.message);
      showAlert("Erreur d'inscription", err.message || "Impossible de s'inscrire.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    console.log('DEBUG: handleSaveProfile appelé pour user:', session?.user?.id);
    if (!name || (role === 'business' && !businessName)) {
      console.log('DEBUG: Nom ou commerce vide');
      showAlert('Champs requis', 'Veuillez renseigner votre nom complet et le nom du commerce.');
      return;
    }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: session.user.id,
          name: name,
          role: role,
          business_name: role === 'business' ? businessName : null,
          updated_at: new Date().toISOString(),
        })
        .select();

      if (error) {
        console.log('DEBUG: Erreur Supabase Upsert:', error);
        if (error.message.includes('relation') && error.message.includes('does not exist')) {
          showAlert(
            'Configuration Supabase requise',
            'La table "profiles" est introuvable. Veuillez exécuter le script SQL fourni dans votre SQL Editor Supabase pour créer la table.'
          );
          return;
        }
        throw error;
      }
      
      console.log('DEBUG: Upsert réussi, rechargement du profil...', data);
      await fetchProfile(session.user.id);
    } catch (err: any) {
      console.log('DEBUG: Catch Erreur Upsert:', err.message);
      showAlert('Erreur de profil', err.message || 'Impossible d\'enregistrer le profil.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setLoading(true);
      if (supabase) {
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      showAlert('Erreur', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    try {
      setLoading(true);

      if (Platform.OS === 'web') {
        // Direct browser window redirection for web platforms
        console.log('DEBUG: OAuth Web redirect for provider:', provider);
        const { error } = await supabase.auth.signInWithOAuth({
          provider,
          options: {
            redirectTo: window.location.origin,
          },
        });
        if (error) throw error;
        return; // Execution stops here as the browser redirects the window location
      }

      // Native mobile popup handling (WebBrowser/Linking)
      console.log('DEBUG: OAuth Mobile redirect for provider:', provider);
      const redirectUrl = Linking.createURL('/auth/callback');
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;

      if (data?.url) {
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUrl);

        if (result.type === 'success' && result.url) {
          const urlParams = Linking.parse(result.url);
          const { access_token, refresh_token } = urlParams.queryParams || {};

          if (access_token && refresh_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: access_token as string,
              refresh_token: refresh_token as string,
            });
            if (sessionError) throw sessionError;
          }
        }
      }
    } catch (err: any) {
      showAlert('Erreur OAuth', err.message || 'Impossible de se connecter.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#C52824" />
      </View>
    );
  }

  // --- 1. Logged Out Auth UI (Neo-Brutalist style based on your template!) ---
  if (!session) {
    return (
      <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scrollContainerCentered} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          {/* Welcome Title */}
          <Text style={styles.titleText}>
            Bienvenue,{'\n'}
            <Text style={styles.titleSpan}>
              {isSignUp ? 'créez un compte pour continuer' : 'connexion pour continuer'}
            </Text>
          </Text>

          {/* Inputs Section */}
          <View style={styles.formGroup}>
            <TextInput
              placeholder="Adresse e-mail"
              placeholderTextColor="#64748B"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedInput('email')}
              onBlur={() => setFocusedInput(null)}
              style={[
                styles.input,
                focusedInput === 'email' && styles.inputFocus,
              ]}
            />

            <TextInput
              placeholder="Mot de passe"
              placeholderTextColor="#64748B"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              onFocus={() => setFocusedInput('password')}
              onBlur={() => setFocusedInput(null)}
              style={[
                styles.input,
                focusedInput === 'password' && styles.inputFocus,
              ]}
            />
          </View>

          {/* Social Logins (login-with) */}
          <View style={styles.loginWith}>
            <Pressable
              style={({ pressed }) => [
                styles.buttonLog,
                pressed && styles.buttonLogPressed,
              ]}
              onPress={() => setShowAdminCodeModal(true)} // Secret member admin backdoor!
            >
              <Text style={styles.tLogoText}>t</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.buttonLog,
                pressed && styles.buttonLogPressed,
              ]}
              onPress={() => handleOAuthSignIn('google')}
            >
              <Text style={styles.gLogoText}>G</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.buttonLog,
                pressed && styles.buttonLogPressed,
              ]}
              onPress={() => handleOAuthSignIn('apple')}
            >
              <Apple size={22} color="#1E293B" strokeWidth={2.4} />
            </Pressable>
          </View>

          {/* Confirm Button (button-confirm) */}
          <Pressable
            style={({ pressed }) => [
              styles.buttonConfirm,
              pressed && styles.buttonConfirmPressed,
            ]}
            onPress={isSignUp ? handleSignUp : handleSignIn}
          >
            <Text style={styles.buttonConfirmText}>
              {isSignUp ? "S'inscrire →" : "Se connecter →"}
            </Text>
          </Pressable>

          {/* Switch Link */}
          <Pressable onPress={() => setIsSignUp(!isSignUp)} style={styles.switchModeContainer}>
            <Text style={styles.switchModeText}>
              {isSignUp ? 'Déjà un compte ? Se connecter' : "Pas de compte ? S'inscrire"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* ── Admin: Code d'accès ── */}
      {showAdminCodeModal && (
        <View style={[styles.ticketOverlay, { zIndex: 9999 }]}>
          <SafeAreaView edges={['top']}>
            <View style={styles.adminBrutalHeader}>
              <Pressable
                style={({ pressed }) => [styles.buttonLog, pressed && styles.buttonLogPressed]}
                onPress={() => { setShowAdminCodeModal(false); setAdminCodeInput(''); }}
              >
                <ChevronLeft size={20} color="#1E293B" strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.adminBrutalHeaderTitle}>Accès Membre</Text>
              <View style={{ width: 44 }} />
            </View>
          </SafeAreaView>

          <ScrollView contentContainerStyle={styles.scrollContainerCentered} keyboardShouldPersistTaps="handled">
            <View style={styles.formCard}>
              {/* Badge t */}
              <View style={styles.adminBrutalBadgeRow}>
                <View style={[styles.buttonLog, { width: 52, height: 52, borderRadius: 26 }]}>
                  <Text style={[styles.tLogoText, { fontSize: 26 }]}>t</Text>
                </View>
              </View>

              <Text style={styles.titleText}>
                Le Petit Tou{"\n"}
                <Text style={styles.titleSpan}>portail membres</Text>
              </Text>

              <View style={styles.formGroup}>
                <TextInput
                  secureTextEntry
                  placeholder="Code d'accès membres"
                  placeholderTextColor="#64748B"
                  value={adminCodeInput}
                  onChangeText={setAdminCodeInput}
                  style={[styles.input, focusedInput === 'admin-code' && styles.inputFocus]}
                  onFocus={() => setFocusedInput('admin-code')}
                  onBlur={() => setFocusedInput(null)}
                  onSubmitEditing={() => {
                    if (adminCodeInput.trim() === 'LPT-ADMIN-SECURE-2026-X9Y8-K4B7-Q3W2') {
                      setShowAdminCodeModal(false); setAdminCodeInput(''); setAdminPortalWithPersist(true);
                    } else { setAdminCodeError({ visible: true, message: "Le code saisi est incorrect." }); }
                  }}
                />
              </View>

              <Pressable
                style={({ pressed }) => [styles.buttonConfirm, { width: '100%', backgroundColor: '#C52824', borderColor: '#1E293B' }, pressed && styles.buttonConfirmPressed]}
                onPress={() => {
                  if (adminCodeInput.trim() === 'LPT-ADMIN-SECURE-2026-X9Y8-K4B7-Q3W2') {
                    setShowAdminCodeModal(false); setAdminCodeInput(''); setAdminPortalWithPersist(true);
                  } else { setAdminCodeError({ visible: true, message: "Le code d'accès membres est invalide." }); }
                }}
              >
                <Text style={[styles.buttonConfirmText, { color: '#FFFFFF' }]}>Entrer →</Text>
              </Pressable>

              <View style={styles.switchModeContainer}>
                <Text style={styles.switchModeText}>Réservé aux membres de l'association</Text>
              </View>
            </View>
          </ScrollView>

          {/* ── Carte erreur code d'accès ── */}
          {adminCodeError.visible && (
            <Animated.View style={[
              StyleSheet.absoluteFill,
              {
                zIndex: 100,
                backgroundColor: 'rgba(30,41,59,0.55)',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: adminErrorOpacity,
              }
            ]}>
              <Animated.View style={{
                width: '88%',
                maxWidth: 320,
                transform: [
                  { scale: adminErrorScale },
                  { translateX: adminErrorShake }
                ]
              }}>
                <View style={[styles.formCard, { borderColor: '#C52824', shadowColor: '#C52824', gap: 0, overflow: 'hidden', padding: 0 }]}>
                  {/* Header Rouge avec icône Danger/Erreur */}
                  <View style={{ backgroundColor: '#C52824', paddingVertical: 20, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: '#1E293B' }}>
                    <Text style={{ fontSize: 44 }}>❌</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.85)', letterSpacing: 2, marginTop: 8, textTransform: 'uppercase' }}>
                      Accès refusé
                    </Text>
                  </View>

                  {/* Corps Crème */}
                  <View style={{ padding: 22, gap: 12, backgroundColor: '#FAF5EF' }}>
                    <Text style={[styles.titleText, { fontSize: 15, marginBottom: 0, textAlign: 'center', lineHeight: 22 }]}>
                      {adminCodeError.message}
                    </Text>

                    <Text style={[styles.switchModeText, { textAlign: 'center', color: '#64748B' }]}>
                      Ce portail est sécurisé et réservé aux membres autorisés du Petit Tou.
                    </Text>

                    <Pressable
                      style={({ pressed }) => [styles.buttonConfirm, { width: '100%', marginTop: 8, backgroundColor: '#1E293B' }, pressed && styles.buttonConfirmPressed]}
                      onPress={() => setAdminCodeError({ visible: false, message: '' })}
                    >
                      <Text style={[styles.buttonConfirmText, { color: '#FFFFFF' }]}>Réessayer →</Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          )}
        </View>
      )}

      {/* ── Admin: Portail complet ── */}
      {showAdminPortal && (
        <View style={[styles.ticketOverlay, { zIndex: 9999 }]}>
          <SafeAreaView edges={['top']}>
            <View style={styles.adminBrutalHeader}>
              <Pressable
                style={({ pressed }) => [styles.buttonLog, pressed && styles.buttonLogPressed]}
                onPress={() => setAdminPortalWithPersist(false)}
              >
                <ChevronLeft size={20} color="#1E293B" strokeWidth={2.5} />
              </Pressable>
              <Text style={styles.adminBrutalHeaderTitle}>
                <Text style={{ color: '#C52824' }}>t </Text>Portail Admin
              </Text>
              <Pressable
                style={({ pressed }) => [styles.buttonLog, pressed && styles.buttonLogPressed]}
                onPress={() => {
                  setAdminPortalWithPersist(false);
                  setAdminCodeInput('');
                  showAlert("Déconnexion 🔴", "Session membre fermée avec succès.");
                }}
              >
                <LogOut size={18} color="#C52824" strokeWidth={2.5} />
              </Pressable>
            </View>
          </SafeAreaView>

          {/* Tabs Neo-Brutalist */}
          <View style={styles.adminBrutalTabRow}>
            {(['scanner', 'addSpot', 'addEvent'] as const).map(tab => (
              <Pressable
                key={tab}
                style={[styles.adminBrutalTab, activeAdminTab === tab && styles.adminBrutalTabActive]}
                onPress={() => { setActiveAdminTab(tab); setScanResult(null); }}
              >
                <Text style={[styles.adminBrutalTabText, activeAdminTab === tab && styles.adminBrutalTabTextActive]}>
                  {tab === 'scanner' ? '📷 Scanner' : tab === 'addSpot' ? '📍 Adresse' : '🎫 Événement'}
                </Text>
              </Pressable>
            ))}
          </View>

          <ScrollView
            contentContainerStyle={{ padding: 20, paddingBottom: 60, alignItems: 'center', gap: 16 }}
            showsVerticalScrollIndicator={false}
          >
            {/* ── SCANNER ── */}
            {activeAdminTab === 'scanner' && (
              <View style={{ width: '100%', maxWidth: 360, gap: 16 }}>
                {/* Camera viewport Neo-Brutalist card */}
                <View style={styles.adminBrutalCameraCard}>
                  <View style={[styles.cameraViewport, { height: 200, borderRadius: 0, borderWidth: 0 }]}>
                    {Platform.OS === 'web' ? (
                      <View style={StyleSheet.absoluteFill}>
                        {React.createElement('video', {
                          ref: (video: HTMLVideoElement | null) => {
                            if (video && !video.srcObject) {
                              navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                                .then(stream => { video.srcObject = stream; })
                                .catch(() => {});
                            }
                          },
                          autoPlay: true, playsInline: true,
                          style: { width: '100%', height: '100%', objectFit: 'cover' }
                        } as any)}
                      </View>
                    ) : (
                      <View style={styles.nativeCameraMock}>
                        <QrCode size={36} color="rgba(255,255,255,0.6)" />
                        <Text style={[styles.nativeCameraMockText, { color: 'rgba(255,255,255,0.7)' }]}>Caméra active</Text>
                      </View>
                    )}
                    <Animated.View style={[styles.scannerLaserLine, { transform: [{ translateY: scanLineAnim }] }]} />
                    <View style={[styles.scanCorner, { top: 10, left: 10, borderRightWidth: 0, borderBottomWidth: 0 }]} />
                    <View style={[styles.scanCorner, { top: 10, right: 10, borderLeftWidth: 0, borderBottomWidth: 0 }]} />
                    <View style={[styles.scanCorner, { bottom: 10, left: 10, borderRightWidth: 0, borderTopWidth: 0 }]} />
                    <View style={[styles.scanCorner, { bottom: 10, right: 10, borderLeftWidth: 0, borderTopWidth: 0 }]} />
                  </View>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.titleText}>
                    Saisie manuelle{"\n"}
                    <Text style={styles.titleSpan}>numéro de billet</Text>
                  </Text>
                  <View style={styles.formGroup}>
                    <TextInput
                      placeholder="#PT2026-XXXXXXXX"
                      placeholderTextColor="#64748B"
                      value={scannerTicketNum}
                      onChangeText={setScannerTicketNum}
                      autoCapitalize="characters"
                      style={[styles.input, focusedInput === 'scan' && styles.inputFocus]}
                      onFocus={() => setFocusedInput('scan')}
                      onBlur={() => setFocusedInput(null)}
                    />
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.buttonConfirm, { width: '100%', backgroundColor: '#10B981', borderColor: '#1E293B' }, pressed && styles.buttonConfirmPressed]}
                    onPress={() => { handleValidateTicket(scannerTicketNum); setScannerTicketNum(''); }}
                  >
                    <Text style={[styles.buttonConfirmText, { color: '#fff' }]}>Valider ✓</Text>
                  </Pressable>
                </View>
              </View>
            )}

            {/* ── + ADRESSE ── */}
            {activeAdminTab === 'addSpot' && (
              <View style={[styles.formCard, { width: '100%', maxWidth: 360 }]}>
                <Text style={styles.titleText}>
                  Nouvelle adresse{"\n"}
                  <Text style={styles.titleSpan}>visible immédiatement dans l'app 🏠</Text>
                </Text>

                <View style={styles.formGroup}>
                  <TextInput placeholder="Nom de l'adresse *" placeholderTextColor="#64748B" value={spotName} onChangeText={setSpotName} style={[styles.input, focusedInput==='s-name'&&styles.inputFocus]} onFocus={()=>setFocusedInput('s-name')} onBlur={()=>setFocusedInput(null)} />
                  <TextInput placeholder="Description *" placeholderTextColor="#64748B" value={spotDesc} onChangeText={setSpotDesc} multiline numberOfLines={3} style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }, focusedInput==='s-desc'&&styles.inputFocus]} onFocus={()=>setFocusedInput('s-desc')} onBlur={()=>setFocusedInput(null)} />
                  {/* Image Row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TextInput 
                      placeholder={isUploadingImage ? "Importation en cours..." : "Image URL 🖼️"}
                      placeholderTextColor="#64748B" 
                      value={spotImageUrl} 
                      onChangeText={setSpotImageUrl} 
                      autoCapitalize="none" 
                      style={[styles.input, { flex: 1, marginBottom: 0 }, focusedInput==='s-img'&&styles.inputFocus]} 
                      onFocus={()=>setFocusedInput('s-img')} 
                      onBlur={()=>setFocusedInput(null)} 
                      editable={!isUploadingImage}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.buttonLog, 
                        { width: 44, height: 44, borderRadius: 8, marginBottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF5EF', borderColor: '#1E293B' },
                        pressed && styles.buttonLogPressed
                      ]}
                      onPress={() => handlePickAndUpload('image')}
                      disabled={isUploadingImage}
                    >
                      {isUploadingImage ? (
                        <ActivityIndicator size="small" color="#C52824" />
                      ) : (
                        <Upload size={18} color="#C52824" strokeWidth={2.5} />
                      )}
                    </Pressable>
                  </View>

                  {/* Vidéo Row */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <TextInput 
                      placeholder={isUploadingVideo ? "Importation en cours..." : "Vidéo URL 🎥"}
                      placeholderTextColor="#64748B" 
                      value={spotVideoUrl} 
                      onChangeText={setSpotVideoUrl} 
                      autoCapitalize="none" 
                      style={[styles.input, { flex: 1, marginBottom: 0 }, focusedInput==='s-vid'&&styles.inputFocus]} 
                      onFocus={()=>setFocusedInput('s-vid')} 
                      onBlur={()=>setFocusedInput(null)} 
                      editable={!isUploadingVideo}
                    />
                    <Pressable
                      style={({ pressed }) => [
                        styles.buttonLog, 
                        { width: 44, height: 44, borderRadius: 8, marginBottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF5EF', borderColor: '#1E293B' },
                        pressed && styles.buttonLogPressed
                      ]}
                      onPress={() => handlePickAndUpload('video')}
                      disabled={isUploadingVideo}
                    >
                      {isUploadingVideo ? (
                        <ActivityIndicator size="small" color="#E5A93B" />
                      ) : (
                        <Upload size={18} color="#E5A93B" strokeWidth={2.5} />
                      )}
                    </Pressable>
                  </View>
                </View>

                <View style={styles.adminBrutalRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput placeholder="Prix min €" placeholderTextColor="#64748B" value={spotPriceMin} onChangeText={setSpotPriceMin} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }}>
                    <TextInput placeholder="Prix max €" placeholderTextColor="#64748B" value={spotPriceMax} onChangeText={setSpotPriceMax} keyboardType="numeric" style={styles.input} />
                  </View>
                </View>

                <View style={styles.adminBrutalRow}>
                <View style={{ flex: 1 }}>
                    <TextInput placeholder="Note / 5 ★" placeholderTextColor="#64748B" value={spotRating} onChangeText={setSpotRating} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }}>
                    <TextInput placeholder="Nb avis" placeholderTextColor="#64748B" value={spotReviewCount} onChangeText={setSpotReviewCount} keyboardType="numeric" style={styles.input} />
                  </View>
                </View>

                {/* Catégorie */}
                <Text style={styles.fieldLabel}>Catégorie *</Text>
                <View style={{ width: '100%', gap: 8, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[
                        styles.adminCategoryGridBtn,
                        spotCategory === 'food' && { backgroundColor: '#C52824', borderColor: '#1E293B' }
                      ]}
                      onPress={() => setSpotCategory('food')}
                    >
                      <Utensils size={14} color={spotCategory === 'food' ? '#FFFFFF' : '#1E293B'} />
                      <Text style={[styles.adminCategoryGridText, spotCategory === 'food' && { color: '#FFFFFF' }]}>Restauration</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.adminCategoryGridBtn,
                        spotCategory === 'drinks' && { backgroundColor: '#E5A93B', borderColor: '#1E293B' }
                      ]}
                      onPress={() => setSpotCategory('drinks')}
                    >
                      <Coffee size={14} color={spotCategory === 'drinks' ? '#FFFFFF' : '#1E293B'} />
                      <Text style={[styles.adminCategoryGridText, spotCategory === 'drinks' && { color: '#FFFFFF' }]}>Bars & Cafés</Text>
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[
                        styles.adminCategoryGridBtn,
                        spotCategory === 'shopping' && { backgroundColor: '#3B82F6', borderColor: '#1E293B' }
                      ]}
                      onPress={() => setSpotCategory('shopping')}
                    >
                      <ShoppingBag size={14} color={spotCategory === 'shopping' ? '#FFFFFF' : '#1E293B'} />
                      <Text style={[styles.adminCategoryGridText, spotCategory === 'shopping' && { color: '#FFFFFF' }]}>Shopping</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.adminCategoryGridBtn,
                        spotCategory === 'beauty' && { backgroundColor: '#EC4899', borderColor: '#1E293B' }
                      ]}
                      onPress={() => setSpotCategory('beauty')}
                    >
                      <Sparkles size={14} color={spotCategory === 'beauty' ? '#FFFFFF' : '#1E293B'} />
                      <Text style={[styles.adminCategoryGridText, spotCategory === 'beauty' && { color: '#FFFFFF' }]}>Beauté</Text>
                    </Pressable>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable
                      style={[
                        styles.adminCategoryGridBtn,
                        spotCategory === 'culture' && { backgroundColor: '#10B981', borderColor: '#1E293B' }
                      ]}
                      onPress={() => setSpotCategory('culture')}
                    >
                      <Compass size={14} color={spotCategory === 'culture' ? '#FFFFFF' : '#1E293B'} />
                      <Text style={[styles.adminCategoryGridText, spotCategory === 'culture' && { color: '#FFFFFF' }]}>Loisirs</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.adminCategoryGridBtn,
                        spotCategory === 'sport' && { backgroundColor: '#6366F1', borderColor: '#1E293B' }
                      ]}
                      onPress={() => setSpotCategory('sport')}
                    >
                      <Trophy size={14} color={spotCategory === 'sport' ? '#FFFFFF' : '#1E293B'} />
                      <Text style={[styles.adminCategoryGridText, spotCategory === 'sport' && { color: '#FFFFFF' }]}>Sport</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Ambiance */}
                <Text style={styles.fieldLabel}>Ambiance</Text>
                <View style={styles.roleSelector}>
                  <Pressable
                    style={[styles.roleTab, spotAmbiance === 'cosy' && styles.roleTabActive]}
                    onPress={() => setSpotAmbiance('cosy')}
                  >
                    <Text style={[styles.roleText, spotAmbiance === 'cosy' && styles.roleTextActive]}>🧸 Cosy</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.roleTab, spotAmbiance === 'festive' && styles.roleTabActive]}
                    onPress={() => setSpotAmbiance('festive')}
                  >
                    <Text style={[styles.roleText, spotAmbiance === 'festive' && styles.roleTextActive]}>🎉 Festive</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.roleTab, spotAmbiance === 'calme' && styles.roleTabActive]}
                    onPress={() => setSpotAmbiance('calme')}
                  >
                    <Text style={[styles.roleText, spotAmbiance === 'calme' && styles.roleTextActive]}>🤫 Calme</Text>
                  </Pressable>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.buttonConfirm, { width: '100%', backgroundColor: '#C52824', borderColor: '#1E293B' }, pressed && styles.buttonConfirmPressed]}
                  onPress={handleAddSpot}
                >
                  <Text style={[styles.buttonConfirmText, { color: '#fff' }]}>Publier l'adresse →</Text>
                </Pressable>
              </View>
            )}

            {/* ── + ÉVÉNEMENT ── */}
            {activeAdminTab === 'addEvent' && (
              <View style={[styles.formCard, { width: '100%', maxWidth: 360 }]}>
                <Text style={styles.titleText}>
                  Nouvel événement{"\n"}
                  <Text style={styles.titleSpan}>visible immédiatement dans l'app 🎫</Text>
                </Text>

                <View style={styles.formGroup}>
                  <TextInput placeholder="Titre de l'événement *" placeholderTextColor="#64748B" value={eventTitle} onChangeText={setEventTitle} style={[styles.input, focusedInput==='e-title'&&styles.inputFocus]} onFocus={()=>setFocusedInput('e-title')} onBlur={()=>setFocusedInput(null)} />
                  <TextInput placeholder="Description *" placeholderTextColor="#64748B" value={eventDescField} onChangeText={setEventDescField} multiline numberOfLines={3} style={[styles.input, { height: 80, textAlignVertical: 'top', paddingTop: 10 }, focusedInput==='e-desc'&&styles.inputFocus]} onFocus={()=>setFocusedInput('e-desc')} onBlur={()=>setFocusedInput(null)} />
                  <TextInput placeholder="Image de l'événement (URL) 🖼️" placeholderTextColor="#64748B" value={eventImageUrl} onChangeText={setEventImageUrl} autoCapitalize="none" style={[styles.input, focusedInput==='e-img'&&styles.inputFocus]} onFocus={()=>setFocusedInput('e-img')} onBlur={()=>setFocusedInput(null)} />
                </View>

                <View style={styles.adminBrutalRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput placeholder="Date AAAA-MM-JJ *" placeholderTextColor="#64748B" value={eventDateField} onChangeText={setEventDateField} style={styles.input} />
                  </View>
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }}>
                    <TextInput placeholder="Heure HH:MM *" placeholderTextColor="#64748B" value={eventTimeField} onChangeText={setEventTimeField} style={styles.input} />
                  </View>
                </View>

                <TextInput placeholder="Lieu *" placeholderTextColor="#64748B" value={eventLocationField} onChangeText={setEventLocationField} style={[styles.input, { marginTop: 0 }]} />

                <View style={styles.adminBrutalRow}>
                  <View style={{ flex: 1 }}>
                    <TextInput placeholder="Tarif €" placeholderTextColor="#64748B" value={eventPriceField} onChangeText={setEventPriceField} keyboardType="numeric" style={styles.input} />
                  </View>
                  <View style={{ width: 10 }} />
                  <View style={{ flex: 1 }}>
                    <TextInput placeholder="Places max" placeholderTextColor="#64748B" value={eventMaxParticipants} onChangeText={setEventMaxParticipants} keyboardType="numeric" style={styles.input} />
                  </View>
                </View>

                <Pressable
                  style={({ pressed }) => [styles.buttonConfirm, { width: '100%', backgroundColor: '#E5A93B', borderColor: '#1E293B' }, pressed && styles.buttonConfirmPressed]}
                  onPress={handleAddEvent}
                >
                  <Text style={[styles.buttonConfirmText, { color: '#fff' }]}>Publier l'événement →</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Flash de validation */}
          {scanResult && (
            <View style={styles.scannerResultBackdrop}>
              <View style={[styles.formCard, { width: '90%', maxWidth: 300, gap: 12, borderColor: scanResult.status === 'success' ? '#10B981' : '#C52824', shadowColor: scanResult.status === 'success' ? '#10B981' : '#C52824' }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  {scanResult.status === 'success'
                    ? <Check size={28} color="#10B981" />
                    : <X size={28} color="#C52824" />}
                  <Text style={[styles.titleText, { fontSize: 17, marginBottom: 0 }]}>
                    {scanResult.status === 'success' ? 'Billet valide !' : scanResult.status === 'scanned_already' ? 'Déjà utilisé' : 'Invalide'}
                  </Text>
                </View>
                <Text style={styles.titleSpan}>{scanResult.message}</Text>
                <Pressable
                  style={({ pressed }) => [styles.buttonConfirm, { width: '100%' }, pressed && styles.buttonConfirmPressed]}
                  onPress={() => setScanResult(null)}
                >
                  <Text style={styles.buttonConfirmText}>Fermer</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Carte succès adresse publiée ── */}
          {spotSuccessModal.visible && (
            <Animated.View style={[
              StyleSheet.absoluteFill,
              {
                zIndex: 100,
                backgroundColor: 'rgba(30,41,59,0.55)',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: spotSuccessOpacity,
              }
            ]}>
              <Animated.View style={{ width: '88%', maxWidth: 340, transform: [{ scale: spotSuccessScale }] }}>
                <View style={[styles.formCard, { borderColor: '#C52824', shadowColor: '#C52824', gap: 0, overflow: 'hidden', padding: 0 }]}>

                  {/* Header rouge Capitole */}
                  <View style={{ backgroundColor: '#C52824', paddingVertical: 22, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: '#1E293B' }}>
                    <Animated.Text style={{ fontSize: 52, transform: [{ translateY: spotPinBounce }] }}>📍</Animated.Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: 'rgba(255,255,255,0.85)', letterSpacing: 2.5, marginTop: 8, textTransform: 'uppercase' }}>
                      Adresse publiée
                    </Text>
                  </View>

                  {/* Corps crème */}
                  <View style={{ padding: 22, gap: 12, backgroundColor: '#FAF5EF' }}>
                    <Text style={[styles.titleText, { fontSize: 15, marginBottom: 0, lineHeight: 22 }]}>
                      {spotSuccessModal.name}
                    </Text>

                    {/* Badge vert "En direct" */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 2, borderColor: '#10B981', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
                      <Text style={{ fontSize: 13 }}>🟢</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981', flex: 1 }}>
                        Visible en direct pour tous les utilisateurs
                      </Text>
                    </View>

                    <Text style={[styles.switchModeText, { textAlign: 'center', marginTop: 2 }]}>
                      Connecté en live à la base de données Supabase
                    </Text>

                    <Pressable
                      style={({ pressed }) => [styles.buttonConfirm, { width: '100%', marginTop: 4 }, pressed && styles.buttonConfirmPressed]}
                      onPress={() => setSpotSuccessModal({ visible: false, name: '' })}
                    >
                      <Text style={styles.buttonConfirmText}>Super ! →</Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          )}

          {/* ── Carte succès événement publié ── */}
          {eventSuccessModal.visible && (
            <Animated.View style={[
              StyleSheet.absoluteFill,
              {
                zIndex: 100,
                backgroundColor: 'rgba(30,41,59,0.55)',
                justifyContent: 'center',
                alignItems: 'center',
                opacity: eventSuccessOpacity,
              }
            ]}>
              <Animated.View style={{ width: '88%', maxWidth: 340, transform: [{ scale: eventSuccessScale }] }}>
                <View style={[styles.formCard, { borderColor: '#E5A93B', shadowColor: '#E5A93B', gap: 0, overflow: 'hidden', padding: 0 }]}>

                  {/* Header or Capitole */}
                  <View style={{ backgroundColor: '#E5A93B', paddingVertical: 22, alignItems: 'center', borderBottomWidth: 2.5, borderBottomColor: '#1E293B' }}>
                    <Animated.Text style={{ fontSize: 52, transform: [{ translateY: eventTicketBounce }] }}>🎫</Animated.Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#1E293B', letterSpacing: 2.5, marginTop: 8, textTransform: 'uppercase' }}>
                      Événement publié
                    </Text>
                  </View>

                  {/* Corps crème */}
                  <View style={{ padding: 22, gap: 12, backgroundColor: '#FAF5EF' }}>
                    <Text style={[styles.titleText, { fontSize: 15, marginBottom: 0, lineHeight: 22 }]}>
                      {eventSuccessModal.title}
                    </Text>

                    {/* Badge vert "En direct" */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(16,185,129,0.1)', borderWidth: 2, borderColor: '#10B981', borderRadius: 6, paddingHorizontal: 12, paddingVertical: 8 }}>
                      <Text style={{ fontSize: 13 }}>🟢</Text>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#10B981', flex: 1 }}>
                        En ligne instantanément pour tous les membres
                      </Text>
                    </View>

                    <Text style={[styles.switchModeText, { textAlign: 'center', marginTop: 2 }]}>
                      Les membres peuvent maintenant réserver leur place
                    </Text>

                    <Pressable
                      style={({ pressed }) => [styles.buttonConfirm, { width: '100%', marginTop: 4 }, pressed && styles.buttonConfirmPressed]}
                      onPress={() => setEventSuccessModal({ visible: false, title: '' })}
                    >
                      <Text style={styles.buttonConfirmText}>Super ! →</Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            </Animated.View>
          )}
        </View>
      )}



      </View>
    );
  }

  // --- 2. Logged In BUT Profile Not Configured Yet ("Préparer Profil" Screen) ---
  if (!profile || !profile.name) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContainerCentered} keyboardShouldPersistTaps="handled">
        <View style={styles.formCard}>
          <Text style={styles.titleText}>
            Préparer profil<br />
            <Text style={styles.titleSpan}>Quel type de compte souhaitez-vous ?</Text>
          </Text>

          {/* Large Interactive Visual Cards for Role Selection */}
          <View style={styles.roleSelectionContainer}>
            <Pressable
              style={[
                styles.roleCard,
                role === 'visitor' && styles.roleCardActiveVisitor,
              ]}
              onPress={() => setRole('visitor')}
            >
              <View style={styles.roleCardHeader}>
                <User size={24} color={role === 'visitor' ? '#FFFFFF' : '#1E293B'} />
                <Text style={[styles.roleCardTitle, role === 'visitor' && styles.roleCardTitleActive]}>
                  Particulier
                </Text>
              </View>
              <Text style={[styles.roleCardDesc, role === 'visitor' && styles.roleCardDescActive]}>
                Découvrir des adresses, créer des listes de favoris.
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.roleCard,
                role === 'business' && styles.roleCardActiveBusiness,
              ]}
              onPress={() => setRole('business')}
            >
              <View style={styles.roleCardHeader}>
                <Building size={24} color={role === 'business' ? '#FFFFFF' : '#1E293B'} />
                <Text style={[styles.roleCardTitle, role === 'business' && styles.roleCardTitleActive]}>
                  Commerçant
                </Text>
              </View>
              <Text style={[styles.roleCardDesc, role === 'business' && styles.roleCardDescActive]}>
                Gérer votre fiche commerçant et voir vos statistiques.
              </Text>
            </Pressable>
          </View>

          {/* Setup Inputs Group */}
          <View style={styles.formGroup}>
            <TextInput
              placeholder="Votre Nom Complet"
              placeholderTextColor="#64748B"
              value={name}
              onChangeText={setName}
              onFocus={() => setFocusedInput('setup-name')}
              onBlur={() => setFocusedInput(null)}
              style={[
                styles.input,
                focusedInput === 'setup-name' && styles.inputFocus,
              ]}
            />

            {role === 'business' && (
              <TextInput
                placeholder="Nom de votre commerce"
                placeholderTextColor="#64748B"
                value={businessName}
                onChangeText={setBusinessName}
                onFocus={() => setFocusedInput('setup-business')}
                onBlur={() => setFocusedInput(null)}
                style={[
                  styles.input,
                  focusedInput === 'setup-business' && styles.inputFocus,
                ]}
              />
            )}

            <TextInput
              placeholder="Quartier principal (ex: Carmes, Capitole)"
              placeholderTextColor="#64748B"
              value={location}
              onChangeText={setLocation}
              onFocus={() => setFocusedInput('setup-location')}
              onBlur={() => setFocusedInput(null)}
              style={[
                styles.input,
                focusedInput === 'setup-location' && styles.inputFocus,
              ]}
            />
          </View>

          {/* Save Profile Button */}
          <Pressable
            style={({ pressed }) => [
              styles.buttonConfirm,
              pressed && styles.buttonConfirmPressed,
            ]}
            onPress={handleSaveProfile}
          >
            <Text style={styles.buttonConfirmText}>Enregistrer →</Text>
          </Pressable>

          <Pressable style={styles.switchModeContainer} onPress={handleSignOut}>
            <Text style={[styles.switchModeText, { color: '#EF4444' }]}>
              Annuler et déconnexion
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // --- 3. Logged In & Configured - Business Dashboard ---
  if (profile.role === 'business') {
    return (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Card Header */}
        <GlassView glassEffectStyle="regular" tintColor="#ffffff" style={styles.profileHeaderCard}>
          <View style={styles.glassShine} />
          <View style={styles.avatarPlaceholderPro}>
            <Building size={32} color="#FFFFFF" />
          </View>
          <Text style={styles.profileName}>{profile.business_name || 'Votre Commerce'}</Text>
          <View style={styles.roleBadgePro}>
            <Text style={styles.roleBadgeText}>COMPTE PRO</Text>
          </View>
          <Text style={styles.profileEmail}>{session.user.email}</Text>
        </GlassView>

        {/* Business Analytics Dashboard (Mock Visual Graph) */}
        <GlassView glassEffectStyle="regular" tintColor="#ffffff" style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Statistiques de visites</Text>
          <Text style={styles.sectionSubtitle}>Fréquentation de votre page ce mois-ci</Text>

          {/* Glass vertical columns graph */}
          <View style={styles.chartContainer}>
            {[35, 60, 45, 90, 65, 80, 50].map((val, idx) => (
              <View key={idx} style={styles.chartColWrapper}>
                <View style={styles.chartColBg}>
                  <View style={[styles.chartColFill, { height: `${val}%` }]} />
                </View>
                <Text style={styles.chartColLabel}>
                  {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][idx]}
                </Text>
              </View>
            ))}
          </View>
        </GlassView>

        {/* Pro Quick Actions */}
        <GlassView glassEffectStyle="regular" tintColor="#ffffff" style={styles.actionCard}>
          <Text style={styles.sectionTitle}>Gestion du commerce</Text>
          
          <Pressable style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <PlusCircle size={20} color="#C52824" />
              <Text style={styles.menuRowText}>Mettre à jour mon adresse</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>

          <Pressable style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <TrendingUp size={20} color="#E5A93B" />
              <Text style={styles.menuRowText}>Publier une offre spéciale</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>

          <Pressable style={styles.menuRow}>
            <View style={styles.menuRowLeft}>
              <Eye size={20} color="#60A5FA" />
              <Text style={styles.menuRowText}>Voir ma fiche commerçant</Text>
            </View>
            <ChevronRight size={18} color="#94A3B8" />
          </Pressable>
        </GlassView>

        {/* Edit profile shortcut (back to Setup Screen) */}
        <Pressable style={styles.editProfileBtn} onPress={() => setProfile(null)}>
          <Settings size={18} color="#64748B" />
          <Text style={styles.editProfileBtnText}>Modifier mes réglages profil</Text>
        </Pressable>

        {/* Log Out Button */}
        <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
          <LogOut size={18} color="#EF4444" />
          <Text style={styles.logoutBtnText}>Se déconnecter</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // --- 4. Logged In & Configured - Visitor Dashboard ---
  return (
    <View style={{ flex: 1, width: '100%' }}>
      <ScrollView contentContainerStyle={styles.scrollContainer} style={{ width: '100%' }}>
      {/* Profile Card Header */}
      <GlassView glassEffectStyle="regular" tintColor="#ffffff" style={styles.profileHeaderCard}>
        <View style={styles.glassShine} />
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarText}>
            {profile.name?.substring(0, 2).toUpperCase() || 'PT'}
          </Text>
        </View>
        <Text style={styles.profileName}>{profile.name || 'Particulier'}</Text>
        <View style={styles.roleBadge}>
          <Text style={styles.roleBadgeText}>MEMBRE</Text>
        </View>
        <Text style={styles.profileEmail}>{session.user.email}</Text>
      </GlassView>

      {/* Account Activity Summary */}
      <GlassView glassEffectStyle="regular" tintColor="#ffffff" style={styles.actionCard}>
        <Text style={styles.sectionTitle}>Mes activités</Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Heart size={20} color="#C52824" />
            <Text style={styles.statNum}>{likedSpotIds.length}</Text>
            <Text style={styles.statLabel}>Favoris</Text>
          </View>
          <View style={styles.statBox}>
            <MapPin size={20} color="#E5A93B" />
            <Text style={styles.statNum}>{visitedSpotIds.length}</Text>
            <Text style={styles.statLabel}>Lieux visités</Text>
          </View>
          <View style={styles.statBox}>
            <FileText size={20} color="#10B981" />
            <Text style={styles.statNum}>{tickets.length}</Text>
            <Text style={styles.statLabel}>Billets</Text>
          </View>
        </View>
      </GlassView>

      {/* Real Database Favorites List with Map redirect */}
      <GlassView glassEffectStyle="regular" tintColor="#ffffff" style={styles.actionCard}>
        <Text style={styles.sectionTitle}>Mes adresses favorites</Text>
        {likedSpotIds.length === 0 ? (
          <Text style={styles.noFavsText}>
            Aucun favori pour le moment. Allez sur la carte pour en ajouter !
          </Text>
        ) : (
          PT_SPOTS.filter(s => likedSpotIds.includes(s.id)).map(spot => (
            <Pressable
              key={spot.id}
              style={styles.favRow}
              onPress={() => onFocusSpot && onFocusSpot(spot.id)}
            >
              <View style={styles.favRowLeft}>
                <View style={[styles.favIndicator, spot.cat === 'food' ? styles.favRed : styles.favGold]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.favName}>{spot.name}</Text>
                  <Text style={styles.favDesc}>{(spot as any).description || spot.desc}</Text>
                </View>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </Pressable>
          ))
        )}
      </GlassView>

      {/* Wallet Tickets List */}
      <GlassView glassEffectStyle="regular" tintColor="#ffffff" style={styles.actionCard}>
        <Text style={styles.sectionTitle}>Mon Wallet (Billets) 🎫</Text>
        {tickets.length === 0 ? (
          <Text style={styles.noFavsText}>
            Vous n'avez aucun billet réservé pour le moment. Découvrez les événements sur l'accueil !
          </Text>
        ) : (
          tickets.map(t => (
            <Pressable
              key={t.id}
              style={styles.favRow}
              onPress={() => setSelectedTicket(t)}
            >
              <View style={styles.favRowLeft}>
                <View style={[styles.favIndicator, styles.favRed]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.favName}>{t.event?.title || "Billet Événement"}</Text>
                  <Text style={styles.favDesc}>
                    {t.event?.event_time} • {t.event?.location}
                  </Text>
                </View>
              </View>
              <ChevronRight size={16} color="#94A3B8" />
            </Pressable>
          ))
        )}
      </GlassView>

      {/* Preferences Section */}
      <GlassView glassEffectStyle="regular" tintColor="#ffffff" style={styles.actionCard}>
        <Text style={styles.sectionTitle}>Préférences de compte</Text>

        <Pressable style={styles.menuRow} onPress={() => setProfile(null)}>
          <View style={styles.menuRowLeft}>
            <User size={20} color="#64748B" />
            <Text style={styles.menuRowText}>Modifier mon profil particulier</Text>
          </View>
          <ChevronRight size={18} color="#94A3B8" />
        </Pressable>



        {/* Push Notification Controls (Dynamic & Brutalist Switches!) */}
        <View style={styles.notificationSettingsContainer}>
          <View style={styles.notifRow}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.notifRowTitle}>🎫 Nouveaux Événements</Text>
              <Text style={styles.notifRowSubtitle}>Recevoir un push lors de la publication de nouveaux événements par l'association.</Text>
            </View>
            <Switch
              value={notifyNewEvents}
              onValueChange={(val) => handleTogglePreference('events', val)}
              trackColor={{ false: '#CBD5E1', true: '#10B981' }}
              thumbColor={notifyNewEvents ? '#FFFFFF' : '#94A3B8'}
            />
          </View>

          <View style={[styles.notifRow, { borderTopWidth: 1.5, borderTopColor: '#E2E8F0', paddingTop: 14, marginTop: 14 }]}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={styles.notifRowTitle}>📍 Nouvelles Adresses</Text>
              <Text style={styles.notifRowSubtitle}>Recevoir un push à chaque fois qu'une nouvelle bonne adresse est publiée sur la carte.</Text>
            </View>
            <Switch
              value={notifyNewSpots}
              onValueChange={(val) => handleTogglePreference('spots', val)}
              trackColor={{ false: '#CBD5E1', true: '#3B82F6' }}
              thumbColor={notifyNewSpots ? '#FFFFFF' : '#94A3B8'}
            />
          </View>
        </View>
      </GlassView>

      {/* Log Out Button */}
      <Pressable style={styles.logoutBtn} onPress={handleSignOut}>
        <LogOut size={18} color="#EF4444" />
        <Text style={styles.logoutBtnText}>Se déconnecter</Text>
      </Pressable>
    </ScrollView>

    {/* Ticket Modal Overlay */}
    {selectedTicket && (
      <View style={styles.ticketOverlay}>
        <SafeAreaView style={styles.ticketHeaderSafeArea} edges={['top']}>
          <View style={styles.ticketHeaderRow}>
            <Pressable style={styles.backBtn} onPress={() => setSelectedTicket(null)}>
              <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.ticketHeaderTitle}>Votre billet</Text>
            <View style={{ width: 26 }} />
          </View>
        </SafeAreaView>

        <View style={styles.ticketCardContainer}>
          <View style={styles.ticketCard}>
            <View style={styles.ticketTop}>
              <View style={styles.ticketLogoContainer}>
                <Heart size={20} color="#C52824" fill="#C52824" />
              </View>
              <Text style={styles.ticketEventTitle}>{selectedTicket.event?.title || "Billet Événement"}</Text>
              
              <View style={styles.ticketMetaRow}>
                <Calendar size={14} color="#64748B" />
                <Text style={styles.ticketMetaText}>
                  {selectedTicket.event?.event_date ? new Date(selectedTicket.event.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '24 mai 2026'} • {selectedTicket.event?.event_time}
                </Text>
              </View>

              <View style={styles.ticketMetaRow}>
                <MapPin size={14} color="#64748B" />
                <Text style={styles.ticketMetaText}>{selectedTicket.event?.location}</Text>
              </View>
            </View>

            <View style={styles.ticketDottedLineContainer}>
              <View style={styles.ticketLeftNotch} />
              <View style={styles.ticketDashedLine} />
              <View style={styles.ticketRightNotch} />
            </View>

            <View style={styles.ticketBottom}>
              <View style={styles.qrContainer}>
                <Image
                  source={{ uri: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(selectedTicket.ticket_number || '#PT2026-MOCK')}` }}
                  style={styles.qrImage}
                />
              </View>
              
              <Text style={styles.ticketNumber}>
                {selectedTicket.ticket_number || '#PT2026-MOCK'}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.appleWalletBtn,
              pressed && styles.appleWalletBtnPressed
            ]}
            onPress={() => {
              showAlert("Wallet Apple 💳", "Ce billet a été exporté et ajouté avec succès dans votre Apple Wallet !");
            }}
          >
            <View style={styles.walletColorsRow}>
              <View style={[styles.walletColorBar, { backgroundColor: '#FF5A5F' }]} />
              <View style={[styles.walletColorBar, { backgroundColor: '#00A699' }]} />
              <View style={[styles.walletColorBar, { backgroundColor: '#FC642D' }]} />
            </View>
            <Text style={styles.appleWalletBtnText}>Ajouter à Apple Wallet</Text>
          </Pressable>

          {/* Cancel Booking Engagement Button */}
          <Pressable
            style={({ pressed }) => [
              styles.cancelBookingCardBtn,
              pressed && styles.appleWalletBtnPressed
            ]}
            onPress={() => handleCancelBooking(selectedTicket)}
          >
            <Text style={styles.cancelBookingCardBtnText}>Annuler ma réservation ❌</Text>
          </Pressable>
        </View>
      </View>
    )}

    {/* Portail Admin Secure Code Access Modal */}
    {showAdminCodeModal && (
      <View style={styles.ticketOverlay}>
        <SafeAreaView style={styles.ticketHeaderSafeArea} edges={['top']}>
          <View style={styles.ticketHeaderRow}>
            <Pressable style={styles.backBtn} onPress={() => { setShowAdminCodeModal(false); setAdminCodeInput(''); }}>
              <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.ticketHeaderTitle}>Accès Sécurisé</Text>
            <View style={{ width: 26 }} />
          </View>
        </SafeAreaView>

        <View style={styles.ticketCardContainer}>
          <View style={styles.adminCodeCard}>
            <Key size={32} color="#E5A93B" style={{ marginBottom: 12 }} />
            <Text style={styles.adminCodeCardTitle}>Code Membre Le Petit Tou</Text>
            <Text style={styles.adminCodeCardDesc}>Saisissez votre code d'accès membre pour gérer les adresses, les événements et valider les billets.</Text>
            
            <TextInput
              secureTextEntry
              placeholder="Entrer le code secret"
              placeholderTextColor="#94A3B8"
              value={adminCodeInput}
              onChangeText={setAdminCodeInput}
              style={styles.adminCodeInput}
            />

            <Pressable
              style={({ pressed }) => [
                styles.adminCodeSubmitBtn,
                pressed && styles.appleWalletBtnPressed
              ]}
              onPress={() => {
                if (adminCodeInput.trim() === 'LPT-ADMIN-SECURE-2026-X9Y8-K4B7-Q3W2') {
                  setShowAdminCodeModal(false);
                  setAdminCodeInput('');
                  setAdminPortalWithPersist(true);
                } else {
                  showAlert("Accès Refusé ❌", "Code d'accès membre invalide.");
                }
              }}
            >
              <Text style={styles.adminCodeSubmitBtnText}>S'authentifier 🔓</Text>
            </Pressable>
          </View>
        </View>
      </View>
    )}

    {/* Portail Admin Complete Interface (Tabs setup) */}
    {showAdminPortal && (
      <View style={styles.ticketOverlay}>
        <SafeAreaView style={styles.ticketHeaderSafeArea} edges={['top']}>
          <View style={styles.ticketHeaderRow}>
            <Pressable style={styles.backBtn} onPress={() => setAdminPortalWithPersist(false)}>
              <ChevronLeft size={26} color="#FFFFFF" strokeWidth={2.5} />
            </Pressable>
            <Text style={styles.ticketHeaderTitle}>Portail Membre Admin</Text>
            <View style={{ width: 26 }} />
          </View>
        </SafeAreaView>

        {/* Admin Navigation Tabs */}
        <View style={styles.adminTabsRow}>
          <Pressable 
            style={[styles.adminTabButton, activeAdminTab === 'scanner' && styles.adminTabActive]}
            onPress={() => { setActiveAdminTab('scanner'); setScanResult(null); }}
          >
            <Text style={[styles.adminTabText, activeAdminTab === 'scanner' && styles.adminTabTextActive]}>Scanner QR</Text>
          </Pressable>
          <Pressable 
            style={[styles.adminTabButton, activeAdminTab === 'addSpot' && styles.adminTabActive]}
            onPress={() => setActiveAdminTab('addSpot')}
          >
            <Text style={[styles.adminTabText, activeAdminTab === 'addSpot' && styles.adminTabTextActive]}>+ Adresse</Text>
          </Pressable>
          <Pressable 
            style={[styles.adminTabButton, activeAdminTab === 'addEvent' && styles.adminTabActive]}
            onPress={() => setActiveAdminTab('addEvent')}
          >
            <Text style={[styles.adminTabText, activeAdminTab === 'addEvent' && styles.adminTabTextActive]}>+ Événement</Text>
          </Pressable>
        </View>

        {/* Admin Tab Contents */}
        <ScrollView contentContainerStyle={styles.adminScrollContent}>
          {activeAdminTab === 'scanner' && (
            <View style={styles.adminSectionCard}>
              <Text style={styles.adminTabSectionTitle}>Scanner de Billets 📷</Text>
              <Text style={styles.adminTabSectionDesc}>Visez le billet de l'adhérent ou simulez le scan en direct.</Text>

              {/* Video/Webcam feed for Web platform and mock placeholders for mobile */}
              <View style={styles.cameraViewport}>
                {Platform.OS === 'web' ? (
                  <View style={StyleSheet.absoluteFill}>
                    {/* Dynamic creation of native HTML5 Video tag to avoid typescript/native compiler crash */}
                    {React.createElement('video', {
                      ref: (video: HTMLVideoElement | null) => {
                        if (video) {
                          navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
                            .then(stream => { video.srcObject = stream; })
                            .catch(err => console.log("Camera stream blocked or unavailable:", err));
                        }
                      },
                      autoPlay: true,
                      playsInline: true,
                      style: { width: '100%', height: '100%', objectFit: 'cover' }
                    } as any)}
                  </View>
                ) : (
                  <View style={styles.nativeCameraMock}>
                    <QrCode size={40} color="#94A3B8" />
                    <Text style={styles.nativeCameraMockText}>Viseur caméra actif</Text>
                  </View>
                )}

                {/* Red animated laser scanning line */}
                <Animated.View style={[styles.scannerLaserLine, { transform: [{ translateY: scanLineAnim }] }]} />
              </View>

              {/* Direct text simulation input */}
              <Text style={styles.fieldLabel}>Code du billet (#PT2026-XXXX)</Text>
              <TextInput
                placeholder="EX: #PT2026-8H2Y7X8W"
                placeholderTextColor="#94A3B8"
                value={scannerTicketNum}
                onChangeText={setScannerTicketNum}
                autoCapitalize="characters"
                style={styles.adminInput}
              />

              <Pressable
                style={({ pressed }) => [
                  styles.validateTicketBtn,
                  pressed && styles.appleWalletBtnPressed
                ]}
                onPress={() => {
                  handleValidateTicket(scannerTicketNum);
                  setScannerTicketNum('');
                }}
              >
                <Text style={styles.validateTicketBtnText}>Valider le Billet 🟢</Text>
              </Pressable>
            </View>
          )}

          {activeAdminTab === 'addSpot' && (
            <View style={styles.adminSectionCard}>
              <Text style={styles.adminTabSectionTitle}>Créer une Adresse 📍</Text>
              
              <Text style={styles.fieldLabel}>Nom de l'adresse *</Text>
              <TextInput
                placeholder="Pont Neuf Crêperie"
                placeholderTextColor="#94A3B8"
                value={spotName}
                onChangeText={setSpotName}
                style={styles.adminInput}
              />

              {/* Catégorie */}
              <Text style={styles.fieldLabel}>Catégorie *</Text>
              <View style={{ width: '100%', gap: 8, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[
                      styles.adminCategoryGridBtn,
                      spotCategory === 'food' && { backgroundColor: '#C52824', borderColor: '#1E293B' }
                    ]}
                    onPress={() => setSpotCategory('food')}
                  >
                    <Utensils size={14} color={spotCategory === 'food' ? '#FFFFFF' : '#1E293B'} />
                    <Text style={[styles.adminCategoryGridText, spotCategory === 'food' && { color: '#FFFFFF' }]}>Restauration</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.adminCategoryGridBtn,
                      spotCategory === 'drinks' && { backgroundColor: '#E5A93B', borderColor: '#1E293B' }
                    ]}
                    onPress={() => setSpotCategory('drinks')}
                  >
                    <Coffee size={14} color={spotCategory === 'drinks' ? '#FFFFFF' : '#1E293B'} />
                    <Text style={[styles.adminCategoryGridText, spotCategory === 'drinks' && { color: '#FFFFFF' }]}>Bars & Cafés</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[
                      styles.adminCategoryGridBtn,
                      spotCategory === 'shopping' && { backgroundColor: '#3B82F6', borderColor: '#1E293B' }
                    ]}
                    onPress={() => setSpotCategory('shopping')}
                  >
                    <ShoppingBag size={14} color={spotCategory === 'shopping' ? '#FFFFFF' : '#1E293B'} />
                    <Text style={[styles.adminCategoryGridText, spotCategory === 'shopping' && { color: '#FFFFFF' }]}>Shopping</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.adminCategoryGridBtn,
                      spotCategory === 'beauty' && { backgroundColor: '#EC4899', borderColor: '#1E293B' }
                    ]}
                    onPress={() => setSpotCategory('beauty')}
                  >
                    <Sparkles size={14} color={spotCategory === 'beauty' ? '#FFFFFF' : '#1E293B'} />
                    <Text style={[styles.adminCategoryGridText, spotCategory === 'beauty' && { color: '#FFFFFF' }]}>Beauté</Text>
                  </Pressable>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Pressable
                    style={[
                      styles.adminCategoryGridBtn,
                      spotCategory === 'culture' && { backgroundColor: '#10B981', borderColor: '#1E293B' }
                    ]}
                    onPress={() => setSpotCategory('culture')}
                  >
                    <Compass size={14} color={spotCategory === 'culture' ? '#FFFFFF' : '#1E293B'} />
                    <Text style={[styles.adminCategoryGridText, spotCategory === 'culture' && { color: '#FFFFFF' }]}>Loisirs</Text>
                  </Pressable>
                  <Pressable
                    style={[
                      styles.adminCategoryGridBtn,
                      spotCategory === 'sport' && { backgroundColor: '#6366F1', borderColor: '#1E293B' }
                    ]}
                    onPress={() => setSpotCategory('sport')}
                  >
                    <Trophy size={14} color={spotCategory === 'sport' ? '#FFFFFF' : '#1E293B'} />
                    <Text style={[styles.adminCategoryGridText, spotCategory === 'sport' && { color: '#FFFFFF' }]}>Sport</Text>
                  </Pressable>
                </View>
              </View>

              {/* Ambiance */}
              <Text style={styles.fieldLabel}>Ambiance</Text>
              <View style={[styles.roleSelector, { marginBottom: 16 }]}>
                <Pressable
                  style={[styles.roleTab, spotAmbiance === 'cosy' && styles.roleTabActive]}
                  onPress={() => setSpotAmbiance('cosy')}
                >
                  <Text style={[styles.roleText, spotAmbiance === 'cosy' && styles.roleTextActive]}>🧸 Cosy</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleTab, spotAmbiance === 'festive' && styles.roleTabActive]}
                  onPress={() => setSpotAmbiance('festive')}
                >
                  <Text style={[styles.roleText, spotAmbiance === 'festive' && styles.roleTextActive]}>🎉 Festive</Text>
                </Pressable>
                <Pressable
                  style={[styles.roleTab, spotAmbiance === 'calme' && styles.roleTabActive]}
                  onPress={() => setSpotAmbiance('calme')}
                >
                  <Text style={[styles.roleText, spotAmbiance === 'calme' && styles.roleTextActive]}>🤫 Calme</Text>
                </Pressable>
              </View>

              <View style={styles.adminFormRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Prix Min (€)</Text>
                  <TextInput
                    placeholder="10"
                    placeholderTextColor="#94A3B8"
                    value={spotPriceMin}
                    onChangeText={setSpotPriceMin}
                    keyboardType="numeric"
                    style={styles.adminInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Prix Max (€)</Text>
                  <TextInput
                    placeholder="35"
                    placeholderTextColor="#94A3B8"
                    value={spotPriceMax}
                    onChangeText={setSpotPriceMax}
                    keyboardType="numeric"
                    style={styles.adminInput}
                  />
                </View>
              </View>

              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                placeholder="Crêpes faites maison avec produits bios..."
                placeholderTextColor="#94A3B8"
                value={spotDesc}
                onChangeText={setSpotDesc}
                multiline
                numberOfLines={3}
                style={[styles.adminInput, { height: 80, textAlignVertical: 'top' }]}
              />

              <Text style={styles.fieldLabel}>Image du spot 🖼️</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <TextInput 
                  placeholder={isUploadingImage ? "Importation en cours..." : "Image URL (ou importez en cliquant à droite)"}
                  placeholderTextColor="#94A3B8" 
                  value={spotImageUrl} 
                  onChangeText={setSpotImageUrl} 
                  autoCapitalize="none" 
                  style={[styles.adminInput, { flex: 1, marginBottom: 0 }]} 
                  editable={!isUploadingImage}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.buttonLog, 
                    { width: 44, height: 44, borderRadius: 8, marginBottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF5EF', borderColor: '#1E293B' },
                    pressed && styles.buttonLogPressed
                  ]}
                  onPress={() => handlePickAndUpload('image')}
                  disabled={isUploadingImage}
                >
                  {isUploadingImage ? (
                    <ActivityIndicator size="small" color="#C52824" />
                  ) : (
                    <Upload size={18} color="#C52824" strokeWidth={2.5} />
                  )}
                </Pressable>
              </View>

              <Text style={styles.fieldLabel}>Vidéo du spot 🎥</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <TextInput 
                  placeholder={isUploadingVideo ? "Importation en cours..." : "Vidéo URL (ou importez en cliquant à droite)"}
                  placeholderTextColor="#94A3B8" 
                  value={spotVideoUrl} 
                  onChangeText={setSpotVideoUrl} 
                  autoCapitalize="none" 
                  style={[styles.adminInput, { flex: 1, marginBottom: 0 }]} 
                  editable={!isUploadingVideo}
                />
                <Pressable
                  style={({ pressed }) => [
                    styles.buttonLog, 
                    { width: 44, height: 44, borderRadius: 8, marginBottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAF5EF', borderColor: '#1E293B' },
                    pressed && styles.buttonLogPressed
                  ]}
                  onPress={() => handlePickAndUpload('video')}
                  disabled={isUploadingVideo}
                >
                  {isUploadingVideo ? (
                    <ActivityIndicator size="small" color="#E5A93B" />
                  ) : (
                    <Upload size={18} color="#E5A93B" strokeWidth={2.5} />
                  )}
                </Pressable>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.adminCodeSubmitBtn,
                  pressed && styles.appleWalletBtnPressed
                ]}
                onPress={handleAddSpot}
              >
                <Text style={styles.adminCodeSubmitBtnText}>Ajouter l'Adresse 📍</Text>
              </Pressable>
            </View>
          )}

          {activeAdminTab === 'addEvent' && (
            <View style={styles.adminSectionCard}>
              <Text style={styles.adminTabSectionTitle}>Créer un Événement 🎫</Text>
              
              <Text style={styles.fieldLabel}>Titre de l'événement *</Text>
              <TextInput
                placeholder="Soirée de lancement du guide 2026"
                placeholderTextColor="#94A3B8"
                value={eventTitle}
                onChangeText={setEventTitle}
                style={styles.adminInput}
              />

              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput
                placeholder="Soirée exclusive toulousaine..."
                placeholderTextColor="#94A3B8"
                value={eventDescField}
                onChangeText={setEventDescField}
                multiline
                numberOfLines={3}
                style={[styles.adminInput, { height: 70, textAlignVertical: 'top' }]}
              />

              <View style={styles.adminFormRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Date (AAAA-MM-JJ) *</Text>
                  <TextInput
                    placeholder="2026-05-24"
                    placeholderTextColor="#94A3B8"
                    value={eventDateField}
                    onChangeText={setEventDateField}
                    style={styles.adminInput}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fieldLabel}>Heure (HH:MM) *</Text>
                  <TextInput
                    placeholder="19:00"
                    placeholderTextColor="#94A3B8"
                    value={eventTimeField}
                    onChangeText={setEventTimeField}
                    style={styles.adminInput}
                  />
                </View>
              </View>

              <View style={styles.adminFormRow}>
                <View style={{ flex: 1.3 }}>
                  <Text style={styles.fieldLabel}>Lieu *</Text>
                  <TextInput
                    placeholder="Quai de la Daurade, Toulouse"
                    placeholderTextColor="#94A3B8"
                    value={eventLocationField}
                    onChangeText={setEventLocationField}
                    style={styles.adminInput}
                  />
                </View>
                <View style={{ flex: 0.7 }}>
                  <Text style={styles.fieldLabel}>Tarif (€) *</Text>
                  <TextInput
                    placeholder="25.00"
                    placeholderTextColor="#94A3B8"
                    value={eventPriceField}
                    onChangeText={setEventPriceField}
                    keyboardType="numeric"
                    style={styles.adminInput}
                  />
                </View>
              </View>

              <Pressable
                style={({ pressed }) => [
                  styles.adminCodeSubmitBtn,
                  pressed && styles.appleWalletBtnPressed
                ]}
                onPress={handleAddEvent}
              >
                <Text style={styles.adminCodeSubmitBtnText}>Créer l'Événement 🎫</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* Verification Overlays Flashing indicator */}
        {scanResult && (
          <View style={styles.scannerResultBackdrop}>
            <View 
              style={[
                styles.scannerResultCard,
                { shadowColor: scanResult.status === 'success' ? '#10B981' : '#C52824' }
              ]}
            >
              <View 
                style={[
                  styles.scannerResultHeader,
                  { backgroundColor: scanResult.status === 'success' ? '#10B981' : '#C52824' }
                ]}
              >
                <Text style={styles.scannerResultHeaderText}>
                  {scanResult.status === 'success' ? 'BILLET VALIDE' : 'ACCÈS REFUSÉ'}
                </Text>
              </View>

              <View style={styles.scannerResultBody}>
                {scanResult.status === 'success' ? (
                  <Check size={48} color="#10B981" style={{ marginBottom: 12 }} />
                ) : (
                  <X size={48} color="#C52824" style={{ marginBottom: 12 }} />
                )}

                <Text style={styles.scannerResultTitle}>
                  {scanResult.status === 'success' ? 'Adhésion Confirmée' : scanResult.status === 'scanned_already' ? 'Double Passage' : 'Billet Invalide'}
                </Text>
                
                <Text style={styles.scannerResultDesc}>{scanResult.message}</Text>

                <Pressable
                  style={({ pressed }) => [
                    styles.scannerResultCloseBtn,
                    pressed && styles.appleWalletBtnPressed
                  ]}
                  onPress={() => setScanResult(null)}
                >
                  <Text style={styles.scannerResultCloseBtnText}>D'accord</Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </View>
    )}
  </View>
);
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContainer: {
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 30,
    paddingBottom: 120,
    alignItems: 'center',
    width: '100%',
  },
  glassShine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    pointerEvents: 'none',
  },
  
  // --- Neo-Brutalist Auth styles ---
  formCard: {
    width: '100%',
    maxWidth: 320,
    padding: 20,
    backgroundColor: '#FAF5EF', // Association Cream color
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  titleText: {
    color: '#1E293B',
    fontWeight: '900',
    fontSize: 22,
    marginBottom: 10,
    lineHeight: 26,
  },
  titleSpan: {
    color: '#64748B',
    fontWeight: '600',
    fontSize: 14,
  },
  roleSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.04)',
    borderRadius: 8,
    padding: 3,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    marginBottom: 10,
  },
  roleTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  roleTabActive: {
    backgroundColor: '#C52824',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  roleTextActive: {
    color: '#FFFFFF',
  },
  roleSelectionContainer: {
    gap: 12,
    width: '100%',
    marginVertical: 10,
  },
  roleCard: {
    backgroundColor: '#FAF5EF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 10,
    padding: 14,
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  roleCardActiveVisitor: {
    backgroundColor: '#C52824',
    borderColor: '#1E293B',
  },
  roleCardActiveBusiness: {
    backgroundColor: '#E5A93B',
    borderColor: '#1E293B',
  },
  roleCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  roleCardTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#1E293B',
  },
  roleCardTitleActive: {
    color: '#FFFFFF',
  },
  roleCardDesc: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 14,
  },
  roleCardDescActive: {
    color: 'rgba(255, 255, 255, 0.85)',
  },
  formGroup: {
    gap: 12,
  },
  input: {
    width: '100%',
    height: 44,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FAF5EF',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    paddingHorizontal: 12,
  },
  inputFocus: {
    borderColor: '#C52824',
  },
  loginWith: {
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'center',
    marginTop: 10,
  },
  buttonLog: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FAF5EF',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonLogPressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    shadowOffset: { width: 0, height: 0 },
  },
  tLogoText: {
    fontSize: 22,
    fontWeight: '900',
    color: '#C52824',
    lineHeight: 24,
  },
  gLogoText: {
    fontSize: 20,
    fontWeight: '900',
    color: '#E5A93B',
    lineHeight: 22,
  },
  buttonConfirm: {
    marginTop: 16,
    width: 130,
    height: 44,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FAF5EF',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
  },
  buttonConfirmPressed: {
    transform: [{ translateX: 3 }, { translateY: 3 }],
    shadowOffset: { width: 0, height: 0 },
  },
  buttonConfirmText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  switchModeContainer: {
    marginTop: 10,
    alignItems: 'center',
  },
  switchModeText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '700',
  },

  // --- Logged In Dashboard Styles ---
  profileHeaderCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.85)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 15,
    marginBottom: 20,
  },
  avatarPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(197, 40, 36, 0.1)',
    borderWidth: 2,
    borderColor: '#C52824',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarPlaceholderPro: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#C52824',
  },
  profileName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  roleBadge: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  roleBadgePro: {
    marginTop: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: '#E5A93B',
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  profileEmail: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
  },
  actionCard: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.5)',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255, 255, 255, 0.45)' : 'rgba(255, 255, 255, 0.85)',
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: -10,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.7)',
  },
  statNum: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    marginVertical: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  menuRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuRowText: {
    fontSize: 14,
    color: '#1E293B',
    fontWeight: '500',
  },
  chartContainer: {
    flexDirection: 'row',
    height: 120,
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 10,
  },
  chartColWrapper: {
    alignItems: 'center',
    width: 32,
  },
  chartColBg: {
    width: 8,
    height: 80,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  chartColFill: {
    width: '100%',
    backgroundColor: '#C52824',
    borderRadius: 4,
  },
  chartColLabel: {
    fontSize: 9,
    color: '#94A3B8',
    marginTop: 6,
    fontWeight: '600',
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    marginBottom: 20,
  },
  editProfileBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  scrollContainerCentered: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 120,
    width: '100%',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    width: '100%',
    maxWidth: 380,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.15)',
    marginTop: 10,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.05)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  statusDotConnected: {
    backgroundColor: '#10B981',
  },
  statusDotError: {
    backgroundColor: '#EF4444',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
  },
  dbErrorHint: {
    fontSize: 9,
    color: '#EF4444',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: -8,
  },
  noFavsText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginVertical: 10,
    fontWeight: '500',
  },
  favRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  favRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  favIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  favRed: {
    backgroundColor: '#C52824',
  },
  favGold: {
    backgroundColor: '#E5A93B',
  },
  favName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  favDesc: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 14,
  },
  
  // Wallet Ticket Styling (Matching capture screen specs)
  ticketOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#C52824', // Crimson Red background
    zIndex: 1000,
  },
  ticketHeaderSafeArea: {
    backgroundColor: 'transparent',
  },
  ticketHeaderRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  backBtn: {
    padding: 4,
  },
  ticketHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  ticketCardContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ticketCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#FAF5EF', // White/Cream background
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    shadowColor: '#1E293B',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    overflow: 'hidden',
  },
  ticketTop: {
    padding: 20,
    alignItems: 'center',
  },
  ticketLogoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.8,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketEventTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 22,
  },
  ticketMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  ticketMetaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  ticketDottedLineContainer: {
    height: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'relative',
  },
  ticketLeftNotch: {
    width: 14,
    height: 20,
    backgroundColor: '#C52824',
    borderTopRightRadius: 10,
    borderBottomRightRadius: 10,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderLeftWidth: 0,
    marginLeft: -2.5,
  },
  ticketRightNotch: {
    width: 14,
    height: 20,
    backgroundColor: '#C52824',
    borderTopLeftRadius: 10,
    borderBottomLeftRadius: 10,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderRightWidth: 0,
    marginRight: -2.5,
  },
  ticketDashedLine: {
    flex: 1,
    height: 2,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderStyle: 'dashed',
    marginHorizontal: 10,
  },
  ticketBottom: {
    padding: 20,
    alignItems: 'center',
    borderTopColor: 'transparent',
  },
  qrContainer: {
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#1E293B',
    shadowColor: '#1E293B',
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    marginBottom: 14,
  },
  qrImage: {
    width: 140,
    height: 140,
  },
  ticketNumber: {
    fontSize: 13,
    fontWeight: '800',
    color: '#1E293B',
    letterSpacing: 1.5,
  },
  appleWalletBtn: {
    width: '100%',
    maxWidth: 340,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    backgroundColor: '#000000', // Black background
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    gap: 10,
  },
  appleWalletBtnPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowOffset: { width: 0, height: 0 },
  },
  appleWalletBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  walletColorsRow: {
    flexDirection: 'row',
    gap: 2,
  },
  walletColorBar: {
    width: 4,
    height: 14,
    borderRadius: 1,
  },

  // Portal Admin and Cancel styling
  cancelBookingCardBtn: {
    width: '100%',
    maxWidth: 340,
    height: 48,
    borderRadius: 24,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    backgroundColor: '#C52824', // Crimson Red
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  cancelBookingCardBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  adminCodeCard: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#FAF5EF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    padding: 24,
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  adminCodeCardTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  adminCodeCardDesc: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
    fontWeight: '600',
  },
  adminCodeInput: {
    width: '100%',
    height: 48,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 15,
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 20,
    textAlign: 'center',
  },
  adminCodeSubmitBtn: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#E5A93B', // Toulouse Gold
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  adminCodeSubmitBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  adminTabsRow: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    paddingHorizontal: 10,
    paddingBottom: 10,
    gap: 8,
  },
  adminTabButton: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#334155',
    justifyContent: 'center',
    alignItems: 'center',
  },
  adminTabActive: {
    backgroundColor: '#FAF5EF', // Active Tab Cream
    borderColor: '#FAF5EF',
  },
  adminTabText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
  },
  adminTabTextActive: {
    color: '#1E293B',
  },
  adminScrollContent: {
    padding: 20,
    paddingBottom: 80,
  },
  adminSectionCard: {
    width: '100%',
    backgroundColor: '#FAF5EF',
    borderRadius: 18,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    padding: 20,
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  adminTabSectionTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 4,
  },
  adminTabSectionDesc: {
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 20,
  },
  cameraViewport: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    backgroundColor: '#000000',
    overflow: 'hidden',
    position: 'relative',
    marginBottom: 20,
  },
  nativeCameraMock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  nativeCameraMockText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  scannerLaserLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    height: 4,
    backgroundColor: '#EF4444',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.8,
    shadowRadius: 4,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  adminInput: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 16,
  },
  validateTicketBtn: {
    width: '100%',
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#10B981', // Emerald green button
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    marginTop: 10,
  },
  validateTicketBtnText: {
    fontSize: 13,
    fontWeight: '900',
    color: '#FFFFFF',
  },
  adminFormRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  pickerSim: {
    width: '100%',
    height: 44,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  pickerSimText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#E5A93B',
  },
  scannerResultBackdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(30, 41, 59, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  scannerResultCard: {
    width: '85%',
    maxWidth: 300,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: '#1E293B',
    shadowOffset: { width: 6, height: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
    overflow: 'hidden',
    backgroundColor: '#FAF5EF',
  },
  scannerResultHeader: {
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2.5,
    borderColor: '#1E293B',
  },
  scannerResultHeaderText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
  },
  scannerResultBody: {
    padding: 20,
    alignItems: 'center',
  },
  scannerResultTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#1E293B',
    textAlign: 'center',
    marginBottom: 8,
  },
  scannerResultDesc: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 16,
  },
  scannerResultCloseBtn: {
    width: '100%',
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#1E293B',
    backgroundColor: '#1E293B',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  scannerResultCloseBtnText: {
    fontSize: 12,
    fontWeight: '900',
    color: '#FFFFFF',
  },

  // ─── Admin Portal — Neo-Brutalist (identical tokens to login screen) ──────
  adminBrutalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FAF5EF',
    borderBottomWidth: 2.5,
    borderBottomColor: '#1E293B',
  },
  adminBrutalHeaderTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  adminBrutalBadgeRow: {
    alignItems: 'center',
    marginBottom: 4,
  },
  adminBrutalTabRow: {
    flexDirection: 'row',
    backgroundColor: '#FAF5EF',
    borderBottomWidth: 2.5,
    borderBottomColor: '#1E293B',
  },
  adminBrutalTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  adminBrutalTabActive: {
    borderBottomColor: '#C52824',
    backgroundColor: 'rgba(197,40,36,0.06)',
  },
  adminBrutalTabText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  adminBrutalTabTextActive: {
    color: '#C52824',
    fontWeight: '900',
  },
  adminBrutalCameraCard: {
    width: '100%',
    maxWidth: 360,
    borderWidth: 2.5,
    borderColor: '#1E293B',
    borderRadius: 8,
    overflow: 'hidden',
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
    backgroundColor: '#000',
  },
  adminBrutalRow: {
    flexDirection: 'row',
    gap: 0,
  },
  scanCorner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#FFFFFF',
    borderWidth: 2.5,
  },
  adminCategoryGridBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    backgroundColor: '#FAF5EF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 2, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 2,
  },
  adminCategoryGridText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1E293B',
  },
  notificationSettingsContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#FAF5EF',
    borderWidth: 2,
    borderColor: '#1E293B',
    borderRadius: 8,
    shadowColor: '#1E293B',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  notifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  notifRowTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#1E293B',
    marginBottom: 4,
  },
  notifRowSubtitle: {
    fontSize: 11,
    color: '#64748B',
    lineHeight: 14,
    fontWeight: '600',
  },
});
