import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useVendorPickup } from '@/contexts/VendorPickupContext';
import { Lock } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import DiscardChangesModal from '@/components/DiscardChangesModal';

export default function PickupDetailsScreen() {
  const router = useRouter();
  const { pickupDetails, savePickupDetails, isLoaded, validateAddressInBusinessArea } = useVendorPickup();
  const [streetAddress, setStreetAddress] = useState('');
  const [unit, setUnit] = useState('');
  const [pickupInstructions, setPickupInstructions] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [addressError, setAddressError] = useState('');

  useEffect(() => {
    if (isLoaded) {
      setStreetAddress(pickupDetails.streetAddress);
      setUnit(pickupDetails.unit);
      setPickupInstructions(pickupDetails.instructions);
      setContactPhone(pickupDetails.contactPhone);
      setVerificationCode(pickupDetails.verificationCode);
    }
  }, [isLoaded, pickupDetails]);

  const unsavedChanges = useUnsavedChanges(
    { streetAddress, unit, pickupInstructions, contactPhone, verificationCode },
    false
  );



  const handleSave = async () => {
    setAddressError('');

    if (!streetAddress.trim()) {
      setAddressError('Street address is required');
      return;
    }

    const isValid = validateAddressInBusinessArea(
      streetAddress,
      pickupDetails.businessArea.city
    );

    if (!isValid) {
      setAddressError(
        `Pickup address must be within your approved business area (${pickupDetails.businessArea.city}, ${pickupDetails.businessArea.state}).`
      );
      return;
    }

    try {
      await savePickupDetails({
        streetAddress,
        unit,
        instructions: pickupInstructions,
        contactPhone: contactPhone,
        verificationCode: verificationCode,
        businessArea: pickupDetails.businessArea,
      });
      Alert.alert('Success', 'Pickup details saved', [{ text: 'OK' }]);
    } catch {
      Alert.alert('Error', 'Failed to save pickup details', [{ text: 'OK' }]);
    }
  };

  const handleRequestAreaChange = () => {
    router.push('/vendor/settings/request-country-change' as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Pickup Details',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!unsavedChanges.hasUnsavedChanges}
              activeOpacity={0.7}
            >
              <Text style={[pickupHeaderStyles.saveText, !unsavedChanges.hasUnsavedChanges && pickupHeaderStyles.saveTextDisabled]}>Save</Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Street Address</Text>
            <TextInput
              style={[styles.input, addressError ? styles.inputError : null]}
              placeholder="123 Main Street"
              placeholderTextColor={Colors.textSecondary}
              value={streetAddress}
              onChangeText={(text) => {
                setStreetAddress(text);
                setAddressError('');
              }}
              maxLength={200}
            />
            {addressError ? (
              <Text style={styles.errorText}>{addressError}</Text>
            ) : null}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Unit / Suite (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="Unit 5B"
              placeholderTextColor={Colors.textSecondary}
              value={unit}
              onChangeText={setUnit}
              maxLength={50}
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>City</Text>
            <View style={styles.lockedField}>
              <Text style={styles.lockedFieldText}>{pickupDetails.businessArea.city}</Text>
              <Lock size={16} color={Colors.textSecondary} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Province / State</Text>
            <View style={styles.lockedField}>
              <Text style={styles.lockedFieldText}>{pickupDetails.businessArea.state}</Text>
              <Lock size={16} color={Colors.textSecondary} />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Country</Text>
            <View style={styles.lockedField}>
              <Text style={styles.lockedFieldText}>{pickupDetails.businessArea.country}</Text>
              <Lock size={16} color={Colors.textSecondary} />
            </View>
            <Text style={styles.helperText}>
              Your business area was verified during onboarding.{"\n"}
              To operate in a different area, you&apos;ll need approval from the platform Support.
            </Text>
            <TouchableOpacity onPress={handleRequestAreaChange} activeOpacity={0.7}>
              <Text style={styles.linkText}>Request business area change</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Pickup Instructions</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Add any special instructions"
              placeholderTextColor={Colors.textSecondary}
              value={pickupInstructions}
              onChangeText={setPickupInstructions}
              maxLength={300}
              multiline
              textAlignVertical="top"
            />
            <View style={styles.charCounterContainer}>
              <Text style={styles.charCounter}>{pickupInstructions.length} / 300</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Pickup Contact Phone</Text>
            <Text style={styles.helperText}>Visible to customers before payment</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter contact phone number"
              placeholderTextColor={Colors.textSecondary}
              value={contactPhone}
              onChangeText={setContactPhone}
              maxLength={20}
              keyboardType="phone-pad"
            />
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Verification Code (Optional)</Text>
            <Text style={styles.helperText}>Only shared after payment. Not required.</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., PICKUP2025 or 1234"
              placeholderTextColor={Colors.textSecondary}
              value={verificationCode}
              onChangeText={setVerificationCode}
              maxLength={20}
              autoCapitalize="characters"
            />
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <DiscardChangesModal
        visible={unsavedChanges.showDiscardModal}
        onKeepEditing={unsavedChanges.handleKeepEditing}
        onDiscard={() => {
          unsavedChanges.handleDiscard();
          router.back();
        }}
      />
    </View>
  );
}

const pickupHeaderStyles = StyleSheet.create({
  saveText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  saveTextDisabled: {
    color: Colors.textMuted,
    opacity: 0.5,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  section: {
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    textAlignVertical: 'top' as const,
    minHeight: 120,
  },
  charCounterContainer: {
    marginTop: 8,
    alignItems: 'flex-end' as const,
  },
  charCounter: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  lockedField: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    opacity: 0.6,
  },
  lockedFieldText: {
    fontSize: 17,
    color: Colors.text,
  },
  linkText: {
    fontSize: 15,
    color: Colors.primary,
    marginTop: 12,
  },
  inputError: {
    borderWidth: 1,
    borderColor: Colors.error,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 8,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
  },
  bottomSpacer: {
    height: 40,
  },
});
