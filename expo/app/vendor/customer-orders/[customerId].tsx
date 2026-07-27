import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, ShoppingBag } from 'lucide-react-native';
import { mockOrders } from '@/mocks/ordersData';
import type { Order, OrderStatus } from '@/mocks/ordersData';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { getOrderStatusColor, getVendorOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { Colors } from '@/constants/colors';
import SegmentedControl from '@/components/SegmentedControl';

const CURRENCY: Currency = (mockVendor.currency as Currency) || 'NGN';

type TabType = 'active' | 'past';

const ACTIVE_STATUSES: OrderStatus[] = ['requested', 'accepted', 'confirmed', 'in_progress'];
const PAST_STATUSES: OrderStatus[] = ['completed', 'cancelled', 'rejected', 'expired'];

interface FilterPill {
  id: string;
  label: string;
  statuses: OrderStatus[] | null;
}

const ACTIVE_FILTERS: FilterPill[] = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'payment_pending', label: 'Payment Pending', statuses: ['confirmed'] },
  { id: 'in_progress', label: 'In Progress', statuses: ['in_progress'] },
  { id: 'requested', label: 'Requested', statuses: ['requested'] },
];

const PAST_FILTERS: FilterPill[] = [
  { id: 'all', label: 'All', statuses: null },
  { id: 'completed', label: 'Completed', statuses: ['completed'] },
  { id: 'cancelled', label: 'Cancelled', statuses: ['cancelled'] },
];

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function StatusPill({ status }: { status: OrderStatus }) {
  const colors = getOrderStatusColor(status);
  const label = getVendorOrderStatusLabel(status);

  return (
    <View style={[pillStyles.pill, { backgroundColor: colors.background }]}>
      <Text style={[pillStyles.text, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
  },
  text: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 0.1,
  },
});

function OrderCard({ order }: { order: Order }) {
  const itemCount = order.items.reduce((sum, it) => sum + it.quantity, 0);
  const fulfillment =
    order.fulfillmentMethod === 'pickup' || order.fulfillmentType === 'Pickup'
      ? 'Pickup'
      : 'Delivery';
  const firstItem = order.items[0];

  const handlePress = () => {
    router.push(`/vendor/orders/${order.id}` as any);
  };

  return (
    <TouchableOpacity
      style={styles.orderCard}
      onPress={handlePress}
      activeOpacity={0.72}
    >
      {/* Header row */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderLeft}>
          <Text style={styles.orderId}>{formatVendorOrderId(order.publicOrderId)}</Text>
          <Text style={styles.orderDate}>{formatRelativeDate(order.orderDate)}</Text>
        </View>
        <StatusPill status={order.status} />
      </View>

      {/* Items preview */}
      {firstItem && (
        <Text style={styles.itemsPreview} numberOfLines={1}>
          {firstItem.name}
          {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
        </Text>
      )}

      {/* Footer row */}
      <View style={styles.cardFooter}>
        <View style={styles.cardMeta}>
          <View style={styles.metaChip}>
            <Text style={styles.metaChipText}>{fulfillment}</Text>
          </View>
          <Text style={styles.metaDot}>·</Text>
          <Text style={styles.metaText}>
            {itemCount} {itemCount === 1 ? 'item' : 'items'}
          </Text>
        </View>
        <Text style={styles.totalAmount}>
          {formatPriceWithCommas(order.total, CURRENCY)}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function CustomerOrdersScreen() {
  const { customerId, customerName } = useLocalSearchParams<{
    customerId: string;
    customerName: string;
    vendorId?: string;
  }>();

  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [activeFilter, setActiveFilter] = useState('all');

  const displayName = customerName ?? 'Customer';
  const shortName = displayName.split(' ')[0] ?? displayName;

  const allCustomerOrders = useMemo(() => {
    return mockOrders
      .filter((o) => {
        const matchDirect = o.customerId === customerId;
        const matchLegacy = `customer-${o.id}` === customerId;
        return matchDirect || matchLegacy;
      })
      .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime());
  }, [customerId]);

  const activeOrders = useMemo(
    () => allCustomerOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
    [allCustomerOrders]
  );

  const pastOrders = useMemo(
    () => allCustomerOrders.filter((o) => PAST_STATUSES.includes(o.status)),
    [allCustomerOrders]
  );

  const currentFilters = activeTab === 'active' ? ACTIVE_FILTERS : PAST_FILTERS;
  const currentBaseOrders = activeTab === 'active' ? activeOrders : pastOrders;

  const filteredOrders = useMemo(() => {
    const filter = currentFilters.find((f) => f.id === activeFilter);
    if (!filter || filter.statuses === null) return currentBaseOrders;
    return currentBaseOrders.filter((o) => (filter.statuses ?? []).includes(o.status));
  }, [currentFilters, activeFilter, currentBaseOrders]);

  const handleTabSwitch = (tab: TabType) => {
    setActiveTab(tab);
    setActiveFilter('all');
  };

  const emptyTitle =
    allCustomerOrders.length === 0
      ? `No orders with ${shortName} yet`
      : activeTab === 'active'
        ? `No active orders with ${shortName}`
        : `No past orders with ${shortName}`;

  const emptyDescription =
    allCustomerOrders.length === 0
      ? 'Orders placed through chat will appear here.'
      : undefined;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />

      {/* Header */}
      <SafeAreaView edges={['top']} style={styles.safeAreaTop}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <ChevronLeft size={20} color={Colors.text} strokeWidth={2.2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            Orders with {displayName}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Segmented tab control */}
        <View style={styles.segmentedWrapper}>
          <SegmentedControl
            tabs={[
              { key: 'active', label: 'Active', count: activeOrders.length || undefined },
              { key: 'past', label: 'Past' },
            ]}
            activeTab={activeTab}
            onTabChange={(key) => handleTabSwitch(key as TabType)}
            fullWidth
          />
        </View>
      </SafeAreaView>

      {/* Secondary filter pills */}
      <View style={styles.filtersContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersScroll}
        >
          {currentFilters.map((filter) => {
            const isActive = activeFilter === filter.id;
            return (
              <TouchableOpacity
                key={filter.id}
                style={[styles.filterPill, isActive && styles.filterPillActive]}
                onPress={() => setActiveFilter(filter.id)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                  {filter.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Order list */}
      {filteredOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconWrap}>
            <ShoppingBag size={24} color={Colors.textMuted} strokeWidth={1.5} />
          </View>
          <Text style={styles.emptyTitle}>{emptyTitle}</Text>
          {emptyDescription && (
            <Text style={styles.emptyDescription}>{emptyDescription}</Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <OrderCard order={item} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeAreaTop: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },

  /* Header */
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  backButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginHorizontal: 8,
  },
  headerSpacer: {
    width: 34,
  },

  /* Segmented control */
  segmentedWrapper: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },

  /* Filter pills */
  filtersContainer: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  filtersScroll: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    gap: 6,
    flexDirection: 'row' as const,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  filterPillActive: {
    backgroundColor: Colors.primaryTint,
    borderColor: Colors.primary,
  },
  filterPillText: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },

  /* List */
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 8,
  },

  /* Order card */
  orderCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 5,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: 0.2,
    marginBottom: 1,
  },
  orderDate: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  itemsPreview: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  cardMeta: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    flex: 1,
  },
  metaChip: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  metaChipText: {
    fontSize: 11,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  metaDot: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  metaText: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.text,
  },

  /* Empty state */
  emptyContainer: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 5,
  },
  emptyDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 19,
  },
});
