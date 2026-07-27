import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Lock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import type { OrderLockConfig } from '@/utils/orderImmutability';

type FulfillmentType = 'Pickup' | 'Delivery' | null;

interface CartVendorSectionProps {
  vendorName: string;
  isCartLocked: boolean;
  lockConfig: OrderLockConfig | null;
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
      {isCartLocked && lockConfig && lockConfig.bannerText && (
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

      {fulfillmentTypes.length > 0 && (
        <PillToggle
          options={fulfillmentTypes}
          selected={selectedFulfillment}
          onSelect={(type) => !isCartLocked && onSelectFulfillment(type as FulfillmentType)}
          disabled={isCartLocked || fulfillmentTypes.length === 1}
        />
      )}
    </>
  );
}

function PillToggle({
  options,
  selected,
  onSelect,
  disabled,
}: {
  options: string[];
  selected: FulfillmentType;
  onSelect: (type: string) => void;
  disabled: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const selectedIndex = options.findIndex((o) => o === selected);

  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: selectedIndex >= 0 ? selectedIndex : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [selectedIndex, slideAnim]);

  const pillCount = options.length;

  return (
    <View style={pillStyles.wrapper}>
      <View style={[pillStyles.track, disabled && pillStyles.trackDisabled]}>
        {pillCount > 1 && selectedIndex >= 0 && (
          <Animated.View
            style={[
              pillStyles.activePill,
              {
                width: `${100 / pillCount}%` as any,
                left: slideAnim.interpolate({
                  inputRange: options.map((_, i) => i),
                  outputRange: options.map((_, i) => `${(100 / pillCount) * i}%`),
                }) as any,
              },
            ]}
          />
        )}
        {options.map((type, _i) => {
          const isSelected = selected === type;
          return (
            <TouchableOpacity
              key={type}
              style={pillStyles.pill}
              onPress={() => !disabled && onSelect(type)}
              disabled={disabled}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  pillStyles.pillText,
                  isSelected && pillStyles.pillTextActive,
                  disabled && pillStyles.pillTextDisabled,
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const pillStyles = StyleSheet.create({
  wrapper: {
    marginTop: 6,
    marginBottom: 2,
  },
  track: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 999,
    padding: 4,
    alignSelf: 'flex-start',
    position: 'relative',
    height: 38,
  },
  trackDisabled: {
    opacity: 0.55,
  },
  activePill: {
    position: 'absolute',
    top: 4,
    bottom: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  pill: {
    paddingHorizontal: 16,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6B7280',
  },
  pillTextActive: {
    color: '#111827',
    fontWeight: '600',
  },
  pillTextDisabled: {
    color: '#9CA3AF',
  },
});

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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  lockBannerText: {
    fontSize: 14,
    fontWeight: '600',
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
    fontWeight: '700',
    color: Colors.text,
  },
  lockBadge: {
    backgroundColor: 'rgba(255,140,66,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
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
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.5,
  },
  lockBadgeTextNeutral: {
    color: Colors.textSecondary,
  },
  lockBadgeTextError: {
    color: Colors.error,
  },

});
