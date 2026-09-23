import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { ChevronLeft, Archive } from 'lucide-react-native';
import ListStateView from '@/components/ListStateView';
import { ChatListSkeleton } from '@/components/SkeletonLoader';
import type { Order } from '@/mocks/ordersData';
import { useOrders } from '@/contexts/OrdersContext';
import { OrderConversationListItem, CircularAvatar } from '@/components/OrderConversationListItem';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useInbox } from '@/contexts/InboxContext';
import { InboxSnapshot } from '@/mocks/inboxData';
import { formatVendorHandle } from '@/utils/vendorHandle';
import { Colors } from '@/constants/colors';

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

const getFulfillmentAndStatus = (item: InboxSnapshot, orders: Order[]): string => {
  if (item.conversationType === 'inquiry') {
    return 'Pre-order inquiry';
  }

  const order = item.orderId ? orders.find(o => o.id === item.orderId) : undefined;
  if (!order) return 'Order';

  const fulfillment = order.fulfillmentType || 'Pickup';
  let status = '';

  switch (order.status) {
    case 'requested':
      status = 'Awaiting response';
      break;
    case 'accepted':
      status = 'Accepted';
      break;
    case 'confirmed':
      status = 'Confirmed';
      break;
    case 'in_progress':
      status = 'In Progress';
      break;
    case 'completed':
      status = 'Completed';
      break;
    case 'rejected':
      status = 'Declined';
      break;
    case 'cancelled':
      status = 'Cancelled';
      break;
    default:
      status = 'Order';
  }

  return `${fulfillment} · ${status}`;
};

export default function ArchivedChatsScreen() {
  const router = useRouter();
  const safeBack = useSafeBack();
  const { archivedChats, unarchiveChat, getBlockedUserByChatId } = useBlockedUsers();
  const { orders } = useOrders();
  const { allCustomerInbox, isInboxHydrated, hasInboxHydrationError } = useInbox();

  const archivedChatsList = useMemo(() => {
    return allCustomerInbox
      .filter(item => archivedChats.some(ac => ac.chatId === item.conversationId))
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [allCustomerInbox, archivedChats]);

  const handleChatPress = (item: InboxSnapshot) => {
    const blockedUser = getBlockedUserByChatId(item.conversationId);
    if (blockedUser) {
      return;
    }

    if (item.conversationType === 'order' && item.orderId) {
      router.push({
        pathname: `/chat/order/${item.orderId}` as any,
        params: { vendorName: item.title },
      });
      return;
    }

    router.push({
      pathname: `/chat/pre-order/${item.vendorId}` as any,
      params: { vendorName: item.title },
    });
  };

  const handleUnarchive = (conversationId: string) => {
    unarchiveChat(conversationId);
  };

  const renderChatItem = ({ item }: { item: InboxSnapshot }) => {
    const fulfillmentAndStatus = getFulfillmentAndStatus(item, orders);
    const timestamp = formatTimestamp(item.lastMessageAt);
    const blockedUser = getBlockedUserByChatId(item.conversationId);
    const isBlocked = !!blockedUser;

    return (
      <OrderConversationListItem
        avatarContent={<CircularAvatar name={item.title} />}
        primaryText={item.title}
        secondaryText={formatVendorHandle({
          vendorSlug: item.vendorSlug,
          vendorPublicId: item.vendorPublicId,
          name: item.title,
          id: item.vendorId,
        })}
        tertiaryText={isBlocked ? 'Blocked' : fulfillmentAndStatus}
        previewText={item.lastMessageText || 'No messages yet'}
        previewType={item.lastMessageType}
        timestamp={timestamp}
        showUnreadDot={false}
        onPress={() => handleChatPress(item)}
        onUnarchive={!isBlocked ? () => handleUnarchive(item.conversationId) : undefined}
        isBlocked={isBlocked}
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack()} style={styles.backButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Archived</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ListStateView
          isLoading={!isInboxHydrated && !hasInboxHydrationError}
          isError={hasInboxHydrationError}
          isEmpty={archivedChatsList.length === 0}
          loadingSkeleton={<ChatListSkeleton count={5} />}
          emptyIcon={<Archive size={48} color={Colors.textSecondary} strokeWidth={1.5} />}
          emptyTitle="No archived chats"
          emptyDescription="Archived conversations will appear here"
          style={styles.stateContainer}
        >
          <FlatList
            data={archivedChatsList}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.conversationId}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
          />
        </ListStateView>
      </SafeAreaView>
    </>
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
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 40,
  },
  stateContainer: {
    flex: 1,
  },
  chatList: {
    paddingTop: 24,
  },
});
