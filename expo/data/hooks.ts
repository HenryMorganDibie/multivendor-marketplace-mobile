import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as api from '@/data/api';
import type { CreateOrderPayload } from '@/types/domain';
import type { OrderStatus } from '@/mocks/ordersData';
import { useOrders as useOrdersContext } from '@/contexts/OrdersContext';
import { useInbox } from '@/contexts/InboxContext';
import { useChats } from '@/contexts/ChatContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchLatestStatusReason } from '@/lib/orders/fetchLatestStatusReason';

export function useVendor(username: string) {
  return useQuery({
    queryKey: ['vendor', username],
    queryFn: () => api.getVendorByUsername(username),
    enabled: !!username,
    staleTime: 1000 * 60 * 5,
  });
}

export function useAllVendors(countryCode?: string, region?: string) {
  return useQuery({
    queryKey: ['vendors', 'all', countryCode, region],
    queryFn: () => api.getAllVendors(countryCode, region),
    staleTime: 1000 * 60 * 5,
  });
}

export function useVendorsByCategory(category: string, countryCode?: string, region?: string) {
  return useQuery({
    queryKey: ['vendors', 'category', category, countryCode, region],
    queryFn: () => api.getVendorsByCategory(category, countryCode, region),
    enabled: !!category,
    staleTime: 1000 * 60 * 5,
  });
}

export function useOpenNowVendors(countryCode?: string, region?: string) {
  return useQuery({
    queryKey: ['vendors', 'open-now', countryCode, region],
    queryFn: () => api.getOpenNowVendors(countryCode, region),
    staleTime: 1000 * 60 * 2,
  });
}

export function useVendorsNearYou(countryCode?: string, region?: string, city?: string) {
  return useQuery({
    queryKey: ['vendors', 'near-you', countryCode, region, city],
    queryFn: () => api.getVendorsNearYou(countryCode, region, city),
    staleTime: 1000 * 60 * 5,
  });
}

export function useVendorMenu(vendorId: string) {
  return useQuery({
    queryKey: ['vendor-menu', vendorId],
    queryFn: () => api.getVendorMenu(vendorId),
    enabled: !!vendorId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useOrders() {
  return useQuery({
    queryKey: ['orders'],
    queryFn: api.getOrders,
    staleTime: 1000 * 30,
  });
}

export function useCustomerCarts() {
  return useQuery({
    queryKey: ['customer-carts'],
    queryFn: api.getCustomerCarts,
    staleTime: 0,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => api.createOrder(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      console.log('[hooks] Order created — invalidated orders cache');
    },
    onError: (error) => {
      console.error('[hooks] createOrder failed:', error);
    },
  });
}

export function useSubmitOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateOrderPayload) => api.submitOrder(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
      console.log('[hooks] Order submitted — invalidated orders cache');
    },
    onError: (error) => {
      console.error('[hooks] submitOrder failed:', error);
    },
  });
}

export function useAcceptOrder() {
  const { applyConfirmedStatus, isDemoOrderAccount, getOrder } = useOrdersContext();
  const { user } = useAuth();
  const { getOrCreateConversation, convertInboxToOrder } = useInbox();
  const { convertToOrderChat } = useChats();
  return useMutation({
    mutationFn: (orderId: string) =>
      isDemoOrderAccount(user?.id)
        ? Promise.resolve({ orderId, newStatus: 'accepted' as const })
        : api.acceptOrder(orderId),
    onSuccess: (data, orderId) => {
      console.log('[hooks] acceptOrder success:', data.orderId);
      applyConfirmedStatus(data.orderId, data.newStatus);

      const order = getOrder(orderId);
      if (order) {
        if (!order.customerId) {
          // customerId is optional on Order, but a real accepted order always
          // has one — this used to fall back to a hardcoded 'customer_mock',
          // which wrote that fake id into BOTH participants' real inbox
          // conversation records (lastSenderId), corrupting inbox metadata
          // for the customer's own accepted order. Skip the conversion
          // instead of writing a fake identity into real data.
          console.error('[hooks] acceptOrder: order has no customerId, skipping chat/inbox conversion:', order.id);
          return;
        }
        const customerId = order.customerId;
        const fulfillmentType = (order.fulfillmentType?.toLowerCase() === 'delivery' ? 'delivery' : 'pickup') as 'pickup' | 'delivery';

        console.log('[hooks] Converting inquiry chat to order chat for order:', order.id);

        convertToOrderChat(order.vendorId, customerId, {
          orderId: order.id,
          orderStatus: 'accepted',
          orderType: fulfillmentType,
          createdAt: new Date().toISOString(),
        });

        convertInboxToOrder(order.vendorId, customerId, order.id);

        getOrCreateConversation({
          conversationType: 'order',
          vendorId: order.vendorId,
          customerId,
          orderId: order.id,
          title: order.vendorName,
          role: 'customer',
        });

        getOrCreateConversation({
          conversationType: 'order',
          vendorId: order.vendorId,
          customerId,
          orderId: order.id,
          title: order.customerName ?? 'Customer',
          role: 'vendor',
        });

        console.log('[hooks] Inquiry chat converted to order chat for both participants');
      }
    },
    onError: (error) => {
      console.error('[hooks] acceptOrder failed:', error);
    },
  });
}

