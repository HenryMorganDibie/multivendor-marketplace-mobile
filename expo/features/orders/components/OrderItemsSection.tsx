import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '@/constants/colors';
import type { Order } from '@/mocks/ordersData';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

export interface GenericOrderItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  addOns?: {
    id: string;
    name: string;
    price: number;
  }[];
}

interface OrderItemsSectionProps {
  order?: Order;
  items?: GenericOrderItem[];
  totalItemCount: number;
  navigateToItem?: boolean;
}

export default function OrderItemsSection({ order, items, totalItemCount, navigateToItem = true }: OrderItemsSectionProps) {
  const router = useRouter();
  const currency = (mockVendor.currency as Currency) || 'NGN';

  const displayItems: GenericOrderItem[] = items ?? order?.items ?? [];

  return (
    <View testID="order-items-section">
      <Text style={styles.sectionTitle}>Items ({totalItemCount})</Text>
      <View style={styles.itemsContainer}>
        {displayItems.map((item, index) => {
          const Wrapper = navigateToItem ? TouchableOpacity : View;
          const wrapperProps = navigateToItem
            ? {
                activeOpacity: 0.7,
                onPress: () => router.push({ pathname: '/item/[id]' as any, params: { id: item.id } }),
              }
            : {};
          return (
            <Wrapper
              key={index}
              style={styles.itemCard}
              testID={`order-item-${index}`}
              {...(wrapperProps as any)}
            >
              <View style={styles.itemHeader}>
                {item.image ? (
                  <Image source={{ uri: item.image }} style={styles.itemImage} resizeMode="cover" />
                ) : (
                  <View style={styles.itemImagePlaceholder} />
                )}
                <View style={styles.itemInfo}>
                  <View style={styles.itemNameRow}>
                    <Text style={styles.itemQuantity}>{item.quantity}×</Text>
                    <Text style={styles.itemName}>{item.name}</Text>
                  </View>
                  {item.addOns && item.addOns.length > 0 && (
                    <View style={styles.addOnsContainer}>
                      {item.addOns.map((addOn, addOnIndex) => (
                        <View key={addOnIndex} style={styles.addOnRow}>
                          <Text style={styles.addOnText}>+ {addOn.name}</Text>
                          <Text style={styles.addOnPrice}>
                            {formatPriceWithCommas(addOn.price, currency)}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
                <Text style={styles.itemPrice}>
                  {formatPriceWithCommas(item.price * item.quantity, currency)}
                </Text>
              </View>
            </Wrapper>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  itemsContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  itemCard: {
    backgroundColor: Colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 1,
  },
  itemHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
  },
  itemImage: { width: 60, height: 60, borderRadius: 8, backgroundColor: Colors.border },
  itemImagePlaceholder: { width: 60, height: 60, borderRadius: 8, backgroundColor: Colors.border },
  itemInfo: { flex: 1 },
  itemNameRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    marginBottom: 4,
  },
  itemQuantity: { fontSize: 16, fontWeight: '400' as const, color: Colors.textMuted },
  itemName: { fontSize: 16, fontWeight: '400' as const, color: Colors.text, flex: 1 },
  itemPrice: { fontSize: 16, fontWeight: '600' as const, color: Colors.text },
  addOnsContainer: { marginTop: 8 },
  addOnRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 6,
  },
  addOnText: { fontSize: 14, color: Colors.textMuted, flex: 1 },
  addOnPrice: { fontSize: 14, color: Colors.textMuted },
});
