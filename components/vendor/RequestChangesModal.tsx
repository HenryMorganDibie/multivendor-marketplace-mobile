import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Animated,
  TouchableWithoutFeedback,
} from 'react-native';
import { Minus, Plus, Trash2, ArrowRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { type OrderItem } from '@/mocks/ordersData';
import { formatPriceCents, type Currency } from '@/utils/formatPrice';
import type { OrderChangeItem, OrderChangeRequest } from '@/types/orderChanges';

interface EditableItem {
  item: OrderItem;
  originalQty: number;
  newQty: number;
  removed: boolean;
}

interface RequestChangesModalProps {
  visible: boolean;
  onClose: () => void;
  onReview: (changeRequest: Omit<OrderChangeRequest, 'status' | 'createdAt'>) => void;
  items: OrderItem[];
  orderId: string;
  vendorId: string;
  originalTotal: number;
  currency?: Currency;
}

export default function RequestChangesModal({
  visible,
  onClose,
  onReview,
  items,
  orderId,
  vendorId,
  originalTotal,
  currency = 'NGN',
}: RequestChangesModalProps) {
  const [editableItems, setEditableItems] = useState<EditableItem[]>(() =>
    items.map((item) => ({
      item,
      originalQty: item.quantity,
      newQty: item.quantity,
      removed: false,
    }))
  );
  const [reason, setReason] = useState('');

  const resetState = useCallback(() => {
    setEditableItems(
      items.map((item) => ({
        item,
        originalQty: item.quantity,
        newQty: item.quantity,
        removed: false,
      }))
    );
    setReason('');
  }, [items]);

  const handleClose = useCallback(() => {
    resetState();
    onClose();
  }, [resetState, onClose]);

  const handleIncrement = useCallback((index: number) => {
    setEditableItems((prev) =>
      prev.map((ei, i) =>
        i === index ? { ...ei, newQty: ei.newQty + 1, removed: false } : ei
      )
    );
  }, []);

  const handleDecrement = useCallback((index: number) => {
    setEditableItems((prev) =>
      prev.map((ei, i) => {
        if (i !== index) return ei;
        const next = ei.newQty - 1;
        if (next <= 0) return { ...ei, newQty: 0, removed: true };
        return { ...ei, newQty: next };
      })
    );
  }, []);

  const handleRemove = useCallback((index: number) => {
    setEditableItems((prev) =>
      prev.map((ei, i) =>
        i === index ? { ...ei, newQty: 0, removed: true } : ei
      )
    );
  }, []);

  const handleRestore = useCallback((index: number) => {
    setEditableItems((prev) =>
      prev.map((ei, i) =>
        i === index ? { ...ei, newQty: ei.originalQty, removed: false } : ei
      )
    );
  }, []);

  const newTotal = useMemo(() => {
    return editableItems.reduce((sum, ei) => {
      if (ei.removed) return sum;
      const addOnsTotal = ei.item.addOns?.reduce((a, ao) => a + ao.price, 0) ?? 0;
      return sum + (ei.item.price + addOnsTotal) * ei.newQty;
    }, 0);
  }, [editableItems]);

  const hasChanges = useMemo(() => {
    return editableItems.some(
      (ei) => ei.removed || ei.newQty !== ei.originalQty
    );
  }, [editableItems]);

  const changedItems = useMemo((): OrderChangeItem[] => {
    return editableItems
      .filter((ei) => ei.removed || ei.newQty !== ei.originalQty)
      .map((ei) => ({
        itemId: ei.item.id,
        name: ei.item.name,
        originalQty: ei.originalQty,
        newQty: ei.newQty,
        removed: ei.removed,
        originalPrice: ei.item.price,
        newPrice: ei.item.price,
      }));
  }, [editableItems]);

  const handleReview = useCallback(() => {
    console.log('[RequestChangesModal] Reviewing changes:', changedItems);
    onReview({
      orderId,
      vendorId,
      changes: changedItems,
      oldTotal: originalTotal,
      newTotal,
      reason: reason.trim() || null,
    });
  }, [changedItems, orderId, vendorId, originalTotal, newTotal, reason, onReview]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.sheet}>
        <View style={styles.dragHandle} />

        <Text style={styles.title}>Request Changes</Text>
        <Text style={styles.subtitle}>
          Adjust quantities or remove items before accepting
        </Text>

        <ScrollView
          style={styles.itemsList}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {editableItems.map((ei, index) => (
            <View
              key={ei.item.id}
              style={[styles.itemRow, ei.removed && styles.itemRowRemoved]}
            >
              <View style={styles.itemInfo}>
                <Text
                  style={[styles.itemName, ei.removed && styles.itemNameRemoved]}
                  numberOfLines={1}
                >
                  {ei.item.name}
                </Text>
                <Text style={[styles.itemPrice, ei.removed && styles.itemPriceRemoved]}>
                  {formatPriceCents(ei.item.price, currency)} each
                </Text>
                {ei.removed && (
                  <Text style={styles.removedLabel}>Removed</Text>
                )}
                {!ei.removed && ei.newQty !== ei.originalQty && (
                  <Text style={styles.changedLabel}>
                    Qty: {ei.originalQty} → {ei.newQty}
                  </Text>
                )}
              </View>

              {ei.removed ? (
                <TouchableOpacity
                  style={styles.restoreButton}
                  onPress={() => handleRestore(index)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.restoreButtonText}>Restore</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.itemActions}>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => handleRemove(index)}
                    activeOpacity={0.7}
                  >
                    <Trash2 size={16} color={Colors.error} />
                  </TouchableOpacity>
                  <View style={styles.stepper}>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => handleDecrement(index)}
                      activeOpacity={0.7}
                    >
                      <Minus size={16} color={Colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.stepperValue}>{ei.newQty}</Text>
                    <TouchableOpacity
                      style={styles.stepperButton}
                      onPress={() => handleIncrement(index)}
                      activeOpacity={0.7}
                    >
                      <Plus size={16} color={Colors.text} />
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.reasonSection}>
          <Text style={styles.reasonLabel}>Reason for changes (optional)</Text>
          <TextInput
            style={styles.reasonInput}
            value={reason}
            onChangeText={setReason}
            placeholder="e.g. Item out of stock, portion adjustment"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={2}
            maxLength={200}
          />
        </View>

        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Original total</Text>
            <Text style={styles.totalOldValue}>
              {formatPriceCents(originalTotal, currency)}
            </Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalNewLabel}>New total</Text>
            <Text style={styles.totalNewValue}>
              {formatPriceCents(newTotal, currency)}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.reviewButton, !hasChanges && styles.reviewButtonDisabled]}
          onPress={handleReview}
          disabled={!hasChanges}
          activeOpacity={0.7}
        >
          <Text style={[styles.reviewButtonText, !hasChanges && styles.reviewButtonTextDisabled]}>
            Review Changes
          </Text>
          <ArrowRight size={18} color={hasChanges ? '#fff' : Colors.textMuted} />
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
    maxHeight: '85%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
  },
  itemsList: {
    maxHeight: 280,
    marginBottom: 16,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemRowRemoved: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  itemNameRemoved: {
    textDecorationLine: 'line-through' as const,
    color: Colors.textMuted,
  },
  itemPrice: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  itemPriceRemoved: {
    color: Colors.textMuted,
  },
  removedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.error,
    marginTop: 4,
  },
  changedLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginTop: 4,
  },
  itemActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
  },
  removeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#FEF2F2',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  stepper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepperButton: {
    width: 36,
    height: 36,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepperValue: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    minWidth: 28,
    textAlign: 'center' as const,
  },
  restoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
  },
  restoreButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  reasonSection: {
    marginBottom: 16,
  },
  reasonLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  reasonInput: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: Colors.text,
    backgroundColor: '#F9FAFB',
    minHeight: 48,
    textAlignVertical: 'top' as const,
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
  reviewButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  reviewButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  reviewButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#fff',
  },
  reviewButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
