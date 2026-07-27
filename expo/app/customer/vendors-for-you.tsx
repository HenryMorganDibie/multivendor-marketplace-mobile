import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, PackageOpen, Truck, Heart } from 'lucide-react-native';
import { Vendor } from '@/mocks/vendorData';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import { Colors } from '@/constants/colors';

export default function VendorsForYouScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { verifiedVendors } = useVendorFilter();

  const vendorsForYou = verifiedVendors.slice(0, 5);

  const handleVendorPress = (vendor: Vendor) => {
    console.log('[VENDORS_FOR_YOU] Opening vendor:', vendor.username);
    router.push(`/store/${vendor.username.toLowerCase()}` as any);
  };

  const toggleFavorite = (vendorId: string) => {
    setFavorites(prev => {
      const newFavorites = new Set(prev);
      if (newFavorites.has(vendorId)) {
        newFavorites.delete(vendorId);
      } else {
        newFavorites.add(vendorId);
      }
      return newFavorites;
    });
  };

  const renderVendorCard = ({ item: vendor }: { item: Vendor }) => (
    <TouchableOpacity
      style={styles.vendorCard}
      activeOpacity={0.8}
      onPress={() => handleVendorPress(vendor)}
    >
      <Image
        source={{ uri: vendor.bannerImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=400&q=80' }}
        style={styles.vendorBanner}
        resizeMode="cover"
      />
      <TouchableOpacity
        style={styles.favoriteButton}
        activeOpacity={0.8}
        onPress={(e) => {
          e.stopPropagation();
          toggleFavorite(vendor.id);
        }}
      >
        <Heart
          size={20}
          color={favorites.has(vendor.id) ? Colors.badge : Colors.text}
          fill={favorites.has(vendor.id) ? Colors.badge : 'transparent'}
          strokeWidth={2}
        />
      </TouchableOpacity>
      <View style={styles.vendorCardContent}>
        <Text style={styles.vendorCardName} numberOfLines={1}>{vendor.name}</Text>
        <Text style={styles.vendorCardCategory} numberOfLines={1}>{vendor.category}</Text>
        <Text style={styles.vendorCardLocation} numberOfLines={1}>
          {vendor.area}
          {vendor.rating > 0 && vendor.reviewCount > 0 && (
            <Text style={styles.vendorCardRating}> • {vendor.rating.toFixed(1)} ★ ({vendor.reviewCount})</Text>
          )}
        </Text>
        <View style={styles.fulfillmentRow}>
          {vendor.fulfillmentTypes.includes('Pickup') && (
            <View style={styles.fulfillmentTag}>
              <PackageOpen size={12} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.fulfillmentTagText}>Pickup</Text>
            </View>
          )}
          {vendor.fulfillmentTypes.includes('Delivery') && (
            <View style={styles.fulfillmentTag}>
              <Truck size={12} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.fulfillmentTagText}>Delivery</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Vendors For You</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <FlatList
        data={vendorsForYou}
        renderItem={renderVendorCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 16,
  },
  vendorCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.charcoal,
    overflow: 'hidden' as const,
  },
  vendorBanner: {
    width: '100%',
    height: 160,
    backgroundColor: Colors.charcoal,
  },
  favoriteButton: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  vendorCardContent: {
    padding: 16,
  },
  vendorCardName: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  vendorCardCategory: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 4,
    fontWeight: '400' as const,
  },
  vendorCardLocation: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 8,
    fontWeight: '400' as const,
  },
  vendorCardRating: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '400' as const,
  },
  fulfillmentRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  fulfillmentTag: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: Colors.charcoal,
    borderRadius: 6,
  },
  fulfillmentTagText: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
});
