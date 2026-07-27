import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
} from 'react-native';
import { Check, Pencil, Trash2, MapPin, Phone, FileText, User } from 'lucide-react-native';
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

  const isSelected = mode === 'picker' && selectedCardId === card.id;

  return (
    <View style={swipeStyles.container}>
      {/* Revealed actions */}
      <View style={swipeStyles.actionsContainer}>
        <TouchableOpacity
          style={swipeStyles.editButton}
          onPress={handleEdit}
          activeOpacity={0.85}
        >
          <Pencil size={16} color="#FFFFFF" strokeWidth={2} />
          <Text style={swipeStyles.actionLabel}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={swipeStyles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.85}
        >
          <Trash2 size={16} color="#FFFFFF" strokeWidth={2} />
          <Text style={swipeStyles.actionLabel}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          swipeStyles.cardWrapper,
          isSelected && swipeStyles.selectedCard,
          { transform: [{ translateX }] },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
          <View style={swipeStyles.cardContent}>
            {/* Card header: label + selection indicator */}
            <View style={swipeStyles.cardHeader}>
              <View style={swipeStyles.labelRow}>
                <View style={swipeStyles.labelBadge}>
                  <Text style={swipeStyles.labelText}>{card.label}</Text>
                </View>
              </View>
              {isSelected && (
                <View style={swipeStyles.checkCircle}>
                  <Check size={14} color={Colors.white} strokeWidth={3} />
                </View>
              )}
            </View>

            {/* Name */}
            {card.name ? (
              <View style={swipeStyles.detailRow}>
                <User size={13} color={Colors.textMuted} strokeWidth={1.8} />
                <Text style={swipeStyles.detailText} numberOfLines={1}>
                  {card.name}
                </Text>
              </View>
            ) : null}

            {/* Phone */}
            {card.phone ? (
              <View style={swipeStyles.detailRow}>
                <Phone size={13} color={Colors.textMuted} strokeWidth={1.8} />
                <Text style={swipeStyles.detailText} numberOfLines={1}>
                  {card.phone}
                </Text>
              </View>
            ) : null}

            {/* Address */}
            {card.address ? (
              <View style={swipeStyles.detailRow}>
                <MapPin size={13} color={Colors.textMuted} strokeWidth={1.8} />
                <Text style={swipeStyles.detailText} numberOfLines={2}>
                  {card.address}
                </Text>
              </View>
            ) : null}

            {/* Note */}
            {card.note ? (
              <View style={[swipeStyles.detailRow, swipeStyles.noteRow]}>
                <FileText size={13} color={Colors.textMuted} strokeWidth={1.8} />
                <Text style={swipeStyles.noteText} numberOfLines={2}>
                  {card.note}
                </Text>
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
  },
  actionsContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: REVEAL_WIDTH,
    flexDirection: 'row' as const,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    overflow: 'hidden' as const,
  },
  editButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: Colors.error,
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
    backgroundColor: Colors.background,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  selectedCard: {
    backgroundColor: Colors.primaryTint,
    borderWidth: 1.5,
    borderColor: Colors.primary,
  },
  cardContent: {
    padding: 16,
    borderRadius: 14,
    overflow: 'hidden' as const,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
  },
  labelRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  labelBadge: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  labelText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: 0.1,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  detailRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginBottom: 5,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  noteRow: {
    marginTop: 4,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  noteText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    fontStyle: 'italic' as const,
  },
});

// ─── ContactCardList ──────────────────────────────────────────────────────────

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
    <View style={listStyles.container}>
      {mode === 'manage' && cards.length > 0 && (
        <View style={listStyles.privacyNote}>
          <Text style={listStyles.privacyNoteText}>
            Stored locally · Not uploaded to servers
          </Text>
        </View>
      )}

      <View style={listStyles.list}>
        {cards.map((card, index) => (
          <View
            key={card.id}
            style={[listStyles.cardWrap, index > 0 && listStyles.cardSpacing]}
          >
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
    </View>
  );
}

const listStyles = StyleSheet.create({
  container: {
    paddingTop: 4,
  },
  privacyNote: {
    alignItems: 'center' as const,
    marginBottom: 16,
  },
  privacyNoteText: {
    fontSize: 12,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },
  list: {
    gap: 10,
  },
  cardWrap: {},
  cardSpacing: {
    // gap handles spacing
  },
});
