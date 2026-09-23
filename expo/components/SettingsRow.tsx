import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors, Spacing, Radii, Typography } from '@/constants/colors';

/**
 * Shared row for a tappable settings/menu list item — icon, label, optional
 * subtitle, optional chevron. Consolidates the two near-identical local
 * `MenuRow` (customer Profile) and `SettingsRow` (Settings hub) components
 * the Customer UI Audit found.
 *
 * Not yet wired into either screen — this is the Phase 1 foundation only.
 */
export interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  showDivider?: boolean;
  showChevron?: boolean;
  destructive?: boolean;
}

export function SettingsRow({
  icon,
  iconBg,
  label,
  subtitle,
  onPress,
  showDivider = true,
  showChevron = true,
  destructive = false,
}: SettingsRowProps) {
  return (
    <>
      <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.55}>
        <View
          style={[
            styles.iconWrap,
            iconBg ? { backgroundColor: iconBg } : null,
            destructive && styles.iconWrapDestructive,
          ]}
        >
          {icon}
        </View>
        <View style={styles.textWrap}>
          <Text style={[styles.label, destructive && styles.labelDestructive]}>
            {label}
          </Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {showChevron && !destructive && (
          <ChevronRight size={15} color={Colors.textMuted} strokeWidth={2.5} />
        )}
      </TouchableOpacity>
      {showDivider && <View style={styles.divider} />}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.s,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.s,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: Radii.sm,
    backgroundColor: Colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  iconWrapDestructive: {
    backgroundColor: Colors.errorLight,
  },
  textWrap: {
    flex: 1,
  },
  label: {
    ...Typography.body,
    fontWeight: '500',
    letterSpacing: -0.1,
  },
  labelDestructive: {
    color: Colors.error,
  },
  subtitle: {
    ...Typography.bodySecondary,
    color: Colors.textMuted,
    marginTop: 1.5,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSoft,
    marginLeft: 34 + Spacing.s + Spacing.sm,
  },
});
