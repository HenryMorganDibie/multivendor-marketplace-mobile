import React from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useContactCards } from '@/contexts/ContactCardsContext';
import { ContactCardList } from '@/components/ContactCardList';

export default function ContactCardsScreen() {
  const router = useRouter();
  const { cards, deleteCard } = useContactCards();

  const handleBackPress = () => {
    router.back();
  };

  const handleAddCard = () => {
    console.log('Add new contact card');
    router.push('/settings/edit-contact-card' as any);
  };

  const handleEditCard = (cardId: string) => {
    console.log('Edit contact card:', cardId);
    router.push({
      pathname: '/settings/edit-contact-card' as any,
      params: { cardId },
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity 
            onPress={handleBackPress} 
            style={styles.headerButton}
          >
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Card Presets</Text>
          <TouchableOpacity 
            onPress={handleAddCard} 
            style={styles.headerButton}
          >
            <Plus size={24} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <ContactCardList
          mode="manage"
          cards={cards}
          onCardPress={handleEditCard}
          onDeleteCard={deleteCard}
          onAddCard={handleAddCard}
        />
        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
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
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  bottomSpacer: {
    height: 40,
  },
});
