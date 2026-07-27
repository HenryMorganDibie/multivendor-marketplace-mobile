import React, { useState, useCallback } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';

export default function NotificationsScreen() {
  const [enableNotifications, setEnableNotifications] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [chatMessages, setChatMessages] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [cartReminders, setCartReminders] = useState(false);
  const [promotions, setPromotions] = useState(false);


  const handleMasterToggle = useCallback((value: boolean) => {
    setEnableNotifications(value);
    if (!value) {
      setOrderUpdates(false);
      setChatMessages(false);
      setAppointmentReminders(false);
      setCartReminders(false);
      setPromotions(false);
    } else {
      setOrderUpdates(true);
      setChatMessages(true);
    }
    console.log('Enable notifications:', value);
  }, []);

  const handleToggle = useCallback((setter: (value: boolean) => void, value: boolean, label: string) => {
    setter(value);
    console.log(`${label}:`, value);
  }, []);

  const renderToggleRow = (
    label: string,
    value: boolean,
    onValueChange: (value: boolean) => void,
    isLast: boolean = false,
    disabled: boolean = false,
    description?: string,
  ) => (
    <>
      <View style={[styles.toggleRow, disabled && styles.disabledRow]}>
        <View style={styles.toggleLeft}>
          <Text style={[styles.toggleLabel, disabled && styles.disabledText]}>{label}</Text>
          {description ? (
            <Text style={[styles.toggleDescription, disabled && styles.disabledDescText]}>{description}</Text>
          ) : null}
        </View>
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

  const allDisabled = !enableNotifications;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notifications',
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PUSH NOTIFICATIONS</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'Enable Notifications',
                enableNotifications,
                handleMasterToggle,
                true,
              )}
            </View>
            <Text style={styles.helperText}>
              Controls all notification preferences below.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ORDERS</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'Order Updates',
                orderUpdates && enableNotifications,
                (val) => handleToggle(setOrderUpdates, val, 'Order Updates'),
                true,
                allDisabled,
                'Status changes, confirmations, and delivery updates',
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MESSAGES</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'Chat Messages',
                chatMessages && enableNotifications,
                (val) => handleToggle(setChatMessages, val, 'Chat Messages'),
                true,
                allDisabled,
                'e.g. Bella Cakes sent you a message',
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REMINDERS</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'Appointment & Pickup Reminders',
                appointmentReminders && enableNotifications,
                (val) => handleToggle(setAppointmentReminders, val, 'Appointment Reminders'),
                false,
                allDisabled,
                'e.g. Your order from Bella Cakes is scheduled for pickup at 7:00 PM today',
              )}
              {renderToggleRow(
                'Cart Reminders',
                cartReminders && enableNotifications,
                (val) => handleToggle(setCartReminders, val, 'Cart Reminders'),
                true,
                allDisabled,
                'e.g. You left items in your cart from Bella Cakes',
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>PROMOTIONS</Text>
            <View style={styles.card}>
              {renderToggleRow(
                'Promotions & Announcements',
                promotions && enableNotifications,
                (val) => handleToggle(setPromotions, val, 'Promotions'),
                true,
                allDisabled,
                'Deals, offers, and vendor announcements',
              )}
            </View>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  toggleLeft: {
    flex: 1,
    marginRight: 12,
  },
  toggleLabel: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  toggleDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 3,
    lineHeight: 18,
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
  disabledDescText: {
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

});
