import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { platformColors, Radii, Shadows } from '@/constants/theme';

interface platformCardProps {
  children: React.ReactNode;
  variant?: 'bordered' | 'surface';
  style?: ViewStyle;
}

export default function platformCard({
  children,
  variant = 'surface',
  style,
}: platformCardProps) {
  return (
    <View
      style={[
        styles.base,
        variant === 'bordered' ? styles.bordered : styles.surface,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radii.card,
    padding: 18,
    ...Shadows.xs,
  },
  bordered: {
    backgroundColor: platformColors.white,
    borderWidth: 1,
    borderColor: platformColors.border,
  },
  surface: {
    backgroundColor: platformColors.white,
    borderWidth: 1,
    borderColor: platformColors.border,
  },
});
