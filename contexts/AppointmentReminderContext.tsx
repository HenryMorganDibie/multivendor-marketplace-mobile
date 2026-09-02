import createContextHook from '@nkzw/create-context-hook';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useOrders } from './OrdersContext';
import type { Order } from '@/mocks/ordersData';

const REMINDER_SENT_KEY = '@platform_appointment_reminders_sent';
const TERMINAL_STATUSES = ['completed', 'rejected', 'cancelled', 'expired'];

export const APPOINTMENT_REMINDER_CUSTOMER_TYPE = 'appointment_reminder_customer' as const;
export const APPOINTMENT_REMINDER_VENDOR_TYPE = 'appointment_reminder_vendor' as const;

export interface AppointmentReminderNotificationData {
  type: typeof APPOINTMENT_REMINDER_CUSTOMER_TYPE | typeof APPOINTMENT_REMINDER_VENDOR_TYPE;
  orderId: string;
  vendorId: string;
  customerId?: string;
  reminderType: '24h' | '6h';
}

export function isAppointmentReminderNotification(
  data: unknown
): data is AppointmentReminderNotificationData {
  return (
    typeof data === 'object' &&
    data !== null &&
    ((data as Record<string, unknown>).type === APPOINTMENT_REMINDER_CUSTOMER_TYPE ||
      (data as Record<string, unknown>).type === APPOINTMENT_REMINDER_VENDOR_TYPE)
  );
}

interface ScheduledReminderIds {
  customer24h?: string;
  vendor24h?: string;
  customer6h?: string;
  vendor6h?: string;
}

interface ReminderSentRecord {
  reminder24hSent?: boolean;
  reminder6hSent?: boolean;
}

function parseScheduledDateTime(scheduledDate?: string, scheduledTime?: string): Date | null {
  if (!scheduledDate || !scheduledTime) return null;

  try {
    const timeMatch = scheduledTime.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!timeMatch) return null;

    let hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    const period = timeMatch[3].toUpperCase();

    if (period === 'PM' && hours !== 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    const date = new Date(`${scheduledDate}T00:00:00`);
    date.setHours(hours, minutes, 0, 0);

    return date;
  } catch {
    return null;
  }
}

