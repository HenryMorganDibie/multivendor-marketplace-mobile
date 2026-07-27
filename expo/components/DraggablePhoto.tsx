import React, { useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  TouchableOpacity,
  Image,
  View,
  StyleSheet,
} from 'react-native';
import { EyeOff, Pencil } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface DraggablePhotoProps {
  uri: string;
  index: number;
  /** Called on short tap — parent should open the edit sheet */
  onTap: () => void;
  onRemove: () => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  isAvailable: boolean;
  isFirst?: boolean;
}

export function DraggablePhoto({
  uri,
  index,
  onTap,
  onRemove: _onRemove,
  onReorder,
  isAvailable,
  isFirst = false,
}: DraggablePhotoProps) {
  const pan = useRef(new Animated.ValueXY()).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const currentIndex = useRef(index);

  // Update the live index ref whenever prop changes
  currentIndex.current = index;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        isDraggingRef.current && Math.abs(gesture.dx) > 3,
      onPanResponderGrant: () => {
        // index already tracked via currentIndex.current
      },
      onPanResponderMove: (_, gesture) => {
        if (isDraggingRef.current) {
          pan.setValue({ x: gesture.dx, y: 0 });
        }
      },
      onPanResponderRelease: (_, gesture) => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          setIsDragging(false);
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
            tension: 200,
            friction: 12,
          }).start();
          const CARD_WIDTH = 132;
          const movedCards = Math.round(gesture.dx / CARD_WIDTH);
          const newIndex = Math.max(0, currentIndex.current + movedCards);
          if (newIndex !== currentIndex.current) {
            onReorder(currentIndex.current, newIndex);
          }
          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            tension: 180,
            friction: 14,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        if (isDraggingRef.current) {
          isDraggingRef.current = false;
          setIsDragging(false);
          Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    })
  ).current;

  const handleLongPress = () => {
    isDraggingRef.current = true;
    setIsDragging(true);
    Animated.spring(scaleAnim, {
      toValue: 1.06,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <Animated.View
      style={[
        styles.photoCard,
        isDragging && styles.photoCardDragging,
        {
          transform: [
            ...pan.getTranslateTransform(),
            { scale: scaleAnim },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        activeOpacity={0.88}
        onPress={onTap}
        onLongPress={handleLongPress}
        delayLongPress={380}
        style={styles.photoTouchable}
      >
        <Image
          source={{ uri }}
          style={[styles.photoImage, !isAvailable && { opacity: 0.5 }]}
        />

        {/* Hidden overlay */}
        {!isAvailable && (
          <View style={styles.hiddenOverlay}>
            <View style={styles.hiddenBadge}>
              <EyeOff size={18} color={Colors.white} strokeWidth={2} />
            </View>
          </View>
        )}

        {/* Main photo badge */}
        {isFirst && (
          <View style={styles.mainBadge}>
            <View style={styles.mainBadgeDot} />
          </View>
        )}

        {/* Edit hint — pencil chip on tap */}
        <View style={styles.editHint}>
          <Pencil size={11} color={Colors.white} strokeWidth={2.5} />
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  photoCard: {
    width: 120,
    height: 120,
    borderRadius: 12,
    position: 'relative',
    backgroundColor: Colors.backgroundCanvas,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  photoCardDragging: {
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 999,
  },
  photoTouchable: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  hiddenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenBadge: {
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 18,
    padding: 8,
  },
  mainBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 3,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  mainBadgeDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#FFD60A',
  },
  editHint: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
