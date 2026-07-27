import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  TextInput,
  StyleSheet,
} from 'react-native';
import { ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { DECLINE_REASONS } from '@/features/orders/actions/orderActions';

interface DeclineOrderSheetProps {
  visible: boolean;
  declineReasonCode: string;
  declineReasonText: string;
  showDropdown: boolean;
  onSetDeclineReasonCode: (code: string) => void;
  onSetDeclineReasonText: (text: string) => void;
  onSetShowDropdown: (show: boolean) => void;
  onDismiss: () => void;
  onConfirmDecline: () => void;
}

export default function DeclineOrderSheet({
  visible,
  declineReasonCode,
  declineReasonText,
  showDropdown,
  onSetDeclineReasonCode,
  onSetDeclineReasonText,
  onSetShowDropdown,
  onDismiss,
  onConfirmDecline,
}: DeclineOrderSheetProps) {
  const isConfirmDisabled =
    !declineReasonCode || (declineReasonCode === 'other' && !declineReasonText.trim());

  const selectedLabel = DECLINE_REASONS.find(r => r.code === declineReasonCode)?.label;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.dismiss} activeOpacity={1} onPress={onDismiss} />
        <View style={styles.sheet}>
          <View style={styles.handle} />

          <Text style={styles.title}>Decline order</Text>
          <Text style={styles.subtitle}>
            Let the customer know why you can't fulfill this order.
          </Text>

          <View style={styles.dropdownContainer}>
            <TouchableOpacity
              style={[styles.dropdownButton, showDropdown && styles.dropdownButtonOpen]}
              onPress={() => onSetShowDropdown(!showDropdown)}
              activeOpacity={0.7}
              testID="decline-reason-dropdown"
            >
              <Text style={[styles.dropdownText, declineReasonCode && styles.dropdownTextSelected]}>
                {selectedLabel ?? 'Select reason'}
              </Text>
              <ChevronDown
                size={18}
                color={Colors.textMuted}
                style={{ transform: [{ rotate: showDropdown ? '180deg' : '0deg' }] }}
              />
            </TouchableOpacity>

            {showDropdown && (
              <View style={styles.dropdownList}>
                <ScrollView
                  style={styles.dropdownScroll}
                  showsVerticalScrollIndicator={false}
                  nestedScrollEnabled
                >
                  {DECLINE_REASONS.map((reason, index) => (
                    <TouchableOpacity
                      key={reason.code}
                      style={[
                        styles.dropdownItem,
                        index < DECLINE_REASONS.length - 1 && styles.dropdownItemBorder,
                        declineReasonCode === reason.code && styles.dropdownItemSelected,
                      ]}
                      onPress={() => {
                        onSetDeclineReasonCode(reason.code);
                        if (reason.code !== 'other') onSetDeclineReasonText('');
                        onSetShowDropdown(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          declineReasonCode === reason.code && styles.dropdownItemTextSelected,
                        ]}
                      >
                        {reason.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {declineReasonCode === 'other' && (
            <View style={styles.textareaContainer}>
              <TextInput
                style={styles.textarea}
                value={declineReasonText}
                onChangeText={(t) => onSetDeclineReasonText(t.slice(0, 120))}
                placeholder="Briefly explain the reason..."
                placeholderTextColor={Colors.textMuted}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={120}
              />
              <Text style={styles.charCount}>{declineReasonText.length}/120</Text>
            </View>
          )}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onDismiss}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelButtonText}>Go back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.declineButton, isConfirmDisabled && styles.declineButtonDisabled]}
              onPress={onConfirmDecline}
              disabled={isConfirmDisabled}
              activeOpacity={0.7}
              testID="confirm-decline-button"
            >
              <Text style={styles.declineButtonText}>Decline order</Text>
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
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end' as const,
  },
  dismiss: { flex: 1 },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 36,
    maxHeight: '80%' as any,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 12,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: 24,
  },
  dropdownContainer: {
    marginBottom: 16,
    zIndex: 10,
  },
  dropdownButton: {
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
  dropdownButtonOpen: {
    borderColor: Colors.textSecondary,
  },
  dropdownText: {
    fontSize: 15,
    color: Colors.textMuted,
    flex: 1,
  },
  dropdownTextSelected: {
    color: Colors.text,
    fontWeight: '500' as const,
  },
  dropdownList: {
    marginTop: 4,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  dropdownScroll: { maxHeight: 220 },
  dropdownItem: {
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  dropdownItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemSelected: {
    backgroundColor: '#FFF3F3',
  },
  dropdownItemText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
  },
  dropdownItemTextSelected: {
    color: '#DC2626',
    fontWeight: '600' as const,
  },
  textareaContainer: {
    marginBottom: 8,
  },
  textarea: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: Colors.text,
    minHeight: 88,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 6,
  },
  actions: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
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
  declineButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#DC2626',
  },
  declineButtonDisabled: {
    backgroundColor: '#F5A5A5',
  },
  declineButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
