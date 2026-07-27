import React, { useRef, useEffect } from 'react';
import { View, Pressable, StyleSheet, Platform, Text, useWindowDimensions, Animated } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { isTablet } from '@/constants/layout';

interface TabItemProps {
  route: BottomTabBarProps['state']['routes'][0];
  isFocused: boolean;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
  testID?: string;
}

function TabItem({ route, isFocused, label, icon, badge, onPress, onLongPress, accessibilityLabel, testID }: TabItemProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const widthAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(widthAnim, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: false,
      tension: 120,
      friction: 10,
    }).start();
  }, [isFocused, widthAnim]);

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

  const pillWidth = widthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [44, 100],
  });

  const pillOpacity = widthAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, 0, 1],
  });

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
          styles.tabPill,
          isFocused && styles.tabPillActive,
          { transform: [{ scale: scaleAnim }] },
          isFocused && {
            width: pillWidth,
          } as any,
        ]}
      >
        <View style={styles.iconContainer}>
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
          <Animated.Text style={[styles.label, { opacity: pillOpacity }]} numberOfLines={1}>
            {label}
          </Animated.Text>
        )}
      </Animated.View>
    </Pressable>
  );
}

export default function CustomerTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tablet = isTablet(width);

  return (
    <View style={[
      styles.container,
      tablet ? styles.containerTablet : styles.containerPhone,
      { paddingBottom: Math.max(insets.bottom + 4, tablet ? 20 : 12) },
    ]}>
      <View style={[styles.tabBar, tablet && styles.tabBarTablet]}>
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
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          const iconColor = isFocused ? Colors.primary : Colors.tabBarInactive;

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color: iconColor,
            size: 22,
          });

          if (Platform.OS === 'web') {
            return (
              <TabItem
                key={route.key}
                route={route}
                isFocused={isFocused}
                label={label}
                icon={icon}
                badge={badge}
                onPress={onPress}
                onLongPress={onLongPress}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                testID={options.tabBarAccessibilityLabel}
              />
            );
          }

          return (
            <TabItem
              key={route.key}
              route={route}
              isFocused={isFocused}
              label={label}
              icon={icon}
              badge={badge}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarAccessibilityLabel}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingTop: 8,
  },
  containerPhone: {
    paddingHorizontal: 20,
  },
  containerTablet: {
    paddingHorizontal: 60,
  },
  tabBarTablet: {
    paddingHorizontal: 24,
    gap: 8,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Colors.white,
    borderRadius: 36,
    paddingVertical: 7,
    paddingHorizontal: 7,
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
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
    borderWidth: 1,
    borderColor: 'rgba(238,240,244,0.8)',
  },
  tabItemOuter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 46,
  },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 10,
    gap: 6,
    minWidth: 44,
  },
  tabPillActive: {
    backgroundColor: `rgba(255,122,40,0.10)`,
    paddingHorizontal: 14,
  },
  iconContainer: {
    position: 'relative',
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.badge,
    borderRadius: 10,
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
    fontWeight: '700',
  },
  label: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
});
