export type PaymentState =
  | 'AWAITING_VENDOR_PAYMENT_DETAILS'
  | 'PAYMENT_DETAILS_SENT'
  | 'CUSTOMER_MARKED_PAID'
  | 'VENDOR_PAYMENT_CONFIRMED'
  | 'PAYMENT_REJECTED'
  | 'ORDER_READY'
  | 'ORDER_COMPLETED'
  | 'PAYMENT_UNDER_REVIEW';

export interface PaymentStateConfig {
  label: string;
  color: string;
  backgroundColor: string;
}

export const getPaymentStateConfig = (state: PaymentState): PaymentStateConfig => {
  switch (state) {
    case 'AWAITING_VENDOR_PAYMENT_DETAILS':
      return { label: 'Awaiting Payment Details', color: '#9CA3AF', backgroundColor: '#F3F4F6' };
    case 'PAYMENT_DETAILS_SENT':
      return { label: 'Payment Details Received', color: '#FF8C42', backgroundColor: 'rgba(255,140,66,0.1)' };
    case 'CUSTOMER_MARKED_PAID':
      return { label: 'Awaiting Vendor Confirmation', color: '#F59E0B', backgroundColor: '#FFFBEB' };
    case 'VENDOR_PAYMENT_CONFIRMED':
      return { label: 'Payment Confirmed', color: '#16A34A', backgroundColor: '#F0FDF4' };
    case 'PAYMENT_REJECTED':
      return { label: 'Payment Issue', color: '#DC2626', backgroundColor: '#FEF2F2' };
    case 'ORDER_READY':
      return { label: 'Order Ready', color: '#16A34A', backgroundColor: '#F0FDF4' };
    case 'ORDER_COMPLETED':
      return { label: 'Completed', color: '#16A34A', backgroundColor: '#F0FDF4' };
    case 'PAYMENT_UNDER_REVIEW':
      return { label: 'Under Review', color: '#F59E0B', backgroundColor: '#FFFBEB' };
  }
};

export const getPaymentStateShortLabel = (state: PaymentState): string => {
  switch (state) {
    case 'AWAITING_VENDOR_PAYMENT_DETAILS':
      return 'Awaiting details';
    case 'PAYMENT_DETAILS_SENT':
      return 'Pay now';
    case 'CUSTOMER_MARKED_PAID':
      return 'Confirming payment';
    case 'VENDOR_PAYMENT_CONFIRMED':
      return 'Paid';
    case 'PAYMENT_REJECTED':
      return 'Payment issue';
    case 'ORDER_READY':
      return 'Order ready';
    case 'ORDER_COMPLETED':
      return 'Completed';
    case 'PAYMENT_UNDER_REVIEW':
      return 'Under review';
  }
};
