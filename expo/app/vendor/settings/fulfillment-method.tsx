import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { CircleAlert } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useVendorFulfillment, FulfillmentMethodType } from '@/contexts/VendorFulfillmentContext';
import { useVendor } from '@/contexts/VendorContext';
import { Colors } from '@/constants/colors';
import { Alert } from '@/utils/alert';
import EditScreenHeader from '@/components/EditScreenHeader';

type FulfillmentOption = {
  key: FulfillmentMethodType;
  label: string;
  description: string;
};

const options: FulfillmentOption[] = [
  {
    key: 'pickup',
    label: 'Pickup',
    description: 'Customers collect orders from your location',
  },
  {
    key: 'delivery',
    label: 'Local Delivery',
    description: 'You deliver orders yourself or via a trusted partner',
  },
  {
    key: 'shipping',
    label: 'Shipping (Courier / Postal)',
    description: 'You ship orders through courier or postal service',
  },
];

if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateLayout(): void {
  LayoutAnimation.configureNext(
    LayoutAnimation.create(180, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity)
  );
}

function hasEnabledMethod(methods: Record<FulfillmentMethodType, boolean>): boolean {
  return methods.pickup || methods.delivery || methods.shipping;
}

function EnabledIndicator({ visible }: { visible: boolean }) {
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [opacity, visible]);

  return <Animated.View style={[styles.enabledRail, { opacity }]} />;
}

export default function FulfillmentMethodScreen() {
  const router = useRouter();
  const { vendor } = useVendor();
  const { fulfillmentMethods, setFulfillmentMethods } = useVendorFulfillment();
  const [localMethods, setLocalMethods] = useState(fulfillmentMethods);
  const [isSaving, setIsSaving] = useState(false);
  const [showValidation, setShowValidation] = useState(!hasEnabledMethod(fulfillmentMethods));

  useEffect(() => {
    setLocalMethods(fulfillmentMethods);
    setShowValidation(!hasEnabledMethod(fulfillmentMethods));
  }, [fulfillmentMethods]);

  const toggleMethod = useCallback((method: FulfillmentMethodType) => {
    animateLayout();
    setLocalMethods(prev => {
      const next = {
        ...prev,
        [method]: !prev[method],
      };
      setShowValidation(!hasEnabledMethod(next));
      return next;
    });

    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  const handleSave = async () => {
    const hasAtLeastOne = hasEnabledMethod(localMethods);
    if (!hasAtLeastOne) {
      setShowValidation(true);
      if (Platform.OS !== 'web') {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      return;
    }

    const payload = {
      pickupEnabled: localMethods.pickup,
      deliveryEnabled: localMethods.delivery,
      shippingEnabled: localMethods.shipping,
      updatedAt: new Date().toISOString(),
      vendorId: vendor.id,
    };

    try {
      setIsSaving(true);
      await setFulfillmentMethods(localMethods, payload);
      console.log('[FULFILLMENT] Methods saved successfully:', payload);
      router.back();
    } catch (error) {
      // setFulfillmentMethods already reconciles fulfillmentMethods back to
      // the last authoritative value on failure -- this only needs to tell
      // the vendor the save didn't happen, rather than leaving them on a
      // screen that silently reverted with no explanation.
      console.error('[FULFILLMENT] Failed to save methods:', error);
      const message = error instanceof Error ? error.message : 'Could not save your fulfillment methods. Please try again.';
      Alert.alert('Could not save', message);
      setLocalMethods(fulfillmentMethods);
      setIsSaving(false);
    }
  };

  const hasChanges =
    localMethods.pickup !== fulfillmentMethods.pickup ||
    localMethods.delivery !== fulfillmentMethods.delivery ||
    localMethods.shipping !== fulfillmentMethods.shipping;

  const hasAtLeastOne = hasEnabledMethod(localMethods);
  const canSave = hasAtLeastOne && hasChanges;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <EditScreenHeader
          title="Fulfillment Method"
          onBack={() => router.back()}
          onSave={handleSave}
          saveEnabled={canSave}
          isSaving={isSaving}
        />
      </SafeAreaView>

      <SafeAreaView edges={['bottom']} style={styles.bodySafeArea}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.introSection}>
            <Text style={styles.sectionTitle}>Fulfillment Methods</Text>
            <Text style={styles.sectionDescription}>
              Choose how customers can receive orders from your business. At least one method must stay enabled.
            </Text>
          </View>

          <View style={styles.optionsCard}>
            {options.map((option, index) => {
              const isEnabled = localMethods[option.key];
              return (
                <React.Fragment key={option.key}>
                  <Pressable
                    onPress={() => !isSaving && toggleMethod(option.key)}
                    disabled={isSaving}
                    accessibilityRole="switch"
                    accessibilityState={{ checked: isEnabled, disabled: isSaving }}
                    accessibilityLabel={option.label}
                    accessibilityHint={option.description}
                    style={({ pressed }) => [
                      styles.optionRow,
                      isEnabled && styles.optionRowActive,
                      pressed && !isSaving && styles.optionRowPressed,
                    ]}
                  >
                    <EnabledIndicator visible={isEnabled} />
                    <View style={styles.optionContent}>
                      <Text style={[styles.optionLabel, isEnabled && styles.optionLabelActive]}>
                        {option.label}
                      </Text>
                      <Text style={styles.optionDescription}>{option.description}</Text>
                    </View>
                    <View style={styles.switchWrap} pointerEvents="none">
                      <Switch
                        value={isEnabled}
                        onValueChange={() => toggleMethod(option.key)}
                        trackColor={{ false: Colors.borderDark, true: 'rgba(255,122,40,0.42)' }}
                        thumbColor={isEnabled ? Colors.primary : Colors.white}
                        ios_backgroundColor={Colors.borderDark}
                        disabled={isSaving}
                        style={styles.switch}
                      />
                    </View>
                  </Pressable>
                  {index < options.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
          </View>

          {showValidation && !hasAtLeastOne && (
            <Animated.View style={styles.validationCard}>
              <CircleAlert size={16} color={Colors.warning} strokeWidth={2} />
              <Text style={styles.validationText}>
                Enable at least one fulfillment method so customers know how orders can be completed.
              </Text>
            </Animated.View>
          )}

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
    backgroundColor: Colors.background,
  },
  bodySafeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },
  introSection: {
    paddingHorizontal: 4,
    marginBottom: 14,
    maxWidth: 560,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 5,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  optionsCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    overflow: 'hidden',
    shadowColor: Colors.black,
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
  optionRow: {
    minHeight: 74,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    paddingLeft: 15,
    paddingRight: 12,
    backgroundColor: Colors.cardBackground,
  },
  optionRowActive: {
    backgroundColor: Colors.primarySofter,
  },
  optionRowPressed: {
    backgroundColor: Colors.surfaceElevated,
  },
  enabledRail: {
    width: 3,
    alignSelf: 'stretch' as const,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginRight: 12,
  },
  optionContent: {
    flex: 1,
    paddingRight: 12,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
    lineHeight: 21,
    marginBottom: 2,
  },
  optionLabelActive: {
    color: Colors.text,
  },
  optionDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  switchWrap: {
    minWidth: 48,
    minHeight: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  switch: {
    transform: [{ scaleX: 0.86 }, { scaleY: 0.86 }],
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
    marginLeft: 30,
  },
  validationCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 9,
    marginTop: 12,
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: Colors.warningLight,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.18)',
  },
  validationText: {
    flex: 1,
    fontSize: 13,
    color: '#7A4B00',
    lineHeight: 18,
  },
  bottomSpacer: {
    height: 28,
  },
});
