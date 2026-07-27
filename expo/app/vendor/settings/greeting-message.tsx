import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle, Check, ChevronRight, Power } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = Math.min(SCREEN_HEIGHT * 0.48, 430);
const MAX_MESSAGE_LENGTH = 300;

type GreetingMessagePayload = {
  enabled: boolean;
  message: string;
  updatedAt: string;
  vendorId: string;
};

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateLayout(): void {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );
}

function formatDateTime(value?: string): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function EnabledMessageSection({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [-4, 0] });

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  if (!visible) return null;

  return (
    <Animated.View style={{ opacity, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}

export default function GreetingMessageScreen() {
  const router = useRouter();
  const { vendor, updateVendor } = useVendor();
  const savedGreeting = vendor.greetingMessageSettings;
  const initialEnabled = savedGreeting?.enabled ?? false;
  const initialMessage = savedGreeting?.message ?? '';

  const [isEnabled, setIsEnabled] = useState<boolean>(initialEnabled);
  const [messageText, setMessageText] = useState<string>(initialMessage);
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false);
  const [tempMessage, setTempMessage] = useState<string>('');
  const [hasEditorChanges, setHasEditorChanges] = useState<boolean>(false);
  const [isInputFocused, setIsInputFocused] = useState<boolean>(false);

  const trimmedMessage = messageText.trim();
  const hasValidMessage = trimmedMessage.length > 0;
  const isEffectivelyEnabled = isEnabled && hasValidMessage;
  const lastUpdatedLabel = formatDateTime(savedGreeting?.updatedAt);
  const statusLabel = isEffectivelyEnabled ? 'Active' : isEnabled ? 'Needs action' : 'Disabled';

  const saveGreetingPayload = useCallback((enabled: boolean, message: string): void => {
    const sanitizedMessage = message.trim();
    const payload: GreetingMessagePayload = {
      enabled: enabled && sanitizedMessage.length > 0,
      message: sanitizedMessage,
      updatedAt: new Date().toISOString(),
      vendorId: vendor.id,
    };

    updateVendor({ greetingMessageSettings: payload });
    console.log('[GREETING_MESSAGE] Settings saved:', payload);
  }, [updateVendor, vendor.id]);

  const handleToggle = useCallback((value: boolean): void => {
    animateLayout();
    setIsEnabled(value);
    saveGreetingPayload(value, messageText);

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, [messageText, saveGreetingPayload]);

  const handleDisable = useCallback((): void => {
    animateLayout();
    setIsEnabled(false);
    saveGreetingPayload(false, messageText);
  }, [messageText, saveGreetingPayload]);

  const openEditor = useCallback((): void => {
    setTempMessage(messageText);
    setHasEditorChanges(false);
    setIsInputFocused(false);
    setIsEditorOpen(true);

    if (Platform.OS !== 'web') {
      void Haptics.selectionAsync();
    }
  }, [messageText]);

  const handleCancel = useCallback((): void => {
    setIsEditorOpen(false);
    setIsInputFocused(false);
  }, []);

  const handleSave = useCallback((): void => {
    const sanitizedMessage = tempMessage.trim();
    setMessageText(sanitizedMessage);
    saveGreetingPayload(isEnabled, sanitizedMessage);
    setIsEditorOpen(false);
    setHasEditorChanges(false);
    setIsInputFocused(false);

    if (Platform.OS !== 'web') {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }, [isEnabled, saveGreetingPayload, tempMessage]);

  const handleTextChange = useCallback((text: string): void => {
    if (text.length <= MAX_MESSAGE_LENGTH) {
      setTempMessage(text);
      setHasEditorChanges(text !== messageText);
    }
  }, [messageText]);

  const getMessagePreview = useCallback((): string => {
    if (!messageText.trim()) return 'Not set';
    return messageText.length > 54 ? `${messageText.substring(0, 54).trim()}…` : messageText;
  }, [messageText]);

  const canSaveMessage = useMemo<boolean>(() => {
    return hasEditorChanges && tempMessage.trim().length > 0;
  }, [hasEditorChanges, tempMessage]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Greeting Message" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introSection}>
            <Text style={styles.sectionTitle}>Automatic Greeting</Text>
            <Text style={styles.sectionDescription}>
              Sent only when a new inquiry chat starts from Message Vendor. It is informational only and does not confirm orders.
            </Text>
          </View>

          <View style={styles.statusCard}>
            <View style={styles.statusTopRow}>
              <View style={styles.statusCopy}>
                <Text style={styles.statusEyebrow}>Greeting status</Text>
                <Text style={styles.statusTitle}>{isEffectivelyEnabled ? 'Greeting is active' : isEnabled ? 'Message needed' : 'Greeting disabled'}</Text>
              </View>
              <View style={[styles.statusBadge, isEffectivelyEnabled ? styles.activeBadge : isEnabled ? styles.warningBadge : styles.disabledBadge]}>
                {isEffectivelyEnabled && <Check size={13} color={Colors.success} strokeWidth={2.5} />}
                <Text style={[styles.statusBadgeText, isEffectivelyEnabled ? styles.activeBadgeText : isEnabled ? styles.warningBadgeText : styles.disabledBadgeText]}>{statusLabel}</Text>
              </View>
            </View>
            {savedGreeting?.updatedAt ? <Text style={styles.lastUpdatedText}>Last updated {lastUpdatedLabel}</Text> : null}
          </View>

          <Pressable
            onPress={() => handleToggle(!isEnabled)}
            accessibilityRole="switch"
            accessibilityState={{ checked: isEnabled }}
            accessibilityLabel="Send greeting message"
            style={({ pressed }) => [
              styles.toggleCard,
              isEnabled && styles.toggleCardActive,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.toggleTextWrap}>
              <Text style={styles.toggleLabel}>Send greeting message</Text>
              <Text style={styles.toggleSubtitle}>
                {isEffectivelyEnabled ? 'Active for new customer chats' : 'Set a message before this becomes active'}
              </Text>
            </View>
            <View style={styles.switchWrap} pointerEvents="none">
              <Switch
                value={isEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: Colors.borderDark, true: 'rgba(255,122,40,0.42)' }}
                thumbColor={isEnabled ? Colors.primary : Colors.white}
                ios_backgroundColor={Colors.borderDark}
                style={styles.switch}
              />
            </View>
          </Pressable>

          <EnabledMessageSection visible={isEnabled}>
            <View style={styles.messageSection}>
              <Text style={styles.sectionLabel}>MESSAGE</Text>
              <Pressable
                style={({ pressed }) => [styles.messageRow, pressed && styles.rowPressed]}
                onPress={openEditor}
                accessibilityRole="button"
                accessibilityLabel="Edit greeting message"
              >
                <View style={styles.messageRowText}>
                  <Text style={styles.messageLabel}>Message</Text>
                  <Text style={[styles.messagePreview, !hasValidMessage && styles.messagePreviewEmpty]} numberOfLines={2}>
                    {getMessagePreview()}
                  </Text>
                </View>
                <ChevronRight size={18} color={Colors.textMuted} strokeWidth={2.1} />
              </Pressable>

              {isEnabled && !hasValidMessage && (
                <View style={styles.guidanceCard}>
                  <AlertTriangle size={15} color={Colors.warning} strokeWidth={2.2} />
                  <Text style={styles.guidanceText}>
                    Greeting is enabled but no message is set. Add a message to make it active.
                  </Text>
                </View>
              )}

              {isEffectivelyEnabled && (
                <View style={styles.savedPreviewCard}>
                  <Text style={styles.savedPreviewLabel}>Message preview</Text>
                  <Text style={styles.savedPreviewText}>{messageText}</Text>
                </View>
              )}

              <View style={styles.actionStack}>
                <Pressable style={({ pressed }) => [styles.secondaryActionButton, pressed && styles.rowPressed]} onPress={openEditor}>
                  <Text style={styles.secondaryActionText}>{hasValidMessage ? 'Edit Message' : 'Add Message'}</Text>
                </Pressable>
                {isEnabled && (
                  <Pressable style={({ pressed }) => [styles.disableActionButton, pressed && styles.rowPressed]} onPress={handleDisable}>
                    <Power size={15} color={Colors.destructive} strokeWidth={2.1} />
                    <Text style={styles.disableActionText}>Disable Greeting</Text>
                  </Pressable>
                )}
              </View>
            </View>
          </EnabledMessageSection>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isEditorOpen}
        animationType="slide"
        transparent
        onRequestClose={handleCancel}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCancel}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <Pressable onPress={(event) => event.stopPropagation()}>
              <SafeAreaView edges={['bottom']} style={[styles.modalContainer, { minHeight: MODAL_HEIGHT }]}>
                <View style={styles.modalHandle} />
                <View style={styles.modalHeader}>
                  <Pressable
                    onPress={handleCancel}
                    style={({ pressed }) => [styles.modalHeaderButton, pressed && styles.modalButtonPressed]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.modalCancelText}>Cancel</Text>
                  </Pressable>

                  <Text style={styles.modalTitle}>Greeting message</Text>

                  <Pressable
                    onPress={canSaveMessage ? handleSave : undefined}
                    disabled={!canSaveMessage}
                    style={({ pressed }) => [
                      styles.modalSaveButton,
                      !canSaveMessage && styles.modalSaveButtonDisabled,
                      pressed && canSaveMessage && styles.modalButtonPressed,
                    ]}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={[styles.modalSaveText, !canSaveMessage && styles.modalSaveTextDisabled]}>
                      Save
                    </Text>
                  </Pressable>
                </View>

                <ScrollView
                  style={styles.modalContent}
                  contentContainerStyle={styles.modalContentContainer}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={[styles.editorCard, isInputFocused && styles.editorCardFocused]}>
                    <TextInput
                      style={styles.messageEditor}
                      placeholder="Write a short welcome message…"
                      placeholderTextColor={Colors.inputPlaceholder}
                      value={tempMessage}
                      onChangeText={handleTextChange}
                      maxLength={MAX_MESSAGE_LENGTH}
                      multiline
                      textAlignVertical="top"
                      autoFocus
                      onFocus={() => setIsInputFocused(true)}
                      onBlur={() => setIsInputFocused(false)}
                    />
                    <View style={styles.counterRow}>
                      <Text style={styles.counterHint}>Line breaks are preserved</Text>
                      <Text style={styles.charCounter}>{tempMessage.length}/{MAX_MESSAGE_LENGTH}</Text>
                    </View>
                  </View>
                </ScrollView>
              </SafeAreaView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </View>
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
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  introSection: {
    paddingHorizontal: 4,
    marginBottom: 14,
    maxWidth: 560,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  statusCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 15,
    marginBottom: 12,
  },
  statusTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  statusCopy: {
    flex: 1,
    minWidth: 0,
  },
  statusEyebrow: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.55,
    marginBottom: 5,
  },
  statusTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    lineHeight: 22,
  },
  statusBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700' as const,
  },
  activeBadge: {
    backgroundColor: Colors.successLight,
    borderColor: Colors.successBorder,
  },
  activeBadgeText: {
    color: Colors.success,
  },
  warningBadge: {
    backgroundColor: Colors.warningLight,
    borderColor: Colors.warningBorder,
  },
  warningBadgeText: {
    color: Colors.warning,
  },
  disabledBadge: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  disabledBadgeText: {
    color: Colors.textSecondary,
  },
  lastUpdatedText: {
    fontSize: 12,
    color: Colors.textTertiary,
    marginTop: 9,
    fontWeight: '500' as const,
  },
  toggleCard: {
    minHeight: 74,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 13,
    paddingLeft: 16,
    paddingRight: 12,
    shadowColor: Colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  toggleCardActive: {
    backgroundColor: Colors.primarySofter,
  },
  cardPressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: 14,
  },
  toggleLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600' as const,
    lineHeight: 21,
    letterSpacing: -0.2,
    marginBottom: 2,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  switchWrap: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  switch: {
    transform: [{ scaleX: 0.86 }, { scaleY: 0.86 }],
  },
  messageSection: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  messageRow: {
    minHeight: 70,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 13,
  },
  rowPressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  messageRowText: {
    flex: 1,
    paddingRight: 12,
  },
  messageLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
    lineHeight: 21,
    marginBottom: 3,
  },
  messagePreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  messagePreviewEmpty: {
    color: Colors.textMuted,
  },
  guidanceCard: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
  },
  guidanceText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  savedPreviewCard: {
    marginTop: 10,
    padding: 14,
    borderRadius: 16,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  savedPreviewLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 7,
  },
  savedPreviewText: {
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
  actionStack: {
    gap: 10,
    marginTop: 12,
  },
  secondaryActionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  secondaryActionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  disableActionButton: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
    backgroundColor: Colors.errorLight,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexDirection: 'row' as const,
    gap: 8,
  },
  disableActionText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.destructive,
  },
  bottomSpacer: {
    height: 28,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(11, 12, 15, 0.46)',
    justifyContent: 'flex-end' as const,
  },
  keyboardAvoid: {
    justifyContent: 'flex-end' as const,
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    overflow: 'hidden' as const,
    shadowColor: Colors.black,
    shadowOpacity: 0.12,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -8 },
    elevation: 12,
  },
  modalHandle: {
    alignSelf: 'center' as const,
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderDark,
    marginTop: 9,
    marginBottom: 6,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  modalHeaderButton: {
    minWidth: 66,
    minHeight: 36,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
    borderRadius: 18,
  },
  modalSaveButton: {
    minWidth: 66,
    height: 34,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 17,
    backgroundColor: Colors.primaryTint,
  },
  modalSaveButtonDisabled: {
    backgroundColor: Colors.surface,
  },
  modalButtonPressed: {
    opacity: 0.72,
  },
  modalTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    letterSpacing: -0.15,
  },
  modalCancelText: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  modalSaveText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  modalSaveTextDisabled: {
    color: Colors.textMuted,
  },
  modalContent: {
    flexGrow: 0,
  },
  modalContentContainer: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
  },
  editorCard: {
    backgroundColor: Colors.inputBackground,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    paddingHorizontal: 14,
    paddingTop: 13,
    paddingBottom: 10,
  },
  editorCardFocused: {
    borderColor: 'rgba(255,122,40,0.42)',
    backgroundColor: Colors.cardBackground,
  },
  messageEditor: {
    minHeight: 116,
    maxHeight: 154,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    paddingVertical: 0,
    textAlignVertical: 'top' as const,
  },
  counterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.borderLight,
  },
  counterHint: {
    flex: 1,
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  charCounter: {
    fontSize: 12,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'] as const,
  },
});
