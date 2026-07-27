import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ScrollView,
  Modal,
  Pressable,
  TextInput,
  Animated,
  PanResponder,
} from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Plus, FileText, Package, StickyNote, Trash2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { type Order, type OrderStatus } from '@/mocks/ordersData';
import { useExternalOrders, type ExternalOrder } from '@/contexts/ExternalOrdersContext';
import { useOrders } from '@/contexts/OrdersContext';
import StatusBadge from '@/components/StatusBadge';
import { getVendorOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { formatPriceCents, formatPriceWithCommas, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import LaektivaModal from '@/components/LaektivaModal';

type FilterType = 'all' | 'new' | 'accepted' | 'confirmed' | 'in_progress' | 'past' | 'today';

const FILTER_LABELS: Record<FilterType, string> = {
  all: 'All',
  new: 'New',
  accepted: 'Accepted',
  confirmed: 'Confirmed',
  in_progress: 'In Progress',
  past: 'Past',
  today: 'Today',
};

interface SwipeableExternalCardProps {
  children: React.ReactNode;
  onDeleteRequest: () => void;
  openId: string | null;
  id: string;
  onOpen: (id: string) => void;
  onClose: () => void;
}

function SwipeableExternalCard({
  children,
  onDeleteRequest,
  openId,
  id,
  onOpen,
  onClose,
}: SwipeableExternalCardProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = openId === id;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        Math.abs(gs.dx) > 8 && Math.abs(gs.dx) > Math.abs(gs.dy),
      onPanResponderMove: (_, gs) => {
        if (gs.dx < 0) {
          translateX.setValue(Math.max(gs.dx, -88));
        } else if (isOpen && gs.dx > 0) {
          translateX.setValue(Math.max(-88, -88 + gs.dx));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx < -44) {
          Animated.spring(translateX, { toValue: -88, useNativeDriver: true }).start(() =>
            onOpen(id)
          );
        } else {
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start(() =>
            onClose()
          );
        }
      },
    })
  ).current;

  useEffect(() => {
    if (!isOpen) {
      Animated.spring(translateX, { toValue: 0, useNativeDriver: true }).start();
    }
  }, [isOpen, translateX]);

  return (
    <View style={swipeStyles.wrapper}>
      <View style={swipeStyles.deleteAction}>
        <TouchableOpacity
          onPress={onDeleteRequest}
          style={swipeStyles.deleteButton}
          activeOpacity={0.8}
        >
          <Trash2 size={20} color="#FFFFFF" strokeWidth={2} />
          <Text style={swipeStyles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const swipeStyles = StyleSheet.create({
  wrapper: {
    position: 'relative' as const,
    marginBottom: 10,
    overflow: 'hidden' as const,
    borderRadius: 14,
  },
  deleteAction: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 88,
    backgroundColor: Colors.destructive,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    borderRadius: 14,
  },
  deleteButton: {
    width: '100%',
    height: '100%',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  deleteText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
});

export default function VendorOrdersScreen() {
  const router = useRouter();
  const { getTodayOrders, todayNote, updateTodayNote, deleteExternalOrder } = useExternalOrders();
  const { orders } = useOrders();
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [showActionSheet, setShowActionSheet] = useState(false);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteInput, setNoteInput] = useState('');
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const the platformOrders = useMemo(
    () => orders.filter((o) => o.orderSource === 'the platform'),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    const externalOrders = getTodayOrders();

    let filtered = the platformOrders;

    if (activeFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = the platformOrders.filter((order) => {
        switch (activeFilter) {
          case 'new':
            return order.status === 'requested';
          case 'accepted':
            return order.status === 'accepted';
          case 'confirmed':
            return order.status === 'confirmed';
          case 'in_progress':
            return order.status === 'in_progress';
          case 'past':
            return (
              order.status === 'completed' ||
              order.status === 'cancelled' ||
              order.status === 'rejected'
            );
          case 'today': {
            const orderDate = new Date(order.orderDate);
            const orderDay = new Date(
              orderDate.getFullYear(),
              orderDate.getMonth(),
              orderDate.getDate()
            );
            const diffDays = Math.floor(
              (orderDay.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
            );
            return diffDays === 0;
          }
          default:
            return true;
        }
      });
    }

    if (activeFilter === 'today') {
      return [...externalOrders, ...filtered] as (ExternalOrder | Order)[];
    }

    return filtered;
  }, [activeFilter, getTodayOrders, the platformOrders]);

  const handleOrderPress = (order: Order) => {
    console.log('Opening vendor order:', order.id);
    router.push({
      pathname: '/vendor/orders/[orderId]' as any,
      params: { orderId: order.id },
    });
  };

  const handleExternalOrderPress = (orderId: string) => {
    console.log('Opening external order:', orderId);
    router.push({
      pathname: '/vendor/orders/external/[orderId]' as any,
      params: { orderId },
    });
  };

  const handleRecordExternalOrder = () => {
    setShowActionSheet(false);
    router.push('/vendor/orders/add-external' as any);
  };

  const handleAddNote = () => {
    setNoteInput(todayNote);
    setIsEditingNote(true);
  };

  const handleSaveNote = async () => {
    try {
      await updateTodayNote(noteInput);
      setIsEditingNote(false);
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Error', 'Failed to save note. Please try again.');
    }
  };

  const handleCancelNote = () => {
    setIsEditingNote(false);
    setNoteInput('');
  };

  const handleDeleteRequest = useCallback((orderId: string) => {
    setDeleteOrderId(orderId);
    setShowDeleteModal(true);
    setOpenSwipeId(null);
  }, []);

  const handleConfirmDelete = async () => {
    if (!deleteOrderId) return;
    try {
      await deleteExternalOrder(deleteOrderId);
      console.log('External order deleted:', deleteOrderId);
    } catch (error) {
      console.error('Delete failed:', error);
      Alert.alert('Error', 'Failed to delete the order. Please try again.');
    } finally {
      setShowDeleteModal(false);
      setDeleteOrderId(null);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteOrderId(null);
  };

  const renderOrderCard = ({ item }: { item: Order | ExternalOrder }) => {
    const isExternal = 'orderSource' in item && item.orderSource === 'external';
    const totalItemCount = item.items.reduce((sum, i) => sum + i.quantity, 0);

    let scheduledDate = 'Not scheduled';
    let scheduledTime = 'No time set';
    let isUnpaid = false;

    if (isExternal && 'fulfillmentDate' in item) {
      const extOrder = item as ExternalOrder;
      const date = new Date(extOrder.fulfillmentDate);
      const todayD = new Date();
      const tomorrow = new Date(todayD);
      tomorrow.setDate(tomorrow.getDate() + 1);

      if (date.toDateString() === todayD.toDateString()) {
        scheduledDate = 'Today';
      } else if (date.toDateString() === tomorrow.toDateString()) {
        scheduledDate = 'Tomorrow';
      } else {
        scheduledDate = date.toLocaleDateString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
        });
      }
      scheduledTime = extOrder.fulfillmentTime || 'No time set';
      isUnpaid =
        extOrder.paymentStatus === 'payment_pending' ||
        extOrder.paymentStatus === 'partially_received';
    } else {
      const laeOrder = item as Order;
      scheduledDate = laeOrder.scheduledDate
        ? new Date(laeOrder.scheduledDate).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })
        : 'Not scheduled';
      scheduledTime = laeOrder.scheduledTime || 'No time set';
    }

    const orderStatus = !isExternal ? (item as Order).status : null;

    const cardContent = (
      <TouchableOpacity
        style={[styles.orderCard, isExternal && styles.orderCardNoMargin]}
        onPress={() => {
          if (isExternal) {
            handleExternalOrderPress(item.id);
          } else {
            handleOrderPress(item as Order);
          }
        }}
        activeOpacity={0.7}
      >
        <View style={styles.orderCardContent}>
          <View style={styles.orderRow}>
            <Text style={styles.customerName}>{item.customerName || 'Customer'}</Text>
            <View style={styles.statusRow}>
              {isExternal && isUnpaid && (
                <View style={styles.unpaidExternalPill}>
                  <Text style={styles.unpaidExternalPillText}>PAYMENT PENDING</Text>
                </View>
              )}
              {isExternal && !isUnpaid && (
                <View style={styles.externalPill}>
                  <Text style={styles.externalPillText}>EXTERNAL</Text>
                </View>
              )}
              {!isExternal && orderStatus && (
                <StatusBadge
                  status={orderStatus}
                  label={getVendorOrderStatusLabel(orderStatus as OrderStatus)}
                />
              )}
            </View>
          </View>

          <Text style={styles.orderId}>
            {isExternal && 'externalReference' in item
              ? item.id
              : (item as Order).publicOrderId}
          </Text>

          <View style={styles.orderRow}>
            <Text style={styles.detailText}>{item.fulfillmentType}</Text>
            <Text style={styles.detailText}>•</Text>
            <Text style={styles.detailText}>{scheduledDate}</Text>
            <Text style={styles.detailText}>•</Text>
            <Text style={styles.detailText}>{scheduledTime}</Text>
          </View>

          <View style={styles.orderRow}>
            <Text style={styles.detailText}>
              {totalItemCount} {totalItemCount === 1 ? 'item' : 'items'}
            </Text>
            <Text style={styles.totalAmount}>
              {isExternal && 'externalReference' in item
                ? formatPriceWithCommas(item.total, (mockVendor.currency as Currency) || 'NGN')
                : formatPriceCents((item as Order).total, (mockVendor.currency as Currency) || 'NGN')}
            </Text>
          </View>
        </View>

        <View style={styles.orderActions}>
          <TouchableOpacity
            style={styles.viewDetailsButton}
            onPress={() => {
              if (isExternal) {
                handleExternalOrderPress(item.id);
              } else {
                handleOrderPress(item as Order);
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.viewDetailsButtonText}>View details</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );

    if (isExternal) {
      return (
        <SwipeableExternalCard
          id={item.id}
          openId={openSwipeId}
          onOpen={(id) => setOpenSwipeId(id)}
          onClose={() => setOpenSwipeId(null)}
          onDeleteRequest={() => handleDeleteRequest(item.id)}
        >
          <>{cardContent}</>
        </SwipeableExternalCard>
      );
    }

    return cardContent;
  };

  const filters: FilterType[] = ['all', 'new', 'accepted', 'confirmed', 'in_progress', 'past', 'today'];

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Orders</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <TouchableOpacity onPress={handleAddNote} activeOpacity={0.7}>
              <StickyNote
                size={22}
                strokeWidth={2}
                color={todayNote ? Colors.primary : Colors.textMuted}
              />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowActionSheet(true)} activeOpacity={0.7}>
              <Plus size={24} color={Colors.text} strokeWidth={2} />
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.filtersSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRowContent}
        >
          {filters.map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter && styles.filterChipTextActive,
                ]}
              >
                {FILTER_LABELS[filter]}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {activeFilter === 'today' && (
          <View style={styles.addNoteRow}>
            {!isEditingNote && !todayNote && (
              <TouchableOpacity style={styles.addNoteButton} onPress={handleAddNote}>
                <Text style={styles.addNoteText}>+ Add today&apos;s note</Text>
              </TouchableOpacity>
            )}

            {isEditingNote && (
              <View style={styles.noteEditContainer}>
                <TextInput
                  style={styles.noteInput}
                  value={noteInput}
                  onChangeText={setNoteInput}
                  placeholder="Add a note for today..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  autoFocus
                />
                <View style={styles.noteActions}>
                  <TouchableOpacity onPress={handleCancelNote} style={styles.noteActionButton}>
                    <Text style={styles.noteCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleSaveNote} style={styles.noteActionButton}>
                    <Text style={styles.noteSaveText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>

      {filteredOrders.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No orders match your filters</Text>
        </View>
      ) : (
        <FlatList
          data={filteredOrders}
          renderItem={renderOrderCard}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.ordersList}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setOpenSwipeId(null)}
        />
      )}

      <Modal
        visible={showActionSheet}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionSheet(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowActionSheet(false)}>
          <Pressable style={styles.actionSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.actionSheetHandle} />
            <Text style={styles.actionSheetTitle}>New Order</Text>

            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={() => {
                setShowActionSheet(false);
                console.log('Create the platform order - Coming soon');
              }}
              activeOpacity={0.7}
            >
              <View style={styles.actionSheetIconContainer}>
                <Package size={22} color={Colors.text} strokeWidth={2} />
              </View>
              <View style={styles.actionSheetTextContainer}>
                <Text style={styles.actionSheetOptionText}>Create the platform order</Text>
                <Text style={styles.actionSheetOptionDescription}>
                  Start a new order through the platform
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetOption}
              onPress={handleRecordExternalOrder}
              activeOpacity={0.7}
            >
              <View style={styles.actionSheetIconContainer}>
                <FileText size={22} color={Colors.text} strokeWidth={2} />
              </View>
              <View style={styles.actionSheetTextContainer}>
                <Text style={styles.actionSheetOptionText}>Add external order</Text>
                <Text style={styles.actionSheetOptionDescription}>
                  Log an order from outside the platform
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionSheetCancel}
              onPress={() => setShowActionSheet(false)}
              activeOpacity={0.7}
            >
              <Text style={styles.actionSheetCancelText}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      <LaektivaModal
        visible={showDeleteModal}
        title="Delete external order?"
        message="This order was created manually and will be permanently removed."
        primaryButton={{
          label: 'Delete order',
          onPress: handleConfirmDelete,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: handleCancelDelete,
          variant: 'outlined',
        }}
        destructive
        onRequestClose={handleCancelDelete}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.surface },
  safeArea: { backgroundColor: Colors.background },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backButton: { padding: 4 },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    marginLeft: 12,
  },
  addButton: { padding: 4 },
  filtersSection: {
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
    paddingTop: 12,
    paddingBottom: 8,
  },
  filterRowContent: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterChipText: { fontSize: 14, fontWeight: '500' as const, color: '#6B7280' },
  filterChipTextActive: { color: '#FFFFFF', fontWeight: '600' as const },
  addNoteRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 8 },
  addNoteButton: { alignSelf: 'flex-start' as const },
  addNoteText: { fontSize: 13, color: Colors.textSecondary, fontWeight: '400' as const },
  noteEditContainer: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  noteInput: {
    fontSize: 14,
    color: Colors.text,
    minHeight: 60,
    textAlignVertical: 'top' as const,
  },
  noteActions: {
    flexDirection: 'row' as const,
    justifyContent: 'flex-end' as const,
    gap: 12,
    marginTop: 8,
  },
  noteActionButton: { paddingVertical: 6, paddingHorizontal: 12 },
  noteCancelText: { fontSize: 14, color: Colors.textSecondary, fontWeight: '500' as const },
  noteSaveText: { fontSize: 14, color: Colors.primary, fontWeight: '600' as const },
  statusRow: { flexDirection: 'row' as const, alignItems: 'center' as const },
  externalPill: {
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  externalPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.3,
  },
  unpaidExternalPill: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  unpaidExternalPillText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: '#DC2626',
    letterSpacing: 0.3,
  },
  ordersList: { paddingHorizontal: 16, paddingVertical: 16 },
  orderCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  orderCardNoMargin: {
    marginBottom: 0,
  },
  orderCardContent: { marginBottom: 12 },
  orderRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 6,
  },
  customerName: { fontSize: 16, fontWeight: '700' as const, color: '#1A1A1A' },
  orderId: { fontSize: 13, color: Colors.textSecondary, marginBottom: 6 },
  detailText: { fontSize: 13, color: Colors.textSecondary, marginRight: 6 },
  totalAmount: { fontSize: 16, fontWeight: '700' as const, color: Colors.text },
  orderActions: { marginTop: 4 },
  viewDetailsButton: {
    backgroundColor: Colors.surface,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  viewDetailsButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
  },
  emptyStateText: { fontSize: 16, color: Colors.textMuted, textAlign: 'center' as const },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end' as const,
  },
  actionSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
    paddingHorizontal: 16,
  },
  actionSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.borderDark,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginBottom: 16,
  },
  actionSheetTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  actionSheetOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.surface,
  },
  actionSheetIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  actionSheetTextContainer: { flex: 1 },
  actionSheetOptionText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 2,
  },
  actionSheetOptionDescription: { fontSize: 13, color: Colors.textSecondary },
  actionSheetCancel: {
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderRadius: 12,
    marginTop: 12,
    alignItems: 'center' as const,
    backgroundColor: Colors.cardBorder,
  },
  actionSheetCancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
});
