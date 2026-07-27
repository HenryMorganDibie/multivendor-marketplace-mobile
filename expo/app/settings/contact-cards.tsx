import React from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, CreditCard, Lock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useContactCards } from '@/contexts/ContactCardsContext';
import { ContactCardList } from '@/components/ContactCardList';

export default function ContactCardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { cards, deleteCard } = useContactCards();

  const handleBackPress = () => {
    router.back();
  };

  const handleAddCard = () => {
    router.push('/settings/edit-contact-card' as any);
  };

  const handleEditCard = (cardId: string) => {
    router.push({
      pathname: '/settings/edit-contact-card' as any,
      params: { cardId },
    });
  };

  const isEmpty = cards.length === 0;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={handleBackPress}
            style={styles.headerBack}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Contact Card Presets</Text>
          <TouchableOpacity
            onPress={handleAddCard}
            style={styles.headerAddBtn}
            activeOpacity={0.7}
          >
            <Plus size={20} color={Colors.primary} strokeWidth={2.5} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {isEmpty ? (
        <View style={[styles.emptyContainer, { paddingBottom: insets.bottom + 80 }]}>
          <View style={styles.emptyIconWrap}>
            <CreditCard size={28} color={Colors.primary} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>Contact Card Presets</Text>
          <Text style={styles.emptySubtitle}>
            Save your most-used delivery and pickup details for faster checkout. Tap + above to create one.
          </Text>

          <View style={styles.emptyPrivacyRow}>
            <Lock size={12} color={Colors.textMuted} strokeWidth={2} />
            <Text style={styles.emptyPrivacyText}>
              Contact cards are stored locally on your device and cannot be screenshotted.
            </Text>
          </View>
        </View>
      ) : (
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 48 }]}
        >
          <ContactCardList
            mode="manage"
            cards={cards}
            onCardPress={handleEditCard}
            onDeleteCard={deleteCard}
            onAddCard={handleAddCard}
          />
        </ScrollView>
      )}
    </View>
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
  headerAddBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerSpacer: {
    width: 36,
  },
  // Empty State
  emptyContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 10,
    letterSpacing: -0.3,
  },
  emptySubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    maxWidth: 280,
    marginBottom: 32,
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
  // List State
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  bottomSpacer: {
    height: 40,
  },
});
