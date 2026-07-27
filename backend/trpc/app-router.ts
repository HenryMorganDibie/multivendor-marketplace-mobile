import { createTRPCRouter } from "./create-context";
import { notificationsRouter } from "./routes/notifications";
import { abandonedCartRouter } from "./routes/abandonedCart";
import { appointmentRemindersRouter } from "./routes/appointmentReminders";

export const appRouter = createTRPCRouter({
  notifications: notificationsRouter,
  abandonedCart: abandonedCartRouter,
  appointmentReminders: appointmentRemindersRouter,
});

export type AppRouter = typeof appRouter;
