import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Search, MessageCircle, Plus } from 'lucide-react-native';
import { useInbox } from '@/contexts/InboxContext';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { OrderConversationListItem, CircularAvatar } from '@/components/OrderConversationListItem';
import { formatInternalCustomerFromFull } from '@/utils/internalCustomerName';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { mockOrders } from '@/mocks/ordersData';
import { getVendorOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import type { InboxSnapshot, OrderStatusType } from '@/mocks/inboxData';
import { Colors } from '@/constants/colors';

/**
 * Filter tabs for the the platform customer picker. Vendors can narrow the list to
 * All / Order chats / Inquiries. Support, AI, creator, blocked, expired and
 * deleted conversations are always excluded — those are not eligible invoice
 * recipients.
 */
type PickerFilter = 'all' | 'order' | 'inquiry';

interface ConversationPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (snapshot: InboxSnapshot) => void;
  onCreateExternal?: () => void;
  title?: string;
}

function formatLastActivity(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return date.toLocaleDateString('en-US', { weekday: 'short' });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const getContextBarColor = (item: InboxSnapshot): string => {
  if (item.conversationType === 'order' && item.orderStatus === 'requested') return '#DC2626';
  const activeStatuses: OrderStatusType[] = ['accepted', 'confirmed', 'in_progress'];
  if (item.conversationType === 'order' && item.orderStatus && activeStatuses.includes(item.orderStatus)) {
    return '#3B82F6';
  }
  if (item.conversationType === 'order') return '#D1D5DB';
  return '#FBBF24';
};

const getOrderIdentifier = (item: InboxSnapshot): string | undefined => {
  if (item.conversationType !== 'order' && item.conversationType !== 'custom_order') return undefined;
  if (item.publicOrderId) return `#${formatVendorOrderId(item.publicOrderId)}`;
  if (item.orderId) {
    const order = mockOrders.find(o => o.id === item.orderId);
    if (order?.publicOrderId) return `#${formatVendorOrderId(order.publicOrderId)}`;
  }
  return undefined;
};

const getChatTypeBadge = (item: InboxSnapshot): 'order_chat' | 'pre_order_inquiry' | undefined => {
  if (item.conversationType === 'order' || item.conversationType === 'custom_order') return 'order_chat';
  if (item.conversationType === 'inquiry') return 'pre_order_inquiry';
  return undefined;
};

const getOrderStatusText = (item: InboxSnapshot): string | undefined => {
  if (item.conversationType !== 'order' && item.conversationType !== 'custom_order') return undefined;
  const orderType = item.orderType ? (item.orderType === 'pickup' ? 'Pickup' : 'Delivery') : '';
  if (item.orderStatus) {
    const label = (() => {
      switch (item.orderStatus) {
        case 'requested': return 'Waiting for action';
        case 'accepted': return 'Accepted';
        case 'confirmed': return 'Confirmed';
        case 'in_progress': return 'In Progress';
        case 'completed': return 'Completed';
        case 'cancelled': return 'Cancelled';
        case 'rejected': return 'Rejected';
        case 'expired': return 'Expired';
        default: return undefined;
      }
    })();
    if (label && orderType) return `${orderType} \u00B7 ${label}`;
    return label;
  }
  const order = mockOrders.find(o => o.id === item.orderId);
  if (!order) return orderType || undefined;
  const label = getVendorOrderStatusLabel(order.status);
  return orderType ? `${orderType} \u00B7 ${label}` : label;
};

/**
 * WhatsApp-style selector of the vendor's eligible customer conversations.
 * Reuses the same InboxContext data + row component as the vendor Chats screen
 * so customers, order IDs, badges, and previews stay identical. No mock names.
 *
 * Privacy: internal the platform customers are always shown as "First L." here so
 * the vendor never sees a customer's full surname during invoice creation.
 * Support / AI / creator / blocked / expired / deleted conversations are
 * excluded — they are not eligible invoice recipients.
 */
export default function ConversationPickerModal({
  visible,
  onClose,
  onSelect,
  onCreateExternal,
  title = 'Select customer',
}: ConversationPickerModalProps) {
  const { getFilteredVendorInbox } = useInbox();
  const { archivedChats } = useBlockedUsers();
  const [search, setSearch] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<PickerFilter>('all');

  const allConversations = useMemo(() => {
    const items = getFilteredVendorInbox('all');
    return items.filter(
      (item) =>
        !archivedChats.some((ac) => ac.chatId === item.conversationId) &&
        item.orderStatus !== 'expired' &&
        (item.conversationType === 'order' ||
          item.conversationType === 'custom_order' ||
          item.conversationType === 'inquiry')
    );
  }, [getFilteredVendorInbox, archivedChats]);

  const filteredByTab = useMemo(() => {
    if (activeFilter === 'all') return allConversations;
    if (activeFilter === 'order') {
      return allConversations.filter(
        (item) => item.conversationType === 'order' || item.conversationType === 'custom_order'
      );
    }
    return allConversations.filter((item) => item.conversationType === 'inquiry');
  }, [allConversations, activeFilter]);

  const conversations = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return filteredByTab;
    return filteredByTab.filter((item) => {
      // Privacy: search against the privacy-safe name so the vendor's mental
      // model matches what they see on screen.
      const name = formatInternalCustomerFromFull(item.title).toLowerCase();
      const orderId = (item.publicOrderId ?? item.orderId ?? '').toLowerCase();
      const preview = (item.lastMessageText ?? '').toLowerCase();
      return name.includes(query) || orderId.includes(query) || preview.includes(query);
    });
  }, [filteredByTab, search]);

  const hasAnyConversations = allConversations.length > 0;
  const isSearching = !!search.trim();

  const renderItem = ({ item }: { item: InboxSnapshot }) => {
    // Privacy: always "First L." for internal the platform customers.
    const displayName = formatInternalCustomerFromFull(item.title);
    const orderIdLabel = getOrderIdentifier(item);
    const statusLabel = getOrderStatusText(item);
    const chatTypeBadge = getChatTypeBadge(item);
    const isUnread = item.unreadCount > 0;

    return (
      <View style={styles.rowWrapper}>
        <View style={[styles.contextBar, { backgroundColor: getContextBarColor(item) }]} />
        <OrderConversationListItem
          avatarContent={<CircularAvatar name={displayName} colorKey={item.customerId ?? displayName} />}
          primaryText={displayName}
          secondaryText={orderIdLabel}
          tertiaryText={statusLabel}
          chatTypeBadge={chatTypeBadge}
          previewText={item.lastMessageText || 'Tap to start messaging'}
          timestamp={formatLastActivity(item.lastMessageAt)}
          isUnread={isUnread}
          unreadCount={item.unreadCount}
          unreadBadgeColor={isUnread ? '#FF3B30' : undefined}
          onPress={() => onSelect(item)}
        />
      </View>
    );
  };

  const FILTER_TABS: { key: PickerFilter; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'order', label: 'Order chats' },
    { key: 'inquiry', label: 'Inquiries' },
  ];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.7}>
            <X size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchWrap}>
          <Search size={16} color={Colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search customers or chats"
            placeholderTextColor={Colors.inputPlaceholder}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {hasAnyConversations ? (
          <View style={styles.filterTabs}>
            {FILTER_TABS.map((tab) => {
              const isActive = activeFilter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[styles.filterTab, isActive && styles.filterTabActive]}
                  onPress={() => setActiveFilter(tab.key)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.filterTabText, isActive && styles.filterTabTextActive]}>
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {conversations.length > 0 ? (
          <FlatList
            data={conversations}
            renderItem={renderItem}
            keyExtractor={(item) => item.conversationId}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <MessageCircle size={24} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>
              {isSearching ? 'No matching customers' : 'No customer conversations found'}
            </Text>
            <Text style={styles.emptyDescription}>
              {isSearching
                ? 'Try a different name or order ID.'
                : 'You can create an external invoice instead.'}
            </Text>
            {!isSearching && onCreateExternal ? (
              <TouchableOpacity
                style={styles.externalButton}
                onPress={onCreateExternal}
                activeOpacity={0.7}
              >
                <Plus size={15} color={Colors.primary} />
                <Text style={styles.externalButtonText}>Create External Invoice</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  searchWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  filterTabs: {
    flexDirection: 'row' as const,
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: Colors.surface,
  },
  filterTabActive: {
    backgroundColor: Colors.primarySoft,
  },
  filterTabText: {
    fontSize: 12.5,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.primary,
  },
  listContent: {
    paddingBottom: 24,
  },
  rowWrapper: {
    position: 'relative' as const,
  },
  contextBar: {
    position: 'absolute' as const,
    left: 0,
    top: 4,
    bottom: 4,
    width: 3,
    borderTopRightRadius: 3,
    borderBottomRightRadius: 3,
    zIndex: 1,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 32,
    paddingBottom: 60,
  },
  emptyIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 5,
  },
  emptyDescription: {
    fontSize: 13,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 19,
    marginBottom: 16,
  },
  externalButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: Colors.primarySoft,
    borderRadius: 10,
  },
  externalButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
});
