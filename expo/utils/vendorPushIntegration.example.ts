import { useVendorPushNotifications } from '@/contexts/VendorPushNotificationContext';
import { useVendorQuietHours } from '@/contexts/VendorQuietHoursContext';

export function useSendVendorChatMessage() {
  const { sendChatMessagePush } = useVendorPushNotifications();
  const { shouldSuppressNotification } = useVendorQuietHours();

  const sendMessage = async (params: {
    vendorId: string;
    chatId: string;
    chatType: 'PREORDER_CHAT' | 'ORDER_CHAT';
    messageContent: string;
  }) => {
    const notificationType = 
      params.chatType === 'PREORDER_CHAT' 
        ? 'preorder_chat_message' 
        : 'order_chat_message';

    await sendChatMessagePush({
      vendorId: params.vendorId,
      chatId: params.chatId,
      chatType: params.chatType,
      senderRole: 'customer',
      notificationType,
      shouldSuppressQuietHours: shouldSuppressNotification,
    });
  };

  return { sendMessage };
}
