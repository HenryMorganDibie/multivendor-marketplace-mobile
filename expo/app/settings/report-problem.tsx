import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Paperclip, X, ChevronDown, Check } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '@/constants/colors';

const ISSUE_TYPES = [
  'Order Issue',
  'Payment Issue',
  'Vendor Report',
  'Chat or Safety Concern',
  'Technical Bug',
  'Account Issue',
  'Other',
] as const;

type IssueType = (typeof ISSUE_TYPES)[number];

export default function ReportProblemScreen() {
  const router = useRouter();
  const [issueType, setIssueType] = useState<IssueType | null>(null);
  const [orderId, setOrderId] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [pickerVisible, setPickerVisible] = useState<boolean>(false);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled) {
      const newImages = result.assets.map((asset) => asset.uri);
      setImages((prev) => [...prev, ...newImages].slice(0, 3));
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const canSubmit = !!issueType && message.trim().length > 0 && !isSending;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setIsSending(true);
    console.log('[Customer Report]', {
      issueType,
      orderId: orderId.trim() || null,
      message: message.trim(),
      images,
    });
    setTimeout(() => {
      setIsSending(false);
      Alert.alert('Report submitted', 'Thanks. Our team will review it and get back to you soon.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    }, 900);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report a Problem</Text>
          <View style={styles.headerButton} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionLabel}>ISSUE TYPE *</Text>
        <TouchableOpacity
          style={styles.selector}
          onPress={() => setPickerVisible(true)}
          activeOpacity={0.7}
        >
          <Text style={[styles.selectorText, !issueType && styles.selectorPlaceholder]}>
            {issueType ?? 'Select issue type'}
          </Text>
          <ChevronDown size={20} color={Colors.textTertiary} strokeWidth={2} />
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>RELATED ORDER ID (OPTIONAL)</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={orderId}
            onChangeText={setOrderId}
            placeholder="Enter Order ID"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
          />
        </View>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>DESCRIPTION *</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.messageInput}
            value={message}
            onChangeText={setMessage}
            placeholder="Describe the problem you're experiencing..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={1000}
          />
        </View>
        <Text style={styles.charCount}>{message.length}/1000</Text>

        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>ATTACHMENTS (OPTIONAL)</Text>
        <View style={styles.attachRow}>
          {images.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.imagePreview}>
              <Image source={{ uri }} style={styles.previewImage} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemoveImage(index)}
                activeOpacity={0.7}
              >
                <X size={14} color={Colors.white} strokeWidth={2.5} />
              </TouchableOpacity>
            </View>
          ))}
          {images.length < 3 && (
            <TouchableOpacity style={styles.addImage} onPress={handlePickImage} activeOpacity={0.7}>
              <Paperclip size={20} color={Colors.primary} />
              <Text style={styles.addImageText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={{ height: 24 }} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.footerSafe}>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.submitButton, !canSubmit && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit}
            activeOpacity={0.85}
          >
            {isSending ? (
              <ActivityIndicator color={Colors.white} />
            ) : (
              <Text style={styles.submitButtonText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal
        visible={pickerVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setPickerVisible(false)}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Select issue type</Text>
            <ScrollView showsVerticalScrollIndicator={false}>
              {ISSUE_TYPES.map((type, index) => {
                const active = issueType === type;
                return (
                  <TouchableOpacity
                    key={type}
                    style={[styles.sheetRow, index === ISSUE_TYPES.length - 1 && styles.sheetRowLast]}
                    onPress={() => {
                      setIssueType(type);
                      setPickerVisible(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.sheetRowText, active && styles.sheetRowTextActive]}>
                      {type}
                    </Text>
                    {active && <Check size={20} color={Colors.primary} strokeWidth={2.5} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    backgroundColor: Colors.backgroundCanvas,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  headerButton: {
    paddingHorizontal: 10,
    minWidth: 44,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
    flex: 1,
    textAlign: 'center' as const,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.0,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  selector: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    paddingHorizontal: 16,
    height: 52,
  },
  selectorText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  selectorPlaceholder: {
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  input: {
    fontSize: 15,
    color: Colors.text,
    height: 28,
  },
  messageInput: {
    fontSize: 15,
    color: Colors.text,
    minHeight: 120,
    textAlignVertical: 'top' as const,
    lineHeight: 21,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right' as const,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  attachRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  imagePreview: {
    width: 80,
    height: 80,
    borderRadius: 12,
    overflow: 'hidden' as const,
    position: 'relative' as const,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeButton: {
    position: 'absolute' as const,
    top: 4,
    right: 4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  addImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    borderStyle: 'dashed' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  addImageText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.primary,
  },
  footerSafe: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
  },
  submitButton: {
    height: 52,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.primaryDisabled,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end' as const,
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 32,
    paddingTop: 10,
    maxHeight: '70%',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  sheetRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  sheetRowLast: {
    borderBottomWidth: 0,
  },
  sheetRowText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  sheetRowTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
});
