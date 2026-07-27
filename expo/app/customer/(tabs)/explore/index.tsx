
import { Colors } from '@/constants/colors';
import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Search, ChevronRight, MapPin } from 'lucide-react-native';
import { useCallback } from 'react';

import { Vendor } from '@/mocks/vendorData';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import VendorCard from '@/components/VendorCard';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { useCountryStatus } from '@/contexts/CountryStatusContext';
import { useResponsive } from '@/constants/layout';

const ALL_CATEGORIES = [
  'Food & Catering',
  'Fashion',
  'Beauty Tools',
  'Home & Living',
  'Electronics Repair',
  'Baby & Kids',
  'Bags & Accessories',
  'Phone Accessories',
  'Art & Handmade',
  'Books & Stationery',
  'Digital Products',
  'Safe Verified Services',
];

const CATEGORY_IMAGES: Record<string, string> = {
  'food & catering': 'https://r2-pub.rork.com/generated-images/ce204cc2-1aa9-4f48-8e27-f4e1c3eaeed9.png',
  'fashion': 'https://r2-pub.rork.com/generated-images/4154e919-2863-4561-b062-60285dc5621e.png',
  'beauty tools': 'https://r2-pub.rork.com/generated-images/247ffe85-37aa-40a4-a827-c2abaac11b6c.png',
  'home & living': 'https://r2-pub.rork.com/generated-images/0e18ab2b-e850-4f25-ad12-77beef78f143.png',
  'baby & kids': 'https://r2-pub.rork.com/generated-images/68bdede0-eccd-4bc3-9ae2-cba31008ffe8.png',
  'bags & accessories': 'https://r2-pub.rork.com/generated-images/fc561e60-ffad-46b5-84fe-95b932c9ed82.png',
  'phone accessories': 'https://r2-pub.rork.com/generated-images/41e8b7d1-2368-4065-9193-a90b3ef115cd.png',
  'art & handmade': 'https://r2-pub.rork.com/generated-images/beb8107e-fde5-4c44-94e0-99084a7bc699.png',
  'books & stationery': 'https://r2-pub.rork.com/generated-images/6ad9e381-aaac-4f6b-b207-3a80434884d2.png',
  'digital products': 'https://r2-pub.rork.com/generated-images/fc97c796-fb95-4780-a576-5426ad2c8fbf.png',
  'safe verified services': 'https://r2-pub.rork.com/generated-images/37a48d37-825a-4f9b-87d2-c59ff6dc737a.png',
  'electronics repair': 'https://r2-pub.rork.com/generated-images/37a48d37-825a-4f9b-87d2-c59ff6dc737a.png',
};

function getCategoryImage(category: string): string {
  const key = category.toLowerCase();
  return CATEGORY_IMAGES[key] || 'https://r2-pub.rork.com/generated-images/37a48d37-825a-4f9b-87d2-c59ff6dc737a.png';
}

const DEFAULT_PLACEHOLDERS = [
  'Search for food, vendors, or services',
  'Find what you need',
  'Browse local vendors',
];

