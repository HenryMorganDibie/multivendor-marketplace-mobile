import React, { useState, useMemo, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Archive, MessageSquare } from 'lucide-react-native';
import ListStateView from '@/components/ListStateView';
import { ChatListSkeleton } from '@/components/SkeletonLoader';
import type { Order } from '@/mocks/ordersData';
import { useOrders } from '@/contexts/OrdersContext';
import { OrderConversationListItem, CircularAvatar } from '@/components/OrderConversationListItem';
import { getVendorOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useVendorDrafts } from '@/contexts/VendorDraftContext';
import { useInbox } from '@/contexts/InboxContext';
import { useChatRead } from '@/contexts/ChatReadContext';
import { useVendorSupportChat } from '@/contexts/VendorSupportChatContext';
import { SupportInboxRow } from '@/components/SupportInboxRow';
import { InboxSnapshot } from '@/mocks/inboxData';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { getBottomOverlayPadding } from '@/lib/constants/layout';

const formatVendorDisplayName = (fullName?: string): string => {
  if (!fullName) return 'Customer';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
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
};

type ChatFilterType = 'all' | 'orders' | 'inquiries';

const getContextBarColor = (item: InboxSnapshot): string => {
  if (item.conversationType === 'order' && item.orderStatus === 'requested') {
    return '#DC2626';
  }
  const activeStatuses = ['accepted', 'confirmed', 'in_progress'];
  if (item.conversationType === 'order' && item.orderStatus && activeStatuses.includes(item.orderStatus)) {
    return '#3B82F6';
  }
  if (item.conversationType === 'order' && item.orderStatus === 'completed') {
    return '#D1D5DB';
  }
  if (item.conversationType === 'order') {
    return '#D1D5DB';
  }
  return '#FBBF24';
};

/**
 * Subtitle shown under the customer display name on vendor-side rows.
 * For order chats: shows the canonical order ID (e.g. #SPICYREST-84032478).
 * For inquiry chats: returns undefined (badge label is sufficient).
 * Never uses customer-name-based public IDs as order references.
 */
const getCustomerIdentifierLabel = (item: InboxSnapshot, orders: Order[]): string | undefined => {
  if (item.conversationType === 'order' || item.conversationType === 'custom_order') {
    if (item.publicOrderId) return `#${formatVendorOrderId(item.publicOrderId)}`;
    if (item.orderId) {
      const order = orders.find(o => o.id === item.orderId);
      if (order?.publicOrderId) return `#${formatVendorOrderId(order.publicOrderId)}`;
    }
    return undefined;
  }
  // Inquiry-only chats — badge label is sufficient, no order ID to show
  return undefined;
};

const getChatTypeBadgeVariant = (
  item: InboxSnapshot
): 'order_chat' | 'pre_order_inquiry' | undefined => {
  if (item.conversationType === 'order' || item.conversationType === 'custom_order') return 'order_chat';
  if (item.conversationType === 'inquiry') return 'pre_order_inquiry';
  return undefined;
};

