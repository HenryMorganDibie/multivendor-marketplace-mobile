import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
} from 'react-native';
import { Edit2, Trash2 } from 'lucide-react-native';
import { ContactCard } from '@/contexts/ContactCardsContext';
import { Colors } from '@/constants/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SWIPE_THRESHOLD = 60;
const ACTION_WIDTH = 75;

interface SwipeableContactCardProps {
  card: ContactCard;
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function SwipeableContactCard({
  card,
  onPress,
  onEdit,
  onDelete,
}: SwipeableContactCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const swipeState = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 5;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dx < 0) {
          const clampedDx = Math.max(gestureState.dx, -ACTION_WIDTH * 2);
          translateX.setValue(clampedDx);
        } else if (swipeState.current !== 0) {
          translateX.setValue(gestureState.dx - ACTION_WIDTH * 2);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dx < -SWIPE_THRESHOLD && swipeState.current === 0) {
          swipeState.current = 1;
          Animated.spring(translateX, {
            toValue: -ACTION_WIDTH * 2,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        } else if (gestureState.dx > SWIPE_THRESHOLD && swipeState.current !== 0) {
          swipeState.current = 0;
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        } else {
          Animated.spring(translateX, {
            toValue: swipeState.current === 0 ? 0 : -ACTION_WIDTH * 2,
            useNativeDriver: true,
            bounciness: 0,
          }).start();
        }
      },
    })
  ).current;

  const handlePress = () => {
    if (swipeState.current !== 0) {
      swipeState.current = 0;
      Animated.spring(translateX, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    } else {
      onPress();
    }
  };

  const handleEdit = () => {
    swipeState.current = 0;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
    onEdit();
  };

  const handleDelete = () => {
    swipeState.current = 0;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
    onDelete();
  };

  return (
    <View style={styles.container}>
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.editButton]}
          onPress={handleEdit}
          activeOpacity={0.7}
        >
          <Edit2 size={20} color={Colors.white} />
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Trash2 size={20} color={Colors.white} />
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>

      <Animated.View
        style={[
          styles.cardWrapper,
          {
            transform: [{ translateX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.card}
          onPress={handlePress}
          activeOpacity={0.7}
        >
          <View style={styles.cardContent}>
            <Text style={styles.cardLabel}>{card.label}</Text>
            <Text style={styles.cardDetail}>{card.name}</Text>
            <Text style={styles.cardDetail}>{card.phone}</Text>
            <Text style={styles.cardDetail} numberOfLines={2}>
              {card.address}
            </Text>
            {card.note && (
              <Text style={styles.cardNote} numberOfLines={1}>
                Note: {card.note}
              </Text>
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    position: 'relative' as const,
  },
  actionsContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  actionButton: {
    width: ACTION_WIDTH,
    height: '100%',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 4,
  },
  editButton: {
    backgroundColor: Colors.primary,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  actionText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  cardWrapper: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardContent: {
    paddingVertical: 16,
    paddingHorizontal: 16,
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
});
