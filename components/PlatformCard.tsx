import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { the platformColors, Radii, Shadows } from '@/constants/theme';

interface the platformCardProps {
  children: React.ReactNode;
  variant?: 'bordered' | 'surface';
  style?: ViewStyle;
}

export default function the platformCard({
  children,
  variant = 'surface',
  style,
}: the platformCardProps) {
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
    backgroundColor: the platformColors.white,
    borderWidth: 1,
    borderColor: the platformColors.border,
  },
  surface: {
    backgroundColor: the platformColors.white,
    borderWidth: 1,
    borderColor: the platformColors.border,
  },
});
