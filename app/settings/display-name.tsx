import React, { useState, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import LaektivaModal from '@/components/LaektivaModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';

export default function DisplayNameScreen() {
  const router = useRouter();
  const { user, updateUserProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user?.firstName) {
      setFirstName(user.firstName);
    }
    if (user?.lastName) {
      setLastInitial(user.lastName.charAt(0).toUpperCase());
    }
  }, [user]);

  const displayNamePreview = firstName.trim() 
    ? (lastInitial ? `${firstName.trim()} ${lastInitial}.` : firstName.trim())
    : '';

  const isSaveEnabled = firstName.trim().length > 0;

  const unsavedChanges = useUnsavedChanges(
    { firstName, lastInitial },
    false
  );

  const handleBackPress = () => {
    if (!unsavedChanges.handleExitAttempt()) {
      return;
    }
    router.back();
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile({
        firstName: firstName.trim(),
        lastName: lastInitial || undefined,
      });
      console.log('Display name updated:', firstName, lastInitial);
      unsavedChanges.resetChanges();
      router.back();
    } catch (error) {
      console.error('Failed to update display name:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Display Name</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <View style={styles.content}>
        <View style={styles.inputSection}>
          <Text style={styles.label}>First Name *</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="words"
            maxLength={30}
            autoFocus
          />
          <Text style={styles.helperText}>
            Required to chat with vendors and place orders.
          </Text>

          <Text style={[styles.label, styles.labelSpacing]}>Last Initial (Optional)</Text>
          <TextInput
            style={styles.input}
            value={lastInitial}
            onChangeText={(text) => {
              const letter = text.replace(/[^a-zA-Z]/g, '').charAt(0).toUpperCase();
              setLastInitial(letter);
            }}
            placeholder="e.g. D"
            placeholderTextColor={Colors.textSecondary}
            autoCapitalize="characters"
            maxLength={1}
          />
          <Text style={styles.helperText}>
            Only your last initial will be shown (e.g. John D.).
          </Text>

          {displayNamePreview ? (
            <View style={styles.previewSection}>
              <Text style={styles.previewLabel}>Display Name Preview</Text>
              <Text style={styles.previewText}>{displayNamePreview}</Text>
            </View>
          ) : null}
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, (!isSaveEnabled || isSaving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          activeOpacity={0.8}
          disabled={!isSaveEnabled || isSaving}
        >
          <Text style={[styles.saveButtonText, (!isSaveEnabled || isSaving) && styles.saveButtonTextDisabled]}>
            {isSaving ? 'Saving...' : 'Save'}
          </Text>
        </TouchableOpacity>
      </View>

      <LaektivaModal
        visible={unsavedChanges.showDiscardModal}
        title="Discard changes?"
        message="If you leave now, your unsaved changes will be lost."
        primaryButton={{
          label: 'Discard',
          onPress: () => {
            unsavedChanges.handleDiscard();
            router.back();
          },
        }}
        secondaryButton={{
          label: 'Keep editing',
          onPress: unsavedChanges.handleKeepEditing,
        }}
        destructive
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  inputSection: {
    flex: 1,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  labelSpacing: {
    marginTop: 20,
  },
  previewSection: {
    marginTop: 24,
    marginBottom: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    backgroundColor: Colors.border,
    borderRadius: 12,
  },
  previewLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  previewText: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 17,
    color: Colors.text,
    marginBottom: 12,
  },
  helperText: {
    fontSize: 14,
    color: Colors.textMuted,
    paddingHorizontal: 4,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 16,
    minHeight: 52,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  saveButtonTextDisabled: {
    color: Colors.textSecondary,
  },
});
