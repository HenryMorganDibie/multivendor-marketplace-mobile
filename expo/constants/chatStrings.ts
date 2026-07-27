/** Reusable string constants for chat screens across the app. */

export const CHAT_INPUT_PLACEHOLDERS = {
  default: 'Type a message...',
  messagingUnavailable: 'Messaging unavailable',
  messagingUnavailableUnderReview: 'Messaging unavailable while under review',
  unblockToSend: 'Unblock to send messages',
  chatNoLongerAvailable: 'Chat is no longer available',
  followUpMessage: 'Send a follow-up message...',
  conversationExpired: 'This conversation has expired',
} as const;

export const CHAT_BANNERS = {
  blockedSelf: 'You’ve blocked this user. Unblock to send messages.',
  blockedOther: 'Messaging is unavailable.',
  vendorSuspended: 'This vendor has been suspended and cannot receive messages.',
  vendorUnavailable: 'This vendor is currently unavailable.',
  vendorUnderReview: 'This vendor is under review. Messaging is limited.',
  limitedClarifications: 'Messaging is limited to order clarifications only.',
  businessHoursHint: 'Vendor may respond during business hours.',
  conversationExpired: 'This pre-order conversation has expired after 72 hours of inactivity.',
} as const;

export const CHAT_HEADER_SUBTITLES = {
  preOrderInquiry: 'Pre-order inquiry',
  orderConversation: 'Order conversation',
} as const;

export const CHAT_EMPTY_STATES = {
  preOrderInquiry: 'Start your conversation with this vendor.',
  noMessages: 'No messages yet. Say hello!',
  askBeforeOrdering: 'Ask questions before placing your order.',
  orderConversationDescription: (vendorName: string) =>
    `Start your conversation with ${vendorName} about this order.`,
} as const;

export const CHAT_DIVIDERS = {
  newInquiry: 'New Inquiry',
  conversationEnded: 'This conversation has ended.',
} as const;

/** Returns up to 2 uppercase initials from a display name. */
export const getAvatarInitials = (name: string): string => {
  const parts = name.trim().split(' ').filter((p) => p.length > 0);
  if (parts.length === 0) return 'V';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};
