import * as z from "zod";
import { createTRPCRouter, publicProcedure } from "../create-context";

export const abandonedCartRouter = createTRPCRouter({
  trackAbandonment: publicProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        vendorId: z.string(),
        vendorName: z.string(),
        itemCount: z.number(),
        lastUpdated: z.number(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[AbandonedCart] Cart abandonment tracked:", {
        userId: input.userId,
        vendorId: input.vendorId,
        vendorName: input.vendorName,
        itemCount: input.itemCount,
        lastUpdated: new Date(input.lastUpdated).toISOString(),
      });

      return {
        success: true,
        tracked: true,
      };
    }),

  markRecovered: publicProcedure
    .input(
      z.object({
        userId: z.string().optional(),
        vendorId: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      console.log("[AbandonedCart] Cart recovered after abandonment:", {
        userId: input.userId,
        vendorId: input.vendorId,
      });

      return {
        success: true,
      };
    }),
});
