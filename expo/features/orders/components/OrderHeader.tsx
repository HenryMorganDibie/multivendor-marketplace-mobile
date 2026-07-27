import React, { type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface OrderHeaderProps {
  onBack: () => void;
  title?: string;
  rightAction?: ReactNode;
  onDecline?: () => void;
}

export default function OrderHeader({ onBack, title = 'Order details', rightAction, onDecline }: OrderHeaderProps) {
  const right = rightAction ?? (onDecline ? (
    <TouchableOpacity
      onPress={onDecline}
      style={styles.declineButton}
      testID="order-header-decline"
      activeOpacity={0.7}
    >
      <Text style={styles.declineText}>Decline</Text>
    </TouchableOpacity>
  ) : (
    <View style={styles.headerSpacer} />
  ));

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.headerButton} testID="order-header-back">
          <ChevronLeft size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        {right}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: { padding: 8 },
  headerSpacer: { width: 40 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  declineButton: {
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  declineText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
});
