import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { Colors } from '@/constants/colors';

export interface SegmentTab {
  key: string;
  label: string;
  /** Optional count badge shown next to label */
  count?: number;
}

interface SegmentedControlProps {
  tabs: SegmentTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  /** Extra style applied to the outer track container */
  style?: StyleProp<ViewStyle>;
  /**
   * When true the control stretches to fill its parent.
   * When false (default) it sizes to its content.
   */
  fullWidth?: boolean;
}

/**
 * Animated pill-slide segmented control.
 * Matches the Pickup / Delivery selector design language used in the Cart screen.
 */
export default function SegmentedControl({
  tabs,
  activeTab,
  onTabChange,
  style,
  fullWidth = false,
}: SegmentedControlProps) {
  const activeIndex = tabs.findIndex((t) => t.key === activeTab);
  const slideAnim = useRef(
    new Animated.Value(activeIndex >= 0 ? activeIndex : 0)
  ).current;

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: activeIndex >= 0 ? activeIndex : 0,
      duration: 210,
      useNativeDriver: false,
    }).start();
  }, [activeIndex, slideAnim]);

  const pillCount = tabs.length;

  return (
    <View
      style={[
        styles.track,
        fullWidth && styles.trackFullWidth,
        style,
      ]}
    >
      {/* Sliding active pill background */}
      {activeIndex >= 0 && (
        <Animated.View
          style={[
            styles.activePill,
            {
              width: `${100 / pillCount}%` as any,
              left: slideAnim.interpolate({
                inputRange: tabs.map((_, i) => i),
                outputRange: tabs.map((_, i) => `${(100 / pillCount) * i}%`),
              }) as any,
            },
          ]}
        />
      )}

      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.pill, fullWidth && styles.pillFullWidth]}
            onPress={() => onTabChange(tab.key)}
            activeOpacity={0.75}
          >
            <Text
              style={[styles.pillText, isActive && styles.pillTextActive]}
            >
              {tab.label}
            </Text>
            {tab.count !== undefined && tab.count > 0 && (
              <View
                style={[styles.badge, isActive && styles.badgeActive]}
              >
                <Text
                  style={[
                    styles.badgeText,
                    isActive && styles.badgeTextActive,
                  ]}
                >
                  {tab.count}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row' as const,
    backgroundColor: '#F2F3F6',
    borderRadius: 999,
    padding: 3,
    alignSelf: 'flex-start' as const,
    position: 'relative' as const,
  },
  trackFullWidth: {
    alignSelf: 'stretch' as const,
  },

  /* The white sliding pill rendered behind the active tab's text */
  activePill: {
    position: 'absolute' as const,
    top: 3,
    bottom: 3,
    borderRadius: 999,
    backgroundColor: Colors.white,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 3,
    elevation: 2,
  },

  /* Each tappable tab sits above the sliding pill via zIndex */
  pill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 7,
    borderRadius: 999,
    zIndex: 1,
    gap: 5,
  },
  pillFullWidth: {
    flex: 1,
  },

  pillText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
  },
  pillTextActive: {
    color: Colors.text,
    fontWeight: '600' as const,
  },

  /* Count badge */
  badge: {
    minWidth: 17,
    height: 17,
    borderRadius: 999,
    backgroundColor: Colors.surfaceMuted,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 4,
  },
  badgeActive: {
    backgroundColor: Colors.primary,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
  },
  badgeTextActive: {
    color: Colors.white,
  },
});
