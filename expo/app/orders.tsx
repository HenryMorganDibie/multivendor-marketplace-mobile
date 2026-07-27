import React, { useState, useMemo } from 'react';
import { Colors } from '@/constants/colors';
import SegmentedControl from '@/components/SegmentedControl';
import { getOrderStatusColor } from '@/features/orders/selectors/orderStatusSelectors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList } from 'react-native';
import { Alert } from '@/utils/alert';

import { useResponsive } from '@/constants/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Store, ShoppingBag } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { type Order, type OrderStatus } from '@/mocks/ordersData';
import { filterUpcomingOrders, filterPastOrders } from '@/utils/orderFilters';
import { getCustomerOrderStatusLabel, getOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import StatusBadge from '@/components/StatusBadge';
import { getTotalItemCount } from '@/utils/orderHelpers';
import { Image } from 'expo-image';
import { getVendorStorefrontPath, getVendorBannerImage, canAccessStorefront } from '@/utils/vendorLookup';
import { useOrders } from '@/contexts/OrdersContext';
import ListStateView from '@/components/ListStateView';
import { OrderListSkeleton } from '@/components/SkeletonLoader';
import { formatPriceWithCommas, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendors } from '@/mocks/vendorData';

type TabType = 'upcoming' | 'past';

function CustomerStatusPill({
  status,
  onPress,
}: {
  status: OrderStatus;
  onPress?: () => void;
}) {
  const colors = getOrderStatusColor(status);
  const label = getCustomerOrderStatusLabel(status);
  const tappable = status === 'accepted';

  if (tappable && onPress) {
    return (
      <TouchableOpacity
        style={[pillStyles.pill, { backgroundColor: colors.background }]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={[pillStyles.text, { color: colors.text }]}>{label}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[pillStyles.pill, { backgroundColor: colors.background }]}>
      <Text style={[pillStyles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
    marginTop: 4,
  },
  text: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.3,
  },
});

export default function OrdersScreen() {
  const router = useRouter();
  const safeBack = useSafeBack();
  const layout = useResponsive();
  const [activeTab, setActiveTab] = useState<TabType>('upcoming');
  const { orders } = useOrders();
  const params = useLocalSearchParams<{ vendorId?: string; vendorName?: string }>();
  const filterVendorId = params.vendorId ?? '';
  const filterVendorName = params.vendorName ?? '';

  // When opened from Vendor Chat Info, show only orders belonging to that vendor.
  const filteredOrders = useMemo(() => {
    if (!filterVendorId) return orders ?? [];
    return (orders ?? []).filter((o) => o.vendorId === filterVendorId);
  }, [orders, filterVendorId]);

  const upcomingOrders = useMemo(() => filterUpcomingOrders(filteredOrders), [filteredOrders]);
  const pastOrders = useMemo(() => filterPastOrders(filteredOrders), [filteredOrders]);
  const safeOrders = filteredOrders;

  const currentOrders = activeTab === 'upcoming' ? upcomingOrders : pastOrders;

  const handleOrderPress = (order: Order) => {
    console.log('Opening order:', order.id);
    router.push(`/order/${order.id}` as any);
  };

  const handleViewStore = (vendorId: string, e: any) => {
    e.stopPropagation();
    const access = canAccessStorefront(vendorId, true);
    if (!access.allowed) {
      Alert.alert('Store Unavailable', access.message ?? 'This store is not available.');
      return;
    }
    router.push(getVendorStorefrontPath(vendorId) as any);
  };

  const renderOrderCard = ({ item }: { item: Order }) => {
    const scheduledDateTime = item.scheduledDate
      ? new Date(item.scheduledDate).toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        }) +
        ' • ' +
        new Date(item.scheduledDate).toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })
      : 'Not scheduled';
    const itemCount = getTotalItemCount(item.items);
    const vendorBanner = getVendorBannerImage(item.vendorId);

    return (
      <TouchableOpacity
        style={styles.orderCard}
        onPress={() => handleOrderPress(item)}
        activeOpacity={0.7}
        testID={`order-card-${item.id}`}
      >
        <View style={styles.orderCardHeader}>
          <View style={styles.orderCardHeaderLeft}>
            <View style={styles.vendorInfoRow}>
              <View style={styles.vendorLogoContainer}>
                {vendorBanner ? (
                  <Image source={{ uri: vendorBanner }} style={styles.vendorLogo} contentFit="cover" />
                ) : (
                  <View style={styles.vendorLogoPlaceholder}>
                    <Store size={16} color={Colors.textSecondary} />
                  </View>
                )}
              </View>
              <Text style={styles.vendorName}>{item.vendorName}</Text>
            </View>
          </View>
          <View style={styles.orderCardHeaderRight}>
            <StatusBadge status={item.status} label={getOrderStatusLabel(item.status)} />
            <ChevronRight size={20} color={Colors.textSecondary} />
          </View>
        </View>

        <Text style={styles.orderIdText}>{item.publicOrderId.toUpperCase()}</Text>

        <Text style={styles.orderDate}>
          {item.fulfillmentMethod === 'pickup' ? 'Pickup' : 'Delivery'} • {scheduledDateTime}
        </Text>

        <View style={styles.orderCardBottom}>
          <View style={styles.orderCardBottomLeft}>
            <Text style={styles.itemsCount}>
              {itemCount} {itemCount === 1 ? 'item' : 'items'}
            </Text>
            {(item.status === 'requested' || item.status === 'accepted') && (
              <CustomerStatusPill
                status={item.status}
                onPress={
                  item.status === 'accepted'
                    ? () =>
                        router.push({
                          pathname: '/chat/order/[orderId]' as any,
                          params: { orderId: item.id },
                        })
                    : undefined
                }
              />
            )}
          </View>
          <Text style={styles.totalAmount}>
            {formatPriceWithCommas(item.total, (() => { const v = mockVendors.find(vv => vv.id === item.vendorId); return (v?.currency as Currency) || getCurrencyFromCountryCode(v?.countryCode || 'NG'); })())}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewStorePill}
          onPress={(e) => handleViewStore(item.vendorId, e)}
          activeOpacity={0.7}
          testID={`view-store-${item.id}`}
        >
          <Text style={styles.viewStorePillText}>View store</Text>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const hPad = layout.horizontalPadding;
  const numCols = layout.gridColumns;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { paddingHorizontal: hPad }]}>
          <TouchableOpacity onPress={() => safeBack()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {filterVendorId && filterVendorName ? `Orders with ${filterVendorName}` : 'Orders'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <View style={[styles.tabContainer, { paddingHorizontal: hPad }]}>
        <SegmentedControl
          tabs={[
            { key: 'upcoming', label: 'Active', count: upcomingOrders.length || undefined },
            { key: 'past', label: 'Past' },
          ]}
          activeTab={activeTab}
          onTabChange={(key) => setActiveTab(key as TabType)}
          fullWidth
        />
      </View>

      <ListStateView
        isLoading={false}
        isError={false}
        isEmpty={currentOrders.length === 0}
        loadingSkeleton={<OrderListSkeleton count={3} />}
        emptyIcon={<ShoppingBag size={36} color={Colors.textMuted} strokeWidth={1.5} />}
        emptyTitle={
          filterVendorId && filterVendorName
            ? `You don’t have any orders with ${filterVendorName} yet.`
            : activeTab === 'upcoming'
              ? safeOrders.length === 0
                ? "You don't have any orders yet"
                : 'No active orders right now'
              : 'No past orders'
        }
        emptyDescription={
          filterVendorId
            ? 'Orders placed with this vendor will appear here.'
            : activeTab === 'upcoming' && safeOrders.length === 0
              ? 'Browse vendors and place your first order.'
              : undefined
        }
        emptyAction={
          filterVendorId
            ? canAccessStorefront(filterVendorId, true).allowed
              ? {
                  label: 'View Storefront',
                  onPress: () => router.push(getVendorStorefrontPath(filterVendorId) as any),
                }
              : undefined
            : activeTab === 'upcoming' && safeOrders.length === 0
              ? { label: 'Browse vendors', onPress: () => router.replace('/') }
              : undefined
        }
        style={styles.stateContainer}
      >
        <FlatList
          data={currentOrders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
          numColumns={numCols}
          key={numCols}
          contentContainerStyle={[styles.ordersList, { paddingHorizontal: hPad }]}
          columnWrapperStyle={numCols > 1 ? { gap: layout.cardGap } : undefined}
          showsVerticalScrollIndicator={false}
        />
      </ListStateView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  safeArea: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerButton: { padding: 8 },
  headerTitle: {
    fontSize: 18, fontWeight: '600' as const, color: Colors.text,
    flex: 1, textAlign: 'center' as const, marginRight: 40,
  },
  headerSpacer: { width: 40 },
  tabContainer: {
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  ordersList: { paddingVertical: 20 },
  orderCard: {
    backgroundColor: Colors.white, borderRadius: 16, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: Colors.border,
  },
  orderCardHeader: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    justifyContent: 'space-between' as const, marginBottom: 8,
  },
  orderCardHeaderLeft: { flex: 1 },
  vendorInfoRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10 },
  vendorLogoContainer: {
    width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border,
  },
  vendorLogo: { width: '100%', height: '100%' },
  vendorLogoPlaceholder: {
    width: '100%', height: '100%', alignItems: 'center' as const,
    justifyContent: 'center' as const, backgroundColor: Colors.surface,
  },
  orderCardHeaderRight: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  orderCardBottom: {
    flexDirection: 'row' as const, alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const, marginTop: 4, marginBottom: 12,
  },
  orderCardBottomLeft: { flex: 1, gap: 4 },
  vendorName: { fontSize: 17, fontWeight: '700' as const, color: Colors.text, flex: 1 },
  orderIdText: { fontSize: 13, color: Colors.textSecondaryOnSurface, marginBottom: 6 },
  itemsCount: { fontSize: 14, color: Colors.textSecondaryOnSurface },
  orderDate: { fontSize: 14, color: Colors.textSecondaryOnSurface, marginBottom: 8 },
  totalAmount: { fontSize: 18, fontWeight: '700' as const, color: Colors.text },
  stateContainer: { flex: 1 },
  viewStorePill: {
    backgroundColor: Colors.surface, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 999, borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 4,
  },
  viewStorePillText: { fontSize: 13, fontWeight: '600' as const, color: Colors.text },
});
