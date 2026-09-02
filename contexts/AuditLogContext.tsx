import createContextHook from '@nkzw/create-context-hook';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useState, useCallback } from 'react';

export type AuditEventType =
  | 'order_created'
  | 'order_accepted'
  | 'order_status_changed'
  | 'order_completed'
  | 'payment_request_sent'
  | 'partial_payment_marked'
  | 'full_payment_marked'
  | 'payment_adjusted'
  | 'chat_enabled'
  | 'chat_disabled'
  | 'vendor_chat_input_disabled';

export interface AuditLog {
  id: string;
  eventType: AuditEventType;
  orderId?: string;
  vendorId?: string;
  customerId?: string;
  previousState?: string;
  newState?: string;
  timestamp: string;
  metadata?: Record<string, any>;
}

const AUDIT_LOG_KEY = '@platform_audit_logs';

export const [AuditLogProvider, useAuditLog] = createContextHook(() => {
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const loadLogs = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(AUDIT_LOG_KEY);
      if (stored) {
        const parsedLogs = JSON.parse(stored);
        setLogs(parsedLogs);
      }
    } catch (error) {
      console.error('[AuditLog] Failed to load logs:', error);
    }
  }, []);

  const saveLogs = useCallback(async (updatedLogs: AuditLog[]) => {
    try {
      await AsyncStorage.setItem(AUDIT_LOG_KEY, JSON.stringify(updatedLogs));
      setLogs(updatedLogs);
    } catch (error) {
      console.error('[AuditLog] Failed to save logs:', error);
    }
  }, []);

  const logEvent = useCallback(
    async (event: Omit<AuditLog, 'id' | 'timestamp'>) => {
      const newLog: AuditLog = {
        ...event,
        id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
      };

      console.log('[AuditLog] Event logged:', newLog);

      const stored = await AsyncStorage.getItem(AUDIT_LOG_KEY);
      const currentLogs: AuditLog[] = stored ? JSON.parse(stored) : [];
      const updatedLogs = [newLog, ...currentLogs];

      await saveLogs(updatedLogs);
    },
    [saveLogs]
  );

  const getLogsByOrder = useCallback(
    (orderId: string) => {
      return logs.filter((log) => log.orderId === orderId);
    },
    [logs]
  );

  const getLogsByVendor = useCallback(
    (vendorId: string) => {
      return logs.filter((log) => log.vendorId === vendorId);
    },
    [logs]
  );

  const getLogsByCustomer = useCallback(
    (customerId: string) => {
      return logs.filter((log) => log.customerId === customerId);
    },
    [logs]
  );

  const getLogsByEventType = useCallback(
    (eventType: AuditEventType) => {
      return logs.filter((log) => log.eventType === eventType);
    },
    [logs]
  );

  const getAllLogs = useCallback(() => {
    return logs;
  }, [logs]);

  return {
    logs,
    logEvent,
    loadLogs,
    getLogsByOrder,
    getLogsByVendor,
    getLogsByCustomer,
    getLogsByEventType,
    getAllLogs,
  };
});
