interface ThrottleRecord {
  lastPushTime: number;
  pushCount: number;
  recentMessages: number[];
}

class NotificationThrottleService {
  private chatThrottles: Map<string, ThrottleRecord> = new Map();
  private vendorHourlyPushes: Map<string, number[]> = new Map();
  private vendorDailyPushes: Map<string, number[]> = new Map();

  private readonly CHAT_COOLDOWN_MS = 30 * 60 * 1000;
  private readonly MESSAGE_DEDUPE_WINDOW_MS = 2 * 60 * 1000;
  private readonly MAX_HOURLY_PUSHES = 10;
  private readonly MAX_DAILY_PUSHES = 30;

  shouldSendPush(chatId: string, vendorId: string): {
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

    const hourlyPushes = (this.vendorHourlyPushes.get(vendorId) || []).filter(
      (timestamp) => now - timestamp < 60 * 60 * 1000
    );
    if (hourlyPushes.length >= this.MAX_HOURLY_PUSHES) {
      return {
        allowed: false,
        reason: `Vendor hourly limit reached: ${hourlyPushes.length}/${this.MAX_HOURLY_PUSHES}`,
      };
    }

    const dailyPushes = (this.vendorDailyPushes.get(vendorId) || []).filter(
      (timestamp) => now - timestamp < 24 * 60 * 60 * 1000
    );
    if (dailyPushes.length >= this.MAX_DAILY_PUSHES) {
      return {
        allowed: false,
        reason: `Vendor daily limit reached: ${dailyPushes.length}/${this.MAX_DAILY_PUSHES}`,
      };
    }

    return { allowed: true };
  }

  recordPush(chatId: string, vendorId: string) {
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

    const hourlyPushes = this.vendorHourlyPushes.get(vendorId) || [];
    hourlyPushes.push(now);
    this.vendorHourlyPushes.set(vendorId, hourlyPushes);

    const dailyPushes = this.vendorDailyPushes.get(vendorId) || [];
    dailyPushes.push(now);
    this.vendorDailyPushes.set(vendorId, dailyPushes);

    console.log('[NotificationThrottle] Recorded push:', {
      chatId,
      vendorId,
      hourlyCount: hourlyPushes.filter((t) => now - t < 60 * 60 * 1000).length,
      dailyCount: dailyPushes.filter((t) => now - t < 24 * 60 * 60 * 1000).length,
    });
  }

  isQuietHours(vendorTimezone: string = 'America/New_York'): boolean {
    try {
      const vendorTime = new Date().toLocaleString('en-US', {
        timeZone: vendorTimezone,
        hour12: false,
      });
      const hour = parseInt(vendorTime.split(',')[1].trim().split(':')[0]);
      
      const isQuiet = hour >= 22 || hour < 7;
      if (isQuiet) {
        console.log('[NotificationThrottle] Quiet hours active:', {
          vendorTimezone,
          hour,
        });
      }
      return isQuiet;
    } catch (error) {
      console.error('[NotificationThrottle] Failed to check quiet hours:', error);
      return false;
    }
  }
}

export const notificationThrottleService = new NotificationThrottleService();
