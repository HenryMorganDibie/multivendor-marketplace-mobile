import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, Check, AlertCircle } from 'lucide-react-native';
import { ContactCardData } from '@/mocks/chatData';
import {
  validateName,
  validatePhone,
  validateAddress,
  validateDeliveryNote,
} from '@/utils/contactCardValidation';

interface ContactCardModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (data: ContactCardData) => void;
  savedContactCards?: ContactCardData[];
}

export function ContactCardModal({
  visible,
  onClose,
  onSend,
  savedContactCards = [],
}: ContactCardModalProps) {
  const [showListModal, setShowListModal] = useState(true);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null);
  const [contactCardData, setContactCardData] = useState<ContactCardData>({
    name: '',
    phone: '',
    address: '',
    deliveryNote: '',
  });

  const [nameError, setNameError] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [addressError, setAddressError] = useState<string>('');
  const [deliveryNoteError, setDeliveryNoteError] = useState<string>('');

  const handleClose = () => {
    setShowListModal(true);
    setShowFormModal(false);
    setShowPreviewModal(false);
    setSelectedCardIndex(null);
    setContactCardData({
      name: '',
      phone: '',
      address: '',
      deliveryNote: '',
    });
    setNameError('');
    setPhoneError('');
    setAddressError('');
    setDeliveryNoteError('');
    onClose();
  };

  const handleAddNew = () => {
    setShowListModal(false);
    setShowFormModal(true);
  };

  const handleSelectCard = (index: number) => {
    setSelectedCardIndex(index);
  };

  const handleSendSelectedCard = () => {
    if (selectedCardIndex !== null && savedContactCards[selectedCardIndex]) {
      onSend(savedContactCards[selectedCardIndex]);
      handleClose();
    }
  };

  const handleNameChange = (text: string) => {
    setContactCardData({ ...contactCardData, name: text });
    const result = validateName(text);
    setNameError(result.isValid ? '' : result.error || '');
  };

  const handlePhoneChange = (text: string) => {
    setContactCardData({ ...contactCardData, phone: text });
    if (text.trim()) {
      const result = validatePhone(text);
      setPhoneError(result.isValid ? '' : result.error || '');
    } else {
      setPhoneError('');
    }
  };

  const handleAddressChange = (text: string) => {
    setContactCardData({ ...contactCardData, address: text });
    const result = validateAddress(text);
    setAddressError(result.isValid ? '' : result.error || '');
  };

  const handleDeliveryNoteChange = (text: string) => {
    setContactCardData({ ...contactCardData, deliveryNote: text });
    const result = validateDeliveryNote(text);
    setDeliveryNoteError(result.isValid ? '' : result.error || '');
  };

  const handleSendNew = () => {
    const nameValidation = validateName(contactCardData.name || '');
    const phoneValidation = validatePhone(contactCardData.phone);
    const addressValidation = validateAddress(contactCardData.address || '');
    const deliveryNoteValidation = validateDeliveryNote(contactCardData.deliveryNote || '');

    setNameError(nameValidation.isValid ? '' : nameValidation.error || '');
    setPhoneError(phoneValidation.isValid ? '' : phoneValidation.error || '');
    setAddressError(addressValidation.isValid ? '' : addressValidation.error || '');
    setDeliveryNoteError(deliveryNoteValidation.isValid ? '' : deliveryNoteValidation.error || '');

    if (
      !nameValidation.isValid ||
      !phoneValidation.isValid ||
      !addressValidation.isValid ||
      !deliveryNoteValidation.isValid
    ) {
      return;
    }

    console.log('[SECURITY_LOG] Contact card validation passed');
    setShowFormModal(false);
    setShowPreviewModal(true);
  };

  const handleConfirmSend = () => {
    const dataToSend: ContactCardData = {
      phone: contactCardData.phone.trim(),
      ...(contactCardData.name?.trim() && { name: contactCardData.name.trim() }),
      ...(contactCardData.address?.trim() && { address: contactCardData.address.trim() }),
      ...(contactCardData.deliveryNote?.trim() && { deliveryNote: contactCardData.deliveryNote.trim() }),
    };

    onSend(dataToSend);
    handleClose();
  };

  const handleCancelPreview = () => {
    setShowPreviewModal(false);
    setShowListModal(true);
  };

  const handleBackToList = () => {
    setShowFormModal(false);
    setShowListModal(true);
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={handleClose}
    >
      {showListModal && (
        <SafeAreaView edges={['top', 'bottom']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleClose} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select contact card</Text>
            <View style={styles.modalHeaderSpacer} />
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <View style={styles.headerSection}>
              <Text style={styles.headerTitleText}>Select contact details</Text>
              <Text style={styles.headerSubtitle}>
                Choose which contact information you want to share with the vendor.
              </Text>
            </View>

            {savedContactCards.length === 0 ? (
              <View style={styles.emptyContactCardsState}>
                <Text style={styles.emptyContactCardsText}>No saved contact cards</Text>
                <Text style={styles.emptyContactCardsSubtext}>
                  Add a contact card to quickly share your details
                </Text>
              </View>
            ) : (
              <View style={styles.contactCardsList}>
                {savedContactCards.map((card, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.savedContactCardItem,
                      selectedCardIndex === index && styles.selectedContactCardItem,
                    ]}
                    onPress={() => handleSelectCard(index)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.savedContactCardContent}>
                      {card.name && (
                        <Text style={styles.savedContactCardName}>{card.name}</Text>
                      )}
                      <Text style={styles.savedContactCardPhone}>{card.phone}</Text>
                      {card.address && (
                        <Text style={styles.savedContactCardAddress} numberOfLines={2}>
                          {card.address}
                        </Text>
                      )}
                      {card.deliveryNote && (
                        <Text style={styles.savedContactCardNote} numberOfLines={1}>
                          Note: {card.deliveryNote}
                        </Text>
                      )}
                    </View>
                    {selectedCardIndex === index && (
                      <View style={styles.checkmarkContainer}>
                        <Check size={20} color="#0B0B0B" strokeWidth={3} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={styles.addNewContactCardButton}
              onPress={handleAddNew}
              activeOpacity={0.7}
            >
              <Plus size={20} color="#FFFFFF" />
              <Text style={styles.addNewContactCardText}>Add new contact card</Text>
            </TouchableOpacity>

            <View style={styles.bottomSpacerLarge} />
          </ScrollView>

          <View style={styles.bottomActionContainer}>
            <TouchableOpacity
              style={[
                styles.sendButton,
                selectedCardIndex === null && styles.sendButtonDisabled,
              ]}
              onPress={handleSendSelectedCard}
              disabled={selectedCardIndex === null}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sendButtonText,
                  selectedCardIndex === null && styles.sendButtonTextDisabled,
                ]}
              >
                Send contact card
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      )}

      {showFormModal && (
        <SafeAreaView edges={['top']} style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleBackToList} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>Back</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Share contact details</Text>
            <TouchableOpacity onPress={handleSendNew} style={styles.modalCloseButton}>
              <Text style={[styles.modalCloseText, styles.modalSubmitText]}>Preview</Text>
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.modalDescription}>
              Share contact details with the vendor. These details are order-scoped and visible only to the vendor for this order.
            </Text>

            <Text style={styles.sectionTitle}>CONTACT DETAILS</Text>

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Full Name (Optional)</Text>
              <TextInput
                style={[styles.fieldInput, nameError && styles.fieldInputError]}
                placeholder="Your full name"
                placeholderTextColor="#666"
                value={contactCardData.name}
                onChangeText={handleNameChange}
              />
            </View>
            {nameError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color="#FF3B30" />
                <Text style={styles.errorText}>{nameError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Phone *</Text>
              <TextInput
                style={[styles.fieldInput, phoneError && styles.fieldInputError]}
                placeholder="Your phone number"
                placeholderTextColor="#666"
                value={contactCardData.phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
              />
            </View>
            {phoneError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color="#FF3B30" />
                <Text style={styles.errorText}>{phoneError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Address (Optional)</Text>
              <TextInput
                style={[styles.fieldInput, styles.addressInput, addressError && styles.fieldInputError]}
                placeholder="Delivery or pickup address"
                placeholderTextColor="#666"
                value={contactCardData.address}
                onChangeText={handleAddressChange}
                multiline
                textAlignVertical="top"
              />
            </View>
            {addressError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color="#FF3B30" />
                <Text style={styles.errorText}>{addressError}</Text>
              </View>
            ) : null}

            <View style={styles.fieldCard}>
              <Text style={styles.fieldLabel}>Delivery / Pickup Note (Optional)</Text>
              <Text style={styles.fieldHelper}>For delivery or pickup instructions only</Text>
              <TextInput
                style={[styles.fieldInput, styles.deliveryNoteInput, deliveryNoteError && styles.fieldInputError]}
                placeholder="Special instructions (e.g., gate code, landmark, delivery timing)"
                placeholderTextColor="#666"
                value={contactCardData.deliveryNote}
                onChangeText={handleDeliveryNoteChange}
                multiline
                textAlignVertical="top"
                maxLength={200}
              />
            </View>
            <Text style={styles.characterCount}>
              {contactCardData.deliveryNote?.length || 0}/200
            </Text>
            {deliveryNoteError ? (
              <View style={styles.errorContainer}>
                <AlertCircle size={14} color="#FF3B30" />
                <Text style={styles.errorText}>{deliveryNoteError}</Text>
              </View>
            ) : null}

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      )}

      {showPreviewModal && (
        <View style={styles.previewOverlay}>
          <View style={styles.previewModalCard}>
            <Text style={styles.previewModalTitle}>Send contact details</Text>
            <Text style={styles.previewModalSubtitle}>
              This information will be shared with the vendor in chat.
            </Text>

            <ScrollView 
              style={styles.previewModalContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.previewGlassCard}>
                <Text style={styles.previewCardLabel}>Contact Card</Text>
                {contactCardData.name && contactCardData.name.trim() !== '' && (
                  <Text style={styles.previewCardDetail}>{contactCardData.name}</Text>
                )}
                <Text style={styles.previewCardDetail}>{contactCardData.phone}</Text>
                {contactCardData.address && contactCardData.address.trim() !== '' && (
                  <Text style={styles.previewCardDetail}>{contactCardData.address}</Text>
                )}
                {contactCardData.deliveryNote && contactCardData.deliveryNote.trim() !== '' && (
                  <Text style={styles.previewCardNote}>Note: {contactCardData.deliveryNote}</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.previewModalButtons}>
              <TouchableOpacity
                style={styles.previewSecondaryButton}
                onPress={handleCancelPreview}
                activeOpacity={0.8}
              >
                <Text style={styles.previewSecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewPrimaryButton}
                onPress={handleConfirmSend}
                activeOpacity={0.8}
              >
                <Text style={styles.previewPrimaryButtonText}>Send</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center' as const,
  },
  modalCloseButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#007AFF',
    fontWeight: '500' as const,
  },
  modalSubmitText: {
    fontWeight: '600' as const,
  },
  modalHeaderSpacer: {
    width: 60,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  headerSection: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  headerTitleText: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#999',
    lineHeight: 21,
  },
  modalDescription: {
    fontSize: 14,
    color: '#999',
    lineHeight: 20,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    letterSpacing: 0.5,
    marginTop: 24,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  fieldHelper: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
    marginTop: -4,
  },
  fieldInputError: {
    borderWidth: 1,
    borderColor: '#FF3B30',
  },
  errorContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 4,
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: '#FF3B30',
    flex: 1,
  },
  fieldCard: {
    marginBottom: 16,
  },
  fieldInput: {
    fontSize: 16,
    color: '#FFFFFF',
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  multilineCard: {
    marginBottom: 16,
  },
  addressInput: {
    minHeight: 80,
    paddingTop: 14,
  },
  deliveryNoteInput: {
    minHeight: 80,
    paddingTop: 14,
  },
  characterCount: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right' as const,
    marginTop: -12,
    marginBottom: 16,
  },
  contactCardsList: {
    marginTop: 16,
  },
  savedContactCardItem: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 12,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedContactCardItem: {
    borderColor: '#FFFFFF',
    backgroundColor: '#1C1C1E',
  },
  savedContactCardContent: {
    flex: 1,
    marginRight: 12,
  },
  checkmarkContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  savedContactCardName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 6,
  },
  savedContactCardPhone: {
    fontSize: 15,
    color: '#999',
    marginBottom: 4,
  },
  savedContactCardAddress: {
    fontSize: 14,
    color: '#999',
    marginBottom: 4,
  },
  savedContactCardNote: {
    fontSize: 13,
    color: '#666',
    fontStyle: 'italic' as const,
  },
  addNewContactCardButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginTop: 12,
  },
  addNewContactCardText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  emptyContactCardsState: {
    alignItems: 'center' as const,
    paddingVertical: 40,
  },
  emptyContactCardsText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptyContactCardsSubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center' as const,
    paddingHorizontal: 20,
  },
  previewOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  previewModalCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
  },
  previewModalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  previewModalSubtitle: {
    fontSize: 15,
    color: '#9CA3AF',
    lineHeight: 22,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  previewModalContent: {
    maxHeight: 300,
  },
  previewModalButtons: {
    flexDirection: 'column' as const,
    gap: 12,
    marginTop: 20,
  },
  previewSecondaryButton: {
    backgroundColor: '#1A1A1A',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#2B2B2B',
    minHeight: 52,
  },
  previewSecondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    textAlign: 'center' as const,
  },
  previewPrimaryButton: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
  },
  previewPrimaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0B0B0B',
    textAlign: 'center' as const,
  },
  previewCard: {
    backgroundColor: '#1A1A1A',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  previewGlassCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  previewCardLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  previewCardDetail: {
    fontSize: 15,
    color: '#AAAAAA',
    marginBottom: 4,
  },
  previewCardNote: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  previewField: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2B2B2B',
  },
  previewFieldFirst: {
    paddingTop: 8,
  },
  previewFieldLast: {
    borderBottomWidth: 0,
    paddingBottom: 8,
  },
  previewFieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#9CA3AF',
    marginBottom: 6,
  },
  previewFieldValue: {
    fontSize: 17,
    color: '#FFFFFF',
    lineHeight: 22,
  },

  bottomSpacer: {
    height: 40,
  },
  bottomSpacerLarge: {
    height: 100,
  },
  bottomActionContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    backgroundColor: '#0A0A0A',
    borderTopWidth: 1,
    borderTopColor: '#2B2B2B',
  },
  sendButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  sendButtonDisabled: {
    backgroundColor: '#1C1C1E',
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#0A0A0A',
  },
  sendButtonTextDisabled: {
    color: '#9CA3AF',
  },
});
