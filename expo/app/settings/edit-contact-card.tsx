import React, { useState, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Trash2, AlertCircle, Lock } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import {
  validateLabel,
  validateName,
  validatePhone,
  validateAddress,
  validateDeliveryNote,
} from '@/utils/contactCardValidation';
import { useContactCards } from '@/contexts/ContactCardsContext';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import { ChevronLeft } from 'lucide-react-native';

export default function EditContactCardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const cardId = params.cardId as string;
  const _fromChat = params.fromChat === 'true';
  const { addCard, updateCard, deleteCard, getCardById } = useContactCards();

  const existingCard = cardId ? getCardById(cardId) : null;
  const isEditing = !!cardId;

  const [label, setLabel] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (existingCard) {
      setLabel(existingCard.label);
      setName(existingCard.name);
      setPhone(existingCard.phone);
      setAddress(existingCard.address);
      setNote(existingCard.note || '');
    }
  }, [existingCard]);

  const [labelError, setLabelError] = useState<string>('');
  const [nameError, setNameError] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [addressError, setAddressError] = useState<string>('');
  const [noteError, setNoteError] = useState<string>('');

  const unsavedChanges = useUnsavedChanges(
    { label, name, phone, address, note },
    !cardId
  );

  const handleBackPress = () => {
    if (!unsavedChanges.handleExitAttempt()) {
      return;
    }
    router.back();
  };

  const handleLabelChange = (text: string) => {
    setLabel(text);
    const result = validateLabel(text);
    setLabelError(result.isValid ? '' : result.error || '');
  };

  const handleNameChange = (text: string) => {
    setName(text);
    const result = validateName(text);
    setNameError(result.isValid ? '' : result.error || '');
  };

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    if (text.trim()) {
      const result = validatePhone(text);
      setPhoneError(result.isValid ? '' : result.error || '');
    } else {
      setPhoneError('');
    }
  };

  const handleAddressChange = (text: string) => {
    setAddress(text);
    const result = validateAddress(text);
    setAddressError(result.isValid ? '' : result.error || '');
  };

  const handleNoteChange = (text: string) => {
    setNote(text);
    const result = validateDeliveryNote(text);
    setNoteError(result.isValid ? '' : result.error || '');
  };

  const isSaveEnabled =
    label.trim().length > 0 &&
    name.trim().length > 0 &&
    phone.trim().length > 0 &&
    address.trim().length > 0;

  const handleSave = () => {
    const labelValidation = validateLabel(label);
    const nameValidation = validateName(name);
    const phoneValidation = validatePhone(phone);
    const addressValidation = validateAddress(address);
    const noteValidation = validateDeliveryNote(note);

    setLabelError(labelValidation.isValid ? '' : labelValidation.error || '');
    setNameError(nameValidation.isValid ? '' : nameValidation.error || '');
    setPhoneError(phoneValidation.isValid ? '' : phoneValidation.error || '');
    setAddressError(addressValidation.isValid ? '' : addressValidation.error || '');
    setNoteError(noteValidation.isValid ? '' : noteValidation.error || '');

    if (
      !labelValidation.isValid ||
      !nameValidation.isValid ||
      !phoneValidation.isValid ||
      !addressValidation.isValid ||
      !noteValidation.isValid
    ) {
      return;
    }

    if (cardId) {
      updateCard(cardId, { label, name, phone, address, note });
    } else {
      addCard({ label, name, phone, address, note });
    }
    console.log('[SECURITY_LOG] Contact card validation passed');
    unsavedChanges.resetChanges();
    router.back();
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete contact card',
      'Are you sure you want to delete this contact card?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (cardId) {
              deleteCard(cardId);
            }
            unsavedChanges.resetChanges();
            router.back();
          },
        },
      ]
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Header */}
        <SafeAreaView edges={['top']} style={styles.safeTop}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBackPress}
              style={styles.headerBack}
              activeOpacity={0.7}
            >
              <ChevronLeft size={22} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {isEditing ? 'Edit Contact Card' : 'New Contact Card'}
            </Text>
            <TouchableOpacity
              onPress={handleSave}
              style={[styles.saveBtn, !isSaveEnabled && styles.saveBtnDisabled]}
              activeOpacity={isSaveEnabled ? 0.8 : 1}
              disabled={!isSaveEnabled}
            >
              <Text style={[styles.saveBtnText, !isSaveEnabled && styles.saveBtnTextDisabled]}>
                Save
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <ScrollView
            style={styles.scroll}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
          >
            {/* CONTACT CARD INFORMATION */}
            <Text style={styles.sectionTitle}>Contact Card Information</Text>
            <View style={styles.sectionCard}>

              {/* Label */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Label <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, labelError ? styles.inputError : null]}
                  placeholder="e.g., Home, Office, Mom's place"
                  placeholderTextColor={Colors.inputPlaceholder}
                  value={label}
                  onChangeText={handleLabelChange}
                />
                {labelError ? (
                  <View style={styles.errorRow}>
                    <AlertCircle size={13} color={Colors.error} />
                    <Text style={styles.errorText}>{labelError}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldDivider} />

              {/* Name */}
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>Name <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, nameError ? styles.inputError : null]}
                  placeholder="Your full name"
                  placeholderTextColor={Colors.inputPlaceholder}
                  value={name}
                  onChangeText={handleNameChange}
                />
                {nameError ? (
                  <View style={styles.errorRow}>
                    <AlertCircle size={13} color={Colors.error} />
                    <Text style={styles.errorText}>{nameError}</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.fieldDivider} />

              {/* Phone */}
              <View style={[styles.field, styles.fieldLast]}>
                <Text style={styles.fieldLabel}>Phone <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, phoneError ? styles.inputError : null]}
                  placeholder="+1 (555) 000-0000"
                  placeholderTextColor={Colors.inputPlaceholder}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                />
                {phoneError ? (
                  <View style={styles.errorRow}>
                    <AlertCircle size={13} color={Colors.error} />
                    <Text style={styles.errorText}>{phoneError}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* ADDRESS */}
            <Text style={styles.sectionTitle}>Address</Text>
            <View style={styles.sectionCard}>
              <View style={[styles.field, styles.fieldLast]}>
                <Text style={styles.fieldLabel}>Address <Text style={styles.required}>*</Text></Text>
                <TextInput
                  style={[styles.input, styles.textArea, addressError ? styles.inputError : null]}
                  placeholder="Delivery or pickup address"
                  placeholderTextColor={Colors.inputPlaceholder}
                  value={address}
                  onChangeText={handleAddressChange}
                  multiline
                  textAlignVertical="top"
                />
                {addressError ? (
                  <View style={styles.errorRow}>
                    <AlertCircle size={13} color={Colors.error} />
                    <Text style={styles.errorText}>{addressError}</Text>
                  </View>
                ) : null}
              </View>
            </View>

            {/* DELIVERY NOTES */}
            <Text style={styles.sectionTitle}>Delivery Notes <Text style={styles.sectionOptional}>(Optional)</Text></Text>
            <View style={styles.sectionCard}>
              <View style={[styles.field, styles.fieldLast]}>
                <TextInput
                  style={[styles.input, styles.noteArea, noteError ? styles.inputError : null]}
                  placeholder="Gate code, buzzer number, landmark, preferred delivery time..."
                  placeholderTextColor={Colors.inputPlaceholder}
                  value={note}
                  onChangeText={handleNoteChange}
                  multiline
                  textAlignVertical="top"
                  maxLength={200}
                />
                <View style={styles.noteFooter}>
                  {noteError ? (
                    <View style={styles.errorRow}>
                      <AlertCircle size={13} color={Colors.error} />
                      <Text style={styles.errorText}>{noteError}</Text>
                    </View>
                  ) : <View />}
                  <Text style={styles.charCount}>{note.length}/200</Text>
                </View>
              </View>
            </View>

            {/* PRIVACY */}
            <Text style={styles.sectionTitle}>Privacy</Text>
            <View style={styles.privacyCard}>
              <View style={styles.privacyIconWrap}>
                <Lock size={18} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.privacyText}>
                Contact cards are stored locally on your device only. They are not uploaded to the platform servers and cannot be screenshotted.
              </Text>
            </View>

            {/* DELETE (edit mode only) */}
            {isEditing && (
              <TouchableOpacity
                style={styles.deleteRow}
                onPress={handleDelete}
                activeOpacity={0.7}
              >
                <Trash2 size={16} color={Colors.error} />
                <Text style={styles.deleteText}>Delete Contact Card</Text>
              </TouchableOpacity>
            )}

          </ScrollView>
        </KeyboardAvoidingView>

        <DiscardChangesModal
          visible={unsavedChanges.showDiscardModal}
          onKeepEditing={unsavedChanges.handleKeepEditing}
          onDiscard={() => {
            unsavedChanges.handleDiscard();
            router.back();
          }}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  flex: {
    flex: 1,
  },
  safeTop: {
    backgroundColor: Colors.backgroundCanvas,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerBack: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  saveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.primary,
  },
  saveBtnDisabled: {
    backgroundColor: Colors.surfaceMuted,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  saveBtnTextDisabled: {
    color: Colors.textTertiary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 8,
    marginTop: 16,
    marginLeft: 2,
  },
  sectionOptional: {
    fontSize: 10,
    fontWeight: '500' as const,
    color: Colors.textMuted,
    textTransform: 'none' as const,
    letterSpacing: 0,
  },
  sectionCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
    paddingHorizontal: 14,
    paddingTop: 4,
  },
  field: {
    paddingVertical: 12,
  },
  fieldLast: {
    paddingBottom: 14,
  },
  fieldDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 0,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  required: {
    color: Colors.error,
  },
  input: {
    fontSize: 16,
    color: Colors.text,
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 11,
    minHeight: 44,
  },
  inputError: {
    borderWidth: 1.5,
    borderColor: Colors.error,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 11,
  },
  noteArea: {
    minHeight: 100,
    paddingTop: 11,
  },
  errorRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    marginTop: 6,
  },
  errorText: {
    fontSize: 12,
    color: Colors.error,
    flex: 1,
  },
  noteFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginTop: 6,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'right' as const,
  },
  privacyCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: Colors.primaryTint,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,122,40,0.15)',
    padding: 14,
    gap: 12,
  },
  privacyIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,122,40,0.12)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
    marginTop: 1,
  },
  privacyText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  deleteRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 18,
    marginTop: 20,
    gap: 8,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.error,
  },
  bottomSpacer: {
    height: 48,
  },
});
