import { useMemo } from 'react';
import { useRecentlyViewed } from '@/contexts/RecentlyViewedContext';
import { useVendorFilter } from '@/contexts/VendorFilterContext';
import type { Vendor } from '@/mocks/vendorData';

export interface ContextualCluster {
  id: string;
  title: string;
  vendors: Vendor[];
  category: string;
}

const MAX_CLUSTERS = 3;
const MIN_VENDORS_PER_CLUSTER = 1;
const MAX_VENDORS_PER_CLUSTER = 6;

function generateClusterTitle(category: string, viewedVendorName?: string): string {
  if (viewedVendorName) {
    return `Because you viewed ${viewedVendorName}`;
  }

  const cat = category.toLowerCase();
  if (cat.includes('food') || cat.includes('catering')) return 'More Food & Catering Vendors';
  if (cat.includes('fashion')) return 'More Fashion Vendors';
  if (cat.includes('beauty')) return 'More Beauty Vendors';
  if (cat.includes('electronics')) return 'More Electronics Vendors';
  if (cat.includes('art') || cat.includes('handmade')) return 'More Art & Handmade Vendors';
  if (cat.includes('service')) return 'More Service Vendors';
  if (cat.includes('retail')) return 'More Retail Vendors';

  return `Similar ${category} Vendors`;
}

export function useContextualVendorClusters(): ContextualCluster[] {
  const { recentCategoriesViewed, recentlyViewedVendorIds, recentVendors } = useRecentlyViewed();
  const { verifiedVendors } = useVendorFilter();

  const clusters = useMemo(() => {
    if (recentCategoriesViewed.length === 0 || verifiedVendors.length === 0) {
      console.log('[CONTEXTUAL_CLUSTERS] No browsing history or no vendors available');
      return [];
    }

    const result: ContextualCluster[] = [];
    const usedVendorIds = new Set<string>();

    for (const category of recentCategoriesViewed) {
      if (result.length >= MAX_CLUSTERS) break;

      const matchingVendors = verifiedVendors.filter(
        (v) =>
          v.category === category &&
          !recentlyViewedVendorIds.has(v.id) &&
          !usedVendorIds.has(v.id)
      );

      if (matchingVendors.length < MIN_VENDORS_PER_CLUSTER) {
        console.log('[CONTEXTUAL_CLUSTERS] Not enough vendors for category:', category, 'found:', matchingVendors.length);
        continue;
      }

      const sorted = [...matchingVendors].sort((a, b) => b.rating - a.rating);
      const clusterVendors = sorted.slice(0, MAX_VENDORS_PER_CLUSTER);

      const lastViewedInCategory = recentVendors.find(
        (rv) => rv.category === category
      );

      const title = generateClusterTitle(
        category,
        lastViewedInCategory?.name
      );

      clusterVendors.forEach((v) => usedVendorIds.add(v.id));

      result.push({
        id: `cluster_${category.toLowerCase().replace(/\s+/g, '_')}`,
        title,
        vendors: clusterVendors,
        category,
      });

      console.log('[CONTEXTUAL_CLUSTERS] Created cluster:', title, 'with', clusterVendors.length, 'vendors');
    }

    console.log('[CONTEXTUAL_CLUSTERS] Total clusters generated:', result.length);
    return result;
  }, [recentCategoriesViewed, verifiedVendors, recentlyViewedVendorIds, recentVendors]);

  return clusters;
}
