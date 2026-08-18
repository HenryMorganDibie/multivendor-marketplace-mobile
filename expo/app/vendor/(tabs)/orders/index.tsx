import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  Animated,
  PanResponder,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Search, Plus, ClipboardList, AlertTriangle, StickyNote, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useOrders } from '@/contexts/OrdersContext';
import { type Order } from '@/mocks/ordersData';
import type { OrderStatus } from '@/constants/orderStatus';
import { useVendorNotifications } from '@/contexts/VendorNotificationContext';
import { useTodaysNote } from '@/contexts/TodaysNoteContext';
import TodaysNoteModal from '@/components/TodaysNoteModal';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { formatCustomerNameFromFull } from '@/utils/formatCustomerName';
import { getTotalItemCount } from '@/utils/orderHelpers';
import {
  getVendorOrderStatusLabel,
  getOrderStatusBadgeStyle,
} from '@/features/orders/selectors/orderStatusSelectors';
import { hasOldUnpaidExternalOrders, sortOrdersByPriority } from '@/utils/orderFilters';
import { formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import { useExternalOrders, type ExternalOrder } from '@/contexts/ExternalOrdersContext';
import { getBottomOverlayPadding } from '@/lib/constants/layout';

type StatusTab = 'all' | 'new' | 'accepted' | 'in_progress' | 'ready' | 'completed';

interface TabConfig {
  key: StatusTab;
  label: string;
  statuses: OrderStatus[];
}

const TABS: TabConfig[] = [
  { key: 'all',         label: 'All',         statuses: [] },
  { key: 'new',         label: 'New',         statuses: ['requested'] },
  { key: 'accepted',    label: 'Accepted',    statuses: ['accepted', 'confirmed'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress'] },
  { key: 'ready',       label: 'Ready',       statuses: [] },
  { key: 'completed',   label: 'Completed',   statuses: ['completed'] },
];

type OrderListItem =
  | { _type: 'internal'; order: Order }
  | { _type: 'external'; extOrder: ExternalOrder };

function formatRelativeDate(dateString?: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function buildFulfillmentLabel(
  fulfillmentType?: string,
  scheduledDate?: string,
  scheduledTime?: string
): string {
  const method = fulfillmentType
    ? fulfillmentType.charAt(0).toUpperCase() + fulfillmentType.slice(1)
    : 'Pickup';
  const datePart = formatRelativeDate(scheduledDate);
  const timePart = scheduledTime || '';
  if (datePart && timePart) return `${method} • ${datePart} ${timePart}`;
  if (datePart) return `${method} • ${datePart}`;
  return method;
}

function getPaymentBadge(status: ExternalOrder['paymentStatus']): { label: string; bg: string; color: string } {
  switch (status) {
    case 'payment_received': return { label: 'Paid', bg: '#F0FDF4', color: '#16A34A' };
    case 'partially_received': return { label: 'Partial', bg: '#FFFBEB', color: '#D97706' };
    default: return { label: 'Pending', bg: '#FEF2F2', color: '#DC2626' };
  }
}

interface SwipeableExtCardProps {
  extOrder: ExternalOrder;
  onDeleteRequest: (id: string) => void;
  currency: Currency;
  onPress: (id: string) => void;
}

function SwipeableExtCard({ extOrder, onDeleteRequest, currency, onPress }: SwipeableExtCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 8 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        if (g.dx < 0) {
          translateX.setValue(Math.max(g.dx, -80));
        } else if (isOpen.current && g.dx > 0) {
          translateX.setValue(Math.max(-80, -80 + g.dx));
        }
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -40) {
          Animated.spring(translateX, { toValue: -80, useNativeDriver: true }).start(() => {
            isOpen.current = true;
          });
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() => {
            isOpen.current = false;
          });
        }
      },
    })
  ).current;

  const handleDeleteTap = () => {
    Animated.timing(translateX, { toValue: -400, duration: 250, useNativeDriver: true }).start(() => {
      onDeleteRequest(extOrder.id);
    });
  };

  const totalItems = extOrder.items.reduce((s, i) => s + i.quantity, 0);
  const payBadge = getPaymentBadge(extOrder.paymentStatus);
  const fulfillment = buildFulfillmentLabel(extOrder.fulfillmentType, extOrder.fulfillmentDate, extOrder.fulfillmentTime);

  return (
    <View style={extStyles.wrapper}>
      <View style={extStyles.deleteAction}>
        <TouchableOpacity style={extStyles.deleteBtn} onPress={handleDeleteTap} activeOpacity={0.7}>
          <Trash2 size={19} color="#FFFFFF" />
          <Text style={extStyles.deleteBtnLabel}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View
        style={[extStyles.card, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={() => onPress(extOrder.id)}
        >
          <View style={extStyles.row}>
            <Text style={extStyles.customerName} numberOfLines={1}>
              {extOrder.customerName || 'Walk-in'}
            </Text>
            <Text style={extStyles.total}>
              {formatPriceWithCommas(extOrder.total, currency)}
            </Text>
          </View>

          <View style={extStyles.idRow}>
            <Text style={extStyles.orderId}>
              {extOrder.externalOrderId || extOrder.id}
            </Text>
            <View style={extStyles.externalBadge}>
              <Text style={extStyles.externalBadgeText}>External</Text>
            </View>
          </View>

          <View style={extStyles.row}>
            <Text style={extStyles.fulfillment} numberOfLines={1}>
              {fulfillment}
            </Text>
            <View style={[extStyles.payBadge, { backgroundColor: payBadge.bg }]}>
              <Text style={[extStyles.payBadgeText, { color: payBadge.color }]}>
                {payBadge.label}
              </Text>
            </View>
          </View>

          <Text style={extStyles.itemCount}>
            {totalItems} {totalItems === 1 ? 'item' : 'items'}
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const extStyles = StyleSheet.create({
  wrapper: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    borderRadius: 12,
    marginBottom: 8,
  },
  deleteAction: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    backgroundColor: '#DC2626',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderRadius: 12,
  },
  deleteBtn: {
    alignItems: 'center' as const,
    gap: 3,
  },
  deleteBtnLabel: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    zIndex: 1,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 3,
  },
  idRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 4,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    flex: 1,
    marginRight: 8,
  },
  total: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    flexShrink: 0,
  },
  orderId: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '400' as const,
    letterSpacing: 0.2,
  },
  externalBadge: {
    backgroundColor: 'rgba(255,140,66,0.12)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
  },
  externalBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#FF8C42',
    letterSpacing: 0.3,
  },
  fulfillment: {
    fontSize: 12,
    color: '#6B7280',
    flex: 1,
    marginRight: 8,
  },
  payBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  payBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  itemCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 1,
  },
});

