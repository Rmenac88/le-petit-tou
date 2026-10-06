import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  SafeAreaView,
  Platform,
} from 'react-native';
import { X, ShieldCheck, Lock, MapPin, Trash2, Mail } from 'lucide-react-native';

import { Brand } from '../constants/brand';
interface PrivacyPolicyModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function PrivacyPolicyModal({ visible, onClose }: PrivacyPolicyModalProps) {
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
              <Text style={styles.lastUpdate}>Dernière mise à jour : 14 septembre 2026</Text>

              <Text style={styles.introText}>
                L'association <Text style={styles.boldText}>Le Petit Tou</Text> (association loi 1901, domiciliée au 1 Place Alphonse Jourdain, 31000 Toulouse, France) s'engage à protéger la vie privée et les données personnelles des utilisateurs de son application mobile, conformément au Règlement Général sur la Protection des Données (RGPD) et aux réglementations Apple App Store et Google Play.
              </Text>

              {/* Section 1 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Lock size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>1. Respect total de votre anonymat</Text>
                </View>
                <Text style={styles.paragraph}>
                  L'application Le Petit Tou est un guide urbain accessible à tous, sans aucune obligation d'inscription ni création de compte :
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Aucun compte requis :</Text> Nous ne collectons et ne stockons aucune information nominative (ni nom, prénom, adresse email, mot de passe ou profil).
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Favoris et Likes sur l'appareil :</Text> Vos coups de cœur et adresses favorites sont conservés exclusivement sur votre appareil dans un espace de stockage sécurisé (SecureStore). Aucun profil individuel ni historique personnel n'est transmis à nos serveurs.
                </Text>
              </View>

              {/* Section 2 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <MapPin size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>2. Géolocalisation & Respect de la vie privée</Text>
                </View>
                <Text style={styles.paragraph}>
                  La localisation est strictement facultative. Elle n'est demandée qu'à l'ouverture de la carte dans le seul but de centrer la vue et de calculer la distance vers les commerces toulousains les plus proches de vous.
                </Text>
                <Text style={[styles.paragraph, styles.highlightBox]}>
                  <Text style={styles.boldText}>Important :</Text> Aucun suivi de localisation en arrière-plan n'est actif. Votre position GPS n'est jamais enregistrée ni conservée sur nos serveurs.
                </Text>
              </View>

              {/* Section 3 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <ShieldCheck size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>3. Absence d'accès aux capteurs sensibles</Text>
                </View>
                <Text style={styles.paragraph}>
                  L'application grand public ne demande et n'utilise aucun accès à l'appareil photo, au microphone, au carnet d'adresses ou à la photothèque de votre téléphone.
                </Text>
              </View>

              {/* Section 4 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Lock size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>4. Hébergement & Sécurité des flux</Text>
                </View>
                <Text style={styles.paragraph}>
                  Les informations publiques du guide (adresses des commerces, descriptions, horaires) sont hébergées sur des infrastructures chiffrées :
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Supabase Inc. :</Text> Base de données avec communications chiffrées en transit (TLS 1.3) et au repos (AES-256).
                </Text>
                <Text style={styles.bulletPoint}>
                  • <Text style={styles.boldText}>Zéro revente de données :</Text> Aucune donnée personnelle n'est vendue, louée, partagée ou exploitée à des fins publicitaires ou de ciblage commercial.
                </Text>
              </View>

              {/* Section 5 */}
              <View style={[styles.section, { marginBottom: 30 }]}>
                <View style={styles.sectionHeaderRow}>
                  <Trash2 size={18} color="#24242E" />
                  <Text style={styles.sectionTitle}>5. Droits RGPD & Réinitialisation</Text>
                </View>
                <Text style={styles.paragraph}>
                  Dans la mesure où l'application ne recueille aucune donnée personnelle nominative sur ses serveurs, aucun identifiant ni profil n'est conservé.
                </Text>
                <Text style={styles.bulletPoint}>
                  • Vous pouvez à tout moment réinitialiser vos favoris locaux en réinitialisant les données de l'application ou en la désinstallant.
                </Text>
                <Text style={styles.paragraph}>
                  Pour toute question concernant notre politique de confidentialité, vous pouvez contacter notre équipe à :
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
