import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '@/constants/colors';

/**
 * Shared section title row — icon + title on the left, an optional
 * "See All"-style chevron affordance on the right. Consolidates the
 * repeated inline sectionHeader/sectionTitle pattern the Customer UI
 * Audit found duplicated across Home and Explore.
 *
 * Not yet wired into either screen — this is the Phase 1 foundation only.
 * Horizontal padding is left to the calling screen (Home and Explore
 * already differ on this), matching the audit's proposal to standardize
 * the row itself, not screen-level spacing, in this phase.
 */
export interface SectionHeaderProps {
  title: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onPress?: () => void;
  showChevron?: boolean;
}

export function SectionHeader({
  title,
  icon,
  actionLabel,
  onPress,
  showChevron = true,
}: SectionHeaderProps) {
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={styles.header}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : undefined}
    >
      <View style={styles.titleRow}>
        {icon}
        <Text style={Typography.sectionTitle} numberOfLines={1}>
          {title}
        </Text>
      </View>
      {onPress && (
        <View style={styles.action}>
          {actionLabel ? <Text style={styles.actionLabel}>{actionLabel}</Text> : null}
          {showChevron && (
            <ChevronRight size={20} color={Colors.textSecondary} strokeWidth={2} />
          )}
        </View>
      )}
    </Container>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.s,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  actionLabel: {
    ...Typography.bodySecondary,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
});
