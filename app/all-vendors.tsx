import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { useResponsive } from '@/constants/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Store } from 'lucide-react-native';
import VendorCard from '@/components/VendorCard';
import ListStateView from '@/components/ListStateView';
import { VendorListSkeleton } from '@/components/SkeletonLoader';
import { Colors } from '@/constants/colors';
import { useAllVendors } from '@/data/hooks';
import { useUserLocation } from '@/contexts/UserLocationContext';

export default function AllVendorsScreen() {
  const router = useRouter();
  const layout = useResponsive();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { countryCode, regionName } = useUserLocation();
  const { data: vendors, isLoading, isError, refetch } = useAllVendors(countryCode || undefined, regionName || undefined);

  const safeVendors = vendors ?? [];

  const toggleFavorite = useCallback((vendorId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) {
        next.delete(vendorId);
      } else {
        next.add(vendorId);
      }
      return next;
    });
  }, []);

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
          <Text style={styles.headerTitle}>All Vendors</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ListStateView
          isLoading={isLoading}
          isError={isError}
          isEmpty={safeVendors.length === 0}
          onRetry={refetch}
          loadingSkeleton={<VendorListSkeleton count={6} />}
          emptyIcon={<Store size={36} color={Colors.textMuted} strokeWidth={1.5} />}
          emptyTitle="No vendors yet"
          emptyDescription="Vendors will appear here once they join the platform in your region."
          style={styles.stateContainer}
        >
          <FlatList
            data={safeVendors}
            keyExtractor={(v) => v.id}
            renderItem={({ item: vendor }) => (
              <VendorCard
                vendor={vendor}
                isFavorite={favorites.has(vendor.id)}
                onToggleFavorite={toggleFavorite}
                variant="compact"
                style={styles.vendorCard}
              />
            )}
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: layout.horizontalPadding },
            ]}
            removeClippedSubviews={true}
            maxToRenderPerBatch={8}
            windowSize={5}
            initialNumToRender={6}
          />
        </ListStateView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  stateContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingVertical: 20,
    gap: 20,
  },
  vendorCard: {
    marginBottom: 0,
  },
  vendorGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
});
