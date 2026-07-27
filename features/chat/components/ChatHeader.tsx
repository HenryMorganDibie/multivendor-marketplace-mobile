import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { Colors } from '@/constants/colors';
import { formatVendorOrderId } from '@/utils/formatOrderId';

type Props = {
  customerDisplayName: string;
  customerInitials: string;
  customerAvatarColor: string;
  orderId: string;
  publicOrderId?: string;
  onAvatarPress: () => void;
  trustLabel?: string;
};

export const ChatHeader = React.memo(({
  customerDisplayName,
  customerInitials,
  customerAvatarColor,
  orderId,
  publicOrderId,
  onAvatarPress,
  trustLabel,
}: Props) => {
  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <View style={styles.header} testID="chat-header">
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton} testID="chat-back-button">
          <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onAvatarPress}>
          <View style={[styles.avatarCircle, { backgroundColor: customerAvatarColor }]}>
            <Text style={styles.avatarText}>{customerInitials}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity style={styles.headerContent} onPress={onAvatarPress}>
          <Text style={styles.customerName}>{customerDisplayName}</Text>
          {trustLabel ? (
            <Text style={styles.trustLabel} numberOfLines={1}>{trustLabel}</Text>
          ) : (
            <Text style={styles.orderId}>{formatVendorOrderId(publicOrderId || orderId)}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.spacer} />
      </View>
    </SafeAreaView>
  );
});

ChatHeader.displayName = 'ChatHeader';

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 8,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  headerContent: {
    flex: 1,
    marginLeft: 0,
  },
  customerName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  orderId: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  trustLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  spacer: {
    width: 40,
  },
});
