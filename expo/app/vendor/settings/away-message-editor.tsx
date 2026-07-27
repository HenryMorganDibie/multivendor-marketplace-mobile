import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { useVendorAwayMessage } from '@/contexts/VendorAwayMessageContext';
import DiscardChangesModal from '@/components/DiscardChangesModal';

const MAX_LENGTH = 300;

export default function AwayMessageEditorScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useVendorAwayMessage();

  const [text, setText] = useState(settings.message);
  const [showDiscardModal, setShowDiscardModal] = useState(false);

  const hasChanges = text !== settings.message;

  const handleSave = () => {
    void updateSettings({ message: text });
    console.log('[AwayMessageEditor] Message saved:', text);
    router.back();
  };

  const handleBack = () => {
    if (hasChanges) {
      setShowDiscardModal(true);
    } else {
      router.back();
    }
  };

  const handleDiscard = () => {
    setShowDiscardModal(false);
    router.back();
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Message"
          onBack={handleBack}
          onSave={handleSave}
          saveEnabled={hasChanges}
          testID="editor"
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.editorCard}>
              <TextInput
                style={styles.textInput}
                value={text}
                onChangeText={setText}
                placeholder="Hi! I'm currently unavailable. I'll get back to you as soon as possible."
                placeholderTextColor={Colors.textMuted}
                multiline
                maxLength={MAX_LENGTH}
                textAlignVertical="top"
                autoFocus
                testID="away-message-input"
              />
            </View>
            <Text style={styles.counterText}>
              {text.length} / {MAX_LENGTH}
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      <DiscardChangesModal
        visible={showDiscardModal}
        onKeepEditing={() => setShowDiscardModal(false)}
        onDiscard={handleDiscard}
        message="If you leave now, your unsaved message will be lost."
      />
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
  keyboardAvoid: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  headerBack: {
    padding: 4,
    marginLeft: -4,
  },
  headerSave: {
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginRight: -4,
  },
  headerSaveText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  editorCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  textInput: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    minHeight: 180,
    textAlignVertical: 'top',
  },
  counterText: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 8,
    paddingHorizontal: 4,
  },
});
