import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ContactCard } from '@/contexts/ContactCardsContext';
import { Colors } from '@/constants/colors';

interface ContactCardDetailModalProps {
  visible: boolean;
  card: ContactCard | null;
  onClose: () => void;
  onSend: (card: ContactCard) => void;
}

export function ContactCardDetailModal({
  visible,
  card,
  onClose,
  onSend,
}: ContactCardDetailModalProps) {
  if (!card) return null;

  const handleSend = () => {
    onSend(card);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.headerButton}
            >
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Contact Card</Text>
            <TouchableOpacity 
              onPress={handleSend} 
              style={styles.headerButton}
            >
              <Text style={styles.sendText}>Send</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoBox}>
            <Text style={styles.infoText}>
              This contact card will be shared with the seller.{'\n'}
              Cards are view-only and protected from screenshots, copying, forwarding, and saving.
            </Text>
          </View>

          <View style={styles.cardContainer}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>{card.label}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Name</Text>
              <Text style={styles.fieldValue}>{card.name}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Phone</Text>
              <Text style={styles.fieldValue}>{card.phone}</Text>
            </View>

            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Address</Text>
              <Text style={styles.fieldValue}>{card.address}</Text>
            </View>

            {card.note && (
              <View style={styles.fieldRow}>
                <Text style={styles.fieldLabel}>Delivery Note</Text>
                <Text style={styles.fieldValue}>{card.note}</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    padding: 8,
    minWidth: 70,
  },
  cancelText: {
    fontSize: 17,
    color: Colors.charcoal,
  },
  sendText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
    textAlign: 'right' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  cardContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  cardHeader: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 16,
    marginBottom: 16,
  },
  cardLabel: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  fieldRow: {
    marginBottom: 20,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
  },
});
