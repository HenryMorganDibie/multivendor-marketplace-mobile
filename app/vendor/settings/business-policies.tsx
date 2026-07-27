import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import { Colors } from '@/constants/colors';
import { useVendor } from '@/contexts/VendorContext';

const MAX_CHARACTERS = 1000;
const MIN_CHARACTERS = 50;

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const animateLayout = () => {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(220, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );
};

export default function BusinessPoliciesScreen() {
  const router = useRouter();
  const { updateVendor } = useVendor();
  const [persistedEnabled, setPersistedEnabled] = useState(false);
  const [persistedPolicyText, setPersistedPolicyText] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [policyText, setPolicyText] = useState('');
  const [showError, setShowError] = useState(false);
  const [showDiscardModal, setShowDiscardModal] = useState(false);
  const initialValuesRef = useRef({ enabled: false, policyText: '' });
  const hasInteracted = useRef(false);

  useEffect(() => {
    initialValuesRef.current = { enabled: persistedEnabled, policyText: persistedPolicyText };
  }, [persistedEnabled, persistedPolicyText]);

  const hasChanges =
    enabled !== initialValuesRef.current.enabled ||
    policyText !== initialValuesRef.current.policyText;

  const handleToggle = () => {
    hasInteracted.current = true;
    setShowError(false);
    animateLayout();
    setEnabled(!enabled);
  };

  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARACTERS) {
      hasInteracted.current = true;
      setPolicyText(text);
      if (showError && text.length >= MIN_CHARACTERS) {
        setShowError(false);
      }
    }
  };

  const handleSave = () => {
    if (enabled && policyText.length < MIN_CHARACTERS) {
      setShowError(true);
      return;
    }

    setPersistedEnabled(enabled);
    setPersistedPolicyText(policyText);
    initialValuesRef.current = { enabled, policyText };
    hasInteracted.current = false;

    const policyValue = enabled ? policyText : '';
    console.log('Business policy saved:', {
      enabled,
      policyText,
      visible: enabled && policyText.length >= MIN_CHARACTERS,
    });
    updateVendor({ policy: policyValue });
    router.back();
  };

  const handleBackPress = () => {
    if (hasChanges) {
      setShowDiscardModal(true);
    } else {
      router.back();
    }
  };

  const handleDiscard = () => {
    setShowDiscardModal(false);
    setEnabled(initialValuesRef.current.enabled);
    setPolicyText(initialValuesRef.current.policyText);
    setShowError(false);
    hasInteracted.current = false;
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Business Policies',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
          headerLeft: () => (
            <TouchableOpacity
              onPress={handleBackPress}
              style={{ paddingLeft: 8 }}
            >
              <ChevronLeft size={28} color={Colors.charcoal} />
            </TouchableOpacity>
          ),
          headerRight: () => hasChanges ? (
            <TouchableOpacity onPress={handleSave} activeOpacity={0.7}>
              <Text style={policyHeaderStyles.saveText}>Save</Text>
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardView}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
        >
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.sectionLabel}>Business Policy</Text>

            <View style={styles.card}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleTextWrap}>
                  <Text style={styles.toggleLabel}>Enable Policy</Text>
                  <Text style={styles.toggleSubtitle}>
                    Show your policy on your storefront
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.toggle, enabled && styles.toggleActive]}
                  onPress={handleToggle}
                  activeOpacity={0.7}
                >
                  <View style={[styles.toggleThumb, enabled && styles.toggleThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>

            {enabled && (
              <View style={styles.policySection}>
                {showError && (
                  <View style={styles.errorCard}>
                    <Text style={styles.errorText}>
                      Add at least {MIN_CHARACTERS} characters before saving.
                    </Text>
                  </View>
                )}

                <Text style={styles.descriptionText}>
                  Customers see this on your storefront — include refund rules,
                  cancellation terms, pickup instructions, or allergy notices.
                </Text>

                <Text style={styles.sectionTitle}>POLICY TEXT</Text>
                <View style={[styles.inputCard, showError && styles.inputCardError]}>
                  <TextInput
                    style={styles.textArea}
                    value={policyText}
                    onChangeText={handleTextChange}
                    placeholder="Add refund rules, pickup instructions, allergy notices…"
                    placeholderTextColor={Colors.inputPlaceholder}
                    multiline
                    maxLength={MAX_CHARACTERS}
                    textAlignVertical="top"
                  />
                  <View style={styles.counterRow}>
                    <Text style={styles.counterHint}>
                      {policyText.length < MIN_CHARACTERS
                        ? `${MIN_CHARACTERS - policyText.length} more to enable`
                        : 'Looks good'}
                    </Text>
                    <Text style={styles.characterCount}>
                      {policyText.length}/{MAX_CHARACTERS}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <View style={styles.bottomSpacer} />
          </ScrollView>


        </KeyboardAvoidingView>
      </SafeAreaView>

      <DiscardChangesModal
        visible={showDiscardModal}
        onKeepEditing={() => setShowDiscardModal(false)}
        onDiscard={handleDiscard}
      />
    </View>
  );
}

const policyHeaderStyles = StyleSheet.create({
  saveText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 10,
    letterSpacing: -0.2,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  toggleTextWrap: {
    flex: 1,
    paddingRight: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '600' as const,
    letterSpacing: -0.2,
  },
  toggleSubtitle: {
    fontSize: 13,
    color: Colors.textTertiary,
    marginTop: 2,
    lineHeight: 17,
  },
  policySection: {
    marginTop: 4,
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: 'center' as const,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: Colors.background,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }],
  },
  errorCard: {
    backgroundColor: Colors.errorLight,
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
  },
  descriptionText: {
    fontSize: 13,
    color: Colors.textTertiary,
    lineHeight: 19,
    marginTop: 14,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 0.6,
    marginTop: 16,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  inputCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inputCardError: {
    borderColor: Colors.errorBorder,
  },
  textArea: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.text,
    minHeight: 132,
    paddingVertical: 0,
  },
  counterRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  counterHint: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontVariant: ['tabular-nums'] as const,
  },
  bottomSpacer: {
    height: 20,
  },
});
