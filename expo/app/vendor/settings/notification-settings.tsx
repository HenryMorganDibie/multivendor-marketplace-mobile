import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Lock } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { useVendorQuietHours } from '@/contexts/VendorQuietHoursContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, callable, db } from '@/lib/firebase';

type VendorPreferencesPatch = Partial<{
  pushEnabled: boolean;
  newOrderRequest: boolean;
  paymentConfirmed: boolean;
  orderChanges: boolean;
  actionRequired: boolean;
  pendingOrderReminder: boolean;
  newMessage: boolean;
  unreadMessageReminder: boolean;
}>;

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [pushEnabled, setPushEnabled] = useState(true);

  const [newOrderRequest, setNewOrderRequest] = useState(true);
  const [paymentConfirmed, setPaymentConfirmed] = useState(true);
  const [orderChanges, setOrderChanges] = useState(true);
  const [actionRequired, setActionRequired] = useState(true);
  const [pendingOrderReminder, setPendingOrderReminder] = useState(true);

  const [newMessage, setNewMessage] = useState(true);
  const [unreadReminder, setUnreadReminder] = useState(true);
  // Guards against the live listener's own initial snapshot re-triggering a
  // write of the defaults it just read.
  const isHydrated = useRef(false);

  const { settings, updateSettings } = useVendorQuietHours();

  /**
   * These toggles were plain useState with no persistence — every value
   * reset to the hardcoded defaults above on every app launch, and
   * updateVendorNotificationPreferences (deployed alongside the rest of the
   * notification system) had no caller. Reading
   * `vendors/{vendorId}/settings/notifications` directly, same pattern as
   * CatalogContext/PromoContext.
   */
  useEffect(() => {
    let unsubscribeSettings: (() => void) | null = null;
    const unsubscribeAuth = auth.onIdTokenChanged(async (user) => {
      unsubscribeSettings?.();
      unsubscribeSettings = null;
      isHydrated.current = false;
      if (!user) return;

      const token = await user.getIdTokenResult();
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) return;

      unsubscribeSettings = onSnapshot(
        doc(db, 'vendors', vendorId, 'settings', 'notifications'),
        (snap) => {
          const data = snap.data();
          if (data) {
            setPushEnabled(data.pushEnabled ?? true);
            setNewOrderRequest(data.newOrderRequest ?? true);
            setPaymentConfirmed(data.paymentConfirmed ?? true);
            setOrderChanges(data.orderChanges ?? true);
            setActionRequired(data.actionRequired ?? true);
            setPendingOrderReminder(data.pendingOrderReminder ?? true);
            setNewMessage(data.newMessage ?? true);
            setUnreadReminder(data.unreadMessageReminder ?? true);
          }
          isHydrated.current = true;
        },
        (err) => console.error('[VendorNotificationSettings] Live subscription failed:', err),
      );
    });

    return () => {
      unsubscribeSettings?.();
      unsubscribeAuth();
    };
  }, []);

  const saveVendorPreferences = useCallback((patch: VendorPreferencesPatch) => {
    if (!isHydrated.current) return;
    const update = callable<VendorPreferencesPatch, { success: true }>('updateVendorNotificationPreferences');
    update(patch).catch((err) => {
      console.error('[VendorNotificationSettings] updateVendorNotificationPreferences failed:', err);
    });
  }, []);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const parseTime = (timeStr: string): Date => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  };

  const formatTime = (date: Date): string => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const formatTimeDisplay = (timeStr: string): string => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const handleStartTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartPicker(false);
    }
    if (selectedDate) {
      void updateSettings({ startTime: formatTime(selectedDate) });
    }
  };

  const handleEndTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    if (selectedDate) {
      void updateSettings({ endTime: formatTime(selectedDate) });
    }
  };

  const handleToggle = (setter: (value: boolean) => void, value: boolean, label: string) => {
    setter(value);
    console.log(`${label}:`, value);
  };

  const handlePushEnabledToggle = (value: boolean) => {
    handleToggle(setPushEnabled, value, 'Push Notifications');
    saveVendorPreferences({ pushEnabled: value });
  };
  const handleNewOrderRequestToggle = (value: boolean) => {
    handleToggle(setNewOrderRequest, value, 'New Order Request');
    saveVendorPreferences({ newOrderRequest: value });
  };
  const handlePaymentConfirmedToggle = (value: boolean) => {
    handleToggle(setPaymentConfirmed, value, 'Payment Confirmed');
    saveVendorPreferences({ paymentConfirmed: value });
  };
  const handleOrderChangesToggle = (value: boolean) => {
    handleToggle(setOrderChanges, value, 'Order Changes');
    saveVendorPreferences({ orderChanges: value });
  };
  const handleActionRequiredToggle = (value: boolean) => {
    handleToggle(setActionRequired, value, 'Action Required');
    saveVendorPreferences({ actionRequired: value });
  };
  const handlePendingOrderReminderToggle = (value: boolean) => {
    handleToggle(setPendingOrderReminder, value, 'Pending Order Reminder');
    saveVendorPreferences({ pendingOrderReminder: value });
  };
  const handleNewMessageToggle = (value: boolean) => {
    handleToggle(setNewMessage, value, 'New Message');
    saveVendorPreferences({ newMessage: value });
  };
  const handleUnreadReminderToggle = (value: boolean) => {
    handleToggle(setUnreadReminder, value, 'Unread Message Reminder');
    saveVendorPreferences({ unreadMessageReminder: value });
  };

  const renderToggleRow = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    isLast: boolean = false,
    disabled: boolean = false
  ) => (
    <>
      <View style={[styles.toggleRow, disabled && styles.disabledRow]}>
        <Text style={[styles.toggleLabel, disabled && styles.disabledText]}>{label}</Text>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: Colors.border, true: Colors.primary }}
          thumbColor={Colors.white}
          ios_backgroundColor={Colors.border}
          disabled={disabled}
        />
      </View>
      {!isLast && <View style={styles.divider} />}
    </>
  );

  const renderTimeRow = (
    label: string,
    value: string,
    onPress: () => void,
    isLast: boolean = false
  ) => {
    const disabled = !settings.enabled;
    return (
      <>
        <TouchableOpacity
          style={[styles.toggleRow, disabled && styles.disabledRow]}
          onPress={onPress}
          activeOpacity={0.7}
          disabled={disabled}
        >
          <Text style={[styles.toggleLabel, disabled && styles.disabledText]}>{label}</Text>
          <View style={styles.timeRowRight}>
            <Text style={[styles.timeValue, disabled && styles.disabledText]}>
              {formatTimeDisplay(value)}
            </Text>
            <ChevronRight size={18} color={disabled ? Colors.textMuted : Colors.textSecondary} />
          </View>
        </TouchableOpacity>
        {!isLast && <View style={styles.divider} />}
      </>
    );
  };

  const [showStartPickerModal, setShowStartPickerModal] = useState(false);
  const [showEndPickerModal, setShowEndPickerModal] = useState(false);
  const [tempStartTime, setTempStartTime] = useState<Date>(parseTime(settings.startTime));
  const [tempEndTime, setTempEndTime] = useState<Date>(parseTime(settings.endTime));

  const handleOpenStartPicker = () => {
    if (!settings.enabled) return;
    setTempStartTime(parseTime(settings.startTime));
    if (Platform.OS === 'ios') {
      setShowStartPickerModal(true);
    } else {
      setShowStartPicker(true);
    }
  };

  const handleOpenEndPicker = () => {
    if (!settings.enabled) return;
    setTempEndTime(parseTime(settings.endTime));
    if (Platform.OS === 'ios') {
      setShowEndPickerModal(true);
    } else {
      setShowEndPicker(true);
    }
  };

  const handleConfirmStartTime = () => {
    void updateSettings({ startTime: formatTime(tempStartTime) });
    setShowStartPickerModal(false);
  };

  const handleConfirmEndTime = () => {
    void updateSettings({ endTime: formatTime(tempEndTime) });
    setShowEndPickerModal(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Notifications" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PUSH NOTIFICATIONS</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'Enable Push Notifications',
                pushEnabled,
                handlePushEnabledToggle,
                true
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDER NOTIFICATIONS</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'New Order Request',
                newOrderRequest,
                handleNewOrderRequestToggle
              )}
              {renderToggleRow(
                'Payment Confirmed',
                paymentConfirmed,
                handlePaymentConfirmedToggle
              )}
              {renderToggleRow(
                'Order Changes',
                orderChanges,
                handleOrderChangesToggle
              )}
              {renderToggleRow(
                'Action Required',
                actionRequired,
                handleActionRequiredToggle
              )}
              {renderToggleRow(
                'Pending Order Reminder',
                pendingOrderReminder,
                handlePendingOrderReminderToggle,
                true
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MESSAGE NOTIFICATIONS</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'New Message',
                newMessage,
                handleNewMessageToggle
              )}
              {renderToggleRow(
                'Unread Message Reminder',
                unreadReminder,
                handleUnreadReminderToggle,
                true
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>QUIET HOURS</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'Enable Quiet Hours',
                settings.enabled,
                (val) => updateSettings({ enabled: val }),
                false
              )}
              {renderTimeRow(
                'Start Time',
                settings.startTime,
                handleOpenStartPicker
              )}
              {renderTimeRow(
                'End Time',
                settings.endTime,
                handleOpenEndPicker,
                true
              )}
            </View>
            <Text style={styles.helperText}>
              Mute non-critical push notifications during selected hours. Critical alerts such as new orders, payments, and security alerts will still be delivered.
            </Text>
          </View>

          {Platform.OS === 'android' && showStartPicker && (
            <DateTimePicker
              value={parseTime(settings.startTime)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleStartTimeChange}
            />
          )}

          {Platform.OS === 'android' && showEndPicker && (
            <DateTimePicker
              value={parseTime(settings.endTime)}
              mode="time"
              is24Hour={false}
              display="default"
              onChange={handleEndTimeChange}
            />
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>SECURITY</Text>
            <View style={styles.card}>
              <View style={styles.securityCard}>
                <View style={styles.securityIconRow}>
                  <View style={styles.securityIconContainer}>
                    <Lock size={18} color="#FF8C42" />
                  </View>
                  <Text style={styles.securityTitle}>Security Alerts</Text>
                  <View style={styles.alwaysEnabledBadge}>
                    <Text style={styles.alwaysEnabledBadgeText}>Always on</Text>
                  </View>
                </View>
                <Text style={styles.securityDescription}>
                  Login attempts, password changes, and account activity
                </Text>
                <Text style={styles.securitySystemMessage}>
                  These alerts are always enabled to keep your account secure and cannot be turned off.
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      {Platform.OS === 'ios' && (
        <Modal
          visible={showStartPickerModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowStartPickerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowStartPickerModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Start Time</Text>
                <TouchableOpacity onPress={handleConfirmStartTime}>
                  <Text style={styles.modalDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempStartTime}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={(_, date) => { if (date) setTempStartTime(date); }}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}

      {Platform.OS === 'ios' && (
        <Modal
          visible={showEndPickerModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEndPickerModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <TouchableOpacity onPress={() => setShowEndPickerModal(false)}>
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.modalTitle}>End Time</Text>
                <TouchableOpacity onPress={handleConfirmEndTime}>
                  <Text style={styles.modalDoneText}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={tempEndTime}
                mode="time"
                is24Hour={false}
                display="spinner"
                onChange={(_, date) => { if (date) setTempEndTime(date); }}
                style={styles.iosPicker}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  toggleLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '400' as const,
    flex: 1,
    marginRight: 12,
  },
  timeValue: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  disabledRow: {
    opacity: 0.45,
  },
  disabledText: {
    color: Colors.textMuted,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  bottomSpacer: {
    height: 40,
  },
  securityCard: {
    padding: 16,
  },
  securityIconRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    marginBottom: 8,
    flexWrap: 'wrap' as const,
  },
  alwaysEnabledBadge: {
    marginLeft: 'auto' as const,
    backgroundColor: '#FFF3E8',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 99,
  },
  alwaysEnabledBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FF8C42',
  },
  securityIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#FFF3E8',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  securityDescription: {
    fontSize: 13,
    color: '#888888',
    lineHeight: 18,
    marginBottom: 6,
  },
  securitySystemMessage: {
    fontSize: 13,
    color: '#AAAAAA',
    lineHeight: 18,
  },
  timeRowRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'flex-end' as const,
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalCancelText: {
    fontSize: 16,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  modalDoneText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  iosPicker: {
    height: 200,
  },
});
