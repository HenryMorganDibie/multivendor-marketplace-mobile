import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter } from 'expo-router';
import EditScreenHeader from '@/components/EditScreenHeader';
import DateTimePicker from '@react-native-community/datetimepicker';
import LaektivaModal from '@/components/LaektivaModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import { usePromo, type PromotionType, type VendorPromotionDraft } from '@/contexts/PromoContext';
import { useVendor } from '@/contexts/VendorContext';
import { getCurrencySymbol, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';

const TYPE_OPTIONS: { value: PromotionType; label: string }[] = [
  { value: 'percentage', label: 'Percentage off' },
  { value: 'flat', label: 'Flat amount off' },
  { value: 'free_delivery', label: 'Free delivery' },
  { value: 'free_item', label: 'Free item' },
  { value: 'bogo', label: 'Buy one, get one' },
];

export default function CreatePromoScreen() {
  const routerNav = useRouter();
  const { createPromotion, canAddPromotion, maxPromotions } = usePromo();
  // The signed-in vendor's own currency, not a hardcoded ₦ — this app
  // supports non-Nigerian vendors (Canada/US/etc, see business-location.tsx).
  const { vendor } = useVendor();
  const currencySymbol = getCurrencySymbol((vendor.currency as Currency) || getCurrencyFromCountryCode(vendor.countryCode));

  const [type, setType] = useState<PromotionType>('percentage');
  const [discountValue, setDiscountValue] = useState('');
  const [minimumOrder, setMinimumOrder] = useState('');
  const [maxDiscount, setMaxDiscount] = useState('');
  const [freeItemName, setFreeItemName] = useState('');
  const [bogoItemName, setBogoItemName] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000));
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const unsavedChanges = useUnsavedChanges(
    { type, discountValue, minimumOrder, maxDiscount, freeItemName, bogoItemName, startDate: startDate.toISOString(), endDate: endDate.toISOString() },
    true
  );

  const needsDiscountValue = type === 'percentage' || type === 'flat';
  const needsFreeItemName = type === 'free_item';
  const needsBogoItemName = type === 'bogo';

  const numericDiscount = parseFloat(discountValue);
  const numericMinOrder = parseFloat(minimumOrder) || 0;

  const isValid =
    (!needsDiscountValue || (discountValue && numericDiscount > 0 && (type !== 'percentage' || numericDiscount <= 100))) &&
    (!needsFreeItemName || freeItemName.trim().length > 0) &&
    (!needsBogoItemName || bogoItemName.trim().length > 0) &&
    endDate.getTime() > startDate.getTime();

  const handleSave = async () => {
    if (isSaving || !isValid) return;
    if (!canAddPromotion) {
      Alert.alert('Promotion limit reached', `Your plan allows up to ${maxPromotions} active promotions at a time.`);
      return;
    }
    setIsSaving(true);
    try {
      const draft: VendorPromotionDraft = {
        type,
        discountValue: needsDiscountValue ? numericDiscount : 0,
        minimumOrder: numericMinOrder,
        maxDiscount: type === 'percentage' && maxDiscount ? parseFloat(maxDiscount) : undefined,
        freeItemName: needsFreeItemName ? freeItemName.trim() : undefined,
        bogoItemName: needsBogoItemName ? bogoItemName.trim() : undefined,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
      };
      await createPromotion(draft, '');
      unsavedChanges.resetChanges();
      router.back();
    } catch (error) {
      console.error('Failed to save promo:', error);
      Alert.alert('Couldn\'t save', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (date: Date) => date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Create Promotion"
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
            <Text style={styles.label}>Promotion Type</Text>
            <View style={styles.radioGroup}>
              {TYPE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={styles.radioOption}
                  onPress={() => setType(opt.value)}
                  activeOpacity={0.8}
                >
                  <View style={styles.radioButton}>
                    {type === opt.value && <View style={styles.radioButtonSelected} />}
                  </View>
                  <Text style={styles.radioLabel}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {needsDiscountValue && (
            <View style={styles.section}>
              <Text style={styles.label}>Discount Value</Text>
              <View style={styles.inputWithPrefix}>
                {type === 'flat' && <Text style={styles.prefix}>{currencySymbol}</Text>}
                <TextInput
                  style={[styles.input, type === 'flat' && styles.inputWithPrefixInput]}
                  value={discountValue}
                  onChangeText={setDiscountValue}
                  placeholder={type === 'percentage' ? 'Enter percentage' : 'Enter amount'}
                  placeholderTextColor={Colors.textSecondary}
                  keyboardType="decimal-pad"
                />
                {type === 'percentage' && <Text style={styles.suffix}>%</Text>}
              </View>
            </View>
          )}

          {type === 'percentage' && (
            <View style={styles.section}>
              <Text style={styles.label}>Maximum Discount (optional)</Text>
              <TextInput
                style={styles.input}
                value={maxDiscount}
                onChangeText={setMaxDiscount}
                placeholder="No cap"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          )}

          {needsFreeItemName && (
            <View style={styles.section}>
              <Text style={styles.label}>Free Item Name</Text>
              <TextInput
                style={styles.input}
                value={freeItemName}
                onChangeText={setFreeItemName}
                placeholder="e.g. Small Fries"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          )}

          {needsBogoItemName && (
            <View style={styles.section}>
              <Text style={styles.label}>Item Name</Text>
              <TextInput
                style={styles.input}
                value={bogoItemName}
                onChangeText={setBogoItemName}
                placeholder="e.g. Jollof Rice"
                placeholderTextColor={Colors.textSecondary}
              />
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.label}>Minimum Order (optional)</Text>
            <View style={styles.inputWithPrefix}>
              <Text style={styles.prefix}>{currencySymbol}</Text>
              <TextInput
                style={[styles.input, styles.inputWithPrefixInput]}
                value={minimumOrder}
                onChangeText={setMinimumOrder}
                placeholder="No minimum"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="decimal-pad"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>Start Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowStartPicker(true)} activeOpacity={0.8}>
              <Text style={styles.dateButtonText}>{formatDate(startDate)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={styles.label}>End Date</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShowEndPicker(true)} activeOpacity={0.8}>
              <Text style={styles.dateButtonText}>{formatDate(endDate)}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.noteCard}>
            <Text style={styles.noteText}>
              Promotions apply automatically at checkout when the order qualifies — customers don't need to enter a code.
            </Text>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.footerButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => {
                if (!unsavedChanges.handleExitAttempt()) return;
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
                {isSaving ? 'Saving...' : 'Save Promotion'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>

      {showStartPicker && (
        <DateTimePicker
          value={startDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={new Date()}
          onChange={(event, selectedDate) => {
            setShowStartPicker(Platform.OS === 'ios');
            if (selectedDate) setStartDate(selectedDate);
          }}
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          minimumDate={startDate}
          onChange={(event, selectedDate) => {
            setShowEndPicker(Platform.OS === 'ios');
            if (selectedDate) setEndDate(selectedDate);
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
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16 },
  section: { marginTop: 24 },
  label: { fontSize: 16, fontWeight: '600' as const, color: Colors.text, marginBottom: 12 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radioGroup: { gap: 12 },
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
  radioButtonSelected: { width: 14, height: 14, borderRadius: 7, backgroundColor: Colors.primary },
  radioLabel: { fontSize: 16, color: Colors.text },
  inputWithPrefix: { position: 'relative' as const },
  inputWithPrefixInput: { paddingLeft: 36 },
  prefix: { position: 'absolute' as const, left: 16, top: 16, fontSize: 16, color: Colors.textSecondary, zIndex: 1 },
  suffix: { position: 'absolute' as const, right: 16, top: 16, fontSize: 16, color: Colors.textSecondary, zIndex: 1 },
  dateButton: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: Colors.border },
  dateButtonText: { fontSize: 16, color: Colors.text },
  noteCard: { backgroundColor: Colors.surface, borderRadius: 12, padding: 14, marginTop: 24 },
  noteText: { fontSize: 14, color: Colors.textMuted, textAlign: 'center' as const, lineHeight: 20 },
  footer: { padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  footerButtons: { flexDirection: 'row' as const, gap: 12 },
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
  cancelButtonText: { fontSize: 16, fontWeight: '600' as const, color: Colors.charcoal },
  saveButton: { flex: 1, backgroundColor: Colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' as const },
  saveButtonDisabled: { backgroundColor: Colors.surface },
  saveButtonText: { fontSize: 16, fontWeight: '600' as const, color: Colors.white },
  saveButtonTextDisabled: { color: Colors.textSecondary },
  bottomSpacer: { height: 40 },
});
