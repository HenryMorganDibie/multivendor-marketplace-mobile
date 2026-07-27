import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Check, MessageCircle } from 'lucide-react-native';
import { useRouter, Stack } from 'expo-router';
import { useVendorChatMode, CustomerChatMode } from '@/contexts/VendorChatModeContext';
import EditScreenHeader from '@/components/EditScreenHeader';

export default function CustomerChatModeScreen() {
  const router = useRouter();
  const { chatMode, setChatMode } = useVendorChatMode();
  const [pendingMode, setPendingMode] = useState<CustomerChatMode | null>(null);
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const handleBackPress = () => {
    router.back();
  };

  const handleSelectMode = (mode: CustomerChatMode) => {
    if (mode === chatMode) return;

    if (mode === 'disabled') {
      setPendingMode(mode);
      setShowDisableModal(true);
    } else {
      void setChatMode(mode);
      showSuccessToast();
    }
  };

  const handleConfirmDisable = () => {
    if (pendingMode) {
      void setChatMode(pendingMode);
      setShowDisableModal(false);
      setPendingMode(null);
      showSuccessToast();
    }
  };

  const handleCancelDisable = () => {
    setShowDisableModal(false);
    setPendingMode(null);
  };

  const showSuccessToast = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 2500);
  };

  const options: { mode: CustomerChatMode; label: string; description: string }[] = [
    {
      mode: 'disabled',
      label: 'Disabled — Orders Only',
      description: 'Customers cannot message you directly. Orders and payments continue normally.',
    },
    {
      mode: 'limited',
      label: 'Limited — Clarifications Only',
      description: 'Customers can only send messages related to order clarifications.',
    },
    {
      mode: 'enabled',
      label: 'Enabled — Full Chat',
      description: 'Customers can message you freely before and during orders.',
    },
  ];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Customer Chat" onBack={handleBackPress} showSave={false} />
      </SafeAreaView>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.iconContainer}>
            <View style={styles.iconCircle}>
              <MessageCircle size={32} color={Colors.text} />
            </View>
          </View>

          <Text style={styles.sectionDescription}>
            Control how customers can communicate with you through chat.
          </Text>

          <View style={styles.optionsCard}>
            {options.map((option, index) => (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.optionRow,
                  index < options.length - 1 && styles.optionRowBorder,
                ]}
                onPress={() => handleSelectMode(option.mode)}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.optionDescription}>{option.description}</Text>
                </View>
                <View style={[styles.radioOuter, chatMode === option.mode && styles.radioOuterSelected]}>
                  {chatMode === option.mode && (
                    <View style={styles.radioInner}>
                      <Check size={14} color={Colors.text} strokeWidth={3} />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <Modal
          visible={showDisableModal}
          animationType="fade"
          transparent
          onRequestClose={handleCancelDisable}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <Text style={styles.modalTitle}>Disable customer chat?</Text>
              
              <View style={styles.modalBullets}>
                <Text style={styles.modalBullet}>• Customers can still place orders normally.</Text>
                <Text style={styles.modalBullet}>• Customers still enter delivery address when placing an order.</Text>
                <Text style={styles.modalBullet}>• Customers still receive payment requests in the order screen + system messages.</Text>
                <Text style={styles.modalBullet}>• the platform AI will still help customers with questions.</Text>
              </View>

              <Text style={styles.modalNote}>
                Chat is optional communication. Orders, address collection, and payment requests continue to function.
              </Text>

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={handleCancelDisable}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={handleConfirmDisable}
                  activeOpacity={0.7}
                >
                  <Text style={styles.modalPrimaryButtonText}>Disable chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {showToast && (
          <View style={styles.toast}>
            <Text style={styles.toastText}>Chat settings updated.</Text>
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  iconContainer: {
    alignItems: 'center' as const,
    marginTop: 24,
    marginBottom: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sectionDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 24,
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  optionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  optionRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  radioInner: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  infoSection: {
    marginTop: 32,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
    textTransform: 'uppercase' as const,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    gap: 12,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  infoBold: {
    fontWeight: '600' as const,
    color: Colors.text,
  },
  bottomSpacer: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  modalBullets: {
    gap: 12,
    marginBottom: 16,
  },
  modalBullet: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  modalNote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginBottom: 24,
    fontStyle: 'italic' as const,
  },
  modalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  modalSecondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
  },
  modalSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  modalPrimaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.error,
    alignItems: 'center' as const,
  },
  modalPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  toast: {
    position: 'absolute' as const,
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: Colors.success,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
  },
  toastText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});
