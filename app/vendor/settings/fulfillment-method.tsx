import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useVendorFulfillment, FulfillmentMethodType } from '@/contexts/VendorFulfillmentContext';
import { Colors } from '@/constants/colors';
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
    description: 'You deliver orders to customers yourself or via third-party',
  },
  {
    key: 'shipping',
    label: 'Shipping (Courier / Postal)',
    description: 'You ship orders via courier or postal service',
  },
];

export default function FulfillmentMethodScreen() {
  const router = useRouter();
  const { fulfillmentMethods, setFulfillmentMethods } = useVendorFulfillment();
  const [localMethods, setLocalMethods] = useState(fulfillmentMethods);
  const [isSaving, setIsSaving] = useState(false);

  const toggleMethod = (method: FulfillmentMethodType) => {
    setLocalMethods(prev => ({
      ...prev,
      [method]: !prev[method],
    }));
  };

  const handleSave = async () => {
    const hasAtLeastOne = localMethods.pickup || localMethods.delivery || localMethods.shipping;
    if (!hasAtLeastOne) {
      return;
    }

    try {
      setIsSaving(true);
      await setFulfillmentMethods(localMethods);
      console.log('[FULFILLMENT] Methods saved successfully:', localMethods);
      router.back();
    } catch (error) {
      console.error('[FULFILLMENT] Failed to save methods:', error);
      setIsSaving(false);
    }
  };

  const hasChanges = 
    localMethods.pickup !== fulfillmentMethods.pickup ||
    localMethods.delivery !== fulfillmentMethods.delivery ||
    localMethods.shipping !== fulfillmentMethods.shipping;
  
  const hasAtLeastOne = localMethods.pickup || localMethods.delivery || localMethods.shipping;
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

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Fulfillment Methods</Text>
          <Text style={styles.sectionDescription}>
            Select one or more fulfillment methods. At least one method must be enabled to accept orders.
          </Text>
        </View>

        <View style={styles.section}>
          <View style={styles.optionsCard}>
            {options.map((option, index) => (
              <React.Fragment key={option.key}>
                <View style={styles.optionRow}>
                  <View style={styles.optionContent}>
                    <Text style={styles.optionLabel}>{option.label}</Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                  <Switch
                    value={localMethods[option.key]}
                    onValueChange={() => toggleMethod(option.key)}
                    trackColor={{ false: Colors.border, true: Colors.primary }}
                    thumbColor={Colors.white}
                    disabled={isSaving}
                  />
                </View>
                {index < options.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>
        </View>

        {!hasAtLeastOne && (
          <View style={styles.section}>
            <Text style={styles.warningText}>
              You must enable at least one fulfillment method to accept orders.
            </Text>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

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

  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionDescription: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
    paddingHorizontal: 4,
  },
  optionsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  optionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionContent: {
    flex: 1,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  warningText: {
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  bottomSpacer: {
    height: 40,
  },

});
