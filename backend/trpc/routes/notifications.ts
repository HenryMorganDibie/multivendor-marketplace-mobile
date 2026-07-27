import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const notificationsRouter = createTRPCRouter({
  sendChatPush: publicProcedure
    .input(z.object({
      vendorId: z.string(),
      chatId: z.string(),
      chatType: z.enum(['PREORDER_CHAT', 'ORDER_CHAT']),
      senderRole: z.enum(['customer', 'vendor']),
      messagePreview: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      console.log('[Notifications] Chat push requested:', {
        chatId: input.chatId,
        chatType: input.chatType,
        senderRole: input.senderRole,
      });

      return {
        success: true,
        pushed: true,
        reason: 'simulated',
      };
    }),
});
