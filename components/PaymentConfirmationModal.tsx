import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  Platform,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import {
  X,
  Plus,
  FileText,
  ImageIcon,
  CreditCard,
  Info,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { PaymentProof } from '@/mocks/ordersData';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

interface PaymentConfirmationModalProps {
  visible: boolean;
  vendorName: string;
  orderId?: string;
  total?: number;
  currency?: Currency;
  onClose: () => void;
  onConfirm: (proofs: PaymentProof[], note?: string) => void;
}

export default function PaymentConfirmationModal({
  visible,
  vendorName,
  orderId,
  total,
  currency = 'NGN',
  onClose,
  onConfirm,
}: PaymentConfirmationModalProps) {
  const [proofs, setProofs] = useState<PaymentProof[]>([]);
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleReset = useCallback(() => {
    setProofs([]);
    setNote('');
    setIsSubmitting(false);
  }, []);

  const handleClose = useCallback(() => {
    handleReset();
    onClose();
  }, [onClose, handleReset]);

  const handleConfirm = useCallback(() => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    console.log('[PaymentConfirmation] Customer confirmed payment, proofs:', proofs.length, 'note:', note);
    onConfirm(proofs, note.trim() || undefined);
    handleReset();
  }, [isSubmitting, proofs, note, onConfirm, handleReset]);

  const MAX_PROOFS = 5;

  const handlePickImage = useCallback(async () => {
    if (proofs.length >= MAX_PROOFS) return;
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        allowsMultipleSelection: false,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const newProof: PaymentProof = {
          id: `proof-${Date.now()}`,
          uri: asset.uri,
          type: 'image',
          uploadedAt: new Date().toISOString(),
        };
        setProofs((prev) => {
          if (prev.length >= MAX_PROOFS) return prev;
          return [...prev, newProof];
        });
        console.log('[PaymentConfirmation] Proof image added');
      }
    } catch (error) {
      console.log('[PaymentConfirmation] Image picker error:', error);
    }
  }, [proofs.length]);

  const handleRemoveProof = useCallback((proofId: string) => {
    setProofs((prev) => prev.filter((p) => p.id !== proofId));
  }, []);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderLeft}>
              <View style={styles.titleIcon}>
                <CreditCard size={18} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.title}>Confirm Payment</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn} activeOpacity={0.7}>
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Let {vendorName} know you've completed payment.
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            {(orderId || total != null) && (
              <View style={styles.contextCard}>
                {orderId && (
                  <View style={styles.contextRow}>
                    <Text style={styles.contextLabel}>Order</Text>
                    <Text style={styles.contextValue}>#{orderId.toUpperCase()}</Text>
                  </View>
                )}
                {total != null && (
                  <View style={[styles.contextRow, orderId ? styles.contextRowBorder : undefined]}>
                    <Text style={styles.contextLabel}>Amount</Text>
                    <Text style={styles.contextAmountValue}>
                      {formatPriceWithCommas(total, currency)}
                    </Text>
                  </View>
                )}
                <View style={[styles.contextRow, styles.contextRowBorder]}>
                  <Text style={styles.contextLabel}>Vendor</Text>
                  <Text style={styles.contextValue}>{vendorName}</Text>
                </View>
              </View>
            )}

            <View style={styles.proofSection}>
              <View style={styles.proofLabelRow}>
                <Text style={styles.proofTitle}>Upload proof</Text>
                <Text style={styles.proofOptional}>(optional)</Text>
              </View>
              <Text style={styles.proofSubtitle}>
                JPG, PNG or PDF · Max {MAX_PROOFS} files
              </Text>

              {proofs.length > 0 && (
                <View style={styles.proofList}>
                  {proofs.map((proof) => (
                    <View key={proof.id} style={styles.proofItem}>
                      {proof.type === 'image' ? (
                        <Image
                          source={{ uri: proof.uri }}
                          style={styles.proofImage}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={styles.proofFilePlaceholder}>
                          <FileText size={20} color={Colors.textMuted} />
                        </View>
                      )}
                      <View style={styles.proofInfo}>
                        <ImageIcon size={13} color={Colors.textSecondary} />
                        <Text style={styles.proofLabel} numberOfLines={1}>
                          Payment proof {proofs.indexOf(proof) + 1}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.proofRemoveBtn}
                        onPress={() => handleRemoveProof(proof.id)}
                        activeOpacity={0.7}
                      >
                        <X size={14} color={Colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}

              {proofs.length < MAX_PROOFS && (
                <TouchableOpacity
                  style={styles.addFileButton}
                  onPress={handlePickImage}
                  activeOpacity={0.7}
                  testID="upload-proof-button"
                >
                  <Plus size={16} color={Colors.primary} strokeWidth={2.5} />
                  <Text style={styles.addFileButtonText}>Add file</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.noteSection}>
              <View style={styles.proofLabelRow}>
                <Text style={styles.proofTitle}>Note</Text>
                <Text style={styles.proofOptional}>(optional)</Text>
              </View>
              <TextInput
                style={styles.noteInput}
                placeholder="Add a note (optional)"
                placeholderTextColor={Colors.textMuted}
                value={note}
                onChangeText={setNote}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={300}
              />
            </View>

            <View style={styles.infoRow}>
              <Info size={14} color={Colors.textMuted} strokeWidth={1.5} />
              <Text style={styles.infoText}>
                {vendorName} will verify your payment before starting your order.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.confirmButton, isSubmitting && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={isSubmitting}
              activeOpacity={0.8}
              testID="confirm-payment-button"
            >
              <Text style={styles.confirmButtonText}>
                {isSubmitting ? 'Sending…' : 'Confirm Payment'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end' as const,
  },
  dismissArea: {
    flex: 1,
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '88%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 10,
    marginBottom: 4,
  },
  sheetHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 4,
  },
  sheetHeaderLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  titleIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: 19,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.3,
  },
  closeBtn: {
    padding: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  contextCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 20,
    overflow: 'hidden' as const,
  },
  contextRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  contextRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  contextLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  contextValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  contextAmountValue: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  proofSection: {
    marginBottom: 20,
  },
  proofLabelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    marginBottom: 3,
  },
  proofTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  proofOptional: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  proofSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  proofList: {
    gap: 8,
    marginBottom: 10,
  },
  proofItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proofImage: {
    width: 44,
    height: 44,
    borderRadius: 8,
  },
  proofFilePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  proofInfo: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  proofLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  proofRemoveBtn: {
    padding: 6,
  },
  addFileButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 7,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    borderStyle: 'dashed' as const,
    backgroundColor: Colors.primarySoft,
  },
  addFileButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  noteSection: {
    marginBottom: 16,
  },
  noteInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    paddingHorizontal: 4,
    paddingBottom: 4,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row' as const,
    gap: 10,
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  confirmButton: {
    flex: 1.6,
    paddingVertical: 15,
    borderRadius: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
