import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import SegmentedControl from '@/components/SegmentedControl';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft, Heart, Store, UtensilsCrossed } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { formatPrice } from '@/utils/formatPrice';

type FavTab = 'all' | 'vendors' | 'items';

interface FavVendor {
  id: string;
  name: string;
  category: string;
  rating: number;
  reviewCount: number;
  bannerImage: string;
  username: string;
}

interface FavItem {
  id: string;
  name: string;
  price: number;
  image: string;
  vendorName: string;
  vendorId: string;
}

const MOCK_FAV_VENDORS: FavVendor[] = [];
const MOCK_FAV_ITEMS: FavItem[] = [];

export default function FavoritesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const safeBack = useSafeBack();
  const [activeTab, setActiveTab] = useState<FavTab>('all');

  const favVendors = MOCK_FAV_VENDORS;
  const favItems = MOCK_FAV_ITEMS;

  const hasVendors = favVendors.length > 0;
  const hasItems = favItems.length > 0;
  const hasAny = hasVendors || hasItems;

  const showVendors = activeTab === 'all' || activeTab === 'vendors';
  const showItems = activeTab === 'all' || activeTab === 'items';

  const renderVendorCard = (vendor: FavVendor) => (
    <TouchableOpacity
      key={vendor.id}
      style={styles.vendorCard}
      onPress={() => router.push(`/store/${vendor.username}` as any)}
      activeOpacity={0.8}
    >
      <Image source={{ uri: vendor.bannerImage }} style={styles.vendorCardImage} />
      <View style={styles.vendorCardOverlay} />
      <View style={styles.vendorCardContent}>
        <Text style={styles.vendorCardName} numberOfLines={1}>{vendor.name}</Text>
        <Text style={styles.vendorCardMeta}>{vendor.category} · ⭐ {vendor.rating} ({vendor.reviewCount})</Text>
      </View>
      <TouchableOpacity style={styles.heartButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Heart size={18} color="#FF3B30" fill="#FF3B30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderItemCard = (item: FavItem) => (
    <TouchableOpacity
      key={item.id}
      style={styles.itemRow}
      activeOpacity={0.8}
    >
      <Image source={{ uri: item.image }} style={styles.itemRowImage} />
      <View style={styles.itemRowContent}>
        <Text style={styles.itemRowName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.itemRowVendor} numberOfLines={1}>{item.vendorName}</Text>
        <Text style={styles.itemRowPrice}>{formatPrice(item.price)}</Text>
      </View>
      <TouchableOpacity style={styles.heartButton} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Heart size={18} color="#FF3B30" fill="#FF3B30" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Favorites</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabRow}>
          <SegmentedControl
            tabs={[
              { key: 'all', label: 'All' },
              { key: 'vendors', label: 'Vendors' },
              { key: 'items', label: 'Items' },
            ]}
            activeTab={activeTab}
            onTabChange={(key) => setActiveTab(key as FavTab)}
          />
        </View>
      </SafeAreaView>

      {!hasAny || (activeTab === 'vendors' && !hasVendors) || (activeTab === 'items' && !hasItems) ? (
        <View style={[styles.emptyState, { paddingBottom: insets.bottom + 60 }]}>
          {activeTab === 'items' ? (
            <UtensilsCrossed size={40} color={Colors.textMuted} />
          ) : (
            <Store size={40} color={Colors.textMuted} />
          )}
          <Text style={styles.emptyTitle}>
            {activeTab === 'vendors'
              ? 'No saved vendors'
              : activeTab === 'items'
              ? 'No saved items'
              : 'Nothing saved yet'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeTab === 'items'
              ? 'Tap the heart on any menu item to save it here.'
              : 'Tap the heart on a vendor to save it here.'}
          </Text>
          <TouchableOpacity style={styles.browseButton} onPress={() => router.replace('/')}>
            <Text style={styles.browseButtonText}>Browse vendors</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 48 }]}
          showsVerticalScrollIndicator={false}
        >
          {showVendors && hasVendors && (
            <View style={styles.section}>
              {activeTab === 'all' && (
                <Text style={styles.sectionLabel}>VENDORS</Text>
              )}
              {favVendors.map(renderVendorCard)}
            </View>
          )}

          {showItems && hasItems && (
            <View style={styles.section}>
              {activeTab === 'all' && (
                <Text style={styles.sectionLabel}>ITEMS</Text>
              )}
              {favItems.map(renderItemCard)}
            </View>
          )}
        </ScrollView>
      )}
    </View>
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
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerButton: {
    padding: 8,
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    flex: 1,
  },
  headerSpacer: {
    width: 40,
  },
  tabRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    marginTop: 4,
  },
  vendorCard: {
    height: 130,
    borderRadius: 14,
    overflow: 'hidden' as const,
    marginBottom: 10,
    backgroundColor: Colors.surface,
  },
  vendorCardImage: {
    width: '100%' as const,
    height: '100%' as const,
    position: 'absolute' as const,
  },
  vendorCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  vendorCardContent: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    padding: 14,
  },
  vendorCardName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 2,
  },
  vendorCardMeta: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.80)',
  },
  heartButton: {
    position: 'absolute' as const,
    top: 12,
    right: 12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  itemRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  itemRowImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    backgroundColor: Colors.cardBorder,
  },
  itemRowContent: {
    flex: 1,
    marginLeft: 12,
  },
  itemRowName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  itemRowVendor: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 3,
  },
  itemRowPrice: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 20,
    marginBottom: 8,
  },
  browseButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 12,
    marginTop: 8,
  },
  browseButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
