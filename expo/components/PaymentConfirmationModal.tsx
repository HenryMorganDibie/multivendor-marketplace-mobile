import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  X,
  Upload,
  ImageIcon,
  ShieldCheck,
  Trash2,
  CheckCircle,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { PaymentProof } from '@/mocks/ordersData';
import type { Currency } from '@/utils/formatPrice';
import { formatPriceWithCommas } from '@/utils/formatPrice';

interface PaymentConfirmationModalProps {
  visible: boolean;
  vendorName: string;
  orderId: string;
  total: number;
  currency: Currency;
  onClose: () => void;
  onConfirm: (proofs: PaymentProof[], note?: string) => void;
}

export default function PaymentConfirmationModal({
  visible,
  vendorName,
  orderId,
  total,
  currency,
  onClose,
  onConfirm,
}: PaymentConfirmationModalProps) {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [note, setNote] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handlePickImage = async () => {
    try {
      setIsUploading(true);
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: 3,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newProofs: PaymentProof[] = result.assets.map((asset: { uri: string }) => ({
          id: `proof-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          uri: asset.uri,
          type: 'image' as const,
          uploadedAt: new Date().toISOString(),
        }));
        setProofs(prev => [...prev, ...newProofs].slice(0, 3));
      }
    } catch (err) {
      console.log('[PaymentConfirmationModal] Image pick error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveProof = (id: string) => {
    setProofs(prev => prev.filter(p => p.id !== id));
  };

  const handleConfirm = () => {
    onConfirm(proofs, note.trim() || undefined);
    setProofs([]);
    setNote('');
  };

  const handleClose = () => {
    setProofs([]);
    setNote('');
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
      statusBarTranslucent={Platform.OS === 'android'}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.overlayBackdrop} onPress={handleClose} activeOpacity={1} />
        <SafeAreaView edges={['bottom']} style={styles.sheetSafeArea}>
          <View style={styles.sheet}>
            {/* Handle */}
            <View style={styles.handle} />

            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <ShieldCheck size={20} color={Colors.primary} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.headerTitle}>Confirm Payment</Text>
                <Text style={styles.headerSubtitle} numberOfLines={1}>
                  Order {orderId.toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                <X size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {/* Summary card */}
              <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Paying to</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{vendorName}</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Amount</Text>
                  <Text style={styles.summaryAmount}>
                    {formatPriceWithCommas(total, currency)}
                  </Text>
                </View>
              </View>

              {/* Info notice */}
              <View style={styles.noticeRow}>
                <CheckCircle size={14} color={Colors.success} />
                <Text style={styles.noticeText}>
                  Tap "I've Paid" to let {vendorName} know you've sent payment. You can also attach a screenshot or receipt.
                </Text>
              </View>

              {/* Proof upload */}
              <Text style={styles.sectionLabel}>PAYMENT PROOF</Text>
              <Text style={styles.sectionHint}>Optional — attach up to 3 images</Text>

              <View style={styles.proofGrid}>
                {proofs.map(proof => (
                  <View key={proof.id} style={styles.proofThumb}>
                    <Image source={{ uri: proof.uri }} style={styles.proofImage} contentFit="cover" />
                    <TouchableOpacity
                      style={styles.proofRemove}
                      onPress={() => handleRemoveProof(proof.id)}
                      activeOpacity={0.8}
                    >
                      <Trash2 size={12} color={Colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
                {proofs.length < 3 && (
                  <TouchableOpacity
                    style={styles.uploadBtn}
                    onPress={handlePickImage}
                    disabled={isUploading}
                    activeOpacity={0.7}
                  >
                    {isUploading ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <>
                        <Upload size={18} color={Colors.primary} />
                        <Text style={styles.uploadBtnText}>
                          {proofs.length === 0 ? 'Upload Proof' : 'Add More'}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>

              {proofs.length === 0 && (
                <View style={styles.noProofHint}>
                  <ImageIcon size={14} color={Colors.textMuted} />
                  <Text style={styles.noProofHintText}>No proof attached — you can skip this step</Text>
                </View>
              )}

              {/* Note */}
              <Text style={[styles.sectionLabel, { marginTop: 20 }]}>NOTE TO VENDOR</Text>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note (optional)"
                placeholderTextColor={Colors.inputPlaceholder}
                value={note}
                onChangeText={setNote}
                multiline
                maxLength={200}
                returnKeyType="done"
              />
            </ScrollView>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.7}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.8}>
                <ShieldCheck size={16} color={Colors.white} />
                <Text style={styles.confirmText}>I've Paid</Text>
              </TouchableOpacity>
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
    justifyContent: 'flex-end',
  },
  overlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.overlay,
  },
  sheetSafeArea: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  sheet: {
    backgroundColor: Colors.background,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  headerText: { flex: 1 },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    maxHeight: 480,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 14,
    overflow: 'hidden',
  },
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryDivider: { height: 1, backgroundColor: Colors.border },
  summaryLabel: { fontSize: 13, color: Colors.textMuted },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'right' as const,
  },
  summaryAmount: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  noticeRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    backgroundColor: Colors.successLight,
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
  },
  noticeText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  sectionHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  proofGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  proofThumb: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
  },
  proofImage: { width: '100%', height: '100%' },
  proofRemove: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  uploadBtnText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  noProofHint: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginTop: 10,
  },
  noProofHintText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: Colors.text,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  actions: {
    flexDirection: 'row' as const,
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    flex: 1,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 2,
    height: 50,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
