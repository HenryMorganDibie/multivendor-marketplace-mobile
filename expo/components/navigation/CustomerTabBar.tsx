import React from 'react';
import { View, Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { isTablet } from '@/constants/layout';

export default function CustomerTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const tablet = isTablet(width);

  return (
    <View style={[
      styles.container,
      tablet ? styles.containerTablet : styles.containerPhone,
      { paddingBottom: Math.max(insets.bottom, tablet ? 20 : 16) },
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

          const iconColor = isFocused ? Colors.primary : Colors.textMuted;

          const icon = options.tabBarIcon?.({
            focused: isFocused,
            color: iconColor,
            size: 22,
          });

          const TabContent = (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarAccessibilityLabel}
              onPress={onPress}
              onLongPress={onLongPress}
              style={[
                styles.tabItem,
                isFocused && styles.activeTabItem,
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
                <Text
                  style={styles.label}
                  numberOfLines={1}
                >
                  {label}
                </Text>
              )}
            </Pressable>
          );

          return TabContent;
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
  },
  containerPhone: {
    paddingHorizontal: 24,
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
    borderRadius: 32,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 24,
    gap: 8,
  },
  activeTabItem: {
    backgroundColor: Colors.primarySoft,
  },
  iconContainer: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: Colors.white,
    fontSize: 10,
    fontWeight: '700',
  },
  label: {
    color: Colors.primary,
    fontSize: 13,
    fontWeight: '600',
  },
});
