import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import VendorCard from '@/components/VendorCard';

export default function OpenNowScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { getOpenVendors, isLoading } = useVendorFilter();

  const vendors = useMemo(() => {
    return getOpenVendors();
  }, [getOpenVendors]);

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
          <Text style={styles.headerTitle}>Open Now</Text>
          <View style={styles.headerSpacer} />
        </View>

        {isLoading ? (
          <View style={styles.stateContainer}>
            <ActivityIndicator size="large" color="#FFFFFF" />
          </View>
        ) : vendors.length === 0 ? (
          <View style={styles.stateContainer}>
            <Text style={styles.emptyTitle}>No vendors open right now</Text>
            <Text style={styles.emptySubtitle}>Check back later for vendors that are currently open</Text>
          </View>
        ) : (
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
        )}
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
  stateContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center' as const,
  },
});
