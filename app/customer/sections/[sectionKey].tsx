import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import VendorCard from '@/components/VendorCard';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import { Colors } from '@/constants/colors';

export default function CustomerSectionPage() {
  const { sectionKey } = useLocalSearchParams<{ sectionKey: string }>();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { verifiedVendors, getOpenVerifiedVendors } = useVendorFilter();

  useEffect(() => {
    console.log('[SECTION PAGE] mounted:', sectionKey);
  }, [sectionKey]);

  const titleMap: Record<string, string> = {
    'vendors-near-you': 'Vendors near you',
    'browse-food': 'Food & Restaurants',
    'browse-electronics': 'Electronics',
    'top-rated': 'Top Rated',
    'open-now': 'Open Now',
  };

  const pageTitle = titleMap[sectionKey ?? ''] ?? 'Vendors';

  const vendors = (() => {
    switch (sectionKey) {
      case 'open-now':
        return getOpenVerifiedVendors();
      case 'top-rated':
        return [...verifiedVendors].filter(v => v.rating >= 4.5).sort((a, b) => b.rating - a.rating);
      case 'vendors-near-you':
        return verifiedVendors.filter(v => v.pickup || v.delivery);
      default:
        return verifiedVendors;
    }
  })();

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

  const handleBack = () => {
    console.log('[SECTION PAGE] back pressed');
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={28} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{pageTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {vendors.map(vendor => (
          <VendorCard
            key={vendor.id}
            vendor={vendor}
            variant="compact"
            isFavorite={favorites.has(vendor.id)}
            onToggleFavorite={toggleFavorite}
          />
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 16,
    backgroundColor: Colors.background,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  list: {
    paddingHorizontal: 16,
    gap: 16,
    paddingBottom: 40,
  },
});
