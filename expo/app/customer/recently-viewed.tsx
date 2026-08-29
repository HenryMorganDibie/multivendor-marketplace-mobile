import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useRecentlyViewed } from '@/contexts/RecentlyViewedContext';
import { vendorService } from '@/services/vendorService';
import { Vendor } from '@/mocks/vendorData';
import VendorCard from '@/components/VendorCard';

export default function RecentlyViewedScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { recentVendors } = useRecentlyViewed();
  const [vendors, setVendors] = useState<Vendor[]>([]);

  // recentVendors only carries an AsyncStorage snapshot of each vendor
  // (id, name, username, category, rating captured at view time - see
  // RecentlyViewedContext.tsx). Rendering that snapshot directly is the same
  // stale-data bug already fixed on the home screen's inline Recently Viewed
  // card: a vendor's username, suspension status, etc. can change after the
  // view was recorded, and the storefront route is keyed strictly on
  // username. Re-resolving each entry against the live vendor record keeps
  // this list (and every tap into it) current, and naturally drops vendors
  // that are no longer live (suspended/removed) instead of showing a dead
  // card for them.
  useEffect(() => {
    let cancelled = false;
    Promise.all(recentVendors.map((entry) => vendorService.getById(entry.vendorId)))
      .then((resolved) => {
        if (cancelled) return;
        setVendors(resolved.filter((v): v is Vendor => v !== undefined));
      })
      .catch((err) => console.error('[RECENTLY_VIEWED] Failed to resolve live vendors:', err));
    return () => {
      cancelled = true;
    };
  }, [recentVendors]);

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
            <ChevronLeft size={24} color="#FFFFFF" strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Recently Viewed</Text>
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
          ListFooterComponent={<View style={styles.bottomPadding} />}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No recently viewed vendors</Text>
              <Text style={styles.emptySubtext}>Vendors you visit will show up here</Text>
            </View>
          )}
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
    backgroundColor: '#0B0B0B',
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
    borderBottomColor: '#1F1F1F',
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
    color: '#FFFFFF',
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
  bottomPadding: {
    height: 32,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 64,
    paddingHorizontal: 24,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#8A8A8A',
    textAlign: 'center' as const,
  },
});
