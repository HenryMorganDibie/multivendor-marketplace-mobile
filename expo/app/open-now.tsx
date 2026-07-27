import React, { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Clock } from 'lucide-react-native';
import VendorCard from '@/components/VendorCard';
import ListStateView from '@/components/ListStateView';
import { VendorListSkeleton } from '@/components/SkeletonLoader';
import { Colors } from '@/constants/colors';
import { useOpenNowVendors } from '@/data/hooks';
import { useUserLocation } from '@/contexts/UserLocationContext';

export default function OpenNowScreen() {
  const router = useRouter();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { countryCode, regionName } = useUserLocation();
  const { data: vendors, isLoading, isError, refetch } = useOpenNowVendors(countryCode || undefined, regionName || undefined);

  const safeVendors = vendors ?? [];

  const toggleFavorite = (vendorId: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(vendorId)) next.delete(vendorId);
      else next.add(vendorId);
      return next;
    });
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Open Now</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ListStateView
          isLoading={isLoading}
          isError={isError}
          isEmpty={safeVendors.length === 0}
          onRetry={refetch}
          loadingSkeleton={<VendorListSkeleton count={5} />}
          emptyIcon={<Clock size={36} color={Colors.textMuted} strokeWidth={1.5} />}
          emptyTitle="No vendors open right now"
          emptyDescription="Check back later — vendors in your area will appear here when they're open."
          style={styles.stateContainer}
        >
          <FlatList
            data={safeVendors}
            keyExtractor={item => item.id}
            renderItem={({ item }) => (
              <VendorCard
                vendor={item}
                isFavorite={favorites.has(item.id)}
                onToggleFavorite={toggleFavorite}
                variant="compact"
              />
            )}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ItemSeparatorComponent={() => <View style={{ height: 20 }} />}
            ListFooterComponent={<View style={{ height: 32 }} />}
          />
        </ListStateView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  backButton: {
    width: 40, height: 40,
    alignItems: 'center' as const, justifyContent: 'center' as const,
    marginRight: 8,
  },
  headerTitle: { fontSize: 20, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  headerSpacer: { width: 40 },
  stateContainer: { flex: 1 },
  listContent: { padding: 20 },
});
