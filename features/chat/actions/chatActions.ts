import { validateChatMessage } from '@/utils/chatValidation';
import { useInbox } from '@/contexts/InboxContext';
import { MOCK_VENDOR_ID } from '@/mocks/inboxData';

export type SendMessageParams = {
  messageText: string;
  chatId: string;
  orderId: string;
  clearDraft: (chatId: string) => void;
  updateInboxAfterMessage: ReturnType<typeof useInbox>['updateInboxAfterMessage'];
  vendorInbox: ReturnType<typeof useInbox>['vendorInbox'];
  onSuccess: () => void;
  onValidationError: (error: string) => void;
};

export const sendVendorChatMessage = ({
  messageText,
  chatId,
  orderId,
  clearDraft,
  updateInboxAfterMessage,
  vendorInbox,
  onSuccess,
  onValidationError,
}: SendMessageParams): void => {
  const trimmed = messageText.trim();
  if (!trimmed) return;

  const validation = validateChatMessage(trimmed);
  if (!validation.isValid) {
    console.log('[VENDOR CHAT] Validation failed:', validation.errorMessage);
    onValidationError(validation.errorMessage || 'Invalid message');
    return;
  }

  console.log('[VENDOR ORDER CHAT] Vendor sending message:', trimmed);
  clearDraft(chatId);
  onSuccess();

  const conv = vendorInbox.find((item) => item.orderId === orderId);
  if (conv) {
    updateInboxAfterMessage({
      conversationId: conv.conversationId,
      lastMessageText: trimmed,
      lastSenderId: MOCK_VENDOR_ID,
      senderRole: 'vendor',
    });
    console.log('[VENDOR ORDER CHAT] Inbox snapshot updated:', conv.conversationId);
  }
};
