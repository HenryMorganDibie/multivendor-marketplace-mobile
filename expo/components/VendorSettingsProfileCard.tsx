import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  AlertCircle,
  Clock3,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { Vendor, DayHoursConfig } from '@/mocks/vendorData';
import type { VendorPlan } from '@/contexts/VendorPlanContext';
import type { VerificationStatus } from '@/contexts/VerificationContext';

interface CompletionItem {
  key: string;
  label: string;
  done: boolean;
}

interface VendorSettingsProfileCardProps {
  vendor: Vendor;
  plan: VendorPlan;
  vendorHandle?: string | null;
  verificationStatus: VerificationStatus;
  catalogItemCount: number;
  onCompletionPress: () => void;
}

interface VerificationBadgeConfig {
  label: string;
  foreground: string;
  background: string;
  border: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
}

const PLAN_LABELS: Record<VendorPlan, string> = {
  basic: 'Basic',
  standard: 'Standard',
  pro: 'Pro',
  'pro+': 'Pro+',
};

const VERIFICATION_BADGES: Record<VerificationStatus, VerificationBadgeConfig> = {
  approved: {
    label: 'Verified',
    foreground: Colors.success,
    background: Colors.successLight,
    border: Colors.successBorder,
    icon: ShieldCheck,
  },
  not_started: {
    label: 'Not verified',
    foreground: Colors.textSecondary,
    background: Colors.surface,
    border: Colors.border,
    icon: ShieldOff,
  },
  pending_review: {
    label: 'Under review',
    foreground: '#B45309',
    background: Colors.warningLight,
    border: Colors.warningBorder,
    icon: Clock3,
  },
  retry_required: {
    label: 'Needs attention',
    foreground: '#B45309',
    background: Colors.warningLight,
    border: Colors.warningBorder,
    icon: AlertCircle,
  },
  rejected: {
    label: 'Verification unsuccessful',
    foreground: Colors.error,
    background: Colors.errorLight,
    border: Colors.errorBorder,
    icon: ShieldAlert,
  },
  suspended: {
    label: 'Suspended',
    foreground: Colors.error,
    background: Colors.errorLight,
    border: Colors.errorBorder,
    icon: ShieldOff,
  },
  deactivated: {
    label: 'Deactivated',
    foreground: Colors.textSecondary,
    background: Colors.surfaceMuted,
    border: Colors.border,
    icon: ShieldOff,
  },
};

function hasText(value?: string | null): boolean {
  return Boolean(value?.trim());
}

function hasConfiguredWeeklyHours(weeklyHours?: Vendor['weeklyHours']): boolean {
  if (!weeklyHours) return false;
  return Object.values(weeklyHours as Record<string, DayHoursConfig>).some((day) => {
    return !day.closed && Array.isArray(day.ranges) && day.ranges.length > 0;
  });
}

function getLocationLabel(vendor: Vendor): string | null {
  const parts: string[] = [];
  const area = vendor.area?.trim();
  const city = vendor.city?.trim();
  const state = vendor.state?.trim() || vendor.region?.trim();
  const country = vendor.country?.trim();

  if (area) parts.push(area);
  if (city && !area?.toLowerCase().includes(city.toLowerCase())) parts.push(city);
  if (state && !parts.some((part) => part.toLowerCase().includes(state.toLowerCase()))) parts.push(state);
  if (country && !parts.some((part) => part.toLowerCase() === country.toLowerCase())) parts.push(country);

  return parts.length > 0 ? parts.join(', ') : null;
}

function getPaymentInstructionsReady(vendor: Vendor): boolean {
  return hasText(vendor.paymentInstructions) || Boolean(vendor.primaryPaymentMethod);
}

function getCompletionItems(vendor: Vendor, catalogItemCount: number): CompletionItem[] {
  return [
    { key: 'logo', label: 'Logo', done: Boolean(vendor.logoImage) },
    { key: 'banner', label: 'Banner', done: Boolean(vendor.bannerImage) },
    { key: 'businessName', label: 'Name', done: hasText(vendor.name) },
    { key: 'category', label: 'Category', done: hasText(vendor.category) },
    { key: 'location', label: 'Location', done: Boolean(getLocationLabel(vendor)) },
    {
      key: 'hours',
      label: 'Hours',
      done: hasText(vendor.businessHours) || hasConfiguredWeeklyHours(vendor.weeklyHours),
    },
    { key: 'payment', label: 'Payment', done: getPaymentInstructionsReady(vendor) },
    { key: 'catalog', label: 'Catalog', done: catalogItemCount > 0 },
  ];
}

function getNextCompletionLabel(items: CompletionItem[]): string {
  return items.find((item) => !item.done)?.label ?? 'Complete';
}

export function calculateVendorProfileCompletionPercent(vendor: Vendor, catalogItemCount: number): number {
  const items = getCompletionItems(vendor, catalogItemCount);
  const completed = items.filter((item) => item.done).length;
  return Math.round((completed / items.length) * 100);
}

/**
 * Reusable backend-ready profile/status summary for the Vendor Settings hub.
 */
