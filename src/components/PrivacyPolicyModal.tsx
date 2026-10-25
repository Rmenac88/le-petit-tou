import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { X, ShieldCheck, Lock, MapPin, Trash2, Mail } from 'lucide-react-native';

import { Brand } from '../constants/brand';
import { supabase } from '../lib/supabase';
import { authService } from '../lib/authService';
import { deleteMyData } from '../lib/dataDeletion';
import { discoveryStore } from '../lib/discoveryStore';
import { discountCardsStore } from '../lib/discountCardsStore';
import { clearDeviceLikedSpotIds } from '../lib/likesStore';
import { clearLocalPushState } from '../lib/pushNotifications';
import { userListsStore } from '../lib/userListsStore';
interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

const showMessage = (title: string, message: string) => {
  if (Platform.OS === 'web') window.alert(`${title}\n\n${message}`);
  else Alert.alert(title, message);
};

export default function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const runDeletion = async () => {
    setIsDeleting(true);
    try {
      const res = await deleteMyData({
        getUserId: () => authService.getUserId(),
        rpc: (fn, args) => supabase.rpc(fn, args),
        clearLocal: async () => {
          await discoveryStore.resetLocal();
          await discountCardsStore.resetLocal();
          await clearDeviceLikedSpotIds();
          await clearLocalPushState();
          await userListsStore.resetLocal();
          await authService.clearSessionAfterDeletion();
        },
      });
      showMessage(res.ok ? 'Données effacées' : 'Effacement impossible', res.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeletion = () => {
    const text = 'Cette action efface définitivement votre progression, vos cartes utilisées, vos suggestions, vos likes et vos listes.';
    if (Platform.OS === 'web') {
      if (window.confirm(`Effacer mes données ?\n\n${text}`)) runDeletion();
      return;
    }
    Alert.alert('Effacer mes données ?', text, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Effacer', style: 'destructive', onPress: runDeletion },
    ]);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <SafeAreaView style={styles.safeContainer}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleRow}>
                <ShieldCheck size={22} color={Brand.primaryDeep} />
                <Text style={styles.headerTitle}>Politique de Confidentialité</Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={10}
                accessibilityLabel="Fermer"
              >
                <X size={20} color={Brand.inkSoft} />
              </Pressable>
            </View>

            {/* Content */}
            <ScrollView
              style={styles.bodyScroll}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={true}
            >
              <Text style={styles.lastUpdate}>Dernière mise à jour : 19 octobre 2026</Text>

              <Text style={styles.introText}>
                L'association <Text style={styles.boldText}>Le Petit Tou</Text> (association loi 1901, domiciliée au 1 Place Alphonse Jourdain, 31000 Toulouse, France) est responsable du traitement des données décrites ci-dessous, conformément au Règlement Général sur la Protection des Données (RGPD).
              </Text>

              {/* Section 1 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Lock size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>1. Aucun compte, un identifiant aléatoire</Text>
                </View>
                <Text style={styles.paragraph}>
                  L'application s'utilise sans inscription : nous ne vous demandons ni nom, ni e-mail, ni mot de passe. Pour faire fonctionner la progression, les cartes privilège et les likes, l'application génère toutefois un identifiant aléatoire propre à votre appareil. Il est conservé dans le stockage sécurisé de votre téléphone (Keychain / Keystore) et envoyé à nos serveurs. Il ne permet pas de vous identifier directement, mais il s'agit d'une donnée personnelle au sens du RGPD.
                </Text>
                <Text style={styles.paragraph}>Données associées à cet identifiant, et pourquoi :</Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Adresses découvertes et points</Text> (date comprise) : faire fonctionner la progression.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Utilisations des cartes privilège</Text> (nombre, dates) : faire respecter le nombre d'utilisations autorisé par carte.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Likes</Text> : un like par appareil et par adresse. Seul le total par adresse est public.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Vos listes</Text> (« À tester plus tard », « Y retourner », listes que vous créez) : elles restent uniquement sur votre téléphone et ne sont jamais envoyées à nos serveurs.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Suggestions d'adresses</Text> : le texte que vous saisissez volontairement. N'y indiquez pas de données personnelles vous concernant.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Statistiques de consultation</Text> : l'adresse consultée, sans identifiant, pour mesurer la fréquentation des fiches.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Notifications</Text> (si vous les activez) : un jeton d'envoi et vos préférences.
                </Text>
                <Text style={styles.paragraph}>
                  Base légale : exécution du service demandé (progression, cartes), consentement (notifications, suggestions) et intérêt légitime de l'association (statistiques, prévention des abus). Conservation : jusqu'à ce que vous effaciez vos données (section 5), ou 24 mois sans aucune activité ; les consultations de fiches sont gardées 13 mois.
                </Text>
              </View>

              {/* Section 2 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <MapPin size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>2. Géolocalisation</Text>
                </View>
                <Text style={styles.paragraph}>
                  La localisation est facultative. Elle n'est demandée qu'à l'ouverture de la carte, uniquement lorsque l'application est ouverte, pour centrer la vue et calculer les distances. Aucun suivi en arrière-plan n'est actif et votre position n'est pas enregistrée sur nos serveurs.
                </Text>
                <Text style={styles.paragraph}>
                  Si vous demandez un itinéraire à pied, votre position et la destination sont transmises au service de cartographie (Mapbox, États-Unis) qui calcule le trajet. La carte elle-même est fournie par Mapbox, Apple Plans ou Google Maps selon votre appareil, qui peuvent recevoir votre adresse IP.
                </Text>
              </View>

              {/* Section 3 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <ShieldCheck size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>3. Notifications, capteurs et traceurs</Text>
                </View>
                <Text style={styles.paragraph}>
                  Les notifications sont désactivées par défaut. Si vous les activez (Accueil, « Notifications »), vous choisissez les types de messages ; nous en envoyons au plus 2 par jour, jamais entre 21 h et 8 h, sans donnée personnelle. Vous pouvez les arrêter à tout moment.
                </Text>
                <Text style={styles.paragraph}>
                  L'application n'utilise ni le microphone, ni le carnet d'adresses. L'accès aux photos n'est demandé que dans l'espace réservé à l'équipe du Petit Tou. Aucun cookie publicitaire, aucun outil de mesure d'audience et aucun SDK publicitaire n'est utilisé.
                </Text>
              </View>

              {/* Section 4 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Lock size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>4. Destinataires et sécurité</Text>
                </View>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Supabase Inc. :</Text> hébergement de la base de données (sous-traitant). Échanges chiffrés (HTTPS) ; accès aux données de chaque utilisateur limité par des fonctions serveur.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Mapbox, Apple, Google :</Text> cartographie et itinéraires (voir section 2) ; Apple et Google acheminent aussi les notifications.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Expo (États-Unis) :</Text> service d'envoi des notifications, si vous les activez. Les photos de certaines fiches sont servies par des hébergeurs d'images qui voient votre adresse IP.
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Aucune revente :</Text> vos données ne sont ni vendues, ni louées, ni utilisées pour de la publicité ciblée.
                </Text>
              </View>

              {/* Section 5 */}
              <View style={[styles.section, { marginBottom: 30 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Trash2 size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>5. Vos droits et l'effacement</Text>
                </View>
                <Text style={styles.paragraph}>
                  Vous disposez des droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité. Vous pouvez aussi introduire une réclamation auprès de la CNIL (cnil.fr).
                </Text>
                <Text style={styles.paragraph}>
                  Le bouton ci-dessous efface immédiatement de nos serveurs et de cet appareil votre progression, vos cartes utilisées, vos suggestions, vos likes, vos listes et vos réglages de notifications. Cette action est définitive.
                </Text>
                <Pressable
                  style={[styles.deleteBtn, isDeleting && { opacity: 0.6 }]}
                  onPress={confirmDeletion}
                  disabled={isDeleting}
                  accessibilityRole="button"
                  accessibilityLabel="Effacer mes données"
                >
                  {isDeleting ? (
                    <ActivityIndicator color={Brand.white} />
                  ) : (
                    <Text style={styles.deleteBtnText}>Effacer mes données</Text>
                  )}
                </Pressable>
                <Text style={styles.paragraph}>
                  Pour toute autre demande ou question, écrivez-nous :
                </Text>
                <Text style={styles.contactEmail}>contact@lepetittou.net</Text>
                <Text style={styles.paragraph}>
                  Association Le Petit Tou — TBS Education, 1 Place Alphonse Jourdain, 31000 Toulouse.
                </Text>
              </View>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <Pressable style={styles.confirmBtn} onPress={onClose}>
                <Text style={styles.confirmBtnText}>J'ai compris</Text>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(43, 29, 70, 0.65)',
    justifyContent: 'flex-end',
  },
  safeContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Brand.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '90%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F0F2',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#24242E',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F5F0F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bodyScroll: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  lastUpdate: {
    fontSize: 12,
    color: Brand.inkSoft,
    marginBottom: 12,
    fontWeight: '500',
  },
  introText: {
    fontSize: 14,
    color: '#3A3A48',
    lineHeight: 22,
    marginBottom: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#24242E',
  },
  section: {
    marginBottom: 22,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#24242E',
  },
  paragraph: {
    fontSize: 13,
    color: '#4A4A58',
    lineHeight: 21,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 13,
    color: '#4A4A58',
    lineHeight: 20,
    marginLeft: 8,
    marginBottom: 6,
  },
  highlightBox: {
    backgroundColor: Brand.primarySoft,
    padding: 10,
    borderRadius: 12,
    marginTop: 6,
  },
  contactEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: Brand.primaryDeep,
    marginVertical: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F5F0F2',
    backgroundColor: Brand.white,
  },
  deleteBtn: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: Brand.primaryDeep,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 12,
  },
  deleteBtnText: {
    color: Brand.white,
    fontSize: 15,
    fontWeight: '700',
  },
  confirmBtn: {
    backgroundColor: Brand.primaryDeep,
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: Brand.white,
    fontSize: 16,
    fontWeight: '700',
  },
});
