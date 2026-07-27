import React, { useMemo, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { mockVendors, Vendor } from '@/mocks/vendorData';
import VendorCard from '@/components/VendorCard';

export default function RecentlyViewedVendorsScreen() {
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const recentlyViewedVendors = useMemo(() => {
    return mockVendors.slice(0, 5);
  }, []);

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
      <Stack.Screen
        options={{
          title: 'Recently Viewed',
          headerStyle: {
            backgroundColor: '#0B0B0B',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '600' as const,
          },
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <FlatList
          data={recentlyViewedVendors}
          renderItem={renderVendorCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
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
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  cardWrapper: {
    marginBottom: 20,
  },
});
