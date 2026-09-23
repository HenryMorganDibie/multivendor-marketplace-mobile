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
 * The backend's pickup-details payload (PickupDetailsPayload, functions/src/
 * types3.ts) is a structured object: a nested `pickupAddress` with
 * street/unit/area/state/country fields, plus top-level `pickupInstructions`/
 * `pickupContactPhone`/`pickupVerificationCode`. The chat card the app
 * already renders (PickupDetailsData, mocks/chatData.ts) expects a flat
 * `address` string plus `instructions`/`contactPhone`/`verificationCode`.
 *
 * Previously this field was cast straight through with no translation, so
 * every field the card reads (`data.address`, `data.instructions`, ...)
 * resolved to undefined against a real backend-sent message and the customer
 * saw an empty pickup-details card. This is the single boundary that composes
 * the flat presentation shape from the canonical payload, so the render code
 * does not need to know the backend's field names.
 */
interface PickupAddressLike {
  streetAddress?: string;
  unitSuite?: string | null;
  areaName?: string;
  stateName?: string;
  countryName?: string;
}

interface PickupDetailsPayloadLike {
  pickupAddress?: PickupAddressLike | null;
  pickupInstructions?: string | null;
  pickupContactPhone?: string | null;
  pickupVerificationCode?: string | null;
}

function mapPickupDetailsData(raw: unknown): ChatMessage['pickupDetailsData'] {
  const payload = raw as PickupDetailsPayloadLike | undefined | null;
  const addr = payload?.pickupAddress;
  if (!addr?.streetAddress) return undefined;

  const areaLine = [addr.areaName, addr.stateName].filter((part) => !!part && part.trim() !== '').join(', ');
  const address = [addr.streetAddress, addr.unitSuite, areaLine, addr.countryName]
    .filter((part): part is string => !!part && part.trim() !== '')
    .join(', ');

  return {
    address,
    instructions: payload?.pickupInstructions?.trim() || undefined,
    contactPhone: payload?.pickupContactPhone?.trim() || undefined,
    verificationCode: payload?.pickupVerificationCode?.trim() || undefined,
  };
}

/**
 * The backend's chatType values against the app's. The backend never
 * distinguishes pre-order from order-linked chat by chatType — both are
 * "commerce" (see createCommerceConversation.ts/injectOrderContext.ts, which
 * reuse the same thread for a customer/vendor pair rather than opening a new
 * one per order) — so that split has to come from whether the thread has any
 * relatedOrderIds yet. Anything unrecognised falls back to a pre-order
 * inquiry rather than throwing, because an unknown kind should still show
 * its messages.
 *
 * Kept as a pre-computed `hasOrder` boolean rather than taking the raw
 * relatedOrderIds array directly (an incoming branch tried the latter,
 * alongside reading a scalar data.orderId that the backend never writes -
 * createCommerceConversation.ts/injectOrderContext.ts only ever populate
 * relatedOrderIds via arrayUnion, confirmed directly against the backend
 * source - so that version's orderId would always resolve to undefined).
 */
function mapChatType(raw: unknown, hasOrder: boolean): ChatType {
  switch (raw) {
    case 'commerce':
      return (hasOrder ? 'order_chat' : 'pre_order_inquiry') as ChatType;
    case 'order_chat':
    case 'order':
      return 'order_chat' as ChatType;
    case 'ai_help':
      return 'ai_help' as ChatType;
    case 'support':
      return 'support' as ChatType;
    default:
      return 'pre_order_inquiry' as ChatType;
  }
}

/**
 * sendChatMessage (functions/src/chat/sendChatMessage.ts) writes
 * catalogItemData as { itemId, name, basePrice, salePrice, currency,
 * thumbnailUrl } — the real catalog item's own field names, snapshotted
 * server-side. The app's CatalogItemData shape (id, name, description,
 * price, image), read by CatalogItemBubble, uses different names for two of
 * those. This type was never actually exercised end-to-end before (nothing
 * sent a real catalog_item message), so the plain pass-through cast below it
 * replaced never got caught: it compiled, but at runtime `data.id`/`data.price`/
 * `data.image` would all read undefined for any real (non-mock) catalog_item
 * message.
 */
function mapCatalogItemData(raw: unknown): ChatMessage['catalogItemData'] {
  if (!raw || typeof raw !== 'object') return undefined;
  const d = raw as Record<string, unknown>;
  return {
    id: d.itemId as string | undefined,
    name: d.name as string,
    price: (d.salePrice as number | null | undefined) ?? (d.basePrice as number) ?? 0,
    image: (d.thumbnailUrl as string | null | undefined) ?? undefined,
  };
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
    pickupDetailsData: mapPickupDetailsData(data.pickupDetailsData),
    // catalogItemData is the one exception — see mapCatalogItemData above.
    catalogItemData: mapCatalogItemData(data.catalogItemData),
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
  // relatedOrderIds accumulates every order ever placed in this thread
  // (chatThreads never carries a scalar orderId); the last entry is the most
  // recently attached order, which is what the inbox/badge/navigation code
  // means by "this chat's order".
  const relatedOrderIds = Array.isArray(data.relatedOrderIds) ? (data.relatedOrderIds as string[]) : [];
  const orderId = relatedOrderIds.length > 0 ? relatedOrderIds[relatedOrderIds.length - 1] : undefined;

  return {
    id,
    vendorId: (data.vendorId as string) ?? '',
    vendorName: (data.vendorName as string) ?? '',
    customerId: (data.customerId as string) ?? undefined,
    customerName: (data.customerName as string) ?? undefined,
    orderId,
    chatType: mapChatType(data.chatType, relatedOrderIds.length > 0),
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
