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
                <ShieldCheck size={22} color="#C52824" />
                <Text style={styles.headerTitle}>Politique de Confidentialité</Text>
              </View>
              <Pressable
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={10}
                accessibilityLabel="Fermer"
              >
                <X size={20} color="#64748B" />
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
                  <Lock size={18} color="#0F172A" />
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
                  <MapPin size={18} color="#0F172A" />
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
                  <ShieldCheck size={18} color="#0F172A" />
                  <Text style={styles.sectionTitle}>3. Absence d'accès aux capteurs sensibles</Text>
                </View>
                <Text style={styles.paragraph}>
                  L'application grand public ne demande et n'utilise aucun accès à l'appareil photo, au microphone, au carnet d'adresses ou à la photothèque de votre téléphone.
                </Text>
              </View>

              {/* Section 4 */}
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Lock size={18} color="#0F172A" />
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
                  <Trash2 size={18} color="#0F172A" />
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
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'flex-end',
  },
  safeContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
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
    borderBottomColor: '#F1F5F9',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0F172A',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F1F5F9',
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
    color: '#94A3B8',
    marginBottom: 12,
    fontWeight: '500',
  },
  introText: {
    fontSize: 14,
    color: '#334155',
    lineHeight: 22,
    marginBottom: 20,
  },
  boldText: {
    fontWeight: '700',
    color: '#0F172A',
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
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  paragraph: {
    fontSize: 13.5,
    color: '#475569',
    lineHeight: 21,
    marginBottom: 8,
  },
  bulletPoint: {
    fontSize: 13,
    color: '#475569',
    lineHeight: 20,
    marginLeft: 8,
    marginBottom: 6,
  },
  highlightBox: {
    backgroundColor: '#FEF2F2',
    padding: 10,
    borderRadius: 10,
    borderLeftWidth: 3,
    borderLeftColor: '#C52824',
    marginTop: 6,
  },
  contactEmail: {
    fontSize: 14,
    fontWeight: '700',
    color: '#C52824',
    marginVertical: 4,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    backgroundColor: '#FFFFFF',
  },
  confirmBtn: {
    backgroundColor: '#C52824',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
