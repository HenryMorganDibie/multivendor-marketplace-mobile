import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { Vendor } from '@/mocks/vendorData';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import VendorCard from '@/components/VendorCard';
import { Colors } from '@/constants/colors';

const CATEGORY_MAP: Record<string, { name: string; filter: (v: Vendor) => boolean }> = {
  food: {
    name: 'Food & Catering',
    filter: (v) => v.category === 'Food & Catering',
  },
  fashion: {
    name: 'Fashion',
    filter: (v) => v.category === 'Fashion',
  },
  beauty: {
    name: 'Beauty Tools',
    filter: (v) => v.category === 'Beauty Tools',
  },
  home: {
    name: 'Home & Living',
    filter: (v) => v.category === 'Home & Living',
  },
  electronics: {
    name: 'Electronics Repair',
    filter: (v) => v.category === 'Electronics Repair',
  },
  baby: {
    name: 'Baby & Kids',
    filter: (v) => v.category === 'Baby & Kids',
  },
  bags: {
    name: 'Bags & Accessories',
    filter: (v) => v.category === 'Bags & Accessories',
  },
  phone: {
    name: 'Phone Accessories',
    filter: (v) => v.category === 'Phone Accessories',
  },
  art: {
    name: 'Art & Handmade',
    filter: (v) => v.category === 'Art & Handmade',
  },
  books: {
    name: 'Books & Stationery',
    filter: (v) => v.category === 'Books & Stationery',
  },
  digital: {
    name: 'Digital Products',
    filter: (v) => v.category === 'Digital Products',
  },
  services: {
    name: 'Safe Verified Services',
    filter: (v) => v.category === 'Safe Verified Services',
  },
};

export default function CategoryScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const categoryId = typeof id === 'string' ? id : id?.[0] || 'food';
  const categoryInfo = CATEGORY_MAP[categoryId] || CATEGORY_MAP.food;
  const { verifiedVendors } = useVendorFilter();

  const vendors = useMemo(() => {
    console.log('[CATEGORY] Filtering verified vendors for:', categoryInfo.name);
    return verifiedVendors.filter(categoryInfo.filter);
  }, [verifiedVendors, categoryInfo]);

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

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{categoryInfo.name}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <FlatList
          data={vendors}
          keyExtractor={vendor => vendor.id}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.vendorList}
          initialNumToRender={6}
          maxToRenderPerBatch={8}
          windowSize={5}
          removeClippedSubviews
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No vendors found</Text>
              <Text style={styles.emptySubtext}>Check back later for vendors in this category</Text>
            </View>
          )}
          ListFooterComponent={<View style={styles.bottomPadding} />}
          renderItem={({ item }) => (
            <VendorCard
              vendor={item}
              isFavorite={favorites.has(item.id)}
              onToggleFavorite={toggleFavorite}
              variant="compact"
            />
          )}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  vendorList: {
    padding: 20,
    gap: 20,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },
  bottomPadding: {
    height: 32,
  },
});
