import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Clock, MessageSquare } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useVendorAwayMessage, formatTime } from '@/contexts/VendorAwayMessageContext';

export default function AwayMessageScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useVendorAwayMessage();

  const handleToggle = (value: boolean) => {
    void updateSettings({ enabled: value });
    console.log('[AwayMessage] Toggled:', value);
  };

  const getMessagePreview = (): string => {
    if (!settings.message.trim()) return 'Tap to set your away message';
    return settings.message.length > 45
      ? `${settings.message.substring(0, 45)}...`
      : settings.message;
  };

  const getScheduleDisplay = (): string => {
    switch (settings.schedule) {
      case 'always':
        return 'Always send';
      case 'outside_business_hours':
        return `Send away message between ${formatTime('18:00')} – ${formatTime('09:00')}`;
      case 'custom':
        return `Send away message between ${formatTime(settings.customScheduleStart)} – ${formatTime(settings.customScheduleEnd)}`;
      default:
        return 'Always send';
    }
  };

  const isDisabled = !settings.enabled;

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Away Message',
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Send away message</Text>
              <Switch
                value={settings.enabled}
                onValueChange={handleToggle}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
                ios_backgroundColor={Colors.border}
                testID="away-message-toggle"
              />
            </View>
          </View>

          <Text style={styles.descriptionText}>
            Automatically reply to customers when you are unavailable.{'\n'}
            Away messages do not block chats or orders.
          </Text>

          <TouchableOpacity
            onPress={() => router.push('/help-center/away-messages' as any)}
            activeOpacity={0.7}
            testID="away-message-learn-more"
          >
            <Text style={styles.learnMoreText}>Learn more</Text>
          </TouchableOpacity>

          <Text style={[styles.sectionLabel, isDisabled && styles.sectionLabelDisabled]}>SCHEDULE</Text>
          <View style={[styles.card, isDisabled && styles.cardDisabled]}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/vendor/settings/away-message-schedule' as any)}
              activeOpacity={isDisabled ? 1 : 0.7}
              disabled={isDisabled}
              testID="away-message-schedule-row"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, isDisabled && styles.rowIconDisabled]}>
                  <Clock size={18} color={isDisabled ? Colors.textMuted : Colors.primary} />
                </View>
                <View style={styles.rowTextGroup}>
                  <Text style={[styles.rowLabel, isDisabled && styles.rowLabelDisabled]}>Schedule</Text>
                  <Text style={[styles.rowSubtext, isDisabled && styles.rowSubtextDisabled]} numberOfLines={1}>
                    {getScheduleDisplay()}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={isDisabled ? Colors.borderDark : Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.sectionLabel, isDisabled && styles.sectionLabelDisabled]}>MESSAGE</Text>
          <View style={[styles.card, isDisabled && styles.cardDisabled]}>
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push('/vendor/settings/away-message-editor' as any)}
              activeOpacity={isDisabled ? 1 : 0.7}
              disabled={isDisabled}
              testID="away-message-message-row"
            >
              <View style={styles.rowLeft}>
                <View style={[styles.rowIcon, isDisabled && styles.rowIconDisabled]}>
                  <MessageSquare size={18} color={isDisabled ? Colors.textMuted : Colors.primary} />
                </View>
                <View style={styles.rowTextGroup}>
                  <Text style={[styles.rowLabel, isDisabled && styles.rowLabelDisabled]}>Message</Text>
                  <Text
                    style={[
                      styles.rowSubtext,
                      isDisabled && styles.rowSubtextDisabled,
                      !settings.message.trim() && styles.rowSubtextPlaceholder,
                    ]}
                    numberOfLines={2}
                  >
                    {getMessagePreview()}
                  </Text>
                </View>
              </View>
              <ChevronRight size={18} color={isDisabled ? Colors.borderDark : Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {settings.enabled && !settings.message.trim() && (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                Away message is enabled but no message has been set. Tap "Message" above to add one.
              </Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />

          <Text style={styles.cooldownText}>
            Away messages are sent once per conversation. A 12-hour cooldown prevents repeat messages to the same customer.
          </Text>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 40,
  },
  headerBack: {
    padding: 4,
    marginLeft: -4,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    marginTop: 28,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionLabelDisabled: {
    color: Colors.textMuted,
    opacity: 0.6,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: 'hidden',
  },
  cardDisabled: {
    opacity: 0.5,
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
    fontWeight: '500' as const,
    color: Colors.text,
  },
  descriptionText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  learnMoreText: {
    fontSize: 13,
    fontWeight: '500' as const,
    color: Colors.primary,
    marginTop: 6,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 64,
  },
  rowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
    marginRight: 8,
  },
  rowIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  rowIconDisabled: {
    backgroundColor: Colors.surface,
  },
  rowTextGroup: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  rowLabelDisabled: {
    color: Colors.textMuted,
  },
  rowSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  rowSubtextDisabled: {
    color: Colors.textMuted,
  },
  rowSubtextPlaceholder: {
    fontStyle: 'italic' as const,
    color: Colors.textMuted,
  },
  warningBanner: {
    marginTop: 16,
    backgroundColor: Colors.warningLight,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.warningBorder,
  },
  warningText: {
    fontSize: 13,
    color: Colors.warning,
    lineHeight: 19,
  },
  bottomSpacer: {
    flex: 1,
    minHeight: 40,
  },
  cooldownText: {
    fontSize: 12,
    color: Colors.textMuted,
    lineHeight: 17,
    paddingHorizontal: 4,
    textAlign: 'center' as const,
    marginTop: 24,
  },
});