export default function CustomerExploreScreen() {
  const router = useRouter();
  const layout = useResponsive();

  const [favorites] = useState<Set<string>>(new Set());

  const { dynamicCategories, verifiedVendors } = useVendorFilter();
  const { regionName, city, area, hasCompletedInitialLocationSetup, isLoading: locationLoading } = useUserLocation();
  const { discoveryVisible, countryName: statusCountryName } = useCountryStatus();
  const [showLocationModal, setShowLocationModal] = useState(!hasCompletedInitialLocationSetup && !locationLoading);

  useEffect(() => {
    if (!locationLoading && !hasCompletedInitialLocationSetup) {
      setShowLocationModal(true);
    }
  }, [locationLoading, hasCompletedInitialLocationSetup]);

  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const locationLabel = area || city || regionName || 'Your Region';

  const rotatingPlaceholders = useMemo(() => {
    if (dynamicCategories.length === 0) return DEFAULT_PLACEHOLDERS;
    const hints: string[] = [];
    dynamicCategories.forEach(group => {
      const cat = group.category.toLowerCase();
      if (cat.includes('food') || cat.includes('catering')) {
        hints.push('cakes near me', 'event catering');
      } else if (cat.includes('fashion')) {
        hints.push('custom dresses', 'tailor');
      } else if (cat.includes('beauty')) {
        hints.push('makeup artist', 'hair stylist');
      } else if (cat.includes('art') || cat.includes('handmade')) {
        hints.push('handmade crafts');
      } else if (cat.includes('electronics')) {
        hints.push('phone repair');
      } else {
        hints.push(group.category.toLowerCase());
      }
    });
    const unique = [...new Set(hints)];
    return unique.length > 0 ? unique : DEFAULT_PLACEHOLDERS;
  }, [dynamicCategories]);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.sequence([
        Animated.timing(placeholderOpacity, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(placeholderOpacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();

      setPlaceholderIndex(i => (i + 1) % rotatingPlaceholders.length);
    }, 3500);

    return () => clearInterval(interval);
  }, [placeholderOpacity, rotatingPlaceholders.length]);

  const hPad = layout.horizontalPadding;

  const handleSearchPress = useCallback(() => {
    console.log('[EXPLORE] Search bar tapped - navigating to explore/search');
    router.push('/customer/explore/search' as any);
  }, [router]);

  const handleCategoryPress = (slug: string) => {
    console.log('[EXPLORE] Category pressed:', slug);
    router.push(`/customer/vendors/${slug}` as any);
  };

  const renderGridSection = (
    title: string,
    vendors: Vendor[],
    sectionKey: string
  ) => {
    if (!vendors.length) return null;

    const cols = layout.gridColumns;
    const gap = layout.cardGap;
    const cardW = layout.cardContainerWidth(cols, gap, hPad);

    return (
      <View style={[styles.section, { paddingHorizontal: hPad }]}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => {
            console.log('[EXPLORE] Section pressed:', sectionKey);
            router.push(`/customer/vendors/${sectionKey}` as any);
          }}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          <ChevronRight size={20} color={Colors.textSecondary} />
        </TouchableOpacity>

        {layout.isTablet ? (
          <View style={[styles.gridContainer, { gap }]}>
            {vendors.map(v => (
              <VendorCard
                key={v.id}
                vendor={v}
                isFavorite={favorites.has(v.id)}
                onToggleFavorite={() => {}}
                variant="compact"
                fixedWidth={cardW}
                style={{ width: cardW }}
              />
            ))}
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.sectionScroll, { paddingLeft: 0, gap }]}>
            {vendors.map(v => (
              <VendorCard
                key={v.id}
                vendor={v}
                isFavorite={favorites.has(v.id)}
                onToggleFavorite={() => {}}
                variant="large"
              />
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const categoryIconSize = layout.isTablet ? 80 : 64;
  const categoryItemWidth = layout.isTablet ? 100 : 80;

  const categoryIcons = useMemo(() => {
    return ALL_CATEGORIES.map(name => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      name,
      image: getCategoryImage(name),
    }));
  }, []);

  const CategoryItem = useCallback(({ cat, iconSize, itemWidth, onPress }: { cat: { id: string; name: string; image: string }; iconSize: number; itemWidth: number; onPress: () => void }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, {
        toValue: 0.92,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        speed: 50,
        bounciness: 4,
      }).start();
    };

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.categoryIconItem, { width: itemWidth }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View style={[styles.categoryIconCircle, { width: iconSize, height: iconSize, borderRadius: iconSize / 2, transform: [{ scale: scaleAnim }] }]}>
          <Image source={{ uri: cat.image }} style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2 }} />
        </Animated.View>
        <Text style={styles.categoryIconText} numberOfLines={2}>{cat.name}</Text>
      </TouchableOpacity>
    );
  }, []);

  return (
    <View style={styles.container}>
      <LocationSelectorModal
        visible={showLocationModal}
        onComplete={() => setShowLocationModal(false)}
      />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <TouchableOpacity
          activeOpacity={0.7}
          style={[styles.searchBar, { marginHorizontal: hPad }]}
          onPress={handleSearchPress}
        >
          <Search size={20} color={Colors.textSecondary} />
          <Animated.Text style={[styles.searchPlaceholder, { opacity: placeholderOpacity }]}>
            {rotatingPlaceholders[placeholderIndex % rotatingPlaceholders.length]}
          </Animated.Text>
        </TouchableOpacity>

        {!discoveryVisible && verifiedVendors.length === 0 ? (
          <View style={styles.discoveryGateContainer}>
            <View style={styles.discoveryGateContent}>
              <Search size={32} color={Colors.textMuted} />
              <Text style={styles.discoveryGateTitle}>
                Vendors in your area are still growing
              </Text>
              <Text style={styles.discoveryGateBody}>
                You can order directly from vendors using their storefront links. As more verified vendors join in {statusCountryName}, they'll appear here automatically.
              </Text>
            </View>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {categoryIcons.length > 0 && (
              <View style={[styles.categoriesSection, { paddingHorizontal: hPad }]}>
                <View style={styles.categoriesHeader}>
                  <Text style={styles.categoriesSectionTitle}>Categories</Text>
                  <View style={styles.locationChip}>
                    <MapPin size={12} color={Colors.primary} strokeWidth={2.5} />
                    <Text style={styles.locationChipText}>{locationLabel}</Text>
                  </View>
                </View>
                {layout.isTablet ? (
                  <View style={styles.categoryGrid}>
                    {categoryIcons.map(cat => (
                      <CategoryItem key={cat.id} cat={cat} iconSize={categoryIconSize} itemWidth={categoryItemWidth} onPress={() => handleCategoryPress(cat.id)} />
                    ))}
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.categoryIconsScroll, { paddingLeft: 0 }]}>
                    {categoryIcons.map(cat => (
                      <CategoryItem key={cat.id} cat={cat} iconSize={categoryIconSize} itemWidth={categoryItemWidth} onPress={() => handleCategoryPress(cat.id)} />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {dynamicCategories.map(group => {
              const displayVendors = group.vendors.slice(0, 10);
              if (displayVendors.length === 0) return null;
              return (
                <React.Fragment key={group.slug}>
                  {renderGridSection(
                    `${group.category} in ${locationLabel}`,
                    displayVendors,
                    group.slug,
                  )}
                </React.Fragment>
              );
            })}

            <View style={{ height: 120 }} />
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    marginTop: 12,
    marginBottom: 8,
    padding: 12,
    borderRadius: 12,
    gap: 8,
  },
  searchPlaceholder: { color: Colors.textSecondary, fontSize: 16 },
  categoriesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  categoriesSectionTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '700',
  },
  locationChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  locationChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  categoryIconsScroll: { gap: 12 },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  categoryIconItem: { alignItems: 'center', paddingVertical: 8 },
  categoryIconCircle: {
    backgroundColor: Colors.surface,
    marginBottom: 8,
  },
  categoryIconText: { color: Colors.text, fontSize: 11, fontWeight: '500', textAlign: 'center', lineHeight: 14 },
  categoriesSection: { marginTop: 8 },
  section: { marginTop: 24 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: { color: Colors.text, fontSize: 20, fontWeight: '700' },
  sectionScroll: { gap: 16 },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  discoveryGateContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
    paddingBottom: 80,
  },
  discoveryGateContent: {
    alignItems: 'center' as const,
    gap: 12,
  },
  discoveryGateTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  discoveryGateBody: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
});
