import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import EditScreenHeader from '@/components/EditScreenHeader';
import { ChevronRight, Clock, MessageSquare, ShieldCheck, AlertTriangle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useVendorAwayMessage, formatTime } from '@/contexts/VendorAwayMessageContext';

type SettingState = 'active' | 'disabled' | 'needs_action';

function formatDateTime(value?: string): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export default function AwayMessageScreen() {
  const router = useRouter();
  const { settings, updateSettings } = useVendorAwayMessage();

  const hasMessage = settings.message.trim().length > 0;
  const state: SettingState = settings.enabled && hasMessage ? 'active' : settings.enabled ? 'needs_action' : 'disabled';
  const cooldownHours = settings.cooldownHours ?? 12;

  const handleToggle = (value: boolean) => {
    void updateSettings({ enabled: value });
    console.log('[AwayMessage] Toggled:', value);
  };

  const getMessagePreview = (): string => {
    if (!hasMessage) return 'No away message set';
    return settings.message.length > 90 ? `${settings.message.substring(0, 90).trim()}…` : settings.message;
  };

  const getScheduleDisplay = (): string => {
    switch (settings.schedule) {
      case 'always':
        return 'Always send';
      case 'outside_business_hours':
        return `Outside business hours, ${formatTime('18:00')} – ${formatTime('09:00')}`;
      case 'custom':
        return `${formatTime(settings.customScheduleStart)} – ${formatTime(settings.customScheduleEnd)}`;
      default:
        return 'Always send';
    }
  };

  const statusLabel = state === 'active' ? 'Active' : state === 'needs_action' ? 'Needs action' : 'Disabled';

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Away Message" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.statusCard}>
            <View style={styles.statusTopRow}>
              <View style={styles.statusTitleBlock}>
                <Text style={styles.eyebrow}>Away message status</Text>
                <Text style={styles.statusTitle}>
                  {state === 'active' ? 'Away replies are active' : state === 'needs_action' ? 'Message needed' : 'Away message disabled'}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  state === 'active' ? styles.activeBadge : state === 'needs_action' ? styles.warningBadge : styles.disabledBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    state === 'active' ? styles.activeBadgeText : state === 'needs_action' ? styles.warningBadgeText : styles.disabledBadgeText,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>
            <Text style={styles.statusDescription}>
              Sends only when a customer messages while you are unavailable. It never confirms, cancels, rejects, or updates an order.
            </Text>
            {settings.updatedAt ? <Text style={styles.lastUpdated}>Last updated {formatDateTime(settings.updatedAt)}</Text> : null}
          </View>

          <TouchableOpacity
            style={styles.toggleCard}
            onPress={() => handleToggle(!settings.enabled)}
            activeOpacity={0.74}
            accessibilityRole="switch"
            accessibilityState={{ checked: settings.enabled }}
            testID="away-message-toggle-row"
          >
            <View style={styles.toggleCopy}>
              <Text style={styles.toggleLabel}>Send away message</Text>
              <Text style={styles.toggleSubtitle}>Inquiry chats and order chats when you are unavailable.</Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={handleToggle}
              trackColor={{ false: Colors.borderDark, true: 'rgba(16,168,98,0.36)' }}
              thumbColor={settings.enabled ? Colors.success : Colors.white}
              ios_backgroundColor={Colors.borderDark}
              style={styles.switch}
              testID="away-message-toggle"
            />
          </TouchableOpacity>

          {settings.enabled && !hasMessage && (
            <View style={styles.warningCard}>
              <AlertTriangle size={16} color={Colors.warning} />
              <Text style={styles.warningText}>Away message is enabled but no message has been set. Add a message to activate automatic replies.</Text>
            </View>
          )}

          <Text style={styles.sectionLabel}>Configured details</Text>
          <View style={styles.detailsCard}>
            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => router.push('/vendor/settings/away-message-schedule' as any)}
              activeOpacity={0.72}
              testID="away-message-schedule-row"
            >
              <View style={styles.rowIcon}><Clock size={17} color={Colors.text} /></View>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowLabel}>Schedule</Text>
                <Text style={styles.rowSubtext}>{getScheduleDisplay()}</Text>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.detailRow}
              onPress={() => router.push('/vendor/settings/away-message-editor' as any)}
              activeOpacity={0.72}
              testID="away-message-message-row"
            >
              <View style={styles.rowIcon}><MessageSquare size={17} color={Colors.text} /></View>
              <View style={styles.rowTextGroup}>
                <Text style={styles.rowLabel}>Message</Text>
                <Text style={[styles.rowSubtext, !hasMessage && styles.placeholderText]} numberOfLines={3}>{getMessagePreview()}</Text>
              </View>
              <ChevronRight size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {state === 'active' && (
            <View style={styles.readOnlyCard}>
              <View style={styles.readOnlyHeader}>
                <ShieldCheck size={17} color={Colors.success} />
                <Text style={styles.readOnlyTitle}>Current saved message</Text>
              </View>
              <Text style={styles.messagePreview}>{settings.message}</Text>
            </View>
          )}

          <View style={styles.cooldownCard}>
            <Text style={styles.cooldownTitle}>Cooldown window</Text>
            <Text style={styles.cooldownText}>
              Away messages send once per conversation per {cooldownHours}-hour cooldown window. Backend field: awayCooldownHours.
            </Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 44, gap: 12 },
  statusCard: { backgroundColor: Colors.cardBackground, borderRadius: 20, borderWidth: 1, borderColor: Colors.cardBorder, padding: 16 },
  statusTopRow: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, justifyContent: 'space-between' as const, gap: 12 },
  statusTitleBlock: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 12, color: Colors.textTertiary, fontWeight: '700' as const, textTransform: 'uppercase' as const, letterSpacing: 0.55, marginBottom: 5 },
  statusTitle: { fontSize: 18, fontWeight: '700' as const, color: Colors.text, lineHeight: 23 },
  statusDescription: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19, marginTop: 10 },
  lastUpdated: { fontSize: 12, color: Colors.textTertiary, marginTop: 9, fontWeight: '500' as const },
  statusBadge: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' as const },
  activeBadge: { backgroundColor: Colors.successLight, borderColor: Colors.successBorder },
  activeBadgeText: { color: Colors.success },
  warningBadge: { backgroundColor: Colors.warningLight, borderColor: Colors.warningBorder },
  warningBadgeText: { color: Colors.warning },
  disabledBadge: { backgroundColor: Colors.surface, borderColor: Colors.border },
  disabledBadgeText: { color: Colors.textSecondary },
  toggleCard: { minHeight: 68, flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, gap: 12, backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, paddingVertical: 12, paddingLeft: 16, paddingRight: 12 },
  toggleCopy: { flex: 1, minWidth: 0 },
  toggleLabel: { fontSize: 16, fontWeight: '700' as const, color: Colors.text, marginBottom: 3 },
  toggleSubtitle: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  switch: { transform: [{ scaleX: 0.86 }, { scaleY: 0.86 }] },
  warningCard: { flexDirection: 'row' as const, alignItems: 'flex-start' as const, gap: 9, backgroundColor: Colors.warningLight, borderColor: Colors.warningBorder, borderWidth: 1, borderRadius: 16, padding: 13 },
  warningText: { flex: 1, fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
  sectionLabel: { fontSize: 12, fontWeight: '700' as const, color: Colors.textTertiary, textTransform: 'uppercase' as const, letterSpacing: 0.55, marginTop: 6, paddingHorizontal: 4 },
  detailsCard: { backgroundColor: Colors.cardBackground, borderRadius: 18, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' as const },
  detailRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 12, paddingHorizontal: 15, paddingVertical: 14, minHeight: 68 },
  rowIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: Colors.surface, alignItems: 'center' as const, justifyContent: 'center' as const },
  rowTextGroup: { flex: 1, minWidth: 0 },
  rowLabel: { fontSize: 15, fontWeight: '700' as const, color: Colors.text, marginBottom: 3 },
  rowSubtext: { fontSize: 13, color: Colors.textSecondary, lineHeight: 18 },
  placeholderText: { color: Colors.textMuted, fontStyle: 'italic' as const },
  divider: { height: 1, backgroundColor: Colors.borderSoft, marginLeft: 61 },
  readOnlyCard: { backgroundColor: Colors.surfaceElevated, borderWidth: 1, borderColor: Colors.border, borderRadius: 18, padding: 15 },
  readOnlyHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 9 },
  readOnlyTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text },
  messagePreview: { fontSize: 14, color: Colors.text, lineHeight: 21 },
  cooldownCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 14 },
  cooldownTitle: { fontSize: 14, fontWeight: '700' as const, color: Colors.text, marginBottom: 4 },
  cooldownText: { fontSize: 13, color: Colors.textSecondary, lineHeight: 19 },
});
