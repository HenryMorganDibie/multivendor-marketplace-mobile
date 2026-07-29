import React from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Bell,
  MapPin,
  Shield,
  Ban,
  HelpCircle,
  Headphones,
  Flag,
  Share2,
  CreditCard,
  FileText,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useSafeBack } from '@/utils/useSafeBack';
import { useUserLocation } from '@/contexts/UserLocationContext';

interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  showDivider?: boolean;
  destructive?: boolean;
}

function SettingsRow({
  icon,
  iconBg,
  label,
  subtitle,
  onPress,
  showDivider = true,
  destructive = false,
}: SettingsRowProps) {
  return (
    <>
      <TouchableOpacity
        style={styles.settingsRow}
        onPress={onPress}
        activeOpacity={0.55}
      >
        <View
          style={[
            styles.iconWrap,
            iconBg ? { backgroundColor: iconBg } : null,
            destructive && styles.iconWrapDestructive,
          ]}
        >
          {icon}
        </View>
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
            {label}
          </Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        <ChevronRight size={15} color={Colors.textMuted} strokeWidth={2.5} />
      </TouchableOpacity>
      {showDivider && <View style={styles.rowDivider} />}
    </>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { countryName, regionName } = useUserLocation();
  const safeBack = useSafeBack();

  const locationLabel =
    regionName && countryName
      ? `${regionName}, ${countryName}`
      : regionName || countryName || 'Not set';

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={safeBack} style={styles.headerButton}>
            <ChevronLeft size={22} color={Colors.text} strokeWidth={2} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Account */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<User size={16} color={Colors.primary} strokeWidth={2} />}
            label="Profile"
            subtitle="Name, photo, identity"
            onPress={() => router.push('/settings/profile' as any)}
          />
          <SettingsRow
            icon={<MapPin size={16} color="#10A862" strokeWidth={2} />}
            iconBg="rgba(16,168,98,0.08)"
            label="Location"
            subtitle={locationLabel || 'Current shopping area'}
            onPress={() => router.push('/settings/location' as any)}
            showDivider={false}
          />
        </View>

        {/* Notifications */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>NOTIFICATIONS</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<Bell size={16} color="#6C63FF" strokeWidth={2} />}
            iconBg="rgba(108,99,255,0.08)"
            label="Notifications"
            subtitle="Alerts, sounds, badges"
            onPress={() => router.push('/settings/notifications' as any)}
            showDivider={false}
          />
        </View>

        {/* Privacy & Data */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>PRIVACY & DATA</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<CreditCard size={16} color={Colors.primary} strokeWidth={2} />}
            label="Contact Card Presets"
            subtitle="Saved info for orders"
            onPress={() => router.push('/settings/contact-cards' as any)}
          />
          <SettingsRow
            icon={<Shield size={16} color="#3B82F6" strokeWidth={2} />}
            iconBg="rgba(59,130,246,0.08)"
            label="Privacy & Data"
            subtitle="Data usage, permissions"
            onPress={() => router.push('/settings/privacy' as any)}
          />
          <SettingsRow
            icon={<Ban size={16} color="#EF4444" strokeWidth={2} />}
            iconBg="rgba(239,68,68,0.08)"
            label="Blocked Users"
            subtitle="Manage blocked accounts"
            onPress={() => router.push('/settings/blocked-users' as any)}
            showDivider={false}
          />
        </View>

        {/* Support */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>SUPPORT</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<HelpCircle size={16} color="#F59E0B" strokeWidth={2} />}
            iconBg="rgba(245,158,11,0.08)"
            label="Help Center"
            subtitle="FAQs, guides"
            onPress={() => router.push('/help-center' as any)}
          />
          <SettingsRow
            icon={<Headphones size={16} color="#10A862" strokeWidth={2} />}
            iconBg="rgba(16,168,98,0.08)"
            label="Contact the platform Support"
            subtitle="Chat with support"
            onPress={() => router.push('/settings/support-chat' as any)}
          />
          <SettingsRow
            icon={<Flag size={16} color="#EF4444" strokeWidth={2} />}
            iconBg="rgba(239,68,68,0.08)"
            label="Report a Problem"
            subtitle="Safety, orders, technical issues"
            onPress={() => router.push('/settings/report-problem' as any)}
            showDivider={false}
          />
        </View>

        {/* Sharing */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>SHARING</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<Share2 size={16} color={Colors.primary} strokeWidth={2} />}
            label="Invite to the platform"
            subtitle="Share with friends"
            onPress={() => router.push('/customer/invite' as any)}
            showDivider={false}
          />
        </View>

        {/* Legal */}
        <Text style={[styles.sectionLabel, { marginTop: 24 }]}>LEGAL</Text>
        <View style={styles.card}>
          <SettingsRow
            icon={<FileText size={16} color={Colors.textSecondary} strokeWidth={2} />}
            iconBg={Colors.surface}
            label="Terms of Use & Privacy Policy"
            onPress={() => router.push('/settings/privacy' as any)}
            showDivider={false}
          />
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    backgroundColor: Colors.backgroundCanvas,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  headerButton: {
    padding: 10,
    width: 44,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 44,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.0,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  settingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 13,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.primarySofter,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  iconWrapDestructive: {
    backgroundColor: Colors.errorLight,
  },
  rowTextWrap: {
    flex: 1,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    letterSpacing: -0.1,
  },
  rowLabelDestructive: {
    color: Colors.error,
  },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1.5,
    fontWeight: '400' as const,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSoft,
    marginLeft: 63,
  },
});
