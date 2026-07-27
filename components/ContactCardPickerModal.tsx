import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Plus, CreditCard } from 'lucide-react-native';
import { useContactCards, ContactCard } from '@/contexts/ContactCardsContext';
import { SwipeableContactCard } from '@/components/SwipeableContactCard';
import { ContactCardDetailModal } from '@/components/ContactCardDetailModal';
import LaektivaModal from '@/components/LaektivaModal';

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
  const router = useRouter();
  const { cards, deleteCard } = useContactCards();
  const [selectedCard, setSelectedCard] = useState<ContactCard | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [cardToDelete, setCardToDelete] = useState<ContactCard | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleCancel = () => {
    setSelectedCard(null);
    setShowDetailModal(false);
    onClose();
  };

  const handleCardPress = (card: ContactCard) => {
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

  const handleEdit = (card: ContactCard) => {
    console.log('[CONTACT_CARD] Navigating to edit screen:', card.label);
    onClose();
    router.push({
      pathname: '/settings/edit-contact-card' as any,
      params: { cardId: card.id, fromChat: 'true' },
    });
  };

  const handleDeletePress = (card: ContactCard) => {
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
    onClose();
    router.push({
      pathname: '/settings/edit-contact-card' as any,
      params: { fromChat: 'true' },
    });
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
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Contact Card</Text>
            <TouchableOpacity 
              onPress={handleAddCard} 
              style={[styles.headerButton, styles.headerButtonRight]}
              activeOpacity={0.7}
            >
              <Plus size={22} color="#0A84FF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {cards.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyStateIconContainer}>
                <CreditCard size={40} color="#48484A" />
              </View>
              <Text style={styles.emptyStateTitle}>No contact cards</Text>
              <Text style={styles.emptyStateText}>
                Create a contact card to share your delivery details with vendors when placing an order.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                  Tap a contact card to view and send.{' '}
                  Swipe left on any card to edit or delete.{' '}
                  These details are stored locally on your device only.
                </Text>
              </View>
              <View style={styles.cardsContainer}>
                {cards.map((card) => (
                  <SwipeableContactCard
                    key={card.id}
                    card={card}
                    onPress={() => handleCardPress(card)}
                    onEdit={() => handleEdit(card)}
                    onDelete={() => handleDeletePress(card)}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <ContactCardDetailModal
          visible={showDetailModal}
          card={selectedCard}
          onClose={handleCloseDetail}
          onSend={handleSendFromDetail}
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
    backgroundColor: '#000000',
  },
  safeArea: {
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#000000',
  },
  headerButton: {
    padding: 8,
    minWidth: 70,
  },
  cancelText: {
    fontSize: 17,
    color: '#0A84FF',
  },
  headerButtonRight: {
    alignItems: 'flex-end' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoBox: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  cardsContainer: {
    paddingBottom: 20,
  },
  emptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 80,
    paddingHorizontal: 44,
  },
  emptyStateIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1C1C1E',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 10,
    textAlign: 'center' as const,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center' as const,
    lineHeight: 22,
  },
});
