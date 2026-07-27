// IMPORTANT:
// Operational settings are intentionally independent from
// subscription and verification.
// Do not couple these systems.
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { useVendorQuietHours } from '@/contexts/VendorQuietHoursContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Colors } from '@/constants/colors';

export default function QuietHoursScreen() {
  const { settings, updateSettings } = useVendorQuietHours();
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
      updateSettings({ startTime: formatTime(selectedDate) });
    }
  };

  const handleEndTimeChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowEndPicker(false);
    }
    
    if (selectedDate) {
      updateSettings({ endTime: formatTime(selectedDate) });
    }
  };

  const renderTimePicker = (
    label: string,
    value: string,
    onPress: () => void,
    isLast: boolean = false
  ) => (
    <>
      <TouchableOpacity
        style={styles.timeRow}
        onPress={onPress}
        activeOpacity={0.7}
        disabled={!settings.enabled}
      >
        <Text style={[styles.timeLabel, !settings.enabled && styles.disabledText]}>{label}</Text>
        <Text style={[styles.timeValue, !settings.enabled && styles.disabledText]}>
          {formatTimeDisplay(value)}
        </Text>
      </TouchableOpacity>
      {!isLast && <View style={styles.divider} />}
    </>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Quiet Hours',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.descriptionCard}>
            <Text style={styles.descriptionText}>
              Quiet hours suppress message notifications during your selected time window.
            </Text>
            <Text style={styles.descriptionText}>
              Critical notifications (new orders, payments, compliance alerts) will always be delivered.
            </Text>
            <Text style={styles.descriptionText}>
              This setting is ideal for vendors who want uninterrupted rest while staying available for urgent matters.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Enable Quiet Hours</Text>
              <Switch
                value={settings.enabled}
                onValueChange={(val) => updateSettings({ enabled: val })}
                trackColor={{ false: Colors.border, true: Colors.success }}
                thumbColor={Colors.white}
                ios_backgroundColor={Colors.border}
              />
            </View>
          </View>

          {settings.enabled && (
            <View style={styles.card}>
              {renderTimePicker('Start Time', settings.startTime, () => setShowStartPicker(true), false)}
              {renderTimePicker('End Time', settings.endTime, () => setShowEndPicker(true), true)}
            </View>
          )}

          {settings.enabled && showStartPicker && (
            <DateTimePicker
              value={parseTime(settings.startTime)}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleStartTimeChange}
            />
          )}

          {settings.enabled && showEndPicker && (
            <DateTimePicker
              value={parseTime(settings.endTime)}
              mode="time"
              is24Hour={false}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleEndTimeChange}
            />
          )}

          <View style={styles.bypassCard}>
            <Text style={styles.bypassTitle}>Always Delivered</Text>
            <Text style={styles.bypassText}>• New order received</Text>
            <Text style={styles.bypassText}>• Order created from preorder chat</Text>
            <Text style={styles.bypassText}>• Payment confirmations</Text>
            <Text style={styles.bypassText}>• Compliance and account alerts</Text>
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
  descriptionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    marginBottom: 16,
  },
  descriptionText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  timeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  timeLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  timeValue: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '400' as const,
  },
  disabledText: {
    opacity: 0.4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  bypassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  bypassTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  bypassText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 4,
  },
  bottomSpacer: {
    height: 40,
  },
});
