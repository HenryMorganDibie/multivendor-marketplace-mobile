import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter } from 'expo-router';
import { Plus, Trash2, Package } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { useInvoices } from '@/contexts/InvoiceContext';
import type { InvoiceLineItem } from '@/contexts/InvoiceContext';
import { formatPrice, getCurrencyFromCountryCode, type Currency } from '@/utils/formatPrice';
import { mockVendor } from '@/mocks/vendorData';
import LaektivaModal from '@/components/LaektivaModal';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import { Colors } from '@/constants/colors';

export default function CreateInvoiceScreen() {
  const routerNav = useRouter();
  const { createInvoice } = useInvoices();
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [items, setItems] = useState<InvoiceLineItem[]>([]);
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [discount, setDiscount] = useState('0');
  const [currency] = useState<Currency>((mockVendor.currency as Currency) || getCurrencyFromCountryCode(mockVendor.countryCode));

  const unsavedChanges = useUnsavedChanges(
    { customerName, customerPhone, customerEmail, items, notes, taxRate, discount },
    true
  );

  const addItem = () => {
    const newItem: InvoiceLineItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: '',
      quantity: 1,
      unitPrice: 0,
      total: 0,
    };
    setItems([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const updated = { ...item, [field]: value };
        if (field === 'quantity' || field === 'unitPrice') {
          updated.total = updated.quantity * updated.unitPrice;
        }
        return updated;
      }
      return item;
    }));
  };

  const removeItem = (id: string) => {
    setItems(items.filter(item => item.id !== id));
  };

  const calculateSubtotal = () => items.reduce((sum, item) => sum + item.total, 0);
  const calculateTax = () => (calculateSubtotal() * (parseFloat(taxRate) || 0)) / 100;
  const calculateTotal = () => calculateSubtotal() + calculateTax() - (parseFloat(discount) || 0);

  const handleSaveDraft = async () => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }
    if (items.length === 0 || items.some(item => !item.name.trim())) {
      Alert.alert('Error', 'Please add at least one item with a name');
      return;
    }
    try {
      await createInvoice({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        items,
        subtotal: calculateSubtotal(),
        tax: calculateTax(),
        discount: parseFloat(discount) || 0,
        total: calculateTotal(),
        notes: notes.trim() || undefined,
        status: 'draft',
        currency,
      });
      unsavedChanges.resetChanges();
      Alert.alert('Success', 'Invoice saved as draft', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error) {
      console.error('Error creating invoice:', error);
      Alert.alert('Error', 'Failed to create invoice');
    }
  };

  const handleSend = async () => {
    if (!customerName.trim()) {
      Alert.alert('Error', 'Customer name is required');
      return;
    }
    if (items.length === 0 || items.some(item => !item.name.trim())) {
      Alert.alert('Error', 'Please add at least one item with a name');
      return;
    }
    try {
      const invoice = await createInvoice({
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        items,
        subtotal: calculateSubtotal(),
        tax: calculateTax(),
        discount: parseFloat(discount) || 0,
        total: calculateTotal(),
        notes: notes.trim() || undefined,
        status: 'draft',
        currency,
      });
      unsavedChanges.resetChanges();
      router.replace(`/vendor/settings/send-invoice/${invoice.id}` as any);
    } catch (error) {
      console.error('Error creating invoice:', error);
      Alert.alert('Error', 'Failed to create invoice');
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Create Invoice"
          onBack={() => {
            if (!unsavedChanges.handleExitAttempt()) return;
            routerNav.back();
          }}
          showSave={false}
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

          {/* CUSTOMER INFORMATION */}
          <Text style={styles.sectionTitle}>CUSTOMER INFORMATION</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Customer name <Text style={styles.required}>*</Text></Text>
              <TextInput
                style={styles.fieldInput}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter customer name"
                placeholderTextColor={Colors.inputPlaceholder}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Phone <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.fieldInput}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="+234 XXX XXX XXXX"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="phone-pad"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Email <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput
                style={styles.fieldInput}
                value={customerEmail}
                onChangeText={setCustomerEmail}
                placeholder="customer@email.com"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* LINE ITEMS */}
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>LINE ITEMS</Text>
            {items.length > 0 && (
              <TouchableOpacity
                style={styles.addInlineButton}
                onPress={addItem}
                activeOpacity={0.7}
              >
                <Plus size={13} color={Colors.primary} />
                <Text style={styles.addInlineText}>Add Item</Text>
              </TouchableOpacity>
            )}
          </View>

          {items.length === 0 ? (
            <TouchableOpacity style={styles.emptyItemsCard} onPress={addItem} activeOpacity={0.7}>
              <View style={styles.emptyItemsIconWrap}>
                <Package size={24} color={Colors.textMuted} />
              </View>
              <Text style={styles.emptyItemsTitle}>No items yet</Text>
              <Text style={styles.emptyItemsHint}>Tap to add your first line item</Text>
              <View style={styles.addFirstButton}>
                <Plus size={13} color={Colors.primary} />
                <Text style={styles.addFirstButtonText}>Add Item</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <>
              {items.map((item, index) => (
                <View key={item.id} style={[styles.card, styles.itemCard]}>
                  <View style={styles.itemHeaderRow}>
                    <Text style={styles.itemLabel}>Item {index + 1}</Text>
                    <TouchableOpacity onPress={() => removeItem(item.id)} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                      <Trash2 size={17} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.fieldRow}>
                    <Text style={styles.fieldLabel}>Name <Text style={styles.required}>*</Text></Text>
                    <TextInput
                      style={styles.fieldInput}
                      value={item.name}
                      onChangeText={(text) => updateItem(item.id, 'name', text)}
                      placeholder="Item name"
                      placeholderTextColor={Colors.inputPlaceholder}
                    />
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.twoColumnRow}>
                    <View style={styles.halfField}>
                      <Text style={styles.fieldLabel}>Qty</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={item.quantity.toString()}
                        onChangeText={(text) => updateItem(item.id, 'quantity', parseFloat(text) || 0)}
                        placeholder="1"
                        placeholderTextColor={Colors.inputPlaceholder}
                        keyboardType="numeric"
                      />
                    </View>
                    <View style={styles.halfDivider} />
                    <View style={styles.halfField}>
                      <Text style={styles.fieldLabel}>Unit price</Text>
                      <TextInput
                        style={styles.fieldInput}
                        value={item.unitPrice.toString()}
                        onChangeText={(text) => updateItem(item.id, 'unitPrice', parseFloat(text) || 0)}
                        placeholder="0.00"
                        placeholderTextColor={Colors.inputPlaceholder}
                        keyboardType="numeric"
                      />
                    </View>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.itemTotalRow}>
                    <Text style={styles.itemTotalLabel}>Line Total</Text>
                    <Text style={styles.itemTotalValue}>{formatPrice(item.total, currency)}</Text>
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ADJUSTMENTS */}
          <Text style={styles.sectionTitle}>ADJUSTMENTS</Text>
          <View style={styles.card}>
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Tax rate (%)</Text>
              <TextInput
                style={styles.fieldInput}
                value={taxRate}
                onChangeText={setTaxRate}
                placeholder="0"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.fieldRow}>
              <Text style={styles.fieldLabel}>Discount amount</Text>
              <TextInput
                style={styles.fieldInput}
                value={discount}
                onChangeText={setDiscount}
                placeholder="0.00"
                placeholderTextColor={Colors.inputPlaceholder}
                keyboardType="numeric"
              />
            </View>
          </View>

          {/* NOTES */}
          <Text style={styles.sectionTitle}>NOTES <Text style={styles.optional}>(OPTIONAL)</Text></Text>
          <View style={styles.card}>
            <TextInput
              style={styles.textArea}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add payment instructions or a message to the customer..."
              placeholderTextColor={Colors.inputPlaceholder}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          {/* TOTALS SUMMARY */}
          <Text style={styles.sectionTitle}>SUMMARY</Text>
          <View style={styles.card}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal</Text>
              <Text style={styles.summaryValue}>{formatPrice(calculateSubtotal(), currency)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Tax ({taxRate || 0}%)</Text>
              <Text style={styles.summaryValue}>{formatPrice(calculateTax(), currency)}</Text>
            </View>
            <View style={styles.summaryDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Discount</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                -{formatPrice(parseFloat(discount) || 0, currency)}
              </Text>
            </View>
            <View style={styles.totalDivider} />
            <View style={styles.summaryRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatPrice(calculateTotal(), currency)}</Text>
            </View>
          </View>

          {/* ACTIONS */}
          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={styles.draftButton}
              onPress={handleSaveDraft}
              activeOpacity={0.7}
            >
              <Text style={styles.draftButtonText}>Save Draft</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.sendButton}
              onPress={handleSend}
              activeOpacity={0.7}
            >
              <Text style={styles.sendButtonText}>Send Invoice</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

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
    backgroundColor: Colors.backgroundCanvas,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  sectionRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    textTransform: 'uppercase' as const,
    marginBottom: 10,
    marginTop: 20,
    paddingHorizontal: 2,
  },
  required: {
    color: Colors.error,
  },
  optional: {
    color: Colors.textMuted,
    fontWeight: '400' as const,
    textTransform: 'none' as const,
  },
  card: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingHorizontal: 16,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  fieldRow: {
    paddingVertical: 12,
  },
  fieldLabel: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    marginBottom: 5,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.3,
  },
  fieldInput: {
    fontSize: 15,
    color: Colors.text,
    paddingVertical: 0,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  addInlineButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    marginBottom: 10,
  },
  addInlineText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  // Empty items state
  emptyItemsCard: {
    backgroundColor: Colors.background,
    borderRadius: 14,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center' as const,
    borderWidth: 1.5,
    borderStyle: 'dashed' as const,
    borderColor: Colors.borderDark,
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 0,
  },
  emptyItemsIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 10,
  },
  emptyItemsTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 3,
  },
  emptyItemsHint: {
    fontSize: 12,
    color: Colors.textMuted,
    marginBottom: 14,
  },
  addFirstButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 5,
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
  },
  addFirstButtonText: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  // Item cards
  itemCard: {
    marginBottom: 10,
  },
  itemHeaderRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 11,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  twoColumnRow: {
    flexDirection: 'row' as const,
  },
  halfField: {
    flex: 1,
    paddingVertical: 12,
  },
  halfDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginVertical: 12,
  },
  itemTotalRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 11,
  },
  itemTotalLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  itemTotalValue: {
    fontSize: 14,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  // Text area
  textArea: {
    fontSize: 15,
    color: Colors.text,
    minHeight: 76,
    paddingVertical: 12,
    paddingHorizontal: 0,
  },
  // Totals
  summaryRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 10,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  summaryDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  totalDivider: {
    height: 1,
    backgroundColor: Colors.borderDark,
    marginVertical: 2,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  // Bottom buttons
  buttonRow: {
    flexDirection: 'row' as const,
    gap: 10,
    marginTop: 24,
  },
  draftButton: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.borderDark,
  },
  draftButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  sendButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
  },
  sendButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
