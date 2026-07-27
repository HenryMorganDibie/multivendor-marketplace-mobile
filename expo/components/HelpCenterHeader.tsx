import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface HelpCenterHeaderProps {
  title: string;
  onBack: () => void;
  rightAction?: React.ReactNode;
  testID?: string;
}

/**
 * Shared light-theme header for all Help Center screens.
 * Circular chevron back button on the left, centered title,
 * optional right action slot.
 */
export default function HelpCenterHeader({
  title,
  onBack,
  rightAction,
  testID,
}: HelpCenterHeaderProps) {
  return (
    <View style={styles.header} testID={testID}>
      <TouchableOpacity
        onPress={onBack}
        style={styles.backButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        activeOpacity={0.65}
        testID={testID ? `${testID}-back` : undefined}
      >
        <ChevronLeft size={20} color={Colors.text} strokeWidth={2.2} />
      </TouchableOpacity>

      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>

      {rightAction ? (
        <View style={styles.right}>{rightAction}</View>
      ) : (
        <View style={styles.placeholder} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    minHeight: 52,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginHorizontal: 8,
  },
  right: {
    minWidth: 36,
    alignItems: 'flex-end' as const,
  },
  placeholder: {
    width: 36,
  },
});
