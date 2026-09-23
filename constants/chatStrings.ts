/**
 * Centralized chat-surface strings.
 *
 * All banner, placeholder, fallback, divider and chat-type label strings used
 * across the customer + vendor chat screens are defined here so we have a
 * single source of truth that is easy to localize / swap when the backend
 * arrives. New chat screens should import from this map rather than inlining
 * literal strings.
 *
 * Backend-ready: keys are stable and intent-named; values can later be replaced
 * by an i18n lookup without touching the call-sites.
 */

export const CHAT_TYPE_LABELS = {
  pre_order_inquiry: 'Inquiry',
  order_chat: 'Order chat',
} as const;

export type ChatTypeKey = keyof typeof CHAT_TYPE_LABELS;

export const CHAT_INPUT_PLACEHOLDERS = {
  default: 'Send a message…',
  messagingUnavailable: 'Messaging unavailable',
  messagingUnavailableUnderReview: 'Messaging unavailable — order under review',
  unblockToSend: 'Unblock to send messages',
  conversationExpired: 'Conversation expired',
  chatNoLongerAvailable: 'Chat is no longer available',
  followUpMessage: 'Send a follow-up message…',
} as const;

export const CHAT_BANNERS = {
  blockedSelf: "You've blocked this user. You can unblock them in Settings.",
  vendorSuspended: 'This vendor is temporarily unavailable.',
  vendorUnavailable: 'This vendor is currently unavailable.',
  vendorUnderReview:
    'This order is temporarily under review.\nThe vendor is currently unavailable. Platform support has been notified.',
  limitedClarifications: 'This vendor accepts messages for order clarifications only.',
  businessHoursHint: 'Vendor may respond during business hours.',
  conversationExpired:
    'This conversation has expired due to inactivity.\nStart a new conversation or create an order to continue.',
  pendingOrderReadOnly: 'Chat will be available after you accept the order',
  completedOrderReadOnly: 'This order is completed. Chat is read-only.',
  declinedOrderReadOnly: 'This order was declined. Chat is read-only.',
} as const;

export const CHAT_DIVIDERS = {
  newInquiry: 'New Inquiry',
  orderStarted: 'Order started',
  conversationEnded: 'Conversation ended',
} as const;

export const CHAT_HEADER_SUBTITLES = {
  preOrderInquiry: 'Pre-order inquiry',
  orderConversation: 'Order conversation',
} as const;

export const CHAT_EMPTY_STATES = {
  noMessages: 'No messages yet',
  startConversation: 'Start your conversation with this vendor.',
  askBeforeOrdering: 'Ask questions before placing an order.',
  orderConversationDescription: (vendorName: string): string =>
    `Your conversation with ${vendorName} will appear here.`,
} as const;

export const CHAT_FALLBACKS = {
  vendor: 'Vendor',
  customer: 'Customer',
  avatarInitial: '?',
} as const;

/**
 * Returns the small badge label for a chat type.
 * Use this rather than inlining the literal "Inquiry" / "Order chat" strings.
 */
export const getChatTypeLabel = (key: ChatTypeKey): string => CHAT_TYPE_LABELS[key];

/**
 * Returns a dynamic 1-2 letter initial for a display name; falls back to
 * `CHAT_FALLBACKS.avatarInitial` when no usable characters are available.
 * Prefer this over hardcoding a literal letter (e.g. "V" or "C").
 */
export const getAvatarInitials = (name: string | undefined | null): string => {
  if (!name) return CHAT_FALLBACKS.avatarInitial;
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return CHAT_FALLBACKS.avatarInitial;
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
