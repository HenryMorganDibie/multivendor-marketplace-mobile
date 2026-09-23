import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { Colors, Spacing, Typography } from '@/constants/colors';

/**
 * Shared customer header — centered title, optional back button, optional
 * right-side action. Consolidates the two near-identical local components
 * the Customer UI Audit found (`EditScreenHeader`, `HelpCenterHeader`),
 * which both now render through this one.
 *
 * The back and right slots are always the same fixed width (SIDE_SLOT_WIDTH),
 * whether or not a back button or right action is actually present, so the
 * title never shifts off-center depending on which side is populated — the
 * audit's Cluster D asymmetric-header bug class.
 */
export interface CustomerHeaderProps {
  title: string;
  onBack?: () => void;
  /**
   * Keeps the back button visible in its usual place but non-interactive —
   * for a screen mid-submit that shouldn't be left via the header, without
   * the button disappearing (which would reflow nothing today since the
   * slot is fixed-width, but would still read as the back action vanishing
   * rather than being temporarily blocked). Has no effect unless `onBack`
   * is also provided; ignored by every existing caller that doesn't pass it.
   */
  backDisabled?: boolean;
  rightAction?: React.ReactNode;
  backgroundColor?: string;
  testID?: string;
}

const SIDE_SLOT_WIDTH = 36;

export default function CustomerHeader({
  title,
  onBack,
  backDisabled = false,
  rightAction,
  backgroundColor = Colors.background,
  testID,
}: CustomerHeaderProps) {
  return (
    <SafeAreaView edges={['top']} style={[styles.safeArea, { backgroundColor }]}>
      <View style={styles.header} testID={testID}>
        {onBack ? (
          <TouchableOpacity
            onPress={backDisabled ? undefined : onBack}
            disabled={backDisabled}
            style={[styles.backButton, backDisabled && styles.backButtonDisabled]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.65}
            accessibilityState={{ disabled: backDisabled }}
            testID={testID ? `${testID}-back` : undefined}
          >
            <ChevronLeft size={20} color={Colors.text} strokeWidth={2.2} />
          </TouchableOpacity>
        ) : (
          <View style={styles.sideSlot} />
        )}

        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>

        {rightAction ? (
          <View style={styles.rightSlot}>{rightAction}</View>
        ) : (
          <View style={styles.sideSlot} />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 52,
  },
  backButton: {
    width: SIDE_SLOT_WIDTH,
    height: SIDE_SLOT_WIDTH,
    borderRadius: SIDE_SLOT_WIDTH / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backButtonDisabled: {
    opacity: 0.4,
  },
  sideSlot: {
    width: SIDE_SLOT_WIDTH,
  },
  rightSlot: {
    minWidth: SIDE_SLOT_WIDTH,
    alignItems: 'flex-end',
  },
  title: {
    flex: 1,
    fontSize: Typography.headerTitle.fontSize,
    fontWeight: Typography.headerTitle.fontWeight,
    color: Colors.text,
    textAlign: 'center',
    marginHorizontal: Spacing.xs,
  },
});
