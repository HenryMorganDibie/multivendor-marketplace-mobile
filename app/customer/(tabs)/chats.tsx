
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { useResponsive } from '@/constants/layout';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Archive, MessageSquare } from 'lucide-react-native';
import ListStateView from '@/components/ListStateView';
import { ChatListSkeleton } from '@/components/SkeletonLoader';
import { mockOrders } from '@/mocks/ordersData';
import { OrderConversationListItem, CircularAvatar } from '@/components/OrderConversationListItem';
import { getOrderStatusColor, getOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import type { StatusChip } from '@/components/OrderConversationListItem';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useCustomerDrafts } from '@/contexts/CustomerDraftContext';
import { useInbox } from '@/contexts/InboxContext';
import { useChatRead } from '@/contexts/ChatReadContext';
import { Colors } from '@/constants/colors';
import { InboxSnapshot } from '@/mocks/inboxData';

type ChatFilterType = 'all' | 'orders' | 'inquiries';

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
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const getLastMessagePreview = (item: InboxSnapshot, draft?: string): { text: string; isDraft: boolean } => {
  if (draft) return { text: draft, isDraft: true };
  if (!item.lastMessageText) return { text: 'Tap to start messaging', isDraft: false };
  return { text: item.lastMessageText, isDraft: false };
};

/**
 * Subtitle shown under the vendor name in the chat list row.
 * Prefers a vendor-stable identifier (slug / publicId) over the order ID,
 * so users can see _who_ they are talking to at a glance. The chat type
 * (Order chat / Inquiry) is rendered as a separate badge.
 * Backend-ready: maps from `InboxSnapshot.vendorSlug | vendorPublicId`.
 */
const getVendorIdentifierLabel = (item: InboxSnapshot): string | undefined => {
  if (item.vendorPublicId) return item.vendorPublicId.toUpperCase();
  if (item.vendorSlug) return item.vendorSlug.toUpperCase();
  return undefined;
};

/**
 * For order-chat rows, optionally also surface a short order reference
 * (formatted public order id) as tertiary context next to the type badge.
 */
const getOrderReferenceLabel = (item: InboxSnapshot): string | undefined => {
  if (item.conversationType !== 'order' && item.conversationType !== 'custom_order') return undefined;
  if (item.publicOrderId) return formatVendorOrderId(item.publicOrderId);
  if (item.orderId) {
    const order = mockOrders.find(o => o.id === item.orderId);
    if (order?.publicOrderId) return formatVendorOrderId(order.publicOrderId);
  }
  return undefined;
};

const getChatTypeBadgeVariant = (
  item: InboxSnapshot
): 'order_chat' | 'pre_order_inquiry' | undefined => {
  if (item.conversationType === 'order' || item.conversationType === 'custom_order') return 'order_chat';
  if (item.conversationType === 'inquiry') return 'pre_order_inquiry';
  return undefined;
};

