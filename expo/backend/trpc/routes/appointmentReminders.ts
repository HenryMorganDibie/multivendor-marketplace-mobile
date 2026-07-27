import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const appointmentRemindersRouter = createTRPCRouter({
  trackScheduled: publicProcedure
    .input(
      z.object({
        orderId: z.string(),
        customerId: z.string().optional(),
        vendorId: z.string(),
        scheduledTime: z.string(),
        reminderType: z.enum(["24h", "6h"]),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[AppointmentReminders] Reminder scheduled:", {
        orderId: input.orderId,
        vendorId: input.vendorId,
        customerId: input.customerId,
        reminderType: input.reminderType,
        scheduledTime: input.scheduledTime,
      });

      return {
        success: true,
        tracked: true,
      };
    }),

  markSent: publicProcedure
    .input(
      z.object({
        orderId: z.string(),
        customerId: z.string().optional(),
        vendorId: z.string(),
        reminderType: z.enum(["24h", "6h"]),
        recipient: z.enum(["customer", "vendor"]),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[AppointmentReminders] Reminder sent:", {
        orderId: input.orderId,
        vendorId: input.vendorId,
        customerId: input.customerId,
        reminderType: input.reminderType,
        recipient: input.recipient,
      });

      return {
        success: true,
      };
    }),
});
