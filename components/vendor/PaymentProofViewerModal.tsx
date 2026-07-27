import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { X, FileText, Download } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { PaymentProof } from '@/mocks/ordersData';

interface PaymentProofViewerModalProps {
  visible: boolean;
  onClose: () => void;
  proofs: PaymentProof[];
  customerName: string;
}

export default function PaymentProofViewerModal({
  visible,
  onClose,
  proofs,
  customerName,
}: PaymentProofViewerModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.dismissArea}
          activeOpacity={1}
          onPress={onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Payment Proof</Text>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={onClose}
              activeOpacity={0.7}
              testID="close-proof-viewer"
            >
              <X size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={styles.subtitle}>
            Uploaded by {customerName}
          </Text>

          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={styles.scrollContent}
          >
            {proofs.length === 0 ? (
              <View style={styles.emptyState}>
                <FileText size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No payment proof uploaded</Text>
              </View>
            ) : (
              proofs.map((proof) => (
                <View key={proof.id} style={styles.proofCard}>
                  {proof.type === 'image' ? (
                    <Image
                      source={{ uri: proof.uri }}
                      style={styles.proofImage}
                      contentFit="contain"
                    />
                  ) : (
                    <View style={styles.pdfPlaceholder}>
                      <FileText size={40} color={Colors.textMuted} />
                      <Text style={styles.pdfLabel}>PDF Document</Text>
                    </View>
                  )}
                  <View style={styles.proofMeta}>
                    <Text style={styles.proofTimestamp}>
                      {new Date(proof.uploadedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.doneButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.doneButtonText}>Done</Text>
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
      },
      android: {
        elevation: 12,
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
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    paddingHorizontal: 20,
    marginTop: 4,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  emptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 40,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  proofCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  proofImage: {
    width: '100%',
    height: 280,
    backgroundColor: Colors.surface,
  },
  pdfPlaceholder: {
    width: '100%',
    height: 160,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    gap: 8,
  },
  pdfLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  proofMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  proofTimestamp: {
    fontSize: 13,
    color: Colors.textMuted,
  },
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  doneButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  doneButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
