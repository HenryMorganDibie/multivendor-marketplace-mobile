import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Check, Pencil, Trash2 } from 'lucide-react-native';
import { ContactCard } from '@/contexts/ContactCardsContext';
import { Colors } from '@/constants/colors';

const REVEAL_WIDTH = 110;

interface SwipeableContactCardProps {
  card: ContactCard;
  selectedCardId?: string | null;
  mode: 'manage' | 'picker';
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SwipeableContactCard({
  card,
  selectedCardId,
  mode,
  onPress,
  onEdit,
  onDelete,
}: SwipeableContactCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const springClose = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 20,
    }).start();
  };

  const springOpen = () => {
    Animated.spring(translateX, {
      toValue: -REVEAL_WIDTH,
      useNativeDriver: true,
      tension: 80,
      friction: 20,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) {
          translateX.setValue(Math.max(g.dx, -REVEAL_WIDTH));
        } else {
          translateX.setValue(Math.min(g.dx * 0.15, 0));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -REVEAL_WIDTH / 2) {
          springOpen();
        } else {
          springClose();
        }
      },
    })
  ).current;

  const handleEdit = () => {
    springClose();
    setTimeout(() => onEdit(), 120);
  };

  const handleDelete = () => {
    springClose();
    setTimeout(() => onDelete(), 120);
  };

  return (
    <View style={swipeStyles.container}>
      <View style={swipeStyles.actionsContainer}>
        <TouchableOpacity
          style={swipeStyles.editButton}
          onPress={handleEdit}
          activeOpacity={0.85}
        >
          <Pencil size={17} color="#FFFFFF" strokeWidth={2} />
          <Text style={swipeStyles.actionLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={swipeStyles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.85}
        >
          <Trash2 size={17} color="#FFFFFF" strokeWidth={2} />
          <Text style={swipeStyles.actionLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          swipeStyles.cardWrapper,
          mode === 'picker' && selectedCardId === card.id && swipeStyles.selectedCard,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={swipeStyles.cardInner}>
          <View style={swipeStyles.cardRow}>
            <View style={swipeStyles.cardLeft}>
              <Text style={swipeStyles.cardLabel}>{card.label}</Text>
              <Text style={swipeStyles.cardDetail}>{card.name}</Text>
              <Text style={swipeStyles.cardDetail}>{card.phone}</Text>
              <Text style={swipeStyles.cardDetail}>{card.address}</Text>
              {card.note ? (
                <Text style={swipeStyles.cardNote}>Note: {card.note}</Text>
              ) : null}
            </View>
            {mode === 'manage' ? null : selectedCardId === card.id ? (
              <View style={swipeStyles.checkIcon}>
                <Check size={20} color={Colors.white} strokeWidth={3} />
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  container: {
    position: 'relative' as const,
    marginBottom: 0,
  },
  actionsContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_WIDTH,
    flexDirection: 'row' as const,
    borderTopRightRadius: 16,
    borderBottomRightRadius: 16,
    overflow: 'hidden' as const,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#FF8C42',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: '#D92D20',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  cardWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  selectedCard: {
    backgroundColor: Colors.warningLight,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  cardInner: {
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  cardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  cardLeft: {
    flex: 1,
    marginRight: 12,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 15,
    color: Colors.textSecondaryOnSurface,
    marginBottom: 4,
  },
  cardNote: {
    fontSize: 14,
    color: Colors.textMutedOnSurface,
    marginTop: 4,
    fontStyle: 'italic' as const,
  },
  checkIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
});

interface ContactCardListProps {
  mode: 'manage' | 'picker';
  cards: ContactCard[];
  selectedCardId?: string | null;
  onCardPress: (cardId: string) => void;
  onDeleteCard?: (cardId: string) => void;
  onAddCard?: () => void;
}

export function ContactCardList({
  mode,
  cards,
  selectedCardId,
  onCardPress,
  onDeleteCard,
}: ContactCardListProps) {
  return (
    <>
      {mode === 'manage' && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Contact cards are stored locally on your device and cannot be screenshotted.
          </Text>
        </View>
      )}

      <View style={styles.section}>
        {cards.map((card, index) => (
          <View key={card.id} style={[styles.cardContainer, index > 0 && styles.cardSpacing]}>
            <SwipeableContactCard
              card={card}
              selectedCardId={selectedCardId}
              mode={mode}
              onPress={() => onCardPress(card.id)}
              onEdit={() => onCardPress(card.id)}
              onDelete={() => onDeleteCard?.(card.id)}
            />
          </View>
        ))}
      </View>


    </>
  );
}

const styles = StyleSheet.create({
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondaryOnSurface,
    lineHeight: 20,
  },
  section: {
    marginTop: 16,
  },
  cardContainer: {
    marginBottom: 0,
  },
  cardSpacing: {
    marginTop: 12,
  },

});
