import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, MapPin } from 'lucide-react-native';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import VendorCard from '@/components/VendorCard';
import ListStateView from '@/components/ListStateView';
import { VendorListSkeleton } from '@/components/SkeletonLoader';
import { Colors } from '@/constants/colors';

export default function VendorsNearYouScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { vendorsNearYou, isLoading } = useVendorFilter();
  const { city } = useUserLocation();

  const vendors = vendorsNearYou;

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
          <Text style={styles.headerTitle}>Vendors Near You</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ListStateView
          isLoading={isLoading ?? false}
          isError={false}
          isEmpty={vendors.length === 0}
          loadingSkeleton={<VendorListSkeleton count={5} />}
          emptyIcon={<MapPin size={36} color={Colors.textMuted} strokeWidth={1.5} />}
          emptyTitle="No vendors nearby"
          emptyDescription={city ? `No vendors found in ${city} yet. More vendors are joining soon.` : 'Set your city to see nearby vendors.'}
          style={styles.stateContainer}
        >
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
            renderItem={({ item }) => (
              <VendorCard
                vendor={item}
                isFavorite={favorites.has(item.id)}
                onToggleFavorite={toggleFavorite}
                variant="compact"
              />
            )}
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
  stateContainer: {
    flex: 1,
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
});
