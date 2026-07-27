import React, { useState, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trash2, AlertCircle } from 'lucide-react-native';
import { useRouter, useLocalSearchParams, Stack } from 'expo-router';
import {
  validateLabel,
  validateName,
  validatePhone,
  validateAddress,
  validateDeliveryNote,
} from '@/utils/contactCardValidation';
import { useContactCards } from '@/contexts/ContactCardsContext';
import EditScreenHeader from '@/components/EditScreenHeader';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';

export default function EditContactCardScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const cardId = params.cardId as string;
  const _fromChat = params.fromChat === 'true';
  const { addCard, updateCard, deleteCard, getCardById } = useContactCards();

  const existingCard = cardId ? getCardById(cardId) : null;

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
      console.log('Contact card updated:', { label, name, phone, address, note });
    } else {
      addCard({ label, name, phone, address, note });
      console.log('Contact card added:', { label, name, phone, address, note });
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
              console.log('Contact card deleted');
            }
            unsavedChanges.resetChanges();
            router.back();
          },
        },
      ]
    );
  };

  const isEditing = !!cardId;

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <EditScreenHeader
            title={isEditing ? 'Edit Contact Card' : 'New Contact Card'}
            onBack={handleBackPress}
            onSave={handleSave}
            saveEnabled={label.trim().length > 0 && phone.trim().length > 0}
          />
        </SafeAreaView>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              Contact cards are saved locally on your device only.{'\n'}
              They are not stored on the platform servers.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.fieldLabel}>Label *</Text>
            <TextInput
              style={[styles.fieldInput, labelError && styles.fieldInputError]}
              placeholder="e.g., Home, Office, Mom's place"
              placeholderTextColor={Colors.textSecondary}
              value={label}
              onChangeText={handleLabelChange}
            />
            {labelError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color={Colors.error} />
                <Text style={styles.errorText}>{labelError}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              style={[styles.fieldInput, nameError && styles.fieldInputError]}
              placeholder="Your name"
              placeholderTextColor={Colors.textSecondary}
              value={name}
              onChangeText={handleNameChange}
            />
            {nameError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color={Colors.error} />
                <Text style={styles.errorText}>{nameError}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Phone *</Text>
            <TextInput
              style={[styles.fieldInput, phoneError && styles.fieldInputError]}
              placeholder="Your phone number"
              placeholderTextColor={Colors.textSecondary}
              value={phone}
              onChangeText={handlePhoneChange}
              keyboardType="phone-pad"
            />
            {phoneError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color={Colors.error} />
                <Text style={styles.errorText}>{phoneError}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Address</Text>
            <TextInput
              style={[styles.fieldInput, styles.textArea, addressError && styles.fieldInputError]}
              placeholder="Delivery or pickup address"
              placeholderTextColor={Colors.textSecondary}
              value={address}
              onChangeText={handleAddressChange}
              multiline
              textAlignVertical="top"
            />
            {addressError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color={Colors.error} />
                <Text style={styles.errorText}>{addressError}</Text>
              </View>
            ) : null}

            <Text style={styles.fieldLabel}>Delivery Note</Text>
            <Text style={styles.fieldHelper}>For delivery or pickup instructions only</Text>
            <TextInput
              style={[styles.fieldInput, styles.textArea, noteError && styles.fieldInputError]}
              placeholder="Special instructions (e.g., gate code, landmark, delivery timing)"
              placeholderTextColor={Colors.textSecondary}
              value={note}
              onChangeText={handleNoteChange}
              multiline
              textAlignVertical="top"
              maxLength={200}
            />
            <Text style={styles.characterCount}>{note.length}/200</Text>
            {noteError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color={Colors.error} />
                <Text style={styles.errorText}>{noteError}</Text>
              </View>
            ) : null}
          </View>

          {isEditing && (
            <TouchableOpacity
              style={styles.deleteAction}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Trash2 size={16} color={Colors.error} />
              <Text style={styles.deleteActionText}>Delete Contact Card</Text>
            </TouchableOpacity>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>

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
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  section: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  fieldHelper: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: -4,
  },
  fieldInputError: {
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: -12,
    marginBottom: 16,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    flex: 1,
  },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginBottom: 16,
  },
  textArea: {
    minHeight: 80,
    paddingTop: 14,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
    marginTop: -12,
    marginBottom: 16,
  },
  deleteAction: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    marginTop: 24,
    gap: 8,
  },
  deleteActionText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.error,
  },
  bottomSpacer: {
    height: 40,
  },
});
