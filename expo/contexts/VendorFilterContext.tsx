import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useMemo, useState } from 'react';
import { Vendor } from '@/mocks/vendorData';
import { useUserLocation } from './UserLocationContext';
import { vendorService } from '@/services/vendorService';
import { vendorMapper } from '@/services/mappers/vendorMapper';

export interface CategoryGroup {
  category: string;
  vendors: Vendor[];
  slug: string;
}

function categoryToSlug(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

export function slugToCategory(slug: string, categories: CategoryGroup[]): string | undefined {
  const found = categories.find(c => c.slug === slug);
  return found?.category;
}

const emptyArr: Vendor[] = [];
const noopVendors = (): Vendor[] => emptyArr;
const noopFulfillment = (_: 'pickup' | 'delivery' | 'shipping'): Vendor[] => emptyArr;
const defaultVendorFilter = {
  allVendors: emptyArr,
  verifiedVendors: emptyArr,
  vendorsInCity: emptyArr,
  vendorsInState: emptyArr,
  vendorsNearYou: emptyArr,
  popularInState: emptyArr,
  dynamicCategories: [] as CategoryGroup[],
  newVendorsNearYou: emptyArr,
  popularVendorsNearYou: emptyArr,
  trendingVendors: emptyArr,
  isLoading: true,
  getVendorsByCategory: noopVendors as (category: string) => Vendor[],
  getVerifiedVendorsByCategory: noopVendors as (category: string) => Vendor[],
  getOpenVendors: noopVendors as () => Vendor[],
  getOpenVerifiedVendors: noopVendors as () => Vendor[],
  getVendorsByFulfillment: noopFulfillment,
};

/**
 * Single-pass derivation of all vendor slices from a filtered vendor array.
 */
function deriveAllVendorSlices(
  verified: Vendor[],
  filtered: Vendor[],
  city: string,
) {
  const cityLower = city ? city.toLowerCase() : '';
  const inCity = !cityLower
    ? verified
    : verified.filter(v => v.city.toLowerCase() === cityLower);
  const inState = !cityLower
    ? verified
    : verified.filter(v => v.city.toLowerCase() !== cityLower);

  const nearYou = inCity
    .filter(v => v.pickup || v.delivery)
    .sort((a, b) => b.rating - a.rating);

  const popular = [...verified].sort((a, b) => {
    if (cityLower) {
      const aInCity = a.city.toLowerCase() === cityLower;
      const bInCity = b.city.toLowerCase() === cityLower;
      if (aInCity && !bInCity) return -1;
      if (!aInCity && bInCity) return 1;
    }
    return b.rating - a.rating;
  });

  const categoryMap = new Map<string, Vendor[]>();
  verified.forEach(v => {
    const existing = categoryMap.get(v.category) || [];
    existing.push(v);
    categoryMap.set(v.category, existing);
  });
  const categories: CategoryGroup[] = [];
  categoryMap.forEach((vendors, category) => {
    categories.push({
      category,
      vendors: vendors.sort((a, b) => b.rating - a.rating),
      slug: categoryToSlug(category),
    });
  });
  categories.sort((a, b) => b.vendors.length - a.vendors.length);

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const newVendors = verified
    .filter(v => v.createdAt && new Date(v.createdAt).getTime() >= thirtyDaysAgo)
    .sort((a, b) => {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime;
    });

  const popularNearYou = [...verified].sort((a, b) => {
    const aScore = a.rating * Math.log(a.reviewCount + 1);
    const bScore = b.rating * Math.log(b.reviewCount + 1);
    return bScore - aScore;
  });

  const calculateTrendingScore = (v: Vendor): number =>
    ((v.orderCount ?? 0) * 3) +
    ((v.recentOrders7Days ?? 0) * 5) +
    ((v.profileViews ?? 0) * 1) +
    ((v.favoritesCount ?? 0) * 2) +
    ((v.ordersLast48h ?? 0) * 6);

  const trending = verified
    .map(v => ({ vendor: v, score: calculateTrendingScore(v) }))
    .sort((a, b) => b.score - a.score)
    .map(s => s.vendor);

  const getByCategory = (cat: string): Vendor[] =>
    filtered.filter(v => v.category === cat);
  const getVerifiedByCategory = (cat: string): Vendor[] =>
    verified.filter(v => v.category === cat);
  const getOpen = (): Vendor[] =>
    filtered.filter(v => v.isOpenNow);
  const getOpenVerified = (): Vendor[] =>
    verified.filter(v => v.isOpenNow);
  const getByFulfillment = (type: 'pickup' | 'delivery' | 'shipping'): Vendor[] =>
    filtered.filter(v => {
      if (type === 'pickup') return v.pickup;
      if (type === 'delivery') return v.delivery;
      if (type === 'shipping') return v.shipping;
      return false;
    });

  return {
    inCity,
    inState,
    nearYou,
    popular,
    categories,
    newVendors,
    popularNearYou,
    trending,
    getByCategory,
    getVerifiedByCategory,
    getOpen,
    getOpenVerified,
    getByFulfillment,
  };
}

export const [VendorFilterProvider, useVendorFilterInner] = createContextHook(() => {
  const { countryCode, regionName, city, isLoading: locationLoading } = useUserLocation();

  // Reference migration (P0.4): the base vendor list now flows through the
  // service/repository/mapper stack — vendorService.getAll() → vendorRepository
  // → mock data — instead of importing mockVendors directly. TODO(Henry): this
  // is the path Firestore reads will replace.
  const [sourceVendors, setSourceVendors] = useState<Vendor[]>([]);
  const [vendorsLoading, setVendorsLoading] = useState<boolean>(true);

  useEffect(() => {
    let active = true;
    vendorService
      .getAll()
      .then(vendors => {
        if (active) setSourceVendors(vendors);
      })
      .catch(error => {
        console.error('[VendorFilterContext] Failed to load vendors:', error);
      })
      .finally(() => {
        if (active) setVendorsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filteredVendors = useMemo(() => {
    if (!countryCode || !regionName) return [];
    return sourceVendors.filter(
      vendor => vendor.countryCode === countryCode && vendor.region === regionName
    );
  }, [sourceVendors, countryCode, regionName]);

  // Public discovery slice — backend-aligned visibility via vendorMapper.
  const verifiedVendors = useMemo(
    () => filteredVendors.filter(vendorMapper.isDiscoverable),
    [filteredVendors],
  );

  const derived = useMemo(
    () => deriveAllVendorSlices(verifiedVendors, filteredVendors, city ?? ''),
    [verifiedVendors, filteredVendors, city],
  );

  return useMemo(() => ({
    allVendors: filteredVendors,
    verifiedVendors,
    vendorsInCity: derived.inCity,
    vendorsInState: derived.inState,
    vendorsNearYou: derived.nearYou,
    popularInState: derived.popular,
    dynamicCategories: derived.categories,
    newVendorsNearYou: derived.newVendors,
    popularVendorsNearYou: derived.popularNearYou,
    trendingVendors: derived.trending,
    isLoading: locationLoading || vendorsLoading,
    getVendorsByCategory: derived.getByCategory,
    getVerifiedVendorsByCategory: derived.getVerifiedByCategory,
    getOpenVendors: derived.getOpen,
    getOpenVerifiedVendors: derived.getOpenVerified,
    getVendorsByFulfillment: derived.getByFulfillment,
  }), [
    filteredVendors,
    verifiedVendors,
    derived,
    locationLoading,
    vendorsLoading,
  ]);
}, defaultVendorFilter);

export function useVendorFilter() {
  const value = useVendorFilterInner();
  return value ?? defaultVendorFilter;
}
