import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Pressable,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Lock, Eye, EyeOff, X, ShieldAlert, Check } from 'lucide-react-native';

import { supabase } from '../lib/supabase';

import { Brand } from '../constants/brand';
interface AdminPasswordModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Empreinte cryptographique SHA-256 du code d'administration (aucun mot de passe en clair)
const MASTER_HASH = '25a52cccd2b92d04a6faa55b3e1bab0c490dc15f76b9435005c099ad90faa8c4';

const computeHash = async (msg: string): Promise<string> => {
  if (typeof crypto !== 'undefined' && crypto?.subtle) {
    const data = new TextEncoder().encode(msg);
    const buffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  return '';
};

export default function AdminPasswordModal({
  visible,
  onClose,
  onSuccess,
}: AdminPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  if (!visible) return null;

  const handleVerify = async () => {
    const cleanPass = password.trim();
    if (!cleanPass) {
      setErrorMsg('Veuillez saisir la clé administrateur.');
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    try {
      // 1. Validation distante sécurisée via RPC Supabase
      const { data, error } = await supabase.rpc('verify_admin_access', { access_code: cleanPass });
      
      let isValid = !error && data === true;

      // 2. Validation de secours par comparaison de hachage cryptographique
      if (!isValid) {
        const hash = await computeHash(cleanPass);
        if (hash && hash === MASTER_HASH) {
          isValid = true;
        }
      }

      if (isValid) {
        setIsSuccess(true);
        setTimeout(() => {
          setPassword('');
          setIsSuccess(false);
          setIsVerifying(false);
          onSuccess();
        }, 350);
      } else {
        setIsVerifying(false);
        setErrorMsg('Clé d\'accès incorrecte.');
      }
    } catch (e) {
      const hash = await computeHash(cleanPass);
      if (hash && hash === MASTER_HASH) {
        setIsSuccess(true);
        setTimeout(() => {
          setPassword('');
          setIsSuccess(false);
          setIsVerifying(false);
          onSuccess();
        }, 350);
      } else {
        setIsVerifying(false);
        setErrorMsg('Clé d\'accès incorrecte.');
      }
    }
  };

  const handleClose = () => {
    setPassword('');
    setErrorMsg('');
    setIsSuccess(false);
    onClose();
  };

  return (
    <View style={styles.backdrop}>
      <Pressable style={styles.backdropPress} onPress={handleClose} />

      <View style={styles.modalCard}>
        {/* Header Strip */}
        <View style={styles.headerStrip}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Lock size={16} color={Brand.white} strokeWidth={2} />
            <Text style={styles.headerStripText}>SÉCURITÉ ADMINISTRATEUR</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={10}>
            <X size={18} color={Brand.white} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Modal Body */}
        <View style={styles.modalBody}>
          <View style={styles.iconCircle}>
            <Lock size={32} color={Brand.primaryDeep} strokeWidth={2} />
          </View>

          <Text style={styles.modalTitle}>Portail Membres</Text>
          <Text style={styles.modalSubtitle}>
            Saisissez le mot de passe administrateur pour accéder à la gestion du Petit Tou.
          </Text>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <TextInput
              secureTextEntry={!showPassword}
              placeholder="Entrez la clé secrète..."
              placeholderTextColor={Brand.inkSoft}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (errorMsg) setErrorMsg('');
              }}
              onSubmitEditing={handleVerify}
              autoFocus={true}
              style={styles.passwordInput}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
            />
            <Pressable
              style={styles.eyeBtn}
              onPress={() => setShowPassword(!showPassword)}
              hitSlop={8}
            >
              {showPassword ? (
                <EyeOff size={20} color={Brand.inkSoft} />
              ) : (
                <Eye size={20} color={Brand.inkSoft} />
              )}
            </Pressable>
          </View>

          {/* Error Message */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <ShieldAlert size={16} color={Brand.primaryDeep} style={{ marginRight: 6 }} />
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Buttons Row */}
          <View style={styles.actionsRow}>
            <Pressable
              style={({ pressed }) => [
                styles.cancelBtn,
                pressed && styles.btnPressed,
              ]}
              onPress={handleClose}
            >
              <Text style={styles.cancelBtnText}>Annuler</Text>
            </Pressable>

            <Pressable
              style={({ pressed }) => [
                styles.confirmBtn,
                isSuccess && styles.confirmBtnSuccess,
                pressed && styles.btnPressed,
                isVerifying && { opacity: 0.8 },
              ]}
              onPress={handleVerify}
              disabled={isVerifying}
            >
              {isSuccess ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Check size={18} color={Brand.white} strokeWidth={2} />
                  <Text style={styles.confirmBtnText}>Accès autorisé</Text>
                </View>
              ) : isVerifying ? (
                <ActivityIndicator size="small" color={Brand.white} />
              ) : (
                <Text style={styles.confirmBtnText}>Déverrouiller</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.securityHint}>
            Connexion chiffrée réservée au bureau de l'association.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(43, 29, 70, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 99999,
    padding: 20,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      } as any,
    }),
  },
  backdropPress: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: Brand.white,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#24242E',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 24,
    elevation: 14,
  },
  headerStrip: {
    backgroundColor: Brand.ink,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerStripText: {
    color: Brand.white,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalBody: {
    padding: 24,
    alignItems: 'center',
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(232, 74, 95, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: Brand.ink,
    marginBottom: 6,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: Brand.inkSoft,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.bg,
    borderWidth: 1,
    borderColor: Brand.line,
    borderRadius: 20,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  passwordInput: {
    flex: 1,
    height: 48,
    fontSize: 16,
    fontWeight: '600',
    color: Brand.ink,
    ...Platform.select({
      web: {
        outlineStyle: 'none',
      } as any,
    }),
  },
  eyeBtn: {
    padding: 6,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Brand.primarySoft,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '100%',
    marginBottom: 16,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 20,
    backgroundColor: '#F5F0F2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#4A4A58',
    fontWeight: '700',
    fontSize: 14,
  },
  confirmBtn: {
    flex: 1.5,
    height: 48,
    borderRadius: 20,
    backgroundColor: Brand.primaryDeep,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Brand.ink,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.14,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmBtnSuccess: {
    backgroundColor: '#1FA67A',
  },
  confirmBtnText: {
    color: Brand.white,
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.5,
  },
  btnPressed: {
    opacity: 0.85,
  },
  securityHint: {
    fontSize: 12,
    color: Brand.inkSoft,
    textAlign: 'center',
    marginTop: 18,
    fontWeight: '500',
  },
});
