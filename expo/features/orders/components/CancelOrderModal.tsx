import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, StyleSheet } from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { CANCELLATION_REASONS } from '@/features/orders/actions/orderActions';

interface CancelOrderModalProps {
  visible: boolean;
  cancelReasonCode: string;
  cancelReasonText: string;
  showCancelDropdown: boolean;
  onSetCancelReasonCode: (code: string) => void;
  onSetCancelReasonText: (text: string) => void;
  onSetShowCancelDropdown: (show: boolean) => void;
  onKeepOrder: () => void;
  onConfirmCancel: () => void;
}

export default function CancelOrderModal({
  visible,
  cancelReasonCode,
  cancelReasonText,
  showCancelDropdown,
  onSetCancelReasonCode,
  onSetCancelReasonText,
  onSetShowCancelDropdown,
  onKeepOrder,
  onConfirmCancel,
}: CancelOrderModalProps) {
  const isConfirmDisabled =
    !cancelReasonCode || (cancelReasonCode === 'other' && !cancelReasonText.trim());

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onKeepOrder}
    >
      <View style={styles.cancelModalOverlay}>
        <TouchableOpacity
          style={styles.cancelModalDismiss}
          activeOpacity={1}
          onPress={onKeepOrder}
        />
        <View style={styles.cancelModalSheet}>
          <View style={styles.cancelModalHandle} />
          <Text style={styles.cancelModalTitle}>Cancel this order?</Text>
          <Text style={styles.cancelModalSubtitle}>Please select a reason so we can improve your experience.</Text>

          <View style={styles.cancelDropdownContainer}>
            <TouchableOpacity
              style={styles.cancelDropdownButton}
              onPress={() => onSetShowCancelDropdown(!showCancelDropdown)}
              activeOpacity={0.7}
              testID="cancel-reason-dropdown"
            >
              <Text style={[
                styles.cancelDropdownButtonText,
                cancelReasonCode ? styles.cancelDropdownButtonTextSelected : null,
              ]}>
                {cancelReasonCode
                  ? CANCELLATION_REASONS.find(r => r.code === cancelReasonCode)?.label ?? 'Select reason'
                  : 'Select reason'}
              </Text>
              <ChevronDown size={18} color={Colors.textMuted} />
            </TouchableOpacity>
            {showCancelDropdown && (
              <View style={styles.cancelDropdownList}>
                <ScrollView
                  style={styles.cancelDropdownScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {CANCELLATION_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.code}
                      style={[
                        styles.cancelDropdownItem,
                        cancelReasonCode === reason.code && styles.cancelDropdownItemSelected,
                      ]}
                      onPress={() => {
                        onSetCancelReasonCode(reason.code);
                        if (reason.code !== 'other') onSetCancelReasonText('');
                        onSetShowCancelDropdown(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[
                        styles.cancelDropdownItemText,
                        cancelReasonCode === reason.code && styles.cancelDropdownItemTextSelected,
                      ]}>
                        {reason.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {(cancelReasonCode === 'item_unavailable' || cancelReasonCode === 'ingredient_unavailable') && (
            <View style={styles.suggestionRow}>
              <Text style={styles.suggestionText}>💡 Consider requesting changes instead</Text>
            </View>
          )}

          {cancelReasonCode === 'other' && (
            <View style={styles.cancelOtherInputContainer}>
              <Text style={styles.cancelOtherInputLabel}>Please provide details</Text>
              <TextInput
                style={styles.cancelOtherInput}
                value={cancelReasonText}
                onChangeText={(text) => onSetCancelReasonText(text.slice(0, 100))}
                placeholder="Describe the reason for cancellation..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={100}
              />
              <Text style={styles.cancelOtherCharCount}>{cancelReasonText.length}/100</Text>
            </View>
          )}

          <View style={styles.cancelModalActions}>
            <TouchableOpacity
              style={styles.cancelModalKeepButton}
              onPress={onKeepOrder}
              activeOpacity={0.7}
              testID="keep-order-button"
            >
              <Text style={styles.cancelModalKeepText}>Keep Order</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.cancelModalConfirmButton,
                isConfirmDisabled && styles.cancelModalConfirmButtonDisabled,
              ]}
              onPress={onConfirmCancel}
              disabled={isConfirmDisabled}
              activeOpacity={0.7}
              testID="confirm-cancel-button"
            >
              <Text style={styles.cancelModalConfirmText}>Cancel Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  cancelModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end' as const,
  },
  cancelModalDismiss: { flex: 1 },
  cancelModalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    maxHeight: '80%' as any,
  },
  cancelModalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 20,
  },
  cancelModalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  cancelModalSubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 20,
    lineHeight: 20,
  },
  cancelDropdownContainer: { marginBottom: 8, zIndex: 10 },
  suggestionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  suggestionText: {
    fontSize: 13,
    color: '#6B7280',
    fontStyle: 'italic' as const,
  },
  cancelDropdownButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  cancelDropdownButtonText: { fontSize: 15, color: Colors.textMuted, flex: 1 },
  cancelDropdownButtonTextSelected: { color: Colors.text, fontWeight: '500' as const },
  cancelDropdownList: {
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  cancelDropdownScroll: { maxHeight: 240 },
  cancelDropdownItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelDropdownItemSelected: { backgroundColor: Colors.primarySoft },
  cancelDropdownItemText: { fontSize: 15, color: Colors.text, lineHeight: 20 },
  cancelDropdownItemTextSelected: { color: Colors.primary, fontWeight: '600' as const },
  cancelOtherInputContainer: { marginTop: 4, marginBottom: 8 },
  cancelOtherInputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  cancelOtherInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 80,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelOtherCharCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 6,
  },
  cancelModalActions: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 20,
  },
  cancelModalKeepButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 50,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cancelModalKeepText: { fontSize: 15, fontWeight: '500' as const, color: Colors.textSecondary },
  cancelModalConfirmButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 50,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  cancelModalConfirmButtonDisabled: { opacity: 0.4 },
  cancelModalConfirmText: { fontSize: 15, fontWeight: '600' as const, color: Colors.primary },
});
