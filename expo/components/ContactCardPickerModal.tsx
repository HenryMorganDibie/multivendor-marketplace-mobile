import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, CreditCard, Lock } from 'lucide-react-native';
import { useContactCards, ContactCard } from '@/contexts/ContactCardsContext';
import { ContactCardList } from '@/components/ContactCardList';
import { ContactCardDetailModal } from '@/components/ContactCardDetailModal';
import { ContactCardEditorModal } from '@/components/ContactCardEditorModal';
import LaektivaModal from '@/components/LaektivaModal';
import { Colors } from '@/constants/colors';

interface ContactCardPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSend: (card: ContactCard) => void;
  ctaLabel?: string;
  showCta?: boolean;
}

export function ContactCardPickerModal({
  visible,
  onClose,
  onSend,
  ctaLabel: _ctaLabel = 'Send Contact Card',
  showCta: _showCta = true,
}: ContactCardPickerModalProps) {
  const insets = useSafeAreaInsets();
  const { cards, deleteCard } = useContactCards();
  const [selectedCard, setSelectedCard] = useState<ContactCard | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<ContactCard | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showEditor, setShowEditor] = useState(false);

  const isEmpty = cards.length === 0;

  const handleCancel = () => {
    setSelectedCard(null);
    setShowDetailModal(false);
    onClose();
  };

  const handleCardPress = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    console.log('[CONTACT_CARD] Card tapped, opening detail modal:', card.label);
    setSelectedCard(card);
    setShowDetailModal(true);
  };

  const handleSendFromDetail = (card: ContactCard) => {
    console.log('[CONTACT_CARD] Sending contact card from detail modal:', card.label);
    onSend(card);
    setShowDetailModal(false);
    setSelectedCard(null);
    onClose();
  };

  const handleCloseDetail = () => {
    setShowDetailModal(false);
    setSelectedCard(null);
  };

  const handleDeletePress = (cardId: string) => {
    const card = cards.find((c) => c.id === cardId);
    if (!card) return;
    console.log('[CONTACT_CARD] Delete requested for:', card.label);
    setCardToDelete(card);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = () => {
    if (cardToDelete) {
      console.log('[CONTACT_CARD] Deleting card:', cardToDelete.label);
      deleteCard(cardToDelete.id);
      setCardToDelete(null);
    }
    setShowDeleteConfirm(false);
  };

  const handleCancelDelete = () => {
    setCardToDelete(null);
    setShowDeleteConfirm(false);
  };

  const handleAddCard = () => {
    setShowEditor(true);
  };

  const handleCloseEditor = () => {
    setShowEditor(false);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancel}
    >
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleCancel}
              style={styles.headerButton}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Contact Card</Text>
            <TouchableOpacity
              onPress={handleAddCard}
              style={[styles.headerButton, styles.headerButtonRight]}
              activeOpacity={0.7}
            >
              <View style={styles.headerAddBtn}>
                <Plus size={20} color={Colors.primary} strokeWidth={2.5} />
              </View>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        {isEmpty ? (
          <View style={[styles.emptyContainer, { paddingBottom: insets.bottom + 24 }]}>
            <View style={styles.emptyIconWrap}>
              <CreditCard size={24} color={Colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.emptyTitle}>No contact cards yet</Text>
            <Text style={styles.emptySubtitle}>
              Save delivery and pickup details to share with vendors in one tap. Tap + above to create one.
            </Text>

            <View style={styles.emptyPrivacyRow}>
              <Lock size={11} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.emptyPrivacyText}>
                Stored locally on your device and protected from screenshots.
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.contentContainer,
              { paddingBottom: insets.bottom + 32 },
            ]}
          >
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                Tap a contact card to preview and send it. Swipe left to edit or delete.
                These details are stored locally on your device only.
              </Text>
            </View>
            <ContactCardList
              mode="picker"
              cards={cards}
              selectedCardId={selectedCard?.id ?? null}
              onCardPress={handleCardPress}
              onDeleteCard={handleDeletePress}
              onAddCard={handleAddCard}
            />
          </ScrollView>
        )}

        <ContactCardDetailModal
          visible={showDetailModal}
          card={selectedCard}
          onClose={handleCloseDetail}
          onSend={handleSendFromDetail}
        />

        <ContactCardEditorModal
          visible={showEditor}
          onClose={handleCloseEditor}
        />

        <LaektivaModal
          visible={showDeleteConfirm}
          title="Delete contact card?"
          message="This contact card will be permanently removed from your device."
          primaryButton={{
            label: 'Delete',
            onPress: handleConfirmDelete,
          }}
          secondaryButton={{
            label: 'Cancel',
            onPress: handleCancelDelete,
          }}
          destructive
        />
      </View>
    </Modal>
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.backgroundCanvas,
  },
  headerButton: {
    minWidth: 70,
    justifyContent: 'center' as const,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  headerButtonRight: {
    alignItems: 'flex-end' as const,
  },
  headerSpacer: {
    minWidth: 70,
  },
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  infoText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  // Empty state (matches Contact Card Presets settings screen)
  emptyContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 28,
  },
  emptyIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    maxWidth: 300,
    marginBottom: 20,
  },
  emptyCtaBtn: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    alignSelf: 'stretch' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    paddingHorizontal: 28,
    borderRadius: 14,
    gap: 8,
    marginBottom: 20,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.24,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  emptyPrivacyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    maxWidth: 280,
  },
  emptyPrivacyText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    flexShrink: 1,
    textAlign: 'center' as const,
  },
});
