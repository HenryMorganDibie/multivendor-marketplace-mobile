import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Archive } from 'lucide-react-native';
import { getAllVendorChats, Chat } from '@/mocks/chatData';
import type { Order } from '@/mocks/ordersData';
import { useOrders } from '@/contexts/OrdersContext';
import { getOrderStatusLabel } from '@/features/orders/selectors/orderStatusSelectors';
import { OrderConversationListItem, CircularAvatar } from '@/components/OrderConversationListItem';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
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

const getLastMessage = (chat: Chat): string => {
  if (!chat || chat.messages.length === 0) return '';
  
  const lastMsg = chat.messages[chat.messages.length - 1];
  if (lastMsg.type === 'system') return lastMsg.content;
  if (lastMsg.sender === 'vendor') return `You: ${lastMsg.content}`;
  return lastMsg.content;
};

const getLatestOrderForChat = (chat: Chat, orders: Order[]) => {
  if (!chat.customerId) return null;
  return orders
    .filter(o => o.vendorId === chat.vendorId && o.customerId === chat.customerId)
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
};

const getCustomerName = (chat: Chat): string => {
  return formatVendorDisplayName(chat.customerName);
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

  const allChats = getAllVendorChats();

  const archivedChatsList = useMemo(() => {
    return allChats
      .filter(chat => archivedChats.some(ac => ac.chatId === chat.id))
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [archivedChats, allChats]);

  const handleChatPress = (chat: Chat) => {
    const blockedUser = getBlockedUserByChatId(chat.id);
    if (blockedUser) {
      return;
    }

    const isOrderChat = chat.chatType === 'order_chat';

    if (isOrderChat) {
      // Navigate using the chat's own orderId rather than only the
      // re-derived "latest order for this vendor+customer": a customer can
      // have more than one order with the same vendor, so that
      // re-derivation alone could open the wrong order, and if this
      // particular order had since fallen out of the live orders list it
      // found nothing at all — a silent dead tap. Matches the fix already
      // applied to the customer-side app/archived-chats.tsx.
      const matchedOrder = getLatestOrderForChat(chat, orders);
      const targetOrderId = chat.orderId || matchedOrder?.id;
      if (targetOrderId) {
        router.push({
          pathname: '/vendor/chats/[orderId]' as any,
          params: { orderId: targetOrderId },
        });
      }
    } else if (!isOrderChat && chat.customerId) {
      router.push({
        pathname: '/vendor/chat/pre-order/[customerId]' as any,
        params: { customerId: chat.customerId },
      });
    }
  };

  const handleUnarchive = (chatId: string) => {
    unarchiveChat(chatId);
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const lastMessage = getLastMessage(item);
    const timeDisplay = getFormattedTime(item.lastActivityAt);
    const customerDisplayName = getCustomerName(item);
    
    const isOrderChat = item.chatType === 'order_chat';
    
    const order = isOrderChat ? getLatestOrderForChat(item, orders) : null;
    const displayStatus = order ? getOrderStatusLabel(order.status) : null;
    const blockedUser = getBlockedUserByChatId(item.id);
    const isBlocked = !!blockedUser;

    return (
      <OrderConversationListItem
        avatarContent={<CircularAvatar name={customerDisplayName} colorKey={item.customerId ?? customerDisplayName} />}
        primaryText={customerDisplayName}
        secondaryText={isOrderChat && order ? formatVendorOrderId(order.publicOrderId) : undefined}
        tertiaryText={isBlocked ? 'Blocked' : (isOrderChat && order ? `${order.fulfillmentType} · ${displayStatus}` : 'Pre-order inquiry')}
        previewText={lastMessage}
        timestamp={timeDisplay}
        showUnreadDot={false}
        onPress={() => handleChatPress(item)}
        onUnarchive={!isBlocked ? () => handleUnarchive(item.id) : undefined}
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

        {archivedChatsList.length === 0 ? (
          <View style={styles.emptyStateContainer}>
            <View style={styles.emptyStateCard}>
              <View style={styles.emptyIconContainer}>
                <Archive size={48} color={Colors.textSecondary} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>No archived chats</Text>
              <Text style={styles.emptyDescription}>
                Archived conversations will appear here
              </Text>
            </View>
          </View>
        ) : (
          <FlatList
            data={archivedChatsList}
            renderItem={renderChatItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
          />
        )}
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
  chatList: {
    paddingTop: 24,
  },
  emptyStateContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  emptyStateCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center' as const,
  },
  emptyIconContainer: {
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  emptyDescription: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
});
