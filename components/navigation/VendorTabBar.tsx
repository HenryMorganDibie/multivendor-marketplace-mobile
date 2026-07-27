import React, { useRef, useEffect } from 'react';
import { View, Pressable, StyleSheet, Text, Platform, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';

interface VendorTabItemProps {
  isFocused: boolean;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

function VendorTabItem({ isFocused, label, icon, badge, onPress, onLongPress, accessibilityLabel, testID }: VendorTabItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const labelOpacity = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(labelOpacity, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: true,
      tension: 120,
      friction: 12,
    }).start();
  }, [isFocused, labelOpacity]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.88,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 200,
      friction: 10,
    }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.tabItemOuter}
    >
      <Animated.View
        style={[
          styles.tabItem,
          isFocused && styles.tabItemActive,
          { transform: [{ scale: scaleAnim }] },
        ]}
      >
        <View style={styles.iconWrapper}>
          {icon}
          {badge !== undefined && badge !== null && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>
                {typeof badge === 'number' && badge > 99 ? '99+' : badge}
              </Text>
            </View>
          )}
        </View>
        {isFocused && (
          <Animated.Text style={[styles.activeLabel, { opacity: labelOpacity }]} numberOfLines={1}>
            {label}
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function VendorTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom + 4, 10);

  return (
    <View style={[styles.outerContainer, { paddingBottom: bottomPad }]}>
      <View style={styles.pillContainer}>
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
          const isFocused = state.index === index;
          const badge = options.tabBarBadge;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name, route.params);
            }
          };

          const onLongPress = () => {
            navigation.emit({ type: 'tabLongPress', target: route.key });
          };

          const iconColor = isFocused ? Colors.primary : Colors.textMuted;

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color: iconColor,
            size: 22,
          });

          return (
            <VendorTabItem
              key={route.key}
              isFocused={isFocused}
              label={label}
              icon={icon}
              badge={badge}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={`tab-${route.name}`}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    paddingTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  pillContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: Colors.white,
    borderRadius: 36,
    height: 60,
    paddingHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(238,240,244,0.9)',
    ...Platform.select({
      ios: {
        shadowColor: '#0B0C0F',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.10,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
      default: {},
    }),
  },
  tabItemOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 22,
    gap: 6,
    minWidth: 44,
  },
  tabItemActive: {
    backgroundColor: `rgba(255,122,40,0.10)`,
    paddingHorizontal: 16,
  },
  iconWrapper: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -10,
    backgroundColor: Colors.error,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: Colors.white,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 9,
    fontWeight: '700' as const,
  },
  activeLabel: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: -0.2,
  },
});
