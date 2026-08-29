
import React, { useEffect, useMemo, useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';

import { Vendor } from '@/mocks/vendorData';
import { useVendorFilter, slugToCategory } from '@/contexts/VendorFilterContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { useRecentlyViewed } from '@/contexts/RecentlyViewedContext';
import { vendorService } from '@/services/vendorService';
import VendorCard from '@/components/VendorCard';

export default function VendorSectionScreen() {
  const router = useRouter();
  const { section } = useLocalSearchParams<{ section: string }>();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const {
    verifiedVendors,
    getOpenVerifiedVendors,
    getVerifiedVendorsByCategory,
    dynamicCategories,
    newVendorsNearYou,
    popularVendorsNearYou,
    trendingVendors,
  } = useVendorFilter();
  const { regionName, city } = useUserLocation();
  const { recentVendors } = useRecentlyViewed();
  const [resolvedRecentVendors, setResolvedRecentVendors] = useState<Vendor[]>([]);

  const locationLabel = city || regionName || 'Your Region';

  // The 'recent' section used to show an arbitrary slice of all verified
  // vendors mislabeled as "Recently Viewed" instead of the vendors the
  // customer actually viewed (tracked in RecentlyViewedContext). Each entry
  // there is only a snapshot captured at view time, so it's re-resolved
  // against the live vendor record here rather than rendered as-is — the
  // same stale-data fix applied to the home screen's inline Recently Viewed
  // card and to app/customer/recently-viewed.tsx.
  useEffect(() => {
    if (section !== 'recent') return;
    let cancelled = false;
    Promise.all(recentVendors.map((entry) => vendorService.getById(entry.vendorId)))
      .then((resolved) => {
        if (cancelled) return;
        setResolvedRecentVendors(resolved.filter((v): v is Vendor => v !== undefined));
      })
      .catch((err) => console.error('[VENDOR SECTION] Failed to resolve recently viewed vendors:', err));
    return () => {
      cancelled = true;
    };
  }, [section, recentVendors]);

  const { title, vendors } = useMemo(() => {
    console.log('[VENDOR SECTION] section:', section);

    switch (section) {
      case 'near-you':
        return {
          title: 'Vendors Near You',
          vendors: verifiedVendors.filter(v => v.pickup || v.delivery),
        };
      case 'recent':
        return {
          title: 'Recently Viewed',
          vendors: resolvedRecentVendors,
        };
      case 'open-now':
        return {
          title: 'Open Now',
          vendors: getOpenVerifiedVendors(),
        };
      case 'top-rated':
        return {
          title: 'Top Rated Vendors',
          vendors: verifiedVendors
            .filter(v => v.rating >= 4.7)
            .sort((a, b) => b.rating - a.rating),
        };
      case 'new-vendors':
        return {
          title: `New Vendors in ${locationLabel}`,
          vendors: newVendorsNearYou,
        };
      case 'popular':
        return {
          title: `Popular in ${locationLabel}`,
          vendors: popularVendorsNearYou,
        };
      case 'trending':
        return {
          title: `Trending in ${locationLabel}`,
          vendors: trendingVendors,
        };
      default: {
        const categoryName = slugToCategory(section ?? '', dynamicCategories);
        if (categoryName) {
          return {
            title: `${categoryName} in ${locationLabel}`,
            vendors: getVerifiedVendorsByCategory(categoryName),
          };
        }

        return {
          title: `All Vendors in ${locationLabel}`,
          vendors: verifiedVendors,
        };
      }
    }
  }, [section, verifiedVendors, getOpenVerifiedVendors, getVerifiedVendorsByCategory, dynamicCategories, newVendorsNearYou, popularVendorsNearYou, trendingVendors, locationLabel, resolvedRecentVendors]);

  const toggleFavorite = (vendorId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  };

  const renderVendorCard = ({ item }: { item: Vendor }) => (
    <View style={styles.cardWrapper}>
      <VendorCard
        vendor={item}
        isFavorite={favorites.has(item.id)}
        onToggleFavorite={toggleFavorite}
        variant="compact"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ChevronLeft size={22} color={Colors.text} />
          </TouchableOpacity>

          <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>

          <View style={{ width: 40 }} />
        </View>
      </SafeAreaView>

      {vendors.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>No vendors found</Text>
          <Text style={styles.emptyBody}>
            There are no vendors in this category for your region yet.
          </Text>
        </View>
      ) : (
        <FlatList
          data={vendors}
          renderItem={renderVendorCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerRow: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  cardWrapper: {
    marginBottom: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
