import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

type FulfillmentType = 'Pickup' | 'Delivery' | null;

interface LockConfig {
  bannerType: 'warning' | 'neutral' | 'error';
  bannerText: string;
  bannerSubtext?: string;
  badgeLabel?: string;
}

interface CartVendorSectionProps {
  vendorName: string;
  isCartLocked: boolean;
  lockConfig: LockConfig | null;
  selectedFulfillment: FulfillmentType;
  onSelectFulfillment: (type: FulfillmentType) => void;
  fulfillmentTypes: string[];
}

export function CartVendorSection({
  vendorName,
  isCartLocked,
  lockConfig,
  selectedFulfillment,
  onSelectFulfillment,
  fulfillmentTypes,
}: CartVendorSectionProps) {
  return (
    <>
      {isCartLocked && lockConfig && (
        <View
          style={[
            styles.lockBanner,
            lockConfig.bannerType === 'warning' && styles.lockBannerWarning,
            lockConfig.bannerType === 'neutral' && styles.lockBannerNeutral,
            lockConfig.bannerType === 'error' && styles.lockBannerError,
          ]}
        >
          <View style={styles.lockBannerRow}>
            <Lock
              size={14}
              color={
                lockConfig.bannerType === 'error'
                  ? Colors.error
                  : lockConfig.bannerType === 'neutral'
                  ? Colors.textSecondary
                  : Colors.primary
              }
            />
            <Text
              style={[
                styles.lockBannerText,
                lockConfig.bannerType === 'error' && styles.lockBannerTextError,
                lockConfig.bannerType === 'neutral' && styles.lockBannerTextNeutral,
              ]}
            >
              {lockConfig.bannerText}
            </Text>
          </View>
          {lockConfig.bannerSubtext && (
            <Text style={styles.lockBannerSubtext}>{lockConfig.bannerSubtext}</Text>
          )}
        </View>
      )}

      <View style={styles.vendorNameContainer}>
        <Text style={styles.vendorName}>{vendorName}</Text>
        {isCartLocked && lockConfig?.badgeLabel && (
          <View
            style={[
              styles.lockBadge,
              lockConfig.bannerType === 'neutral' && styles.lockBadgeNeutral,
              lockConfig.bannerType === 'error' && styles.lockBadgeError,
            ]}
          >
            <Text
              style={[
                styles.lockBadgeText,
                lockConfig.bannerType === 'neutral' && styles.lockBadgeTextNeutral,
                lockConfig.bannerType === 'error' && styles.lockBadgeTextError,
              ]}
            >
              {lockConfig.badgeLabel}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.fulfillmentSection}>
        <View style={[styles.segmentedControl, isCartLocked && styles.segmentedControlLocked]}>
          {fulfillmentTypes.map((type) => {
            const isSelected = selectedFulfillment === type;
            const isDisabled = fulfillmentTypes.length === 1 || isCartLocked;
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.segmentedButton,
                  isSelected && styles.segmentedButtonActive,
                  (fulfillmentTypes.length === 1 || isCartLocked) && styles.segmentedButtonSingle,
                ]}
                onPress={() => !isDisabled && onSelectFulfillment(type as FulfillmentType)}
                disabled={isDisabled}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.segmentedButtonText,
                    isSelected && styles.segmentedButtonTextActive,
                    isCartLocked && styles.segmentedButtonTextLocked,
                  ]}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  lockBanner: {
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: 'rgba(255,140,66,0.08)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,140,66,0.2)',
  },
  lockBannerWarning: {
    backgroundColor: 'rgba(255,140,66,0.08)',
    borderColor: 'rgba(255,140,66,0.2)',
  },
  lockBannerNeutral: {
    backgroundColor: Colors.surface,
    borderColor: Colors.border,
  },
  lockBannerError: {
    backgroundColor: Colors.errorLight,
    borderColor: Colors.errorBorder,
  },
  lockBannerRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
    marginBottom: 4,
  },
  lockBannerText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  lockBannerTextNeutral: {
    color: Colors.textSecondary,
  },
  lockBannerTextError: {
    color: Colors.error,
  },
  lockBannerSubtext: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    paddingLeft: 22,
  },
  vendorNameContainer: {
    paddingTop: 16,
    paddingBottom: 12,
  },
  vendorName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  lockBadge: {
    backgroundColor: 'rgba(255,140,66,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start' as const,
    marginTop: 6,
  },
  lockBadgeNeutral: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lockBadgeError: {
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.errorBorder,
  },
  lockBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  lockBadgeTextNeutral: {
    color: Colors.textSecondary,
  },
  lockBadgeTextError: {
    color: Colors.error,
  },
  fulfillmentSection: {
    marginTop: 4,
  },
  segmentedControl: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.border,
    borderRadius: 10,
    padding: 3,
    gap: 3,
  },
  segmentedControlLocked: {
    opacity: 0.6,
  },
  segmentedButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  segmentedButtonActive: {
    backgroundColor: Colors.background,
  },
  segmentedButtonSingle: {
    backgroundColor: Colors.background,
  },
  segmentedButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  segmentedButtonTextActive: {
    color: Colors.text,
  },
  segmentedButtonTextLocked: {
    color: Colors.textMuted,
  },
});
