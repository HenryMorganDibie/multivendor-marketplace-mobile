import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Pressable,
  TouchableOpacity,
  Animated,
  Platform,
} from 'react-native';
import { useResponsive } from '@/constants/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowLeft, Clock, X, UserPlus, SearchX, Search } from 'lucide-react-native';
import VendorCard from '@/components/VendorCard';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import { isUsernameSearch, extractUsername } from '@/utils/usernameValidation';
import { safeShare } from '@/utils/share';
import { Vendor } from '@/mocks/vendorData';

const RECENT_SEARCHES = [
  "Mama T's Kitchen",
  'TechFix Pro',
  'Style Lounge',
  'Handmade bags',
  'Phone cases',
  'Beauty tools',
];

const RECOMMENDED_SEARCHES = [
  'Fashion',
  'Electronics',
  'Food',
  'Beauty',
  'Home decor',
  'Art',
  'Services',
  'Cakes',
  'Tailoring',
];

const FILLER_WORDS = [
  'near me', 'nearby', 'around me', 'close to me', 'close by',
  'in my area', 'around here', 'local', 'closest',
  'best', 'top', 'good', 'cheap', 'affordable',
  'the', 'a', 'an', 'for', 'and', 'or', 'in', 'at', 'to',
];

function cleanSearchQuery(raw: string): string {
  let cleaned = raw.toLowerCase().trim();
  for (const filler of FILLER_WORDS) {
    cleaned = cleaned.replace(new RegExp(`\\b${filler}\\b`, 'gi'), '');
  }
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

function vendorMatchesQuery(vendor: Vendor, query: string): boolean {
  const q = query.toLowerCase();
  const tokens = q.split(/\s+/).filter(t => t.length > 0);
  if (tokens.length === 0) return false;

  const searchableFields = [
    vendor.name,
    vendor.username,
    vendor.category,
    vendor.description,
    vendor.area,
    vendor.city,
    vendor.region,
    vendor.slug,
  ].filter(Boolean).map(f => (f as string).toLowerCase());

  const combined = searchableFields.join(' ');
  return tokens.every(token => combined.includes(token));
}

export default function CustomerSearchScreen() {
  const router = useRouter();
  const layout = useResponsive();
  const inputRef = useRef<TextInput>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [showAllRecent, setShowAllRecent] = useState(false);
  const { verifiedVendors, dynamicCategories } = useVendorFilter();

  const fadeAnim = useRef(new Animated.Value(0)).current;

  const dynamicCategoryList = useMemo(() => {
    return dynamicCategories.map(group => ({
      id: group.slug,
      name: group.category,
    }));
  }, [dynamicCategories]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, []);

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

  const handleCategoryPress = useCallback((slug: string) => {
    console.log('[SEARCH] category press:', slug);
    router.push(`/customer/vendors/${slug}` as any);
  }, [router]);

  const handleRecentSearchPress = useCallback((query: string) => {
    console.log('[SEARCH] recent/recommended search tapped:', query);
    setSearchQuery(query);
    inputRef.current?.focus();
  }, []);

  const isHandleSearch = isUsernameSearch(searchQuery);
  const username = isHandleSearch ? extractUsername(searchQuery) : null;

  const handleInviteVendor = useCallback(async () => {
    await safeShare({
      message: `Join the platform as a vendor @${username}! Download the app and start selling: https://the platform.app/vendor`,
    });
    console.log('[SEARCH] Invite vendor share sheet opened for username:', username);
  }, [username]);

  const handleBack = useCallback(() => {
    console.log('[SEARCH] back pressed');
    router.back();
  }, [router]);

  const handleClear = useCallback(() => {
    setSearchQuery('');
    inputRef.current?.focus();
  }, []);

  const filteredVendors = useMemo(() => {
    const raw = searchQuery.trim();
    if (raw.length === 0) return [];

    if (isHandleSearch && username) {
      return verifiedVendors.filter(v => v.username.toLowerCase() === username);
    }

    const cleaned = cleanSearchQuery(raw);
    console.log('[SEARCH] Raw query:', raw, '| Cleaned:', cleaned);

    if (cleaned.length === 0) {
      return verifiedVendors.filter(v => {
        const q = raw.toLowerCase();
        return (
          v.name.toLowerCase().includes(q) ||
          v.category.toLowerCase().includes(q)
        );
      });
    }

    return verifiedVendors.filter(v => vendorMatchesQuery(v, cleaned));
  }, [searchQuery, verifiedVendors, isHandleSearch, username]);

  const showResults = searchQuery.trim().length > 0;
  const isUsernameNotFound = isHandleSearch && filteredVendors.length === 0 && searchQuery.trim().length > 0;
  const isGeneralNotFound = !isHandleSearch && filteredVendors.length === 0 && searchQuery.trim().length > 0;
  const displayedRecentSearches = showAllRecent ? RECENT_SEARCHES : RECENT_SEARCHES.slice(0, 5);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.searchBarRow}>
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            hitSlop={12}
            testID="search-back-button"
          >
            <ArrowLeft size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>

          <View style={styles.inputWrapper}>
            <Search size={17} color={Colors.textMuted} strokeWidth={2} />
            <TextInput
              ref={inputRef}
              style={styles.searchInput}
              placeholder="Search vendors or items"
              placeholderTextColor={Colors.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              testID="search-input"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClear} hitSlop={10}>
                <View style={styles.clearBtn}>
                  <X size={12} color={Colors.white} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.divider} />

      <ScrollView
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {!showResults ? (
          <>
            {RECENT_SEARCHES.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Recent Searches</Text>
                  {RECENT_SEARCHES.length > 5 && (
                    <Pressable onPress={() => setShowAllRecent(!showAllRecent)}>
                      <Text style={styles.seeMoreText}>
                        {showAllRecent ? 'See Less' : 'See More'}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {displayedRecentSearches.map((query, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.listItem}
                    onPress={() => handleRecentSearchPress(query)}
                    testID={`recent-search-${idx}`}
                  >
                    <Clock size={17} color={Colors.textMuted} strokeWidth={1.8} />
                    <Text style={styles.listItemText}>{query}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Recommended</Text>
              <View style={styles.chipsContainer}>
                {RECOMMENDED_SEARCHES.map((query, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.chip}
                    onPress={() => handleRecentSearchPress(query)}
                  >
                    <Text style={styles.chipText}>{query}</Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {dynamicCategoryList.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Categories</Text>
                {dynamicCategoryList.map(category => (
                  <Pressable
                    key={category.id}
                    style={styles.listItem}
                    onPress={() => handleCategoryPress(category.id)}
                    testID={`category-${category.id}`}
                  >
                    <Search size={17} color={Colors.textMuted} strokeWidth={1.8} />
                    <Text style={styles.listItemText}>{category.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : isUsernameNotFound ? (
          <View style={styles.emptyState}>
            <SearchX size={44} color={Colors.textMuted} strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>No vendor found for @{username}</Text>
            <Text style={styles.emptyBody}>
              This username doesn&apos;t exist on the platform yet.
            </Text>
            <Pressable style={styles.inviteButton} onPress={handleInviteVendor}>
              <UserPlus size={18} color={Colors.primary} />
              <Text style={styles.inviteButtonText}>Invite Vendor</Text>
            </Pressable>
          </View>
        ) : isGeneralNotFound ? (
          <View style={styles.emptyState}>
            <SearchX size={44} color={Colors.textMuted} strokeWidth={1.4} />
            <Text style={styles.emptyTitle}>No results for "{searchQuery.trim()}"</Text>
            <Text style={styles.emptyBody}>
              Try a different search term, or browse a category below.
            </Text>
            {dynamicCategoryList.length > 0 && (
              <View style={styles.emptyChips}>
                {dynamicCategoryList.slice(0, 5).map(cat => (
                  <Pressable
                    key={cat.id}
                    style={styles.emptyChip}
                    onPress={() => handleCategoryPress(cat.id)}
                  >
                    <Text style={styles.emptyChipText}>{cat.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : (
          <View style={[styles.resultsSection, { paddingHorizontal: layout.horizontalPadding }]}>
            <Text style={styles.resultsLabel}>
              {isHandleSearch
                ? 'Direct match'
                : `${filteredVendors.length} result${filteredVendors.length !== 1 ? 's' : ''}`}
            </Text>

            {layout.isTablet ? (
              <View style={[styles.vendorGrid, { gap: layout.cardGap }]}>
                {filteredVendors.map(vendor => (
                  <View
                    key={vendor.id}
                    style={{ width: layout.cardContainerWidth(layout.gridColumns, layout.cardGap, 0) }}
                  >
                    <VendorCard
                      vendor={vendor}
                      isFavorite={favorites.has(vendor.id)}
                      onToggleFavorite={toggleFavorite}
                      variant="compact"
                    />
                  </View>
                ))}
              </View>
            ) : (
              filteredVendors.map(vendor => (
                <View key={vendor.id} style={styles.cardWrapper}>
                  <VendorCard
                    vendor={vendor}
                    isFavorite={favorites.has(vendor.id)}
                    onToggleFavorite={toggleFavorite}
                    variant="compact"
                  />
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 60 }} />
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  searchBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  backButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 11 : 8,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
  },
  clearBtn: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 8,
  },
  section: {
    paddingTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
    marginBottom: 4,
  },
  seeMoreText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  listItemText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  chip: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipText: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500',
  },
  resultsSection: {
    paddingTop: 16,
  },
  vendorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  resultsLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 16,
    fontWeight: '500',
  },
  cardWrapper: {
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingTop: 72,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginTop: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 20,
    gap: 8,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    marginTop: 8,
  },
  inviteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
    justifyContent: 'center',
  },
  emptyChip: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  emptyChipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
});
