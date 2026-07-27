import React, { useMemo } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { ChevronLeft, Archive } from 'lucide-react-native';
import { mockChats, Chat } from '@/mocks/chatData';
import { mockOrders } from '@/mocks/ordersData';
import { OrderConversationListItem, CircularAvatar } from '@/components/OrderConversationListItem';
import { useBlockedUsers } from '@/contexts/BlockedUsersContext';
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

const getLastMessagePreview = (chat: Chat): string => {
  if (chat.messages.length === 0) return 'No messages yet';
  const lastMessage = chat.messages[chat.messages.length - 1];
  
  if (lastMessage.type === 'system') {
    return lastMessage.content;
  }
  if (lastMessage.type === 'payment-request') {
    return 'Payment request sent';
  }
  if (lastMessage.type === 'contact-card') {
    return 'Contact details shared';
  }
  
  const prefix = lastMessage.sender === 'customer' ? 'You: ' : '';
  return `${prefix}${lastMessage.content}`;
};

const getFulfillmentAndStatus = (chat: Chat): string => {
  if (chat.chatType === 'pre_order_inquiry') {
    return 'Pre-order inquiry';
  }
  
  if (!chat.customerId || !chat.vendorId) return 'Order';
  const order = mockOrders
    .filter(o => o.vendorId === chat.vendorId && o.customerId === chat.customerId)
    .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
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

  const archivedChatsList = useMemo(() => {
    return mockChats
      .filter(chat => archivedChats.some(ac => ac.chatId === chat.id))
      .sort((a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime());
  }, [archivedChats]);

  const handleChatPress = (chat: Chat) => {
    const blockedUser = getBlockedUserByChatId(chat.id);
    if (blockedUser) {
      return;
    }

    if (chat.chatType === 'pre_order_inquiry') {
      router.push(`/chat/pre-order/${chat.vendorId}` as any);
    } else {
      const latestOrder = mockOrders
        .filter(o => o.vendorId === chat.vendorId && o.customerId === chat.customerId)
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
      if (latestOrder) {
        router.push({
          pathname: `/chat/order/[orderId]` as any,
          params: {
            orderId: latestOrder.id,
            vendorName: chat.vendorName,
            publicOrderId: latestOrder.publicOrderId,
          },
        });
      }
    }
  };

  const handleUnarchive = (chatId: string) => {
    unarchiveChat(chatId);
  };

  const renderChatItem = ({ item }: { item: Chat }) => {
    const lastMessagePreview = getLastMessagePreview(item);
    const fulfillmentAndStatus = getFulfillmentAndStatus(item);
    const timestamp = formatTimestamp(item.lastActivityAt);
    const blockedUser = getBlockedUserByChatId(item.id);
    const isBlocked = !!blockedUser;

    return (
      <OrderConversationListItem
        avatarContent={<CircularAvatar name={item.vendorName} />}
        primaryText={item.vendorName}
        secondaryText={(() => {
          const latestOrder = mockOrders
            .filter(o => o.vendorId === item.vendorId && o.customerId === item.customerId)
            .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
          return latestOrder ? latestOrder.publicOrderId.toUpperCase() : undefined;
        })()}
        tertiaryText={isBlocked ? 'Blocked' : fulfillmentAndStatus}
        previewText={lastMessagePreview}
        timestamp={timestamp}
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
          <TouchableOpacity onPress={() => safeBack()} style={styles.backButton}>
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
