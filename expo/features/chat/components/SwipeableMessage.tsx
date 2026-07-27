import React, { useRef } from 'react';
import {
  View,
  Animated,
  PanResponder,
  StyleSheet,
  Platform,
} from 'react-native';
import { Reply } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const SWIPE_THRESHOLD = 60;
const MAX_SWIPE = 80;

export type SwipeDirection = 'left' | 'right';

type Props = {
  children: React.ReactNode;
  onSwipeToReply: () => void;
  enabled?: boolean;
  direction?: SwipeDirection;
};

export const SwipeableMessage = React.memo(function SwipeableMessage({
  children,
  onSwipeToReply,
  enabled = true,
  direction = 'right',
}: Props) {
  const sign = direction === 'right' ? 1 : -1;
  const translateX = useRef(new Animated.Value(0)).current;
  const replyIconOpacity = useRef(new Animated.Value(0)).current;
  const replyIconScale = useRef(new Animated.Value(0.5)).current;
  const hasTriggeredHaptic = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gestureState) => {
        if (!enabled) return false;
        return gestureState.dx * sign > 10 && Math.abs(gestureState.dy) < 30;
      },
      onMoveShouldSetPanResponderCapture: (_evt, gestureState) => {
        if (!enabled) return false;
        return gestureState.dx * sign > 15 && Math.abs(gestureState.dy) < 20;
      },
      onPanResponderGrant: () => {
        hasTriggeredHaptic.current = false;
      },
      onPanResponderMove: (_evt, gestureState) => {
        const dxRaw = gestureState.dx * sign;
        const dx = Math.max(0, Math.min(dxRaw, MAX_SWIPE));
        translateX.setValue(dx * sign);

        const progress = dx / SWIPE_THRESHOLD;
        replyIconOpacity.setValue(Math.min(progress, 1));
        replyIconScale.setValue(0.5 + Math.min(progress, 1) * 0.5);

        if (dx >= SWIPE_THRESHOLD && !hasTriggeredHaptic.current) {
          hasTriggeredHaptic.current = true;
          if (Platform.OS !== 'web') {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          }
        }
      },
      onPanResponderRelease: (_evt, gestureState) => {
        if (gestureState.dx * sign >= SWIPE_THRESHOLD) {
          onSwipeToReply();
        }

        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }),
          Animated.timing(replyIconOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(replyIconScale, {
            toValue: 0.5,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      },
      onPanResponderTerminate: () => {
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 80,
            friction: 10,
          }),
          Animated.timing(replyIconOpacity, {
            toValue: 0,
            duration: 150,
            useNativeDriver: true,
          }),
          Animated.timing(replyIconScale, {
            toValue: 0.5,
            duration: 150,
            useNativeDriver: true,
          }),
        ]).start();
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          direction === 'right' ? styles.replyIconContainerLeft : styles.replyIconContainerRight,
          {
            opacity: replyIconOpacity,
            transform: [{ scale: replyIconScale }],
          },
        ]}
      >
        <View style={styles.replyIconCircle}>
          <Reply size={16} color="#FFFFFF" />
        </View>
      </Animated.View>
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  replyIconContainerLeft: {
    position: 'absolute',
    left: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  replyIconContainerRight: {
    position: 'absolute',
    right: 8,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: -1,
  },
  replyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#8E8E93',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