export default function VendorOrdersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orders } = useOrders();
  const { externalOrders, deleteExternalOrder } = useExternalOrders();
  const { clearOrderBadges } = useVendorNotifications();

  const [activeTab, setActiveTab] = useState<StatusTab>('all');
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [noteModalVisible, setNoteModalVisible] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const { note: todaysNote } = useTodaysNote();

  useEffect(() => {
    clearOrderBadges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // orders (from OrdersContext) now includes backend-recorded external orders
  // too, mapped by mapOrderDoc with orderSource: 'external' and an -EXT- in
  // publicOrderId. This used to filter those out because "external" meant
  // only the on-device AsyncStorage records rendered below via
  // externalOrders/SwipeableExtCard. Excluding them here hid every real
  // external order from every status tab.
  const the platformOrders = orders;

  const tabCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      all: 0, new: 0, accepted: 0, in_progress: 0, ready: 0, completed: 0,
    };
    counts.all = the platformOrders.length + externalOrders.length;
    TABS.forEach((tab) => {
      if (tab.key === 'completed') {
        counts[tab.key] =
          the platformOrders.filter((o) => tab.statuses.includes(o.status)).length +
          externalOrders.length;
      } else if (tab.key !== 'all') {
        counts[tab.key] = the platformOrders.filter((o) =>
          tab.statuses.includes(o.status)
        ).length;
      }
    });
    return counts;
  }, [the platformOrders, externalOrders]);

  const combinedOrders = useMemo((): OrderListItem[] => {
    const tab = TABS.find((t) => t.key === activeTab);
    if (!tab) return [];

    let the platformFiltered: Order[];
    if (tab.key === 'all') {
      the platformFiltered = sortOrdersByPriority([...the platformOrders]);
    } else if (tab.statuses.length === 0) {
      the platformFiltered = [];
    } else {
      the platformFiltered = sortOrdersByPriority(
        the platformOrders.filter((o) => tab.statuses.includes(o.status))
      );
    }

    const items: OrderListItem[] = the platformFiltered.map((o) => ({ _type: 'internal', order: o }));

    if (activeTab === 'all' || activeTab === 'completed') {
      externalOrders.forEach((o) => items.push({ _type: 'external', extOrder: o }));
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return items.filter((item) => {
        if (item._type === 'internal') {
          const name = (item.order.customerName ?? '').toLowerCase();
          const id = item.order.publicOrderId.toLowerCase();
          return name.includes(q) || id.includes(q);
        } else {
          const name = item.extOrder.customerName.toLowerCase();
          const extId = (item.extOrder.externalOrderId ?? '').toLowerCase();
          return name.includes(q) || extId.includes(q);
        }
      });
    }

    return items;
  }, [activeTab, the platformOrders, externalOrders, searchQuery]);

  const hasUnpaidWarning = useMemo(
    () => hasOldUnpaidExternalOrders(orders, 6),
    [orders]
  );

  const handleOrderPress = useCallback((order: Order) => {
    console.log('[VendorOrders] Opening order:', order.id);
    router.push({
      pathname: '/vendor/orders/[orderId]' as any,
      params: { orderId: order.id, fromChat: 'false' },
    });
  }, [router]);

  const handleExternalOrderPress = useCallback((orderId: string) => {
    console.log('[VendorOrders] Opening external order:', orderId);
    router.push({
      pathname: '/vendor/orders/external/[orderId]' as any,
      params: { orderId },
    });
  }, [router]);

  const handleAddOrder = useCallback(() => {
    router.push('/vendor/orders/add-external' as any);
  }, [router]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteConfirmId) return;
    try {
      await deleteExternalOrder(deleteConfirmId);
      console.log('[VendorOrders] External order deleted:', deleteConfirmId);
    } catch (e) {
      console.error('[VendorOrders] Failed to delete external order:', e);
    } finally {
      setDeleteConfirmId(null);
    }
  }, [deleteConfirmId, deleteExternalOrder]);

  const vendorCurrency = (mockVendor.currency as Currency) || 'NGN';

  const renderItem = useCallback(({ item }: { item: OrderListItem }) => {
    if (item._type === 'external') {
      return (
        <SwipeableExtCard
          extOrder={item.extOrder}
          onDeleteRequest={setDeleteConfirmId}
          currency={vendorCurrency}
          onPress={handleExternalOrderPress}
        />
      );
    }

    const order = item.order;
    const totalItems = getTotalItemCount(order.items);
    const statusBadge = getOrderStatusBadgeStyle(order.status);
    const statusLabel = getVendorOrderStatusLabel(order.status);
    const customerName = formatCustomerNameFromFull(order.customerName ?? 'Customer');
    // order.total (from orderSnapshot.total) is stored in major units (naira),
    // not minor units — formatPriceCents was dividing every real order's total
    // by 100 on this screen, showing a ₦4,500 order as ₦45.00.
    const totalFormatted = formatPriceWithCommas(order.total, vendorCurrency);
    const orderId = formatVendorOrderId(order.publicOrderId);
    const fulfillment = buildFulfillmentLabel(
      order.fulfillmentType,
      order.scheduledDate,
      order.scheduledTime
    );

    return (
      <TouchableOpacity
        testID={`order-card-${order.id}`}
        style={styles.card}
        onPress={() => handleOrderPress(order)}
        activeOpacity={0.75}
      >
        <View style={styles.cardRow}>
          <Text style={styles.customerName} numberOfLines={1}>
            {customerName}
          </Text>
          <Text style={styles.totalAmount}>
            {totalFormatted}
          </Text>
        </View>

        <Text style={styles.orderId} numberOfLines={1}>
          {orderId}
        </Text>

        <View style={[styles.cardRow, styles.cardRowMid]}>
          <Text style={styles.fulfillmentText} numberOfLines={1}>
            {fulfillment}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusBadge.backgroundColor }]}>
            <Text style={[styles.statusBadgeText, { color: statusBadge.textColor }]}>
              {statusLabel}
            </Text>
          </View>
        </View>

        <Text style={styles.itemCount}>
          {totalItems} {totalItems === 1 ? 'item' : 'items'}
        </Text>
      </TouchableOpacity>
    );
  }, [handleOrderPress, handleExternalOrderPress, vendorCurrency]);

  const ListHeaderComponent = useMemo(() => (
    <View>
      {hasUnpaidWarning && (
        <View style={styles.warningBanner}>
          <AlertTriangle size={14} color="#B45309" />
          <Text style={styles.warningText}>
            Some external orders may need payment follow-up
          </Text>
        </View>
      )}
    </View>
  ), [hasUnpaidWarning]);

  const ListEmptyComponent = useMemo(() => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIconWrap}>
        <ClipboardList size={28} color={Colors.primary} strokeWidth={1.5} />
      </View>
      <Text style={styles.emptyTitle}>No orders here</Text>
      <Text style={styles.emptySubtitle}>
        {activeTab === 'new'
          ? 'New orders will appear here'
          : activeTab === 'all'
            ? 'No orders yet'
            : `No ${activeTab.replace('_', ' ')} orders`}
      </Text>
    </View>
  ), [activeTab]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Orders</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => {
                setShowSearch((v) => !v);
                if (showSearch) setSearchQuery('');
              }}
              activeOpacity={0.7}
            >
              <Search size={21} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => setNoteModalVisible(true)}
              activeOpacity={0.7}
              testID="orders-todays-note-btn"
            >
              <StickyNote
                size={21}
                strokeWidth={2}
                color={todaysNote?.trim().length ? Colors.primary : Colors.textMuted}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleAddOrder}
              activeOpacity={0.7}
            >
              <Plus size={21} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>

        {showSearch && (
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search by name or order ID"
              placeholderTextColor={Colors.textMuted}
              autoFocus
            />
          </View>
        )}

        <View style={styles.pillBar}>
          <FlatList
            horizontal
            data={TABS}
            keyExtractor={(t) => t.key}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pillBarContent}
            renderItem={({ item: tab }) => {
              const isActive = activeTab === tab.key;
              const count = tabCounts[tab.key];
              return (
                <TouchableOpacity
                  testID={`tab-${tab.key}`}
                  style={[styles.pill, isActive && styles.pillActive]}
                  onPress={() => setActiveTab(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.pillText, isActive && styles.pillTextActive]}>
                    {tab.label}{count > 0 ? ` (${count})` : ''}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </SafeAreaView>

      <FlatList
        data={combinedOrders}
        keyExtractor={(item) =>
          item._type === 'internal' ? item.order.id : item.extOrder.id
        }
        renderItem={renderItem}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        contentContainerStyle={[styles.listContent, { paddingBottom: getBottomOverlayPadding(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
      />

      <TodaysNoteModal
        visible={noteModalVisible}
        onClose={() => setNoteModalVisible(false)}
      />

      {/* DELETE CONFIRMATION MODAL */}
      <Modal
        visible={!!deleteConfirmId}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteConfirmId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Delete external order?</Text>
            <Text style={styles.modalMessage}>
              This order was created manually and will be permanently removed.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setDeleteConfirmId(null)}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalDeleteBtn}
                onPress={handleConfirmDelete}
                activeOpacity={0.7}
              >
                <Text style={styles.modalDeleteText}>Delete order</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 14,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: '#111111',
  },
  headerActions: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  iconBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.surface,
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: Colors.background,
  },
  searchInput: {
    height: 44,
    borderRadius: 13,
    paddingHorizontal: 14,
    fontSize: 15,
    backgroundColor: Colors.surface,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  pillBar: {
    backgroundColor: Colors.background,
    paddingTop: 2,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  pillBarContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  pillActive: {
    backgroundColor: Colors.text,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  pillTextActive: {
    color: Colors.background,
    fontWeight: '600' as const,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  warningBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  warningText: {
    fontSize: 13,
    color: '#92400E',
    fontWeight: '500' as const,
    flex: 1,
    lineHeight: 18,
  },
  noteDisplay: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  noteDisplayText: {
    fontSize: 13,
    color: '#78350F',
    lineHeight: 18,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 15,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Platform.select({
      ios: {
        shadowColor: '#0B0C0F',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
      },
      android: { elevation: 1 },
      default: {},
    }),
  },
  cardRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 3,
  },
  cardRowMid: {
    marginTop: 5,
    marginBottom: 3,
  },
  customerName: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
    letterSpacing: -0.2,
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
    flexShrink: 0,
  },
  orderId: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
    marginBottom: 1,
  },
  fulfillmentText: {
    fontSize: 12,
    color: Colors.textSecondary,
    flex: 1,
    marginRight: 8,
    fontWeight: '400' as const,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    flexShrink: 0,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '700' as const,
    letterSpacing: 0.3,
  },
  itemCount: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    fontWeight: '400' as const,
  },
  emptyState: {
    alignItems: 'center' as const,
    paddingVertical: 64,
    paddingHorizontal: 32,
    gap: 8,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primarySofter,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 4,
    letterSpacing: -0.2,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(11,12,15,0.52)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 28,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  modalMessage: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row' as const,
    gap: 10,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 13,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  modalDeleteBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 13,
    backgroundColor: Colors.error,
    alignItems: 'center' as const,
  },
  modalDeleteText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
});
