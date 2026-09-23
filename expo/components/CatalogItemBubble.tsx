import React from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { CatalogItemData } from '@/mocks/chatData';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';

interface CatalogItemBubbleProps {
  data: CatalogItemData;
  timestamp: string;
  sender: 'customer' | 'vendor' | 'system' | 'ai';
  vendorId?: string;
  /**
   * The caller already resolves the real vendor and derives this same
   * currency elsewhere on the same screen - looking vendorId up in
   * mockVendors here only ever matched the handful of demo vendors, so
   * every real vendor's shared catalog items priced in NGN regardless of
   * their actual currency.
   */
  currency: Currency;
}

export function CatalogItemBubble({ data, timestamp, sender, vendorId, currency }: CatalogItemBubbleProps) {
  const router = useRouter();
  const { user } = useAuth();

  const formatTime = (ts: string) => {
    const date = new Date(ts);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const handleViewPress = () => {
    if (!data.id) {
      console.log('Cannot view item: itemId is missing');
      return;
    }

    if (user?.role === 'customer') {
      router.push({
        pathname: `/item/${data.id}` as any,
        params: { vendorId: vendorId || '', fromChat: 'true' },
      });
    } else if (user?.role === 'vendor') {
      router.push({
        pathname: `/vendor/catalog/items/edit/${data.id}` as any,
      });
    }
  };

  const isOutgoing = user?.role === 'customer' && sender === 'customer' || user?.role === 'vendor' && sender === 'vendor';

  return (
    <View style={[styles.container, isOutgoing && styles.containerOutgoing]}>
      <View style={styles.catalogCard}>
        {data.image && (
          <Image source={{ uri: data.image }} style={styles.itemImage} />
        )}
        <View style={styles.itemInfo}>
          <Text style={styles.itemName} numberOfLines={2}>{data.name}</Text>
          {data.description && (
            <Text style={styles.itemDescription} numberOfLines={2}>{data.description}</Text>
          )}
          <View style={styles.itemFooter}>
            <Text style={styles.itemPrice}>{formatPriceWithCommas(data.price, currency)}</Text>
            {data.id && (
              <TouchableOpacity
                style={styles.viewButton}
                onPress={handleViewPress}
                activeOpacity={0.7}
              >
                <Text style={styles.viewButtonText}>View</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
      <Text style={[styles.timestamp, isOutgoing && styles.timestampOutgoing]}>
        {formatTime(timestamp)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: '85%',
    alignSelf: 'flex-start' as const,
  },
  containerOutgoing: {
    alignSelf: 'flex-end' as const,
  },
  catalogCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemImage: {
    width: '100%',
    height: 180,
    backgroundColor: Colors.surface,
  },
  itemInfo: {
    padding: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  itemDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  itemFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginTop: 4,
  },
  itemPrice: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.success,
  },
  viewButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  viewButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 8,
    textAlign: 'left' as const,
    paddingHorizontal: 4,
  },
  timestampOutgoing: {
    textAlign: 'right' as const,
  },
});
