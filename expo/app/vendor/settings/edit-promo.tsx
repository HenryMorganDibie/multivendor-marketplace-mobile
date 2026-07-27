import React, { useState, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter, useLocalSearchParams } from 'expo-router';
import EditScreenHeader from '@/components/EditScreenHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LaektivaModal from '@/components/LaektivaModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';

interface PromoCode {
  id: string;
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  expiryDate: string;
  isActive: boolean;
}

const PROMO_CODES_STORAGE_KEY = '@the platform_vendor_promo_codes';

export default function EditPromoScreen() {
  const routerNav = useRouter();
  const { promoId } = useLocalSearchParams<{ promoId: string }>();
  const [promo, setPromo] = useState<PromoCode | null>(null);
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'percentage' | 'flat'>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [expiryDate, setExpiryDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const unsavedChanges = useUnsavedChanges(
    { code, discountType, discountValue, expiryDate: expiryDate.toISOString() },
    false
  );

  useEffect(() => {
    const loadPromo = async () => {
      if (!promoId) return;
      const stored = await AsyncStorage.getItem(PROMO_CODES_STORAGE_KEY);
      const existing: PromoCode[] = stored ? JSON.parse(stored) : [];
      const found = existing.find((p) => p.id === promoId) ?? null;
      setPromo(found);
      if (found) {
        setCode(found.code);
        setDiscountType(found.discountType);
        setDiscountValue(found.discountValue.toString());
        setExpiryDate(new Date(found.expiryDate));
      }
    };
    void loadPromo();
  }, [promoId]);

  const handleSave = async () => {
    if (isSaving || !promo) return;

    const trimmedCode = code.trim().toUpperCase();
    const numericValue = parseFloat(discountValue);

    if (!trimmedCode || trimmedCode.length < 4 || trimmedCode.length > 10) {
      console.log('Invalid code length');
      return;
    }

    if (!numericValue || numericValue <= 0) {
      console.log('Invalid discount value');
      return;
    }

    if (discountType === 'percentage' && numericValue > 100) {
      console.log('Percentage cannot exceed 100');
      return;
    }

    setIsSaving(true);

    try {
      const updatedPromo: PromoCode = {
        ...promo,
        code: trimmedCode,
        discountType,
        discountValue: numericValue,
        expiryDate: expiryDate.toISOString(),
      };

      const stored = await AsyncStorage.getItem(PROMO_CODES_STORAGE_KEY);
      const existing: PromoCode[] = stored ? JSON.parse(stored) : [];
      await AsyncStorage.setItem(
        PROMO_CODES_STORAGE_KEY,
        JSON.stringify(existing.map((p) => (p.id === updatedPromo.id ? updatedPromo : p))),
      );
      unsavedChanges.resetChanges();
      router.back();
    } catch (error) {
      console.error('Failed to save promo:', error);
      setIsSaving(false);
    }
  };

  const isValid =
    code.trim().length >= 4 &&
    code.trim().length <= 10 &&
    discountValue &&
    parseFloat(discountValue) > 0 &&
    (discountType === 'flat' || parseFloat(discountValue) <= 100);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  if (!promo) {
    return null;
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Edit Promo Code"
          onBack={() => {
            if (!unsavedChanges.handleExitAttempt()) return;
            routerNav.back();
          }}
          showSave={false}
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.label}>Promo Code</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="4–10 characters, no spaces"
              placeholderTextColor={Colors.textSecondary}
              autoCapitalize="characters"
              maxLength={10}
            />
            <Text style={styles.helperText}>4–10 characters, no spaces</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Discount Type</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setDiscountType('percentage')}
                activeOpacity={0.8}
              >
                <View style={styles.radioButton}>
                  {discountType === 'percentage' && <View style={styles.radioButtonSelected} />}
                </View>
                <Text style={styles.radioLabel}>Percentage</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.radioOption}
                onPress={() => setDiscountType('flat')}
                activeOpacity={0.8}
              >
                <View style={styles.radioButton}>
                  {discountType === 'flat' && <View style={styles.radioButtonSelected} />}
                </View>
                <Text style={styles.radioLabel}>Flat Amount</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Discount Value</Text>
            <View style={styles.inputWithPrefix}>
              {discountType === 'flat' && <Text style={styles.prefix}>$</Text>}
              <TextInput
                style={[styles.input, discountType === 'flat' && styles.inputWithPrefixInput]}
                value={discountValue}
                onChangeText={setDiscountValue}
                placeholder={discountType === 'percentage' ? 'Enter percentage' : 'Enter amount'}
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
              />
              {discountType === 'percentage' && <Text style={styles.suffix}>%</Text>}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Expiry Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.8}
            >
              <Text style={styles.dateButtonText}>{formatDate(expiryDate)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteText}>
              Promo codes apply in cart before customers send an order request.
            </Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                if (!unsavedChanges.handleExitAttempt()) {
                  return;
                }
                router.back();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.saveButton, (!isValid || isSaving) && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={!isValid || isSaving}
              activeOpacity={0.8}
            >
              <Text style={[styles.saveButtonText, (!isValid || isSaving) && styles.saveButtonTextDisabled]}>
                {isSaving ? 'Saving...' : 'Save Promo'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {showDatePicker && (
        <DateTimePicker
          value={expiryDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowDatePicker(Platform.OS === 'ios');
            if (selectedDate) {
              setExpiryDate(selectedDate);
            }
          }}
        />
      )}

      <LaektivaModal
        visible={unsavedChanges.showDiscardModal}
        title="Discard changes?"
        message="If you leave now, your unsaved changes will be lost."
        primaryButton={{
          label: 'Discard',
          onPress: () => {
            unsavedChanges.handleDiscard();
            router.back();
          },
        }}
        secondaryButton={{
          label: 'Keep editing',
          onPress: unsavedChanges.handleKeepEditing,
        }}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
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
    marginTop: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  radioGroup: {
    gap: 12,
  },
  radioOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  radioButtonSelected: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: 16,
    color: Colors.text,
  },
  inputWithPrefix: {
    position: 'relative' as const,
  },
  inputWithPrefixInput: {
    paddingLeft: 36,
  },
  prefix: {
    position: 'absolute' as const,
    left: 16,
    top: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    zIndex: 1,
  },
  suffix: {
    position: 'absolute' as const,
    right: 16,
    top: 16,
    fontSize: 16,
    color: Colors.textSecondary,
    zIndex: 1,
  },
  dateButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateButtonText: {
    fontSize: 16,
    color: Colors.white,
  },
  noteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginTop: 24,
  },
  noteText: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 20,
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  footerButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.white,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.charcoal,
    minHeight: 52,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  saveButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.surface,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  saveButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
