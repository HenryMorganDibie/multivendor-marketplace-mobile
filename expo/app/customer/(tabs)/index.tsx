
import React, { useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, Text, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Bell, ShoppingCart, ChevronRight, MapPin, MapPin as LocationIcon, Users, RefreshCw, Clock, Sparkles, TrendingUp, Star, Flame, Award, Eye, Building2 } from 'lucide-react-native';
import { Vendor } from '@/mocks/vendorData';
import { useCart } from '@/contexts/CartContext';
import { useRecentlyViewed } from '@/contexts/RecentlyViewedContext';
import { Image as ExpoImage } from 'expo-image';
import { useAuth } from '@/contexts/AuthContext';
import { useCustomerNotifications } from '@/contexts/CustomerNotificationContext';
import { useVendorFilter, CategoryGroup } from '@/contexts/VendorFilterContext';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { useVendorRelationships } from '@/contexts/VendorRelationshipContext';
import VendorCard from '@/components/VendorCard';
import LocationSelectorModal from '@/components/LocationSelectorModal';
import { Colors } from '@/constants/colors';
import { useCountryStatus } from '@/contexts/CountryStatusContext';
import { useResponsive } from '@/constants/layout';
import { useContextualVendorClusters } from '@/hooks/useContextualVendorClusters';
import { vendorService } from '@/services/vendorService';