export const [AppointmentReminderProvider, useAppointmentReminder] = createContextHook(() => {
  const { orders } = useOrders();
  const scheduledIds = useRef<Record<string, ScheduledReminderIds>>({});
  const sentRecords = useRef<Record<string, ReminderSentRecord>>({});
  const initialized = useRef(false);

  const loadSentRecords = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(REMINDER_SENT_KEY);
      if (stored) {
        sentRecords.current = JSON.parse(stored) as Record<string, ReminderSentRecord>;
      }
      console.log('[AppointmentReminder] Loaded sent records:', Object.keys(sentRecords.current).length, 'orders');
    } catch (error) {
      console.error('[AppointmentReminder] Failed to load sent records:', error);
    }
    initialized.current = true;
    processOrders(orders);
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void loadSentRecords();
  }, [loadSentRecords]);

  useEffect(() => {
    if (!initialized.current) return;
    processOrders(orders);
  }, [orders]);

  const saveSentRecords = async () => {
    try {
      await AsyncStorage.setItem(REMINDER_SENT_KEY, JSON.stringify(sentRecords.current));
    } catch (error) {
      console.error('[AppointmentReminder] Failed to save sent records:', error);
    }
  };

  const markReminderSent = (orderId: string, reminderType: '24h' | '6h') => {
    sentRecords.current = {
      ...sentRecords.current,
      [orderId]: {
        ...(sentRecords.current[orderId] ?? {}),
        ...(reminderType === '24h' ? { reminder24hSent: true } : { reminder6hSent: true }),
      },
    };
    void saveSentRecords();
    console.log(`[AppointmentReminder] Marked ${reminderType} reminder sent for order: ${orderId}`);
  };

  const isReminderSent = (orderId: string, reminderType: '24h' | '6h'): boolean => {
    const record = sentRecords.current[orderId];
    if (!record) return false;
    return reminderType === '24h' ? !!record.reminder24hSent : !!record.reminder6hSent;
  };

  const cancelOrderReminders = async (orderId: string) => {
    const ids = scheduledIds.current[orderId];
    if (!ids) return;

    const toCancel = [ids.customer24h, ids.vendor24h, ids.customer6h, ids.vendor6h].filter(
      (id): id is string => !!id
    );

    for (const id of toCancel) {
      try {
        await Notifications.cancelScheduledNotificationAsync(id);
        console.log('[AppointmentReminder] Cancelled notification:', id);
      } catch {
        // Already fired or invalid
      }
    }

    delete scheduledIds.current[orderId];
    console.log('[AppointmentReminder] Cancelled all reminders for order:', orderId);
  };

  const scheduleReminderPair = async (
    order: Order,
    reminderType: '24h' | '6h',
    triggerSeconds: number
  ) => {
    markReminderSent(order.id, reminderType);

    const timeDisplay = order.scheduledTime ?? 'your scheduled time';
    const customerName = order.customerName ?? 'a customer';
    const existingIds = scheduledIds.current[order.id] ?? {};

    let customerNotifId: string | undefined;
    let vendorNotifId: string | undefined;

    try {
      customerNotifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Upcoming order reminder',
          body: `Your order with ${order.vendorName} is scheduled for ${timeDisplay}.`,
          data: {
            type: APPOINTMENT_REMINDER_CUSTOMER_TYPE,
            orderId: order.id,
            vendorId: order.vendorId,
            customerId: order.customerId,
            reminderType,
          } as Record<string, unknown>,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
          repeats: false,
        },
      });
      console.log(`[AppointmentReminder] Customer ${reminderType} notification scheduled:`, customerNotifId);
    } catch (error) {
      console.error(`[AppointmentReminder] Failed to schedule customer ${reminderType}:`, error);
    }

    try {
      vendorNotifId = await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Upcoming order reminder',
          body: `You have an order from ${customerName} scheduled for ${timeDisplay}.`,
          data: {
            type: APPOINTMENT_REMINDER_VENDOR_TYPE,
            orderId: order.id,
            vendorId: order.vendorId,
            customerId: order.customerId,
            reminderType,
          } as Record<string, unknown>,
          sound: true,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: triggerSeconds,
          repeats: false,
        },
      });
      console.log(`[AppointmentReminder] Vendor ${reminderType} notification scheduled:`, vendorNotifId);
    } catch (error) {
      console.error(`[AppointmentReminder] Failed to schedule vendor ${reminderType}:`, error);
    }

    if (reminderType === '24h') {
      scheduledIds.current[order.id] = {
        ...existingIds,
        customer24h: customerNotifId,
        vendor24h: vendorNotifId,
      };
    } else {
      scheduledIds.current[order.id] = {
        ...existingIds,
        customer6h: customerNotifId,
        vendor6h: vendorNotifId,
      };
    }
  };

  const processOrders = (currentOrders: Order[]) => {
    if (Platform.OS === 'web') {
      console.log('[AppointmentReminder] Skipping on web');
      return;
    }

    const now = Date.now();

    currentOrders.forEach((order) => {
      if (TERMINAL_STATUSES.includes(order.status)) {
        if (scheduledIds.current[order.id]) {
          void cancelOrderReminders(order.id);
        }
        return;
      }

      const scheduledAt = parseScheduledDateTime(order.scheduledDate, order.scheduledTime);
      if (!scheduledAt) return;

      const scheduledMs = scheduledAt.getTime();

      const trigger24hMs = scheduledMs - 24 * 60 * 60 * 1000;
      const delay24hMs = trigger24hMs - now;

      if (!isReminderSent(order.id, '24h')) {
        if (delay24hMs > 0) {
          const delaySeconds = Math.floor(delay24hMs / 1000);
          console.log(
            `[AppointmentReminder] Scheduling 24h reminder for order ${order.id} in ${Math.floor(delaySeconds / 3600)}h ${Math.floor((delaySeconds % 3600) / 60)}m`
          );
          void scheduleReminderPair(order, '24h', delaySeconds);
        } else {
          console.log(`[AppointmentReminder] 24h window already passed for order ${order.id}`);
          markReminderSent(order.id, '24h');
        }
      }

      const trigger6hMs = scheduledMs - 6 * 60 * 60 * 1000;
      const delay6hMs = trigger6hMs - now;

      if (!isReminderSent(order.id, '6h')) {
        if (delay6hMs > 0) {
          const delaySeconds = Math.floor(delay6hMs / 1000);
          console.log(
            `[AppointmentReminder] Scheduling 6h reminder for order ${order.id} in ${Math.floor(delaySeconds / 3600)}h ${Math.floor((delaySeconds % 3600) / 60)}m`
          );
          void scheduleReminderPair(order, '6h', delaySeconds);
        } else {
          console.log(`[AppointmentReminder] 6h window already passed for order ${order.id}`);
          markReminderSent(order.id, '6h');
        }
      }
    });
  };

  return useMemo(() => ({
    scheduledIds: scheduledIds.current,
  }), []);
});
