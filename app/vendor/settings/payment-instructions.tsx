import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import DiscardChangesModal from '@/components/DiscardChangesModal';

const MAX_CHARS = 200;

export default function PaymentInstructionsScreen() {
  const router = useRouter();
  const [instructions, setInstructions] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [attestationChecked, setAttestationChecked] = useState<boolean>(false);

  const unsavedChanges = useUnsavedChanges(
    { instructions, attestationChecked },
    false
  );



  const validateInstructions = (text: string): boolean => {
    const urlPattern =
      /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9-]+\.(com|net|org|io|app|co))/gi;
    if (urlPattern.test(text)) {
      setError('Links are not allowed in payment instructions.');
      return false;
    }
    setError('');
    return true;
  };

  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARS) {
      setInstructions(text);
      if (text.trim().length > 0) {
        validateInstructions(text);
      } else {
        setError('');
      }
    }
  };

  const isSaveEnabled =
    (instructions.trim().length > 0 || attestationChecked) &&
    error.length === 0;

  const handleSave = () => {
    if (!isSaveEnabled) return;

    if (instructions.trim().length > 0) {
      if (!validateInstructions(instructions)) return;
    }

    const timestamp = new Date().toISOString();
    console.log('Payment instructions saved:', {
      instructions,
      attestationAccepted: attestationChecked,
      attestationTimestamp: timestamp,
    });
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Payment Instructions',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!isSaveEnabled || !unsavedChanges.hasUnsavedChanges}
              activeOpacity={0.7}
            >
              <Text style={[payHeaderStyles.saveText, (!isSaveEnabled || !unsavedChanges.hasUnsavedChanges) && payHeaderStyles.saveTextDisabled]}>Save</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.helperText}>
            These instructions are shown to customers when you request payment.
          </Text>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>
              Default Payment Instructions{' '}
              <Text style={styles.optional}>(Optional)</Text>
            </Text>

            <View style={styles.inputWrapper}>
              <TextInput
                style={styles.textInput}
                placeholder="Example: Please include your order ID as the transfer narration."
                placeholderTextColor={Colors.inputPlaceholder}
                value={instructions}
                onChangeText={handleTextChange}
                multiline
                textAlignVertical="top"
                maxLength={MAX_CHARS}
                testID="payment-instructions-input"
              />
              <Text style={styles.charCounter}>
                {instructions.length} / {MAX_CHARS}
              </Text>
            </View>

            {error.length > 0 && (
              <Text style={styles.errorText}>{error}</Text>
            )}
          </View>

          <TouchableOpacity
            style={styles.attestationRow}
            onPress={() => setAttestationChecked(!attestationChecked)}
            activeOpacity={0.7}
            testID="attestation-checkbox"
          >
            <View
              style={[
                styles.checkbox,
                attestationChecked && styles.checkboxChecked,
              ]}
            >
              {attestationChecked && (
                <Text style={styles.checkmark}>✓</Text>
              )}
            </View>
            <Text style={styles.attestationText}>
              I confirm that this payment information belongs to me or my
              business and that I am responsible for payment collection.
            </Text>
          </TouchableOpacity>

          <Text style={styles.footerNote}>
            Payment instructions are guidance only. the platform does not process
            payments or verify payment ownership.
          </Text>

        </ScrollView>
      </SafeAreaView>

      <DiscardChangesModal
        visible={unsavedChanges.showDiscardModal}
        onKeepEditing={unsavedChanges.handleKeepEditing}
        onDiscard={() => {
          unsavedChanges.handleDiscard();
          router.back();
        }}
      />
    </View>
  );
}

const payHeaderStyles = StyleSheet.create({
  saveText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  saveTextDisabled: {
    color: Colors.textMuted,
    opacity: 0.5,
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 32,
  },
  helperText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 24,
  },
  fieldBlock: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  optional: {
    fontWeight: '400' as const,
    textTransform: 'none' as const,
    letterSpacing: 0,
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.surface,
    overflow: 'hidden' as const,
  },
  textInput: {
    fontSize: 15,
    color: Colors.inputText,
    padding: 14,
    minHeight: 110,
    maxHeight: 180,
  },
  charCounter: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    textAlign: 'right' as const,
    paddingHorizontal: 14,
    paddingBottom: 10,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    lineHeight: 18,
    marginTop: 6,
  },
  attestationRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    marginBottom: 20,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 1,
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkmark: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  attestationText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 21,
  },
  footerNote: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 19,
    marginBottom: 24,
  },

});
