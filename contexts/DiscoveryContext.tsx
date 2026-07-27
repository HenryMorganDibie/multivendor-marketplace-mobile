import createContextHook from '@nkzw/create-context-hook';
import { useMemo } from 'react';
import { useVendorFilter } from './VendorFilterContext';
import { useRecentlyViewed } from './RecentlyViewedContext';
import { useCountryStatus } from './CountryStatusContext';
import type { Vendor } from '@/mocks/vendorData';

export const [DiscoveryProvider, useDiscovery] = createContextHook(() => {
  const vendorFilter = useVendorFilter();
  const recentlyViewed = useRecentlyViewed();
  const countryStatus = useCountryStatus();

  const searchVendors = useMemo(() => {
    return (query: string): Vendor[] => {
      if (!query.trim()) return [];
      const lower = query.toLowerCase();
      return vendorFilter.verifiedVendors.filter(
        v =>
          v.name.toLowerCase().includes(lower) ||
          v.category.toLowerCase().includes(lower)
      );
    };
  }, [vendorFilter.verifiedVendors]);

  return useMemo(() => ({
    allVendors: vendorFilter.allVendors,
    verifiedVendors: vendorFilter.verifiedVendors,
    vendorsInCity: vendorFilter.vendorsInCity,
    vendorsInState: vendorFilter.vendorsInState,
    vendorsNearYou: vendorFilter.vendorsNearYou,
    popularInState: vendorFilter.popularInState,
    dynamicCategories: vendorFilter.dynamicCategories,
    newVendorsNearYou: vendorFilter.newVendorsNearYou,
    popularVendorsNearYou: vendorFilter.popularVendorsNearYou,
    trendingVendors: vendorFilter.trendingVendors,
    getVendorsByCategory: vendorFilter.getVendorsByCategory,
    getVerifiedVendorsByCategory: vendorFilter.getVerifiedVendorsByCategory,
    getOpenVendors: vendorFilter.getOpenVendors,
    getOpenVerifiedVendors: vendorFilter.getOpenVerifiedVendors,
    getVendorsByFulfillment: vendorFilter.getVendorsByFulfillment,

    recentVendors: recentlyViewed.recentVendors,
    recentlyViewedEntries: recentlyViewed.entries,
    trackVendorView: recentlyViewed.trackVendorView,
    clearRecentlyViewed: recentlyViewed.clearRecentlyViewed,

    discoveryVisible: countryStatus.discoveryVisible,
    isComingSoon: countryStatus.isComingSoon,
    isActive: countryStatus.isActive,
    isWaitlistOnly: countryStatus.isWaitlistOnly,

    isLoading: vendorFilter.isLoading,

    searchVendors,
  }), [vendorFilter, recentlyViewed, countryStatus, searchVendors]);
});
