import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useChats } from '@/contexts/ChatContext';
import { useOrders } from '@/contexts/OrdersContext';
import { mockVendors } from '@/mocks/vendorData';
import type { Order, OrderStatus } from '@/mocks/ordersData';
import type { Chat } from '@/mocks/chatData';

/**
 * Order statuses that are considered "active" for the purpose of
 * routing the customer into an order chat instead of a pre-order chat.
 *
 * When the backend is integrated, this set can be replaced with a
 * server-driven flag (e.g. `order.isActive`) without changing callers.
 */
const ACTIVE_ORDER_STATUSES: OrderStatus[] = [
  'requested',
  'accepted',
  'confirmed',
  'in_progress',
];

export type MessageVendorTarget =
  | { kind: 'order_chat'; orderId: string; publicOrderId: string; vendorName: string }
  | { kind: 'pre_order_inquiry'; vendorId: string; chatThreadId: string };

export interface MessageVendorResult {
  target: MessageVendorTarget;
  chatThreadId: string;
}

/**
 * Reusable, backend-ready handler for the storefront "Message vendor" CTA.
 *
 * Routing rules (single thread per customer/vendor relationship):
 *  1. If the customer has an active order with this vendor → open that order chat.
 *  2. Else if a pre-order inquiry thread already exists → reopen it.
 *  3. Else → create a new pre-order inquiry thread and open it.
 *
 * NOTE: Today this uses local mock contexts (`useChats`, `useOrders`).
 * When swapping to Firebase / backend, replace the lookups below with
 * server queries on the `chatThreads` and `orders` collections. The
 * function signature and routing behavior should stay the same.
 */
export function useMessageVendor() {
  const router = useRouter();
  const { getConversationByPair, getOrCreateConversation, startNewInquiry } = useChats();
  const { orders } = useOrders();

  const findActiveOrder = useCallback(
    (vendorId: string, customerId: string): Order | undefined => {
      return orders
        .filter(
          (o) =>
            o.vendorId === vendorId &&
            o.customerId === customerId &&
            ACTIVE_ORDER_STATUSES.includes(o.status)
        )
        .sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime())[0];
    },
    [orders]
  );

  const handleMessageVendorPress = useCallback(
    (vendorId: string, customerId: string): MessageVendorResult | null => {
      if (!vendorId || !customerId) {
        console.warn('[useMessageVendor] Missing vendorId or customerId', { vendorId, customerId });
        return null;
      }

      // TODO(backend): replace with server lookup for active order
      const activeOrder = findActiveOrder(vendorId, customerId);

      if (activeOrder) {
        console.log('[useMessageVendor] Active order found, routing to order chat:', activeOrder.id);
        router.push({
          pathname: '/chat/order/[orderId]' as any,
          params: {
            orderId: activeOrder.id,
            publicOrderId: activeOrder.publicOrderId,
            vendorName: activeOrder.vendorName,
          },
        });
        return {
          chatThreadId: `chat-order-${activeOrder.id}`,
          target: {
            kind: 'order_chat',
            orderId: activeOrder.id,
            publicOrderId: activeOrder.publicOrderId,
            vendorName: activeOrder.vendorName,
          },
        };
      }

      // TODO(backend): replace with server query for existing thread
      const existing: Chat | undefined = getConversationByPair(vendorId, customerId);

      let chat: Chat;
      if (existing) {
        console.log('[useMessageVendor] Reusing existing pre-order thread:', existing.id);
        // If the existing thread was for a completed/expired order, mark a new inquiry
        const lastMsg = existing.messages[existing.messages.length - 1];
        const lastActivityTime = lastMsg ? new Date(lastMsg.timestamp).getTime() : 0;
        const isExpired = !!lastMsg && Date.now() - lastActivityTime > 72 * 60 * 60 * 1000;
        const isClosedOrderThread = existing.chatType === 'order_chat' && !existing.vendorCanReply;
        if (isExpired || isClosedOrderThread) {
          startNewInquiry(vendorId);
        }
        chat = existing;
      } else {
        const vendorName =
          mockVendors.find((v) => v.id === vendorId)?.name ?? 'Vendor';
        chat = getOrCreateConversation(vendorId, vendorName, 'pre_order_inquiry');
        console.log('[useMessageVendor] Created new pre-order thread:', chat.id);
      }

      router.push(`/chat/pre-order/${vendorId}` as any);

      return {
        chatThreadId: chat.id,
        target: {
          kind: 'pre_order_inquiry',
          vendorId,
          chatThreadId: chat.id,
        },
      };
    },
    [findActiveOrder, getConversationByPair, getOrCreateConversation, startNewInquiry, router]
  );

  return { handleMessageVendorPress };
}
