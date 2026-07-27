import { ChatMessage } from '@/mocks/chatData';

export const formatScheduledDate = (dateStr: string): string => {
  try {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

export const getCustomerFirstName = (fullName?: string): string => {
  if (!fullName) return 'Customer';
  return fullName.trim().split(' ')[0] || 'Customer';
};

export const formatTime = (timestamp: string): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatTimestampDivider = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  if (isToday) return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  if (isYesterday) return 'Yesterday · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' + date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

export const transformSystemMessageForVendor = (content: string, customerFirstName: string): string | null => {
  if (content === 'Order request sent') return `${customerFirstName} sent an order request`;
  if (content === 'Your order request has been sent. The vendor will review and confirm availability.') return `${customerFirstName} sent an order request`;
  if (content === 'Order accepted') return `You accepted ${customerFirstName}'s order`;
  if (content === 'Order rejected') return `You rejected ${customerFirstName}'s order`;
  if (content === 'Order declined') return `You declined ${customerFirstName}'s order`;
  if (content === 'Order ready') return 'You marked this order as ready';
  if (content === 'Order completed') return 'You marked this order as completed';
  if (content === 'Order cancelled') return `${customerFirstName} cancelled this order`;
  if (content === 'Order cancelled by customer') return `${customerFirstName} cancelled this order`;
  if (content === 'Payment confirmed') return 'You confirmed this payment';
  if (content === 'Payment sent') return `${customerFirstName} marked payment as sent`;
  if (content === 'Payment marked as sent') return `${customerFirstName} marked payment as sent`;

  if (content.includes('accepted your order request')) return `You accepted ${customerFirstName}'s order`;
  if (content.includes('confirmed payment') || content.includes('confirmed your payment')) return 'You confirmed this payment';
  if (content.includes('marked your order as ready') || content.includes('marked this order as ready')) return 'You marked this order as ready';
  if (content.includes('marked this order as completed') || content.includes('marked your order as completed')) return 'You marked this order as completed';
  if (content.includes('cancelled your order') && !content.includes(customerFirstName)) return `${customerFirstName} cancelled this order`;
  if (content.includes('declined your order request')) return `You declined ${customerFirstName}'s order`;
  if (content.includes('is currently fulfilling')) return `You are fulfilling ${customerFirstName}'s order`;
  if (content.includes('has received your request') || content.includes('Order request sent')) return `${customerFirstName} sent an order request`;
  if (content.includes('marked payment as sent')) return `${customerFirstName} marked payment as sent`;
  if (content.includes('been cancelled')) return `${customerFirstName} cancelled this order`;

  return content;
};

export const shouldShowPinnedCard = (o: { status: string; completedAt?: string }): boolean => {
  const activeStatuses = ['accepted', 'confirmed', 'in_progress'];
  if (activeStatuses.includes(o.status)) return true;
  if (o.status === 'completed' && o.completedAt) {
    const completedAt = new Date(o.completedAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return completedAt > sevenDaysAgo;
  }
  return false;
};

export const getExistingPaymentRequest = (messages: ChatMessage[]): ChatMessage | null => {
  const paymentMessages = messages.filter(
    (m) => m.type === 'payment-request' && m.paymentRequestData
  );
  if (paymentMessages.length === 0) return null;
  const lastPayment = paymentMessages[paymentMessages.length - 1];
  if (lastPayment.paymentRequestData?.status === 'confirmed') return null;
  return lastPayment;
};

export const GROUP_TIME_THRESHOLD_MS = 3 * 60 * 1000;
export const TIMESTAMP_DIVIDER_THRESHOLD_MS = 5 * 60 * 1000;

export type MessageGroupInfo = {
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
};

export const buildMessageGroups = (
  msgs: ChatMessage[]
): Array<{ message: ChatMessage; groupInfo: MessageGroupInfo; showDivider: boolean }> => {
  return msgs.map((msg, i) => {
    const prev = i > 0 ? msgs[i - 1] : null;
    const next = i < msgs.length - 1 ? msgs[i + 1] : null;
    const msgTime = new Date(msg.timestamp).getTime();
    const prevTime = prev ? new Date(prev.timestamp).getTime() : 0;
    const nextTime = next ? new Date(next.timestamp).getTime() : 0;

    const showDivider = !prev || msgTime - prevTime > TIMESTAMP_DIVIDER_THRESHOLD_MS;
    const isTextMsg = msg.type === 'text';
    const isSameSenderAsPrev = !!(
      prev?.sender === msg.sender &&
      prev?.type === 'text' &&
      isTextMsg &&
      msgTime - prevTime <= GROUP_TIME_THRESHOLD_MS
    );
    const isSameSenderAsNext = !!(
      next?.sender === msg.sender &&
      next?.type === 'text' &&
      isTextMsg &&
      nextTime - msgTime <= GROUP_TIME_THRESHOLD_MS
    );

    return {
      message: msg,
      groupInfo: {
        isFirstInGroup: !isSameSenderAsPrev,
        isLastInGroup: !isSameSenderAsNext,
      },
      showDivider,
    };
  });
};

export const getInitials = (name: string): string => {
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};

export const formatOrderStatusLabel = (status: string): { label: string; color: string; bgColor: string } => {
  switch (status) {
    case 'accepted':
    case 'confirmed':
      return { label: 'Confirmed', color: '#FF8C42', bgColor: 'rgba(255,140,66,0.1)' };
    case 'in_progress':
      return { label: 'In Progress', color: '#FF8C42', bgColor: 'rgba(255,140,66,0.1)' };
    case 'completed':
      return { label: 'Completed', color: '#22C55E', bgColor: '#F0FDF4' };
    default:
      return { label: 'Pending', color: '#9CA3AF', bgColor: '#F9FAFB' };
  }
};

export const formatOrderStatus = (status: string): string => {
  switch (status) {
    case 'ORDER_REQUESTED': return 'Order Requested';
    case 'CONFIRMED': return 'Confirmed';
    case 'READY': return 'Ready';
    case 'COMPLETED': return 'Completed';
    case 'CANCELLED': return 'Cancelled';
    case 'accepted': return 'Confirmed';
    case 'in_progress': return 'In Progress';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
};
