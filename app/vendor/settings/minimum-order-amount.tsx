import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
import { getCurrencySymbol, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';

const CURRENCY = getCurrencySymbol((mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode));

function formatCurrencyDisplay(value: string): string {
  const num = value.replace(/[^0-9]/g, '');
  if (!num) return '';
  const parsed = parseInt(num, 10);
  if (isNaN(parsed)) return '';
  return parsed.toLocaleString();
}

export default function MinimumOrderAmountScreen() {
  const [savedEnabled, setSavedEnabled] = useState(false);
  const [savedAmount, setSavedAmount] = useState('');

  const [isEnabled, setIsEnabled] = useState(false);
  const [amount, setAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  const inputRef = useRef<TextInput>(null);

  const hasChanges = isEnabled !== savedEnabled || amount !== savedAmount;
  const isValidAmount = !isEnabled || (amount.trim().length > 0 && parseFloat(amount.replace(/,/g, '')) > 0);
  const canSave = hasChanges && isValidAmount;

  const numericAmount = parseFloat(amount.replace(/,/g, '') || '0');

  useEffect(() => {
    if (isEnabled) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isEnabled]);

  const handleToggle = useCallback((val: boolean) => {
    setIsEnabled(val);
    if (!val) {
      setAmountError('');
    }
    console.log('[MinimumOrderAmount] toggle changed:', val);
  }, []);

  const handleAmountChange = useCallback((val: string) => {
    const formatted = formatCurrencyDisplay(val);
    setAmount(formatted);
    if (amountError && formatted.length > 0) {
      setAmountError('');
    }
  }, [amountError]);

  const handleSave = useCallback(() => {
    const raw = parseFloat(amount.replace(/,/g, ''));
    if (isEnabled && (!amount || raw <= 0)) {
      setAmountError('Amount must be greater than 0.');
      return;
    }
    console.log('[MinimumOrderAmount] saved:', { isEnabled, amount: isEnabled ? raw : null });
    setSavedEnabled(isEnabled);
    setSavedAmount(amount);
  }, [isEnabled, amount]);

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Minimum Order Amount',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
          headerRight: () => (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[
                styles.headerSaveText,
                !canSave && styles.headerSaveTextDisabled,
              ]}>
                Save
              </Text>
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.helperText}>
            Require customers to spend a minimum amount before placing an order.
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Enable minimum order amount</Text>
            <Switch
              value={isEnabled}
              onValueChange={handleToggle}
              trackColor={{ false: Colors.border, true: Colors.primary }}
              thumbColor={Colors.white}
              ios_backgroundColor={Colors.border}
            />
          </View>

          {isEnabled && (
            <View style={styles.inputSection}>
              <Text style={styles.inputLabel}>Minimum order amount</Text>
              <View style={[styles.inputRow, amountError ? styles.inputRowError : null]}>
                <Text style={styles.currencySymbol}>{CURRENCY}</Text>
                <TextInput
                  ref={inputRef}
                  style={styles.input}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder={`e.g. 5,000`}
                  placeholderTextColor={Colors.inputPlaceholder}
                  keyboardType="number-pad"
                  returnKeyType="done"
                />
              </View>
              {amountError ? (
                <Text style={styles.errorText}>{amountError}</Text>
              ) : (
                <Text style={styles.helperTextBelow}>
                  {numericAmount > 0
                    ? `Customers must spend at least ${CURRENCY}${amount} to place an order`
                    : `Customers must spend at least this amount to place an order`}
                </Text>
              )}
            </View>
          )}
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
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
  },
  helperText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  toggleLabel: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  inputSection: {
    marginTop: 20,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.4,
  },
  inputRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputRowError: {
    borderColor: Colors.error,
  },
  currencySymbol: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: Colors.text,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 6,
    lineHeight: 18,
  },
  headerSaveText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  headerSaveTextDisabled: {
    color: Colors.disabledText,
  },
  helperTextBelow: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
});
