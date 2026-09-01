import { useCallback } from 'react';
import { useRouter } from 'expo-router';
import { useChats } from '@/contexts/ChatContext';
import { useOrders } from '@/contexts/OrdersContext';
import { mockVendors } from '@/mocks/vendorData';
import type { Order, OrderStatus } from '@/mocks/ordersData';
import type { Chat } from '@/mocks/chatData';
import { auth, callable } from '@/lib/firebase';
import { DEV_LOCAL_AUTH_ENABLED } from '@/constants/devAuth';

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
    async (vendorId: string, customerId: string, vendorName?: string): Promise<MessageVendorResult | null> => {
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
        // mockVendors only ever matches the ten demo ids — for any real vendor
        // this silently fell back to the literal string 'Vendor' as the local
        // chat scaffold's display name. The caller (the storefront) already
        // has the real, live vendor object, so it passes vendorName through;
        // the mock lookup stays only as a last-resort fallback for any other
        // caller that doesn't.
        const resolvedVendorName =
          vendorName ?? mockVendors.find((v) => v.id === vendorId)?.name ?? 'Vendor';

        /**
         * createCommerceConversation has been deployed since this flow was
         * written and nothing called it. For a real signed-in customer this
         * creates the canonical `chatThreads` document server-side — the one
         * `sendChatMessage` actually writes into and the vendor's own
         * real-time listener actually sees — running the eligibility checks
         * (blocks, vendor active, country availability) up front rather than
         * only discovering a problem when the first message fails to send.
         *
         * Best-effort: if it fails (offline, vendor just went inactive), the
         * local scaffold below still opens so the customer sees a
         * conversation screen; the send path surfaces a real error the next
         * time a message is actually sent.
         */
        if (!DEV_LOCAL_AUTH_ENABLED || auth.currentUser) {
          try {
            const create = callable<{ vendorId: string }, { success: true; chatId: string; created: boolean }>(
              'createCommerceConversation',
            );
            await create({ vendorId });
          } catch (err) {
            console.error('[useMessageVendor] createCommerceConversation failed:', err);
          }
        }

        chat = getOrCreateConversation(vendorId, resolvedVendorName, 'pre_order_inquiry');
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
