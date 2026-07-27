import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useContactCards } from '@/contexts/ContactCardsContext';
import { ContactCardList } from '@/components/ContactCardList';

export default function SelectContactCardScreen() {
  const router = useRouter();
  const { cards } = useContactCards();
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleCancelPress = () => {
    router.back();
  };

  const handleCardSelect = (cardId: string) => {
    setSelectedCardId(cardId);
  };

  const handleSendCard = () => {
    if (!selectedCardId) return;
    
    const selectedCard = cards.find(c => c.id === selectedCardId);
    if (!selectedCard) return;

    console.log('Sending contact card:', selectedCard);
    router.back();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={handleCancelPress} 
            style={styles.headerButton}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Select contact card</Text>
          <TouchableOpacity 
            onPress={handleSendCard} 
            style={styles.headerButton}
            disabled={!selectedCardId}
          >
            <Text style={[
              styles.sendText,
              !selectedCardId && styles.sendTextDisabled
            ]}>
              Send
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {cards.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>No contact cards</Text>
            <Text style={styles.emptyStateText}>
              Create contact card presets in Settings to share them in chats.
            </Text>
          </View>
        ) : (
          <ContactCardList
            mode="picker"
            cards={cards}
            selectedCardId={selectedCardId}
            onCardPress={handleCardSelect}
          />
        )}
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  safeArea: {
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
  },
  headerButton: {
    padding: 8,
    minWidth: 70,
  },
  cancelText: {
    fontSize: 17,
    color: '#4A9EFF',
  },
  sendText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#4A9EFF',
    textAlign: 'right' as const,
  },
  sendTextDisabled: {
    color: '#444',
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
    paddingHorizontal: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  emptyState: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#888',
    textAlign: 'center' as const,
    lineHeight: 22,
  },
});