export default function VendorSettingsProfileCard({
  vendor,
  plan,
  vendorHandle,
  verificationStatus,
  catalogItemCount,
  onCompletionPress,
}: VendorSettingsProfileCardProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState<number>(0);
  const [isPressed, setIsPressed] = useState<boolean>(false);

  const businessName = hasText(vendor.name) ? vendor.name.trim() : 'Your business';
  const category = hasText(vendor.category) ? vendor.category.trim() : null;
  const location = getLocationLabel(vendor);
  const handle = hasText(vendorHandle) ? vendorHandle?.trim() : hasText(vendor.username) ? vendor.username.trim() : null;
  const badge = VERIFICATION_BADGES[verificationStatus] ?? VERIFICATION_BADGES.not_started;
  const BadgeIcon = badge.icon;

  const completionItems = useMemo(
    () => getCompletionItems(vendor, catalogItemCount),
    [vendor, catalogItemCount]
  );
  const completionPercent = useMemo(
    () => calculateVendorProfileCompletionPercent(vendor, catalogItemCount),
    [vendor, catalogItemCount]
  );
  const isComplete = completionPercent >= 100;
  const nextLabel = getNextCompletionLabel(completionItems);
  const completedCount = completionItems.filter((item) => item.done).length;
  const progressColor = isComplete ? Colors.success : completionPercent >= 65 ? Colors.primary : Colors.warning;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: completionPercent,
      duration: 520,
      useNativeDriver: false,
    }).start();
  }, [completionPercent, progress]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 100],
    outputRange: [0, trackWidth],
  });

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.businessName} numberOfLines={2} ellipsizeMode="tail">
            {businessName}
          </Text>
          {(category || location) && (
            <View style={styles.metaWrap}>
              {category && (
                <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                  {category}
                </Text>
              )}
              {category && location && <View style={styles.metaDot} />}
              {location && (
                <Text style={styles.metaText} numberOfLines={1} ellipsizeMode="tail">
                  {location}
                </Text>
              )}
            </View>
          )}
        </View>

        <View style={[styles.verificationBadge, { backgroundColor: badge.background, borderColor: badge.border }]}>
          <BadgeIcon size={13} color={badge.foreground} />
          <Text style={[styles.verificationText, { color: badge.foreground }]} numberOfLines={1}>
            {badge.label}
          </Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        {handle && (
          <View style={styles.softPill}>
            <Text style={styles.softPillText} numberOfLines={1} ellipsizeMode="tail">
              @{handle}
            </Text>
          </View>
        )}
        <View style={styles.softPill}>
          <Text style={styles.softPillText}>Plan: {PLAN_LABELS[plan]}</Text>
        </View>
      </View>

      <Pressable
        onPress={onCompletionPress}
        onPressIn={() => setIsPressed(true)}
        onPressOut={() => setIsPressed(false)}
        accessibilityRole="button"
        accessibilityLabel={`Profile completion ${completionPercent} percent`}
        style={[styles.completionPanel, isPressed && styles.completionPanelPressed]}
      >
        <View style={styles.completionTopRow}>
          <View style={styles.completionCopy}>
            <Text style={styles.completionTitle}>Profile completion</Text>
            <Text style={styles.completionSubtitle} numberOfLines={2}>
              {isComplete ? 'Storefront essentials are ready' : `Next: ${nextLabel}`}
            </Text>
          </View>
          <Text style={[styles.completionPercent, { color: progressColor }]}>{completionPercent}%</Text>
        </View>

        <View style={styles.progressTrack} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
          <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: progressColor }]} />
        </View>

        <View style={styles.completionFooter}>
          <Text style={styles.completionCount}>{completedCount} of {completionItems.length} ready</Text>
          <Text style={styles.completionAction}>Review storefront</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 20,
    padding: 16,
    marginTop: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  headerRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  titleBlock: {
    flex: 1,
    minWidth: 0,
  },
  businessName: {
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '700' as const,
    letterSpacing: -0.35,
    color: Colors.text,
  },
  metaWrap: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flexWrap: 'wrap' as const,
    gap: 7,
    marginTop: 5,
    paddingRight: 4,
  },
  metaText: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
    maxWidth: 190,
  },
  metaDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.textMuted,
  },
  verificationBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    maxWidth: 142,
    flexShrink: 1,
  },
  verificationText: {
    fontSize: 12,
    lineHeight: 15,
    fontWeight: '700' as const,
  },
  statusRow: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    gap: 8,
    marginTop: 14,
  },
  softPill: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    maxWidth: '100%',
  },
  softPillText: {
    fontSize: 12,
    lineHeight: 15,
    color: Colors.textSecondaryOnSurface,
    fontWeight: '700' as const,
  },
  completionPanel: {
    marginTop: 14,
    borderRadius: 16,
    padding: 13,
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  completionPanelPressed: {
    opacity: 0.86,
  },
  completionTopRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    gap: 12,
  },
  completionCopy: {
    flex: 1,
  },
  completionTitle: {
    fontSize: 13,
    lineHeight: 17,
    color: Colors.text,
    fontWeight: '700' as const,
  },
  completionSubtitle: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 17,
    color: Colors.textTertiary,
    fontWeight: '500' as const,
  },
  completionPercent: {
    fontSize: 18,
    lineHeight: 22,
    fontWeight: '800' as const,
    letterSpacing: -0.25,
  },
  progressTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: Colors.borderLight,
    overflow: 'hidden' as const,
    marginTop: 12,
  },
  progressFill: {
    height: 5,
    borderRadius: 999,
  },
  completionFooter: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    gap: 10,
    marginTop: 10,
  },
  completionCount: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.textTertiary,
    fontWeight: '600' as const,
  },
  completionAction: {
    fontSize: 12,
    lineHeight: 16,
    color: Colors.primary,
    fontWeight: '800' as const,
  },
});
