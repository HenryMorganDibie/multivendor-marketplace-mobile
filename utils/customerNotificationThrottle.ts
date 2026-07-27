interface CustomerThrottleRecord {
  lastPushTime: number;
  pushCount: number;
  recentMessages: number[];
}

interface OrderThrottleRecord {
  pushCount: number;
  timestamps: number[];
}

class CustomerNotificationThrottleService {
  private chatThrottles: Map<string, CustomerThrottleRecord> = new Map();
  private orderThrottles: Map<string, OrderThrottleRecord> = new Map();
  private customerDailyPushes: Map<string, number[]> = new Map();

  private readonly CHAT_COOLDOWN_MS = 30 * 60 * 1000;
  private readonly MESSAGE_DEDUPE_WINDOW_MS = 2 * 60 * 1000;
  private readonly MAX_ORDER_PUSHES = 4;
  private readonly MAX_DAILY_PUSHES = 6;

  shouldSendOrderPush(orderId: string, customerId: string): {
    allowed: boolean;
    reason?: string;
  } {
    const now = Date.now();

    const orderRecord = this.orderThrottles.get(orderId);
    if (orderRecord && orderRecord.pushCount >= this.MAX_ORDER_PUSHES) {
      return {
        allowed: false,
        reason: `Order push limit reached: ${orderRecord.pushCount}/${this.MAX_ORDER_PUSHES}`,
      };
    }

    const dailyPushes = (this.customerDailyPushes.get(customerId) || []).filter(
      (timestamp) => now - timestamp < 24 * 60 * 60 * 1000
    );
    if (dailyPushes.length >= this.MAX_DAILY_PUSHES) {
      return {
        allowed: false,
        reason: `Customer daily limit reached: ${dailyPushes.length}/${this.MAX_DAILY_PUSHES}`,
      };
    }

    return { allowed: true };
  }

  shouldSendChatPush(chatId: string, customerId: string): {
    allowed: boolean;
    reason?: string;
  } {
    const now = Date.now();

    const chatRecord = this.chatThrottles.get(chatId);
    if (chatRecord) {
      if (now - chatRecord.lastPushTime < this.CHAT_COOLDOWN_MS) {
        return {
          allowed: false,
          reason: `Chat throttled: ${Math.round((this.CHAT_COOLDOWN_MS - (now - chatRecord.lastPushTime)) / 60000)}min remaining`,
        };
      }

      const recentMessages = chatRecord.recentMessages.filter(
        (timestamp) => now - timestamp < this.MESSAGE_DEDUPE_WINDOW_MS
      );
      if (recentMessages.length > 0) {
        return {
          allowed: false,
          reason: 'Message deduplicated: sent within 2min window',
        };
      }
    }

    const dailyPushes = (this.customerDailyPushes.get(customerId) || []).filter(
      (timestamp) => now - timestamp < 24 * 60 * 60 * 1000
    );
    if (dailyPushes.length >= this.MAX_DAILY_PUSHES) {
      return {
        allowed: false,
        reason: `Customer daily limit reached: ${dailyPushes.length}/${this.MAX_DAILY_PUSHES}`,
      };
    }

    return { allowed: true };
  }

  recordOrderPush(orderId: string, customerId: string) {
    const now = Date.now();

    const orderRecord = this.orderThrottles.get(orderId) || {
      pushCount: 0,
      timestamps: [],
    };

    orderRecord.pushCount += 1;
    orderRecord.timestamps.push(now);
    this.orderThrottles.set(orderId, orderRecord);

    const dailyPushes = this.customerDailyPushes.get(customerId) || [];
    dailyPushes.push(now);
    this.customerDailyPushes.set(customerId, dailyPushes);

    console.log('[CustomerThrottle] Recorded order push:', {
      orderId,
      customerId,
      orderPushCount: orderRecord.pushCount,
      dailyCount: dailyPushes.filter((t) => now - t < 24 * 60 * 60 * 1000).length,
    });
  }

  recordChatPush(chatId: string, customerId: string) {
    const now = Date.now();

    const chatRecord = this.chatThrottles.get(chatId) || {
      lastPushTime: 0,
      pushCount: 0,
      recentMessages: [],
    };

    chatRecord.lastPushTime = now;
    chatRecord.pushCount += 1;
    chatRecord.recentMessages.push(now);
    chatRecord.recentMessages = chatRecord.recentMessages.filter(
      (timestamp) => now - timestamp < this.MESSAGE_DEDUPE_WINDOW_MS
    );

    this.chatThrottles.set(chatId, chatRecord);

    const dailyPushes = this.customerDailyPushes.get(customerId) || [];
    dailyPushes.push(now);
    this.customerDailyPushes.set(customerId, dailyPushes);

    console.log('[CustomerThrottle] Recorded chat push:', {
      chatId,
      customerId,
      dailyCount: dailyPushes.filter((t) => now - t < 24 * 60 * 60 * 1000).length,
    });
  }
}

export const customerNotificationThrottleService = new CustomerNotificationThrottleService();