export default function CustomerHomeScreen() {
  const router = useRouter();
  const layout = useResponsive();
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const { vendorCartCount } = useCart();
  const { recentVendors } = useRecentlyViewed();
  const { getUnreadCount } = useCustomerNotifications();
  const vendorFilter = useVendorFilter();
  const {
    getOpenVerifiedVendors,
    allVendors,
    vendorsNearYou,
    dynamicCategories,
    newVendorsNearYou,
    trendingVendors,
    popularVendorsNearYou,
    refetchVendors,
  } = vendorFilter;
  const { regionName, countryName, city, area, hasCompletedInitialLocationSetup, isLoading: locationLoading } = useUserLocation();
  const [showLocationModal, setShowLocationModal] = useState(!hasCompletedInitialLocationSetup && !locationLoading);
  const { getRelatedVendors } = useVendorRelationships();
  const { discoveryVisible, isComingSoon, countryName: statusCountryName } = useCountryStatus();
  const contextualClusters = useContextualVendorClusters();

  const unreadNotificationCount = getUnreadCount();

  const getCustomerFirstName = () => {
    if (user?.firstName) {
      return user.firstName;
    }
    return 'Customer';
  };

  const yourVendors = useMemo(() => {
    return getRelatedVendors();
  }, [getRelatedVendors]);

  const nearYouList = useMemo(() => {
    return vendorsNearYou.slice(0, 6);
  }, [vendorsNearYou]);

  const trendingInRegion = useMemo(() => {
    return trendingVendors.slice(0, 6);
  }, [trendingVendors]);

  const openNowVerified = useMemo(() => {
    return getOpenVerifiedVendors().slice(0, 6);
  }, [getOpenVerifiedVendors]);

  const newVendorsList = useMemo(() => {
    return newVendorsNearYou.slice(0, 6);
  }, [newVendorsNearYou]);

  const popularNearYouList = useMemo(() => {
    return popularVendorsNearYou.slice(0, 6);
  }, [popularVendorsNearYou]);

  const vendorsInStateList = useMemo(() => {
    return vendorFilter.vendorsInState.slice(0, 6);
  }, [vendorFilter.vendorsInState]);

  React.useEffect(() => {
    if (!locationLoading && !hasCompletedInitialLocationSetup) {
      setShowLocationModal(true);
    }
  }, [locationLoading, hasCompletedInitialLocationSetup]);

  const handleLocationComplete = useCallback(() => {
    console.log('[HOME] Location setup complete');
    setShowLocationModal(false);
  }, []);

  const locationLabel = area || city || regionName || 'Your Region';
  const cityLabel = area || city || null;
  const stateLabel = regionName || null;

  const categorySectionIcon = useCallback((category: string): React.ReactNode => {
    const cat = category.toLowerCase();
    if (cat.includes('food') || cat.includes('catering')) return <Flame size={16} color={Colors.primary} strokeWidth={2.5} />;
    if (cat.includes('fashion')) return <Star size={16} color={Colors.primary} strokeWidth={2.5} />;
    if (cat.includes('beauty')) return <Sparkles size={16} color={Colors.primary} strokeWidth={2.5} />;
    if (cat.includes('art') || cat.includes('handmade')) return <Award size={16} color={Colors.primary} strokeWidth={2.5} />;
    return null;
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

  const handleSectionPress = useCallback((route: string, title: string) => {
    console.log(`[HOME] Section header tapped: ${title}, navigating to: ${route}`);
    try {
      router.push(route as any);
    } catch (error) {
      console.error('[HOME] Navigation error:', error);
    }
  }, [router]);

  const renderVendorSection = (title: string, vendors: Vendor[], route: string, icon?: React.ReactNode) => {
    if (vendors.length === 0) return null;
    const hPad = layout.horizontalPadding;
    const cols = layout.gridColumns;
    const gap = layout.cardGap;
    const cardW = layout.cardContainerWidth(cols, gap, hPad);

    return (
      <View style={[styles.section, layout.isTablet && { paddingHorizontal: hPad }]}>
        <TouchableOpacity
          style={[styles.sectionHeader, layout.isTablet && { paddingHorizontal: 0 }]}
          onPress={() => handleSectionPress(route, title)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionTitleRow}>
            {icon}
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
          <ChevronRight size={20} color={Colors.textSecondary} strokeWidth={2} />
        </TouchableOpacity>
        {layout.isTablet ? (
          <View style={[styles.vendorGrid, { gap }]}>
            {vendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                isFavorite={favorites.has(vendor.id)}
                onToggleFavorite={toggleFavorite}
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
            contentContainerStyle={styles.sectionScroll}
            keyboardShouldPersistTaps="handled"
          >
            {vendors.map(vendor => (
              <VendorCard
                key={vendor.id}
                vendor={vendor}
                isFavorite={favorites.has(vendor.id)}
                onToggleFavorite={toggleFavorite}
                variant="large"
              />
            ))}
          </ScrollView>
        )}
      </View>
    );
  };

  const renderCategorySection = (group: CategoryGroup) => {
    const vendors = group.vendors.slice(0, 6);
    if (vendors.length === 0) return null;

    const sectionTitle = `${group.category} in ${locationLabel}`;
    const route = `/customer/vendors/${group.slug}`;
    const icon = categorySectionIcon(group.category);

    return renderVendorSection(sectionTitle, vendors, route, icon);
  };

  const renderYourVendors = () => {
    if (yourVendors.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Vendors</Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.yourVendorsScroll}
          keyboardShouldPersistTaps="handled"
        >
          {yourVendors.map(vendor => (
            <TouchableOpacity
              key={vendor.id}
              style={styles.yourVendorCard}
              onPress={() => {
                console.log('[HOME] Your Vendor tapped:', vendor.name);
                router.push(`/store/${vendor.username.toLowerCase()}` as any);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.yourVendorImageWrapper}>
                <Image
                  source={{ uri: vendor.bannerImage || 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&q=80' }}
                  style={styles.yourVendorImage}
                />
                <View style={[
                  styles.statusDot,
                  { backgroundColor: vendor.isOpenNow ? Colors.success : Colors.textMuted }
                ]} />
              </View>
              <Text style={styles.yourVendorName} numberOfLines={1}>{vendor.name}</Text>
              <Text style={styles.yourVendorStatus}>
                {vendor.isOpenNow ? 'Open' : (() => {
                  if (vendor.businessHours) {
                    const match = vendor.businessHours.match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
                    if (match) {
                      const now = new Date();
                      const openTime = match[1];
                      const openHourMatch = openTime.match(/(\d{1,2})/);
                      const isPM = /PM/i.test(openTime);
                      const openHour = openHourMatch ? parseInt(openHourMatch[1]) + (isPM && parseInt(openHourMatch[1]) !== 12 ? 12 : 0) : 0;
                      return now.getHours() >= openHour ? `Opens tomorrow` : `Opens at ${openTime}`;
                    }
                  }
                  return 'Currently closed';
                })()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderRecentlyViewed = () => {
    if (recentVendors.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Clock size={16} color={Colors.primary} strokeWidth={2.5} />
            <Text style={styles.sectionTitle}>Recently Viewed</Text>
          </View>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.recentlyViewedScroll}
          keyboardShouldPersistTaps="handled"
        >
          {recentVendors.map((entry) => (
            <TouchableOpacity
              key={entry.id}
              style={styles.recentVendorCard}
              onPress={async () => {
                console.log('[HOME] Recently viewed vendor tapped:', entry.name);
                // entry.username is a snapshot captured whenever this vendor
                // was first viewed, saved to AsyncStorage and never refreshed
                // (RecentlyViewedContext.tsx). If the vendor didn't have a
                // finalized username yet at that moment (e.g. mid-setup),
                // this stays permanently stale, and the storefront route is
                // keyed strictly on username with no id fallback
                // (vendorRepository.getByUsername), so a stale/missing value
                // here silently fails on every future tap even after the
                // vendor's real username is set. Re-resolve the current
                // vendor by id first; only fall back to the stored snapshot
                // if that lookup fails (e.g. offline).
                try {
                  const current = await vendorService.getById(entry.vendorId);
                  const liveUsername = current?.username || entry.username;
                  if (liveUsername) {
                    router.push(`/store/${liveUsername.toLowerCase()}` as any);
                  } else {
                    console.log('[HOME] Recently viewed vendor has no resolvable username:', entry.vendorId);
                  }
                } catch (err) {
                  console.log('[HOME] Failed to resolve current vendor, falling back to stored username:', err);
                  if (entry.username) {
                    router.push(`/store/${entry.username.toLowerCase()}` as any);
                  }
                }
              }}
              activeOpacity={0.75}
            >
              <View style={styles.recentVendorImageWrapper}>
                {entry.image ? (
                  <ExpoImage
                    source={{ uri: entry.image }}
                    style={styles.recentVendorImage}
                    contentFit="cover"
                  />
                ) : (
                  <View style={styles.recentVendorImagePlaceholder}>
                    <Text style={styles.recentVendorInitial}>
                      {entry.name.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
              <Text style={styles.recentVendorName} numberOfLines={1}>{entry.name}</Text>
              {entry.category && (
                <Text style={styles.recentVendorCategory} numberOfLines={1}>{entry.category}</Text>
              )}
              <View style={styles.recentVendorMeta}>
                <Clock size={10} color={Colors.textMuted} strokeWidth={2} />
                <Text style={styles.recentVendorTime}>
                  {formatRelativeTime(entry.lastViewedAt)}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const hasAnyVendors = allVendors.length > 0;

  const formatRelativeTime = (iso: string): string => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  const hPad = layout.horizontalPadding;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { paddingHorizontal: hPad }]}>
          <View style={styles.headerIconsRow}>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                console.log('[HOME] Bell icon pressed, navigating to notifications');
                router.push('/customer/notifications' as any);
              }}
              activeOpacity={0.7}
            >
              <Bell size={22} color={Colors.text} strokeWidth={2} />
              {unreadNotificationCount > 0 && (
                <View style={styles.notificationDot} />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => {
                console.log('[HOME] Cart icon pressed, navigating to global-cart');
                router.push('/global-cart' as any);
              }}
              activeOpacity={0.7}
            >
              <ShoppingCart size={22} color={Colors.text} strokeWidth={2} />
              {vendorCartCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{vendorCartCount > 9 ? '9+' : vendorCartCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.greeting}>Greetings, {getCustomerFirstName()}.</Text>
          <View style={styles.locationRow}>
            <MapPin size={16} color={Colors.textMuted} strokeWidth={2} />
            <TouchableOpacity
              onPress={() => {
                if (hasCompletedInitialLocationSetup) {
                  router.push('/settings/location' as any);
                } else {
                  setShowLocationModal(true);
                }
              }}
              activeOpacity={0.7}
              style={styles.locationTouchable}
            >
              <Text style={styles.locationText}>
                {regionName && countryName
                  ? `${area ? `${area}, ` : ''}${regionName}, ${countryName}`
                  : countryName
                    ? countryName
                    : 'Select location'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <LocationSelectorModal
          visible={showLocationModal}
          onComplete={handleLocationComplete}
        />

        {!hasCompletedInitialLocationSetup && !hasAnyVendors ? (
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.locationRequiredContainer, { paddingBottom: 120 }]}
          >
            <View style={styles.locationRequiredContent}>
              <LocationIcon size={20} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.locationRequiredTitle}>Find vendors near you</Text>
              <Text style={styles.locationRequiredBody}>
                Select your location to see nearby vendors, prices, and currency.
              </Text>
              <TouchableOpacity
                style={styles.selectLocationButton}
                onPress={() => {
                  console.log('[HOME] Select Location pressed, opening location modal');
                  setShowLocationModal(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.selectLocationButtonText}>Select Location</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : !discoveryVisible && hasCompletedInitialLocationSetup ? (
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.locationRequiredContainer, { paddingBottom: 120 }]}
          >
            <View style={styles.locationRequiredContent}>
              <MapPin size={20} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.locationRequiredTitle}>
                {isComingSoon
                  ? 'Platform is coming soon to your region'
                  : 'Vendors are currently waitlisted in your region'}
              </Text>
              <Text style={styles.locationRequiredBody}>
                {isComingSoon
                  ? `Platform is not yet available in ${statusCountryName}. We're working hard to bring our platform to more countries.`
                  : `Vendor discovery is not yet available in ${statusCountryName}. Vendors are being onboarded and will be visible once we fully launch.`}
              </Text>
            </View>
          </ScrollView>
        ) : !hasAnyVendors ? (
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.locationRequiredContainer, { paddingBottom: 120 }]}
          >
            <View style={styles.locationRequiredContent}>
              <Users size={20} color={Colors.textMuted} strokeWidth={2} />
              <Text style={styles.locationRequiredTitle}>No vendors available in your area yet</Text>
              <Text style={styles.locationRequiredBody}>
                We&apos;re onboarding businesses and more vendors will appear soon. You can also invite vendors you know to join Platform.
              </Text>
              <TouchableOpacity
                style={styles.selectLocationButton}
                onPress={() => {
                  console.log('[HOME] Invite Vendors pressed, navigating to invite page');
                  router.push('/customer/invite' as any);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.selectLocationButtonText}>Invite Vendors</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.refreshButton}
                onPress={() => {
                  console.log('[HOME] Refresh pressed, requerying vendors');
                  refetchVendors();
                }}
                activeOpacity={0.7}
              >
                <RefreshCw size={14} color={Colors.textMuted} strokeWidth={2} />
                <Text style={styles.refreshButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        ) : (
          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {renderYourVendors()}

            {renderRecentlyViewed()}

            {renderVendorSection(
              `Trending in ${locationLabel}`,
              trendingInRegion,
              '/customer/vendors/trending' as any,
              <TrendingUp size={16} color={Colors.primary} strokeWidth={2.5} />,
            )}

            {renderVendorSection(
              `Popular in ${locationLabel}`,
              popularNearYouList,
              '/customer/vendors/popular' as any,
              <Award size={16} color={Colors.primary} strokeWidth={2.5} />,
            )}

            {cityLabel && renderVendorSection(
              `Near you in ${cityLabel}`,
              nearYouList,
              '/customer/vendors-near-you' as any,
              <MapPin size={16} color={Colors.primary} strokeWidth={2.5} />,
            )}

            {stateLabel && vendorsInStateList.length > 0 && renderVendorSection(
              `In ${stateLabel}`,
              vendorsInStateList,
              '/customer/all-vendors' as any,
              <Building2 size={16} color={Colors.primary} strokeWidth={2.5} />,
            )}

            {dynamicCategories.slice(0, 2).map(group => (
              <React.Fragment key={group.slug}>
                {renderCategorySection(group)}
              </React.Fragment>
            ))}

            {contextualClusters.map(cluster => (
              <React.Fragment key={cluster.id}>
                {renderVendorSection(
                  cluster.title,
                  cluster.vendors,
                  `/customer/vendors/${cluster.category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}` as any,
                  <Eye size={16} color={Colors.primary} strokeWidth={2.5} />,
                )}
              </React.Fragment>
            ))}

            {renderVendorSection(
              'Open Now',
              openNowVerified,
              '/customer/open-now' as any,
              <Star size={16} color={Colors.primary} strokeWidth={2.5} />,
            )}

            {newVendorsList.length > 0 && renderVendorSection(
              `New Vendors in ${locationLabel}`,
              newVendorsList,
              '/customer/vendors/new-vendors' as any,
              <Sparkles size={16} color={Colors.primary} strokeWidth={2.5} />,
            )}

            {dynamicCategories.slice(2).map(group => (
              <React.Fragment key={group.slug}>
                {renderCategorySection(group)}
              </React.Fragment>
            ))}

            <View style={styles.bottomPadding} />
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
  header: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  headerIconsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'flex-end' as const,
    gap: 12,
    marginBottom: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    position: 'relative' as const,
  },
  notificationDot: {
    position: 'absolute' as const,
    top: 6,
    right: 6,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.badge,
  },
  badge: {
    position: 'absolute' as const,
    top: -2,
    right: -2,
    backgroundColor: Colors.badge,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: Colors.text,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  locationTouchable: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  locationText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },

  scrollView: {
    flex: 1,
  },
  section: {
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    flex: 1,
  },
  vendorGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  sectionScroll: {
    paddingHorizontal: 20,
    gap: 16,
  },

  yourVendorsScroll: {
    paddingHorizontal: 20,
    gap: 16,
    paddingBottom: 4,
  },
  yourVendorCard: {
    alignItems: 'center' as const,
    width: 80,
  },
  yourVendorImageWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.surface,
    overflow: 'hidden' as const,
    position: 'relative' as const,
    marginBottom: 6,
  },
  yourVendorImage: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  statusDot: {
    position: 'absolute' as const,
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  yourVendorName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 2,
  },
  yourVendorStatus: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center' as const,
  },

  recentlyViewedScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  recentVendorCard: {
    width: 96,
    alignItems: 'center' as const,
  },
  recentVendorImageWrapper: {
    width: 72,
    height: 72,
    borderRadius: 18,
    overflow: 'hidden' as const,
    marginBottom: 6,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recentVendorImage: {
    width: 72,
    height: 72,
  },
  recentVendorImagePlaceholder: {
    width: 72,
    height: 72,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
  },
  recentVendorInitial: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.textMuted,
  },
  recentVendorName: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 2,
  },
  recentVendorCategory: {
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    marginBottom: 3,
  },
  recentVendorMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 3,
  },
  recentVendorTime: {
    fontSize: 10,
    color: Colors.textMuted,
  },

  bottomPadding: {
    height: 120,
  },
  locationRequiredContainer: {
    paddingTop: 20,
  },
  locationRequiredContent: {
    alignItems: 'center' as const,
  },
  locationRequiredTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginTop: 12,
    marginBottom: 8,
  },
  locationRequiredBody: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 20,
  },
  selectLocationButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center' as const,
    minHeight: 48,
    justifyContent: 'center' as const,
  },
  selectLocationButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  refreshButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    marginTop: 12,
  },
  refreshButtonText: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
});