const getOrderStatusLabel = (item: InboxSnapshot, orders: Order[]): string | undefined => {
  if (item.conversationType === 'custom_order' || item.conversationType === 'inquiry') return undefined;
  if (item.conversationType !== 'order') return undefined;

  const orderType = item.orderType ? (item.orderType === 'pickup' ? 'Pickup' : 'Delivery') : '';

  if (item.orderStatus) {
    const statusLabel = (() => {
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
    if (statusLabel && orderType) return `${orderType} \u00B7 ${statusLabel}`;
    return statusLabel;
  }
  const order = orders.find(o => o.id === item.orderId);
  if (!order) return orderType || undefined;
  const label = getVendorOrderStatusLabel(order.status);
  return orderType ? `${orderType} \u00B7 ${label}` : label;
};

export default function VendorChatsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selectedFilter, setSelectedFilter] = useState<ChatFilterType>('all');
  const { archivedChats, archiveChat } = useBlockedUsers();
  const { orders } = useOrders();
  const { getDraft } = useVendorDrafts();
  const {
    getFilteredVendorInbox,
    markConversationRead,
    loadMoreVendor,
    hasMoreVendor,
    isInboxHydrated,
    hasInboxHydrationError,
  } = useInbox();
  const { markChatAsRead } = useChatRead();
  const { supportChat, getUnreadCount: getSupportUnreadCount } = useVendorSupportChat();

  const supportPreview = useMemo(() => {
    if (!supportChat) return null;
    const lastTextMessage = [...supportChat.messages].reverse().find(m => m.type === 'text');
    return {
      previewText: lastTextMessage?.content ?? 'Tap to continue the conversation',
      lastActivityAt: supportChat.lastActivityAt,
      unreadCount: getSupportUnreadCount(),
    };
  }, [supportChat, getSupportUnreadCount]);

  const filteredInbox = useMemo(() => {
    const items = getFilteredVendorInbox(selectedFilter);
    return items.filter(item => !archivedChats.some(ac => ac.chatId === item.conversationId));
  }, [getFilteredVendorInbox, selectedFilter, archivedChats]);

  const handleConversationPress = useCallback((item: InboxSnapshot) => {
    markConversationRead(item.conversationId, 'vendor');
    if (item.chatId) {
      markChatAsRead(item.chatId, 'vendor');
    }
    console.log('[VENDOR CHATS] Opening conversation:', item.conversationId, 'type:', item.conversationType);

    if (item.conversationType === 'order' && item.orderId) {
      router.push({
        pathname: '/vendor/chats/[orderId]' as any,
        params: { orderId: item.orderId },
      });
    } else {
      router.push({
        pathname: '/vendor/chat/pre-order/[customerId]' as any,
        params: { customerId: item.customerId },
      });
    }
  }, [markConversationRead, markChatAsRead, router]);

  const handleSupportPress = useCallback(() => {
    router.push('/vendor/settings/support-chat' as any);
  }, [router]);

  const handleArchive = useCallback((conversationId: string) => {
    archiveChat(conversationId, 'manual');
  }, [archiveChat]);

  const handleArchivedPress = useCallback(() => {
    router.push('/vendor/archived-chats' as any);
  }, [router]);

  const renderConversationItem = useCallback(({ item }: { item: InboxSnapshot }) => {
    const draft = getDraft(item.conversationId);
    const displayText = draft || item.lastMessageText || 'Tap to start messaging';
    const isDraft = !!draft;
    const isUnread = item.unreadCount > 0;
    const displayName = formatVendorDisplayName(item.title);
    const contextBarColor = getContextBarColor(item);
    const customerIdLabel = getCustomerIdentifierLabel(item, orders);
    const orderStatusLabel = getOrderStatusLabel(item, orders);
    const chatTypeBadge = getChatTypeBadgeVariant(item);
    const unreadBadgeColor = isUnread ? '#FF3B30' : undefined;

    return (
      <View style={styles.itemWrapper}>
        <View style={[styles.contextBar, { backgroundColor: contextBarColor }]} />
        <OrderConversationListItem
          avatarContent={<CircularAvatar name={displayName} colorKey={item.customerId ?? displayName} />}
          primaryText={displayName}
          secondaryText={customerIdLabel}
          tertiaryText={orderStatusLabel}
          chatTypeBadge={chatTypeBadge}
          previewText={displayText}
          previewType={item.lastMessageType}
          isDraft={isDraft}
          timestamp={formatTimestamp(item.lastMessageAt)}
          showUnreadDot={false}
          isUnread={isUnread}
          unreadCount={item.unreadCount}
          unreadBadgeColor={unreadBadgeColor}
          onPress={() => handleConversationPress(item)}
          onArchive={() => handleArchive(item.conversationId)}
        />
      </View>
    );
  }, [getDraft, handleConversationPress, handleArchive]);

  const hasArchivedChats = archivedChats.length > 0;
  const showSupportRow = selectedFilter === 'all' && supportPreview !== null;

  const allVendorItems = useMemo(() => {
    const items = getFilteredVendorInbox('all');
    return items.filter(item => !archivedChats.some(ac => ac.chatId === item.conversationId));
  }, [getFilteredVendorInbox, archivedChats]);

  const filterCounts = useMemo(() => {
    let orders = 0;
    let inquiries = 0;
    for (const item of allVendorItems) {
      if (item.unreadCount <= 0) continue;
      if (item.conversationType === 'order' || item.conversationType === 'custom_order') {
        orders++;
      } else if (item.conversationType === 'inquiry') {
        inquiries++;
      }
    }
    return { orders, inquiries };
  }, [allVendorItems]);

  const filters: { key: ChatFilterType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'orders', label: `Orders${filterCounts.orders > 0 ? ` (${filterCounts.orders})` : ''}` },
    { key: 'inquiries', label: `Inquiries${filterCounts.inquiries > 0 ? ` (${filterCounts.inquiries})` : ''}` },
  ];

  const emptyStateConfig =
    selectedFilter === 'orders'
      ? { title: 'No order chats yet', description: 'Order chats appear here after customers submit an order request.' }
      : selectedFilter === 'inquiries'
      ? { title: 'No inquiries yet', description: 'Customer questions will appear here before orders are placed.' }
      : { title: 'No conversations yet', description: 'Your customer conversations will appear here.' };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Chats</Text>

          <View style={styles.filterRow}>
            {filters.map(f => (
              <TouchableOpacity
                key={f.key}
                style={[styles.filterPill, selectedFilter === f.key && styles.filterPillActive]}
                onPress={() => setSelectedFilter(f.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterPillText, selectedFilter === f.key && styles.filterPillTextActive]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {hasArchivedChats && (
        <TouchableOpacity style={styles.archivedRow} onPress={handleArchivedPress} activeOpacity={0.7}>
          <View style={styles.archivedIconContainer}>
            <Archive size={20} color={Colors.textSecondary} />
          </View>
          <Text style={styles.archivedText}>Archived</Text>
        </TouchableOpacity>
      )}

      <ListStateView
        isLoading={!isInboxHydrated && !hasInboxHydrationError}
        isError={hasInboxHydrationError}
        isEmpty={filteredInbox.length === 0 && !showSupportRow}
        loadingSkeleton={<ChatListSkeleton count={5} />}
        emptyIcon={<MessageSquare size={36} color={Colors.textMuted} strokeWidth={1.5} />}
        emptyTitle={emptyStateConfig.title}
        emptyDescription={emptyStateConfig.description}
        style={styles.stateContainer}
      >
        <FlatList
          data={filteredInbox}
          renderItem={renderConversationItem}
          keyExtractor={item => item.conversationId}
          ListHeaderComponent={
            showSupportRow && supportPreview ? (
              <SupportInboxRow
                previewText={supportPreview.previewText}
                lastActivityAt={supportPreview.lastActivityAt}
                unreadCount={supportPreview.unreadCount}
                onPress={handleSupportPress}
              />
            ) : null
          }
          contentContainerStyle={[styles.listContent, { paddingBottom: getBottomOverlayPadding(insets.bottom) }]}
          showsVerticalScrollIndicator={false}
          onEndReached={hasMoreVendor ? loadMoreVendor : undefined}
          onEndReachedThreshold={0.3}
        />
      </ListStateView>
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
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  filterPill: {
    paddingVertical: 7,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  filterPillActive: {
    backgroundColor: Colors.text,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  filterPillTextActive: {
    color: Colors.background,
    fontWeight: '600' as const,
  },
  listContent: {
  },
  stateContainer: {
    flex: 1,
  },
  itemWrapper: {
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

  archivedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  archivedIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  archivedText: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: Colors.text,
  },
});
