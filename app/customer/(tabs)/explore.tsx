
import { Colors } from '@/constants/colors';
import React, {
  useMemo,
  useState,
  useRef,
  useEffect,
  useCallback,
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

import { Vendor } from '@/mocks/vendorData';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import VendorCard from '@/components/VendorCard';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { useCountryStatus } from '@/contexts/CountryStatusContext';
import { useResponsive } from '@/constants/layout';

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
  'Search vendors near you',
  'Find what you need',
  'Browse local vendors',
];

export default function CustomerExploreScreen() {
  const router = useRouter();
  const layout = useResponsive();

  const [favorites] = useState<Set<string>>(new Set());

  const { dynamicCategories, verifiedVendors } = useVendorFilter();
  const { regionName, city, hasCompletedInitialLocationSetup, isLoading: locationLoading } = useUserLocation();
  const { discoveryVisible, isComingSoon, countryName: statusCountryName } = useCountryStatus();
  const [showLocationModal, setShowLocationModal] = useState(!hasCompletedInitialLocationSetup && !locationLoading);

  useEffect(() => {
    if (!locationLoading && !hasCompletedInitialLocationSetup) {
      setShowLocationModal(true);
    }
  }, [locationLoading, hasCompletedInitialLocationSetup]);

  const placeholderOpacity = useRef(new Animated.Value(1)).current;
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  const locationLabel = city || regionName || 'Your Region';

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
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(placeholderOpacity, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        }),
      ]).start();
      setPlaceholderIndex(i => (i + 1) % rotatingPlaceholders.length);
    }, 3500);
    return () => clearInterval(interval);
  }, [placeholderOpacity, rotatingPlaceholders.length]);

  const hPad = layout.horizontalPadding;

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
          activeOpacity={0.7}
        >
          <Text style={styles.sectionTitle}>{title}</Text>
          <ChevronRight size={18} color={Colors.textMuted} strokeWidth={2.5} />
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
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={[styles.sectionScroll, { gap }]}
          >
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

  const categoryIconSize = layout.isTablet ? 78 : 64;
  const categoryItemWidth = layout.isTablet ? 96 : 80;

  const categoryIcons = useMemo(() => {
    return dynamicCategories.map(group => ({
      id: group.slug,
      name: group.category,
      image: getCategoryImage(group.category),
    }));
  }, [dynamicCategories]);

  const CategoryItem = useCallback(({ cat, iconSize, itemWidth, onPress }: {
    cat: { id: string; name: string; image: string };
    iconSize: number;
    itemWidth: number;
    onPress: () => void;
  }) => {
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
      Animated.spring(scaleAnim, { toValue: 0.90, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 4 }).start();
    };

    return (
      <TouchableOpacity
        activeOpacity={1}
        style={[styles.categoryIconItem, { width: itemWidth }]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        <Animated.View
          style={[
            styles.categoryIconCircle,
            { width: iconSize, height: iconSize, borderRadius: iconSize / 2, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <Image
            source={{ uri: cat.image }}
            style={{ width: iconSize, height: iconSize, borderRadius: iconSize / 2 }}
          />
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
        {/* Search Bar */}
        <TouchableOpacity
          style={[styles.searchBar, { marginHorizontal: hPad }]}
          onPress={() => {
            console.log('[EXPLORE] Search bar tapped - pushing to /customer/search');
            router.push('/customer/search' as any);
          }}
          activeOpacity={0.8}
        >
          <View style={styles.searchIconWrap}>
            <Search size={17} color={Colors.textSecondary} strokeWidth={2.5} />
          </View>
          <Animated.Text style={[styles.searchPlaceholder, { opacity: placeholderOpacity }]}>
            {rotatingPlaceholders[placeholderIndex % rotatingPlaceholders.length]}
          </Animated.Text>
        </TouchableOpacity>

        {!discoveryVisible && verifiedVendors.length === 0 ? (
          <View style={styles.discoveryGateContainer}>
            <View style={styles.discoveryGateIconWrap}>
              <Search size={28} color={Colors.primary} strokeWidth={1.5} />
            </View>
            <Text style={styles.discoveryGateTitle}>
              {isComingSoon
                ? 'Coming soon to your region'
                : 'Discovery not available yet'}
            </Text>
            <Text style={styles.discoveryGateBody}>
              {isComingSoon
                ? `the platform is not yet available in ${statusCountryName}. We're working to bring our platform to more countries.`
                : `Vendor discovery is not yet available in ${statusCountryName}. Vendors are being onboarded and will appear once we fully launch.`}
            </Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Categories */}
            {categoryIcons.length > 0 && (
              <View style={[styles.categoriesSection, { paddingHorizontal: hPad }]}>
                <View style={styles.categoriesHeader}>
                  <Text style={styles.categoriesSectionTitle}>Browse</Text>
                  <TouchableOpacity
                    style={styles.locationChip}
                    onPress={() => setShowLocationModal(true)}
                    activeOpacity={0.7}
                  >
                    <MapPin size={12} color={Colors.primary} strokeWidth={2.5} />
                    <Text style={styles.locationChipText}>{locationLabel}</Text>
                  </TouchableOpacity>
                </View>
                {layout.isTablet ? (
                  <View style={styles.categoryGrid}>
                    {categoryIcons.map(cat => (
                      <CategoryItem
                        key={cat.id}
                        cat={cat}
                        iconSize={categoryIconSize}
                        itemWidth={categoryItemWidth}
                        onPress={() => handleCategoryPress(cat.id)}
                      />
                    ))}
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={[styles.categoryIconsScroll]}
                  >
                    {categoryIcons.map(cat => (
                      <CategoryItem
                        key={cat.id}
                        cat={cat}
                        iconSize={categoryIconSize}
                        itemWidth={categoryItemWidth}
                        onPress={() => handleCategoryPress(cat.id)}
                      />
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

            {/* Category Sections */}
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
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  searchBar: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    marginTop: 14,
    marginBottom: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderRadius: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  searchIconWrap: {
    width: 26,
    height: 26,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  searchPlaceholder: {
    color: Colors.textMuted,
    fontSize: 15,
    fontWeight: '400' as const,
    flex: 1,
  },
  categoriesHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 14,
  },
  categoriesSectionTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800' as const,
    letterSpacing: -0.4,
  },
  locationChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    backgroundColor: Colors.primarySofter,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
  },
  locationChipText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: -0.1,
  },
  categoryIconsScroll: {
    gap: 10,
    paddingBottom: 4,
  },
  categoryGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  categoryIconItem: {
    alignItems: 'center' as const,
    paddingVertical: 6,
  },
  categoryIconCircle: {
    backgroundColor: Colors.surface,
    marginBottom: 7,
    overflow: 'hidden' as const,
  },
  categoryIconText: {
    color: Colors.text,
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center' as const,
    lineHeight: 15,
    letterSpacing: -0.1,
  },
  categoriesSection: {
    marginTop: 4,
    marginBottom: 8,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700' as const,
    letterSpacing: -0.3,
    flex: 1,
  },
  sectionScroll: {
    gap: 16,
  },
  gridContainer: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
  discoveryGateContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 36,
    paddingBottom: 80,
  },
  discoveryGateIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySofter,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
  },
  discoveryGateTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  discoveryGateBody: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
});