export function useRejectOrder() {
  const { applyConfirmedStatus, isDemoOrderAccount } = useOrdersContext();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) =>
      isDemoOrderAccount(user?.id)
        ? Promise.resolve({ orderId, newStatus: 'rejected' as const, reason })
        : api.rejectOrder(orderId, reason),
    onSuccess: (data) => {
      console.log('[hooks] rejectOrder success:', data.orderId);
      applyConfirmedStatus(data.orderId, data.newStatus, data.reason);
    },
    onError: (error) => {
      console.error('[hooks] rejectOrder failed:', error);
    },
  });
}

export function useMarkOrderPaid() {
  const { updateOrderStatus } = useOrdersContext();
  return useMutation({
    mutationFn: (orderId: string) => api.markOrderPaid(orderId),
    onSuccess: (data) => {
      console.log('[hooks] markOrderPaid success:', data.orderId);
      updateOrderStatus(data.orderId, data.newStatus);
    },
    onError: (error) => {
      console.error('[hooks] markOrderPaid failed:', error);
    },
  });
}

export function useMarkInProgress() {
  const { applyConfirmedStatus, isDemoOrderAccount } = useOrdersContext();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (orderId: string) =>
      isDemoOrderAccount(user?.id)
        ? Promise.resolve({ orderId, newStatus: 'in_progress' as const })
        : api.markInProgress(orderId),
    onSuccess: (data) => {
      console.log('[hooks] markInProgress success:', data.orderId);
      applyConfirmedStatus(data.orderId, data.newStatus);
    },
    onError: (error) => {
      console.error('[hooks] markInProgress failed:', error);
    },
  });
}

export function useCompleteOrder() {
  const { applyConfirmedStatus, isDemoOrderAccount } = useOrdersContext();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (orderId: string) =>
      isDemoOrderAccount(user?.id)
        ? Promise.resolve({ orderId, newStatus: 'completed' as const })
        : api.completeOrder(orderId),
    onSuccess: (data) => {
      console.log('[hooks] completeOrder success:', data.orderId);
      applyConfirmedStatus(data.orderId, data.newStatus);
    },
    onError: (error) => {
      console.error('[hooks] completeOrder failed:', error);
    },
  });
}

export function useCancelOrder() {
  const { applyConfirmedStatus, isDemoOrderAccount } = useOrdersContext();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ orderId, reason, reasonCode, reasonText }: { orderId: string; reason?: string; reasonCode?: string; reasonText?: string }) =>
      isDemoOrderAccount(user?.id)
        ? Promise.resolve({ orderId, newStatus: 'cancelled' as const, reason, reasonCode, reasonText })
        : api.cancelOrder(orderId, reason, reasonCode, reasonText),
    onSuccess: (data) => {
      console.log('[hooks] cancelOrder success:', data.orderId);
      applyConfirmedStatus(data.orderId, data.newStatus, data.reason, data.reasonCode, data.reasonText);
    },
    onError: (error) => {
      console.error('[hooks] cancelOrder failed:', error);
    },
  });
}

/**
 * The durable rejection/cancellation reason for one order, sourced from the
 * backend's order-events subcollection rather than any locally-decorated
 * field -- mapOrderDoc never maps rejectionReason/cancellationReason* (no
 * such field exists on the order document), so a value set only in local
 * state is wiped by the very next Firestore snapshot for this or any
 * sibling order under the same query. This re-derives it independently of
 * OrdersContext's listener, from data that is already durably persisted and
 * already readable under current Firestore rules.
 *
 * Scoped by uid in the query key because the app's single, process-lifetime
 * QueryClient is never cleared on logout -- without this, a cached result
 * could otherwise be served across an account switch in the same session.
 *
 * staleTime/gcTime: Infinity because the source event is for a terminal
 * order status; nothing can ever change it again (see
 * fetchLatestStatusReason's determinism note), so there is nothing to gain
 * from ever refetching within the same app process.
 */
export function useOrderStatusReason(orderId: string | undefined, status: OrderStatus | undefined) {
  const { user } = useAuth();
  const { isDemoOrderAccount } = useOrdersContext();
  const isTerminalReasonStatus = status === 'rejected' || status === 'cancelled';
  const uid = user?.id;

  return useQuery({
    queryKey: ['orderStatusReason', uid, orderId],
    queryFn: () => fetchLatestStatusReason(orderId as string, status as 'rejected' | 'cancelled'),
    // Demo orders have no backend document to read events from -- skip the
    // query outright rather than let it run and return nothing.
    enabled: !!uid && !isDemoOrderAccount(uid) && !!orderId && isTerminalReasonStatus,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}
