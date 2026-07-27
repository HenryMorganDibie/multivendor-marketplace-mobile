import type { Order, OrderStatus, PaymentStatus, BackendPaymentStatus } from '@/types/domain';
import { toBackendPaymentStatus } from '@/utils/orderDisplay';

/**
 * orderMapper — converts raw order records into the domain `Order` shape and
 * exposes the order/payment status translation at the boundary.
 *
 * SCAFFOLD ONLY. Mock orders already match `Order`, so `fromRaw` is a
 * normalization pass. The payment-status helpers reuse the shared domain
 * translation so screens read backend-consistent payment names.
 *
 * TODO(Henry): map Firestore `orders/{orderId}` documents (FieldValue
 * timestamps → ISO strings) into this shape.
 */
export type RawOrder = Record<string, unknown>;

export const orderMapper = {
  /** Raw order record → domain `Order`. */
  fromRaw(raw: RawOrder): Order {
    const order = raw as unknown as Order;
    return {
      ...order,
      items: Array.isArray(order.items) ? order.items : [],
    };
  },

  /** Domain `Order` → raw record for persistence. */
  toRaw(order: Order): RawOrder {
    return { ...order };
  },

  /** The order's progress status. */
  statusOf(order: Order): OrderStatus {
    return order.status as OrderStatus;
  },

  /** The order's payment status in backend-canonical form. */
  backendPaymentStatus(order: Order): BackendPaymentStatus {
    return toBackendPaymentStatus(order.paymentStatus as PaymentStatus) as BackendPaymentStatus;
  },
};
