import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { ContactCardData } from '@/mocks/chatData';
import { Colors } from '@/constants/colors';

interface ContactCardBubbleProps {
  data: ContactCardData;
  timestamp: string;
  label?: string;
}

export function ContactCardBubble({ data, timestamp, label = 'Contact Card' }: ContactCardBubbleProps) {
  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleLongPress = () => {
    Alert.alert(
      'Contact Card Protection',
      'Contact cards are view-only and protected. Screenshots, copying, forwarding, and saving are blocked by the operating system when supported.\n\nThis contact information is customer-owned and stored locally on their device only.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  return (
    <View 
      style={styles.contactCardContainer}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      onTouchEnd={handleLongPress}
    >
      <View 
        style={styles.glassCard}
        accessible={false}
        importantForAccessibility="no"
      >
        <Text style={styles.cardLabel}>{data.label || label}</Text>
        {data.name && (
          <Text style={styles.cardDetail}>{data.name}</Text>
        )}
        {data.phone && (
          <Text style={styles.cardDetail}>{data.phone}</Text>
        )}
        {data.address && (
          <Text style={styles.cardDetail}>{data.address}</Text>
        )}
        {data.note && (
          <Text style={styles.cardNote}>Note: {data.note}</Text>
        )}
      </View>
      <Text style={styles.contactCardTime}>{formatTime(timestamp)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contactCardContainer: {
    maxWidth: '85%',
  },
  glassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardLabel: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  cardDetail: {
    fontSize: 15,
    color: Colors.textSecondaryOnSurface,
    marginBottom: 4,
    userSelect: 'none' as const,
  },
  cardNote: {
    fontSize: 14,
    color: Colors.textMutedOnSurface,
    marginTop: 4,
    fontStyle: 'italic' as const,
    userSelect: 'none' as const,
  },
  contactCardTime: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'right' as const,
    paddingHorizontal: 4,
  },
});
