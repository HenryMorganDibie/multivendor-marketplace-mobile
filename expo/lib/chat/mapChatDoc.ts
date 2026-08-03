import type { Chat, ChatMessage, ChatType, MessageType } from '@/mocks/chatData';

/**
 * Firestore chat documents into the shape the chat screens already read.
 *
 * The screens were written against `mocks/chatData`, and chatService documents
 * its own store as the seam a Firestore listener should drop in behind. This is
 * that mapping, kept in one place so neither the screens nor chatService need
 * to know the backend's field names.
 *
 * Two vocabularies have to meet. The backend stores `senderRole` as
 * customer/vendor/system/ai and message kinds as the MessageType union; the app
 * calls the first `sender`. They line up closely enough that this is a rename
 * rather than a translation, which is why the screens need no changes.
 */

type Timestampish = { toDate: () => Date } | { seconds: number } | string | null | undefined;

function toIso(value: Timestampish): string {
  if (!value) return new Date().toISOString();
  if (typeof value === 'string') return value;
  if (typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  const seconds = (value as { seconds?: number }).seconds;
  return typeof seconds === 'number'
    ? new Date(seconds * 1000).toISOString()
    : new Date().toISOString();
}

/**
 * The backend's chatType values against the app's. `inquiry` and
 * `pre_order_inquiry` are the same conversation under two names; anything
 * unrecognised falls back to a pre-order inquiry rather than throwing, because
 * an unknown kind should still show its messages.
 */
function mapChatType(raw: unknown): ChatType {
  switch (raw) {
    case 'order_chat':
    case 'order':
      return 'order_chat' as ChatType;
    case 'support':
      return 'support' as ChatType;
    default:
      return 'pre_order_inquiry' as ChatType;
  }
}

export function mapMessageDoc(id: string, data: Record<string, unknown>): ChatMessage {
  const role = data.senderRole as string | undefined;

  return {
    id,
    type: (data.type as MessageType) ?? 'text',
    content: (data.content as string) ?? '',
    sender:
      role === 'vendor' || role === 'customer' || role === 'ai' ? role : 'system',
    timestamp: toIso(data.createdAt as Timestampish),

    // Passed through as stored. Each is server-assembled — a client cannot
    // write an invoice or receipt card directly — so re-deriving anything here
    // would risk showing something other than what was actually sent.
    contactCardData: (data.contactCardData as ChatMessage['contactCardData']) ?? undefined,
    paymentRequestData: (data.paymentRequestData as ChatMessage['paymentRequestData']) ?? undefined,
    pickupDetailsData: (data.pickupDetailsData as ChatMessage['pickupDetailsData']) ?? undefined,
    catalogItemData: (data.catalogItemData as ChatMessage['catalogItemData']) ?? undefined,
    receiptData: (data.receiptData as ChatMessage['receiptData']) ?? undefined,
    invoiceData: (data.invoiceData as ChatMessage['invoiceData']) ?? undefined,
    orderContextData: (data.orderContextData as ChatMessage['orderContextData']) ?? undefined,
    changeRequestData: (data.changeRequestData as ChatMessage['changeRequestData']) ?? undefined,

    status: 'sent',
  };
}

export function mapChatThreadDoc(
  id: string,
  data: Record<string, unknown>,
  messages: ChatMessage[],
): Chat {
  return {
    id,
    vendorId: (data.vendorId as string) ?? '',
    vendorName: (data.vendorName as string) ?? '',
    customerId: (data.customerId as string) ?? undefined,
    customerName: (data.customerName as string) ?? undefined,
    orderId: (data.orderId as string) ?? undefined,
    chatType: mapChatType(data.chatType),
    messages,
    createdAt: toIso(data.createdAt as Timestampish),
    lastActivityAt: toIso((data.lastMessageAt ?? data.updatedAt ?? data.createdAt) as Timestampish),

    // Whether the vendor may reply is decided by the backend — a blocked
    // customer, a closed thread, a suspended vendor. Defaulting to true would
    // put a working composer in front of somebody whose message will bounce.
    vendorCanReply: data.vendorCanReply !== false,
    vendorDisabledReason: (data.vendorDisabledReason as string) ?? undefined,
  };
}
