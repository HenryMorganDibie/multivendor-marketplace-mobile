import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePathname } from 'expo-router';
import { BlurView } from 'expo-blur';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

interface TabBadge {
  count?: number;
  alert?: boolean;
}

interface FloatingTabBarProps extends BottomTabBarProps {
  badges?: Record<string, TabBadge>;
}

export default function FloatingTabBar({ state, descriptors, navigation, badges = {} }: FloatingTabBarProps) {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();

  const isHidden = pathname.includes('/chat/') || pathname.includes('/chats/');

  if (isHidden) {
    return null;
  }

  const formatBadgeCount = (count: number): string => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  const renderBadge = (routeName: string) => {
    const badge = badges[routeName];
    if (!badge) return null;

    if (badge.alert) {
      return (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>!</Text>
        </View>
      );
    }

    if (badge.count && badge.count > 0) {
      return (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{formatBadgeCount(badge.count)}</Text>
        </View>
      );
    }

    return null;
  };

  const TabBarContainer = Platform.OS === 'ios' ? BlurView : View;
  const blurProps = Platform.OS === 'ios' ? { intensity: 80, tint: 'dark' as const } : {};

  return (
    <View style={[styles.outerContainer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <TabBarContainer
        {...blurProps}
        style={[
          styles.tabBarContainer,
          Platform.OS === 'android' && styles.tabBarContainerAndroid,
        ]}
      >
        <View style={styles.tabBar}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const label =
              options.tabBarLabel !== undefined
                ? options.tabBarLabel
                : options.title !== undefined
                ? options.title
                : route.name;

            const isFocused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({
                type: 'tabPress',
                target: route.key,
                canPreventDefault: true,
              });

              if (!isFocused && !event.defaultPrevented) {
                navigation.navigate(route.name);
              }
            };

            const onLongPress = () => {
              navigation.emit({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            const iconColor = isFocused ? '#FFFFFF' : 'rgba(255, 255, 255, 0.65)';
            const iconSize = 24;

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tab}
              >
                {isFocused && <View style={styles.activeHighlight} />}
                <View style={styles.iconContainer}>
                  {options.tabBarIcon?.({ 
                    focused: isFocused, 
                    color: iconColor, 
                    size: iconSize 
                  })}
                  {renderBadge(route.name)}
                </View>
                <Text
                  style={[
                    styles.label,
                    isFocused ? styles.labelActive : styles.labelInactive,
                  ]}
                  numberOfLines={1}
                >
                  {typeof label === 'string' ? label : route.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </TabBarContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 1000,
    elevation: 1000,
  },
  tabBarContainer: {
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 1001,
    pointerEvents: 'auto',
  },
  tabBarContainerAndroid: {
    backgroundColor: 'rgba(14, 15, 18, 0.96)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: Platform.OS === 'ios' ? 'rgba(14, 15, 18, 0.78)' : 'transparent',
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    position: 'relative',
  },
  activeHighlight: {
    position: 'absolute',
    top: 4,
    left: 6,
    right: 6,
    bottom: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 22,
  },
  iconContainer: {
    position: 'relative',
    marginBottom: 4,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    backgroundColor: '#FF7A28',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
    borderWidth: 1.5,
    borderColor: 'rgba(14,15,18,0.95)',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700' as const,
  },
  label: {
    fontSize: 10.5,
    fontWeight: '600' as const,
    textAlign: 'center',
    letterSpacing: 0.1,
  },
  labelActive: {
    color: '#FFFFFF',
  },
  labelInactive: {
    color: 'rgba(255, 255, 255, 0.65)',
  },
});
