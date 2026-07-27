import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TouchableWithoutFeedback,
} from 'react-native';
import { Send, ArrowLeft, ArrowDown, Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { formatPriceCents, type Currency } from '@/utils/formatPrice';
import type { OrderChangeRequest } from '@/types/orderChanges';

interface ChangeSummaryModalProps {
  visible: boolean;
  onClose: () => void;
  onBack: () => void;
  onSend: (changeRequest: OrderChangeRequest) => void;
  changeData: Omit<OrderChangeRequest, 'status' | 'createdAt'> | null;
  currency?: Currency;
}

export default function ChangeSummaryModal({
  visible,
  onClose,
  onBack,
  onSend,
  changeData,
  currency = 'NGN',
}: ChangeSummaryModalProps) {
  const handleSend = useCallback(() => {
    if (!changeData) return;
    const fullRequest: OrderChangeRequest = {
      ...changeData,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    console.log('[ChangeSummaryModal] Sending change request:', fullRequest);
    onSend(fullRequest);
  }, [changeData, onSend]);

  if (!changeData) return null;

  const savings = changeData.oldTotal - changeData.newTotal;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.dragHandle} />

        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <ArrowLeft size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Review Changes</Text>
          <View style={styles.headerSpacer} />
        </View>

        <Text style={styles.subtitle}>
          Confirm before sending to customer
        </Text>

        <ScrollView
          style={styles.changesList}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {changeData.changes.map((change) => (
            <View key={change.itemId} style={styles.changeRow}>
              <View style={styles.changeIcon}>
                {change.removed ? (
                  <Trash2 size={14} color={Colors.error} />
                ) : (
                  <ArrowDown
                    size={14}
                    color={Colors.primary}
                    style={{ transform: [{ rotate: change.newQty > change.originalQty ? '180deg' : '0deg' }] }}
                  />
                )}
              </View>
              <View style={styles.changeInfo}>
                <Text style={styles.changeName}>{change.name}</Text>
                {change.removed ? (
                  <Text style={styles.changeDetail}>Removed</Text>
                ) : (
                  <Text style={styles.changeDetailQty}>
                    Qty: {change.originalQty} → {change.newQty}
                  </Text>
                )}
              </View>
            </View>
          ))}
        </ScrollView>

        {changeData.reason ? (
          <View style={styles.reasonBox}>
            <Text style={styles.reasonBoxLabel}>Reason</Text>
            <Text style={styles.reasonBoxText}>{changeData.reason}</Text>
          </View>
        ) : null}

        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Old Total</Text>
            <Text style={styles.totalOldValue}>
              {formatPriceCents(changeData.oldTotal, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalNewLabel}>New Total</Text>
            <Text style={styles.totalNewValue}>
              {formatPriceCents(changeData.newTotal, currency)}
            </Text>
          </View>
          {savings > 0 && (
            <View style={styles.savingsRow}>
              <Text style={styles.savingsText}>
                Customer saves {formatPriceCents(savings, currency)}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.sendButton}
          onPress={handleSend}
          activeOpacity={0.7}
        >
          <Send size={18} color="#fff" />
          <Text style={styles.sendButtonText}>Send Changes</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '80%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 36,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  changesList: {
    maxHeight: 220,
    marginBottom: 16,
  },
  changeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  changeIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#fff',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  changeInfo: {
    flex: 1,
  },
  changeName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  changeDetail: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.error,
  },
  changeDetailQty: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  reasonBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  reasonBoxLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#92400E',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 4,
  },
  reasonBoxText: {
    fontSize: 14,
    color: '#78350F',
    lineHeight: 20,
  },
  totalSection: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  totalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
  },
  totalLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  totalOldValue: {
    fontSize: 14,
    color: Colors.textMuted,
    textDecorationLine: 'line-through' as const,
  },
  totalNewLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalNewValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  savingsRow: {
    marginTop: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  savingsText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.success,
    textAlign: 'center' as const,
  },
  sendButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
});
