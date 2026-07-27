import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors } from '@/constants/colors';

export type ChatTypeBadgeVariant = 'order_chat' | 'pre_order_inquiry';

interface Props {
  variant: ChatTypeBadgeVariant;
  compact?: boolean;
}

const LABELS: Record<ChatTypeBadgeVariant, string> = {
  order_chat: 'Order chat',
  pre_order_inquiry: 'Inquiry',
};

/**
 * Small pill badge that labels a chat thread's type.
 * Backend-ready: maps `chatType` from a chat thread / inbox snapshot to a display badge.
 */
export function ChatTypeBadge({ variant, compact = false }: Props) {
  const isOrder = variant === 'order_chat';
  const bg = isOrder ? 'rgba(255,140,66,0.12)' : Colors.surface;
  const color = isOrder ? Colors.primary : Colors.textSecondary;
  const borderColor = isOrder ? 'rgba(255,140,66,0.25)' : Colors.borderSoft;

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: bg, borderColor },
      ]}
    >
      <Text style={[styles.text, { color }, compact && styles.textCompact]} numberOfLines={1}>
        {LABELS[variant]}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start' as const,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeCompact: {
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  text: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.2,
  },
  textCompact: {
    fontSize: 10,
  },
});

export default ChatTypeBadge;