export default function CustomerChatsScreen() {
  const router = useRouter();
  const layout = useResponsive();
  const [selectedFilter, setSelectedFilter] = useState<ChatFilterType>('all');

  const { archivedChats, archiveChat } = useBlockedUsers();
  const { getDraft } = useCustomerDrafts();
  const { getFilteredCustomerInbox, markConversationRead, loadMoreCustomer, hasMoreCustomer, customerInbox } = useInbox();
  const { markChatAsRead } = useChatRead();

  const unreadCounts = useMemo(() => {
    const nonArchived = customerInbox.filter(
      item => !archivedChats.some(ac => ac.chatId === item.conversationId)
    );
    const chatsUnread = nonArchived
      .filter(item => item.conversationType === 'order' || item.conversationType === 'custom_order')
      .reduce((sum, item) => sum + item.unreadCount, 0);
    const inquiriesUnread = nonArchived
      .filter(item => item.conversationType === 'inquiry')
      .reduce((sum, item) => sum + item.unreadCount, 0);
    return { chats: chatsUnread, inquiries: inquiriesUnread };
  }, [customerInbox, archivedChats]);

  const filteredInbox = useMemo(() => {
    const items = getFilteredCustomerInbox(selectedFilter);
    return items.filter(item => !archivedChats.some(ac => ac.chatId === item.conversationId));
  }, [getFilteredCustomerInbox, selectedFilter, archivedChats]);

  const handleArchive = (conversationId: string) => {
    archiveChat(conversationId, 'manual');
  };

  const handleArchivedPress = () => {
    router.push('/archived-chats' as any);
  };

  const handleConversationPress = (item: InboxSnapshot) => {
    markConversationRead(item.conversationId, 'customer');
    if (item.chatId) {
      markChatAsRead(item.chatId, 'customer');
    }
    console.log('[CHATS] Opening conversation:', item.conversationId, 'type:', item.conversationType, 'vendorId:', item.vendorId);

    if (item.conversationType === 'order' && item.orderId) {
      router.push({
        pathname: `/chat/order/${item.orderId}` as any,
        params: { vendorName: item.title },
      });
    } else {
      router.push({
        pathname: `/chat/pre-order/${item.vendorId}` as any,
        params: { vendorName: item.title },
      });
    }
  };

  const getOrderStatusChip = (item: InboxSnapshot): StatusChip | undefined => {
    if ((item.conversationType !== 'order' && item.conversationType !== 'custom_order') || !item.orderId) return undefined;
    const order = mockOrders.find(o => o.id === item.orderId);
    if (!order) return undefined;
    const colors = getOrderStatusColor(order.status);
    return {
      label: getOrderStatusLabel(order.status).toUpperCase(),
      backgroundColor: colors.background,
      textColor: colors.text,
    };
  };

  const renderConversationItem = ({ item }: { item: InboxSnapshot }) => {
    const draft = getDraft(item.conversationId);
    const { text: displayText, isDraft } = getLastMessagePreview(item, draft);
    const isUnread = item.unreadCount > 0;
    const statusChip = getOrderStatusChip(item);
    const unreadBadgeColor = isUnread ? Colors.primary : undefined;
    const vendorIdLabel = getVendorIdentifierLabel(item);
    const orderRef = getOrderReferenceLabel(item);
    const chatTypeBadge = getChatTypeBadgeVariant(item);

    return (
      <OrderConversationListItem
        avatarContent={<CircularAvatar name={item.title} />}
        primaryText={item.title}
        secondaryText={vendorIdLabel}
        tertiaryText={orderRef}
        chatTypeBadge={chatTypeBadge}
        statusChip={statusChip}
        previewText={displayText}
        isDraft={isDraft}
        timestamp={formatTimestamp(item.lastMessageAt)}
        showUnreadDot={false}
        isUnread={isUnread}
        unreadCount={item.unreadCount}
        unreadBadgeColor={unreadBadgeColor}
        onPress={() => handleConversationPress(item)}
        onArchive={
          selectedFilter !== 'inquiries' && item.conversationType === 'order'
            ? () => handleArchive(item.conversationId)
            : undefined
        }
        theme="light"
      />
    );
  };

  const hasArchivedChats = archivedChats.length > 0;

  const filters: { key: ChatFilterType; label: string; unread: number }[] = [
    { key: 'all', label: 'All', unread: 0 },
    { key: 'orders', label: 'Chats', unread: unreadCounts.chats },
    { key: 'inquiries', label: 'Inquiries', unread: unreadCounts.inquiries },
  ];

  const emptyStateConfig =
    selectedFilter === 'orders'
      ? { title: 'No chats yet', description: 'Conversations about your orders will appear here' }
      : selectedFilter === 'inquiries'
      ? { title: 'No inquiries yet', description: 'Ask vendors questions before placing an order' }
      : { title: 'No conversations yet', description: 'Your vendor conversations will appear here' };

  const hPad = layout.horizontalPadding;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={[styles.header, { paddingHorizontal: hPad }]}>
          <Text style={styles.headerTitle}>Messages</Text>

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
                {f.unread > 0 && (
                  <View style={[styles.filterUnreadDot, selectedFilter === f.key && styles.filterUnreadDotActive]}>
                    <Text style={[styles.filterUnreadText, selectedFilter === f.key && styles.filterUnreadTextActive]}>
                      {f.unread}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {hasArchivedChats && selectedFilter !== 'inquiries' && (
        <TouchableOpacity style={styles.archivedRow} onPress={handleArchivedPress} activeOpacity={0.7}>
          <View style={styles.archivedIconContainer}>
            <Archive size={18} color={Colors.textSecondary} />
          </View>
          <View style={styles.archivedTextWrap}>
            <Text style={styles.archivedText}>Archived chats</Text>
            <Text style={styles.archivedCount}>{archivedChats.length}</Text>
          </View>
        </TouchableOpacity>
      )}

      <ListStateView
        isLoading={false}
        isError={false}
        isEmpty={filteredInbox.length === 0}
        loadingSkeleton={<ChatListSkeleton count={5} />}
        emptyIcon={<MessageSquare size={32} color={Colors.primary} strokeWidth={1.5} />}
        emptyTitle={emptyStateConfig.title}
        emptyDescription={emptyStateConfig.description}
        style={styles.stateContainer}
      >
        <FlatList
          data={filteredInbox}
          renderItem={renderConversationItem}
          keyExtractor={item => item.conversationId}
          contentContainerStyle={[styles.chatList, layout.isTablet && { paddingHorizontal: hPad }]}
          showsVerticalScrollIndicator={false}
          onEndReached={hasMoreCustomer ? loadMoreCustomer : undefined}
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
    paddingTop: 16,
    paddingBottom: 14,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800' as const,
    color: Colors.text,
    letterSpacing: -0.6,
    marginBottom: 14,
  },
  filterRow: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  filterPill: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterPillActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  filterPillText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: -0.1,
  },
  filterPillTextActive: {
    color: Colors.white,
  },
  filterUnreadDot: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 5,
  },
  filterUnreadDotActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  filterUnreadText: {
    fontSize: 10,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  filterUnreadTextActive: {
    color: Colors.white,
  },
  chatList: {
    paddingBottom: 120,
  },
  stateContainer: {
    flex: 1,
  },
  archivedRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.backgroundCanvas,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
  },
  archivedIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 13,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  archivedTextWrap: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  archivedText: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  archivedCount: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
});
