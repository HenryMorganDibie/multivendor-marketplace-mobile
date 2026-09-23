import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Archive } from 'lucide-react-native';
import ListStateView from '@/components/ListStateView';
import { ChatListSkeleton } from '@/components/SkeletonLoader';
import type { Order } from '@/mocks/ordersData';
import { useOrders } from '@/contexts/OrdersContext';
import { getOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { OrderConversationListItem, CircularAvatar } from '@/components/OrderConversationListItem';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
import { useInbox } from '@/contexts/InboxContext';
import { InboxSnapshot } from '@/mocks/inboxData';
import { formatVendorOrderId } from '@/utils/formatOrderId';
import { Colors } from '@/constants/colors';

const formatVendorDisplayName = (fullName?: string): string => {
  if (!fullName) return 'Customer';
  const parts = fullName.trim().split(' ');
  if (parts.length === 1) return parts[0];
  const firstName = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
};

const getOrderForItem = (item: InboxSnapshot, orders: Order[]) => {
  if (!item.orderId) return null;
  return orders.find(o => o.id === item.orderId) ?? null;
};

const getFormattedTime = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInMs = now.getTime() - date.getTime();
  const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

  if (diffInDays === 0) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } else if (diffInDays === 1) {
    return 'Yesterday';
  } else if (diffInDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' });
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  }
};

export default function VendorArchivedChatsScreen() {
  const router = useRouter();
  const { archivedChats, unarchiveChat, getBlockedUserByChatId } = useBlockedUsers();
  const { orders } = useOrders();
  const { allVendorInbox, isInboxHydrated, hasInboxHydrationError } = useInbox();

  const archivedChatsList = useMemo(() => {
    return allVendorInbox
      .filter(item => archivedChats.some(ac => ac.chatId === item.conversationId))
      .sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
  }, [archivedChats, allVendorInbox]);

  const handleChatPress = (item: InboxSnapshot) => {
    const blockedUser = getBlockedUserByChatId(item.conversationId);
    if (blockedUser) {
      return;
    }

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
  };

  const handleUnarchive = (conversationId: string) => {
    unarchiveChat(conversationId);
  };

  const renderChatItem = ({ item }: { item: InboxSnapshot }) => {
    const timeDisplay = getFormattedTime(item.lastMessageAt);
    const customerDisplayName = formatVendorDisplayName(item.title);

    const isOrderChat = item.conversationType === 'order';

    const order = isOrderChat ? getOrderForItem(item, orders) : null;
    const displayStatus = order ? getOrderStatusLabel(order.status) : null;
    const blockedUser = getBlockedUserByChatId(item.conversationId);
    const isBlocked = !!blockedUser;

    return (
      <OrderConversationListItem
        avatarContent={<CircularAvatar name={customerDisplayName} colorKey={item.customerId ?? customerDisplayName} />}
        primaryText={customerDisplayName}
        secondaryText={isOrderChat && order ? formatVendorOrderId(order.publicOrderId) : undefined}
        tertiaryText={isBlocked ? 'Blocked' : (isOrderChat && order ? `${order.fulfillmentType} · ${displayStatus}` : 'Pre-order inquiry')}
        previewText={item.lastMessageText || ''}
        previewType={item.lastMessageType}
        timestamp={timeDisplay}
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
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
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
