import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CheckSquare, Square, ChevronDown, ChevronUp, Search, X, Check } from 'lucide-react-native';
import { DAY_ONE_CATEGORIES } from '@/constants/categories';
import LaektivaModal from '@/components/LaektivaModal';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';
import LocationCascadeFields, { LocationValue, formatLocationLabel } from '@/components/LocationCascadeFields';
import { useVendor } from '@/contexts/VendorContext';
import { useAuth } from '@/contexts/AuthContext';

type FieldKey = 'businessName' | 'businessCategory' | 'businessArea' | 'contactEmail' | 'phoneNumber';

interface FieldOption {
  key: FieldKey;
  label: string;
  currentValue: string;
}

const BUSINESS_AREA_REASONS = [
  'Business moved to a new location',
  'Area was incorrect',
  'Service area changed',
  'Other',
];

const DEFAULT_REASONS = [
  'Business information changed',
  'Information was incorrect',
  'Legal or registration update',
  'Administrative correction',
  'Other',
];

function maskPhone(phone?: string): string {
  if (!phone) return 'Not set';
  if (phone.length < 6) return phone;
  return `${phone.slice(0, Math.max(0, phone.length - 7))} ••• ••• ${phone.slice(-4)}`;
}

function getReasonsForField(key: FieldKey): string[] {
  return key === 'businessArea' ? BUSINESS_AREA_REASONS : DEFAULT_REASONS;
}

interface FieldState {
  newValue: string;
  reason: string;
  otherExplanation: string;
  errors: {
    newValue?: string;
    reason?: string;
    otherExplanation?: string;
  };
}

type FieldStates = Record<FieldKey, FieldState>;

function makeDefaultFieldState(): FieldState {
  return { newValue: '', reason: '', otherExplanation: '', errors: {} };
}

/**
 * A location is only valid when country, state/province, and area are all selected.
 * Mirrors the signup-level validation — no free-text or partial values allowed.
 */
function isLocationComplete(location: LocationValue | null): boolean {
  return (
    !!location &&
    !!location.countryCode &&
    !!location.stateCode &&
    !!location.areaId &&
    !!location.areaName
  );
}

export default function RequestChangeScreen() {
  const router = useRouter();
  const { vendor } = useVendor();
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedFields, setSelectedFields] = useState<Set<FieldKey>>(new Set());
  const [fieldStates, setFieldStates] = useState<FieldStates>({
    businessName: makeDefaultFieldState(),
    businessCategory: makeDefaultFieldState(),
    businessArea: makeDefaultFieldState(),
    contactEmail: makeDefaultFieldState(),
    phoneNumber: makeDefaultFieldState(),
  });
  const [openReasonDropdown, setOpenReasonDropdown] = useState<FieldKey | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [categorySearch, setCategorySearch] = useState('');
  const [categoryPickerFieldKey, setCategoryPickerFieldKey] = useState<FieldKey | null>(null);
  const [businessLocation, setBusinessLocation] = useState<LocationValue | null>(null);

  const fields = useMemo<FieldOption[]>(() => [
    { key: 'businessName', label: 'Business Name', currentValue: vendor.name || 'Not set' },
    { key: 'businessCategory', label: 'Business Category', currentValue: vendor.category || 'Not set' },
    { key: 'businessArea', label: 'Business Area', currentValue: vendor.area || [vendor.state, vendor.city].filter(Boolean).join(', ') || 'Not set' },
    { key: 'contactEmail', label: 'Contact Email', currentValue: vendor.email || user?.identifier || 'Not set' },
    { key: 'phoneNumber', label: 'Phone Number', currentValue: maskPhone(vendor.phone) },
  ], [user?.identifier, vendor.area, vendor.category, vendor.city, vendor.email, vendor.name, vendor.phone, vendor.state]);

  const categories = useMemo(() => {
    return DAY_ONE_CATEGORIES.map((name) => ({
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      name,
    }));
  }, []);

  const filteredCategories = useMemo(() => {
    if (!categorySearch.trim()) return categories;
    const q = categorySearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, categorySearch]);

  const openCategoryPicker = (key: FieldKey) => {
    setCategoryPickerFieldKey(key);
    setCategorySearch('');
    setShowCategoryPicker(true);
  };

  const selectCategory = (cat: { id: string; name: string }) => {
    if (categoryPickerFieldKey) {
      updateFieldState(categoryPickerFieldKey, { newValue: cat.name });
      clearError(categoryPickerFieldKey, 'newValue');
    }
    setShowCategoryPicker(false);
    setCategoryPickerFieldKey(null);
  };

  const toggleField = (key: FieldKey) => {
    const newSelected = new Set(selectedFields);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedFields(newSelected);
  };

  const updateFieldState = (key: FieldKey, patch: Partial<FieldState>) => {
    setFieldStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  };

  const clearError = (key: FieldKey, errorField: keyof FieldState['errors']) => {
    setFieldStates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        errors: { ...prev[key].errors, [errorField]: undefined },
      },
    }));
  };

  const handleContinue = () => {
    if (selectedFields.size > 0) {
      setStep(2);
    }
  };

  const isFieldValid = (key: FieldKey): boolean => {
    const state = fieldStates[key];
    if (key === 'businessArea') {
      if (!isLocationComplete(businessLocation)) return false;
    } else if (!state.newValue.trim()) {
      return false;
    }
    if (!state.reason) return false;
    if (state.reason === 'Other' && !state.otherExplanation.trim()) return false;
    return true;
  };

  const allSelectedFieldsValid = (): boolean => {
    return Array.from(selectedFields).every(isFieldValid);
  };

  const validateAll = (): boolean => {
    let allValid = true;
    const updated = { ...fieldStates };

    for (const key of Array.from(selectedFields)) {
      const state = updated[key];
      const errors: FieldState['errors'] = {};

      if (key === 'businessArea') {
        if (!isLocationComplete(businessLocation)) {
          errors.newValue = 'Please select a country, state/province, and area.';
          allValid = false;
        }
      } else if (!state.newValue.trim()) {
        errors.newValue = 'Please enter the new value.';
        allValid = false;
      }
      if (!state.reason) {
        errors.reason = 'Please select a reason for this change.';
        allValid = false;
      }
      if (state.reason === 'Other' && !state.otherExplanation.trim()) {
        errors.otherExplanation = 'Please explain the reason for this change.';
        allValid = false;
      }

      updated[key] = { ...state, errors };
    }

    setFieldStates(updated);
    return allValid;
  };

  const handleSubmitClick = () => {
    if (validateAll()) {
      setShowConfirmModal(true);
    }
  };

  const handleConfirmSubmit = () => {
    setShowConfirmModal(false);
    console.log('Submitting change request:', {
      selectedFields: Array.from(selectedFields),
      fieldStates,
      businessLocation,
      backendReadyPayload: {
        vendorId: vendor.id,
        requestedFields: Array.from(selectedFields),
        changes: Array.from(selectedFields).map((key) => ({
          field: key,
          currentValue: fields.find((field) => field.key === key)?.currentValue ?? '',
          newValue: key === 'businessArea' ? formatLocationLabel(businessLocation) : fieldStates[key].newValue.trim(),
          reason: fieldStates[key].reason,
          otherExplanation: fieldStates[key].otherExplanation.trim() || undefined,
        })),
        status: 'pending_review',
        createdAt: new Date().toISOString(),
      },
    });
    setShowSuccessModal(true);
  };

  const handleSuccessClose = () => {
    setShowSuccessModal(false);
    router.back();
  };

  if (step === 1) {
    return (
      <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Request Account Change" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
        <SafeAreaView edges={['bottom']} style={styles.safeArea}>
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.notice}>
              Select one or more protected details to request a change. All requests require verification and admin approval.
            </Text>

            <View style={styles.card}>
              {fields.map((field, index) => (
                <React.Fragment key={field.key}>
                  <TouchableOpacity
                    style={styles.checkboxRow}
                    onPress={() => toggleField(field.key)}
                    activeOpacity={0.7}
                  >
                    {selectedFields.has(field.key) ? (
                      <CheckSquare size={24} color={Colors.primary} />
                    ) : (
                      <Square size={24} color={Colors.textSecondary} />
                    )}
                    <Text style={styles.checkboxLabel}>{field.label}</Text>
                  </TouchableOpacity>
                  {index < fields.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              ))}
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.button,
                  selectedFields.size > 0 ? styles.primaryButton : styles.disabledButton,
                ]}
                onPress={handleContinue}
                activeOpacity={0.7}
                disabled={selectedFields.size === 0}
              >
                <Text
                  style={[
                    styles.buttonText,
                    selectedFields.size > 0
                      ? styles.primaryButtonText
                      : styles.disabledButtonText,
                  ]}
                >
                  Continue
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.bottomSpacer} />
          </ScrollView>
        </SafeAreaView>
      </View>
    );
  }

  const isSubmitEnabled = allSelectedFieldsValid();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Request Account Change" onBack={() => setStep(1)} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {fields
            .filter((field) => selectedFields.has(field.key))
            .map((field) => {
              const state = fieldStates[field.key];
              const isDropdownOpen = openReasonDropdown === field.key;

              return (
                <View key={field.key} style={styles.inputCard}>
                  <Text style={styles.sectionTitle}>{field.label}</Text>

                  <View style={styles.currentValueContainer}>
                    <Text style={styles.currentValueLabel}>CURRENT VALUE</Text>
                    <Text style={styles.currentValue}>{field.currentValue}</Text>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>NEW VALUE</Text>
                    {field.key === 'businessArea' ? (
                      <>
                        <LocationCascadeFields
                          value={businessLocation}
                          onChange={(loc) => {
                            setBusinessLocation(loc);
                            const label = formatLocationLabel(loc);
                            updateFieldState('businessArea', { newValue: label });
                            if (isLocationComplete(loc)) clearError('businessArea', 'newValue');
                          }}
                          testIDPrefix="request-change-area"
                        />
                        {state.errors.newValue ? (
                          <Text style={styles.errorText}>{state.errors.newValue}</Text>
                        ) : null}
                      </>
                    ) : field.key === 'businessCategory' ? (
                      <>
                        <TouchableOpacity
                          style={[
                            styles.dropdown,
                            state.errors.newValue ? styles.inputError : null,
                          ]}
                          onPress={() => openCategoryPicker(field.key)}
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.dropdownText,
                              !state.newValue ? styles.dropdownPlaceholder : null,
                            ]}
                          >
                            {state.newValue || 'Select business category'}
                          </Text>
                          <ChevronDown size={18} color={Colors.textSecondary} />
                        </TouchableOpacity>
                        {state.errors.newValue ? (
                          <Text style={styles.errorText}>{state.errors.newValue}</Text>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <TextInput
                          style={[
                            styles.input,
                            state.errors.newValue ? styles.inputError : null,
                          ]}
                          value={state.newValue}
                          onChangeText={(text) => {
                            updateFieldState(field.key, { newValue: text });
                            if (text.trim()) clearError(field.key, 'newValue');
                          }}
                          placeholder={`Enter new ${field.label.toLowerCase()}`}
                          placeholderTextColor={Colors.textMuted}
                          keyboardType={
                            field.key === 'contactEmail'
                              ? 'email-address'
                              : field.key === 'phoneNumber'
                              ? 'phone-pad'
                              : 'default'
                          }
                          autoCapitalize={field.key === 'contactEmail' ? 'none' : 'words'}
                        />
                        {state.errors.newValue ? (
                          <Text style={styles.errorText}>{state.errors.newValue}</Text>
                        ) : null}
                      </>
                    )}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.inputLabel}>REASON FOR CHANGE</Text>
                    <TouchableOpacity
                      style={[
                        styles.dropdown,
                        state.errors.reason ? styles.inputError : null,
                        isDropdownOpen ? styles.dropdownOpen : null,
                      ]}
                      onPress={() =>
                        setOpenReasonDropdown(isDropdownOpen ? null : field.key)
                      }
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.dropdownText,
                          !state.reason ? styles.dropdownPlaceholder : null,
                        ]}
                      >
                        {state.reason || 'Select a reason'}
                      </Text>
                      {isDropdownOpen ? (
                        <ChevronUp size={18} color={Colors.textSecondary} />
                      ) : (
                        <ChevronDown size={18} color={Colors.textSecondary} />
                      )}
                    </TouchableOpacity>

                    {isDropdownOpen && (
                      <View style={styles.dropdownMenu}>
                        {getReasonsForField(field.key).map((reason, idx) => (
                          <React.Fragment key={reason}>
                            <TouchableOpacity
                              style={styles.dropdownItem}
                              onPress={() => {
                                updateFieldState(field.key, {
                                  reason,
                                  otherExplanation: '',
                                  errors: { ...state.errors, reason: undefined, otherExplanation: undefined },
                                });
                                setOpenReasonDropdown(null);
                              }}
                              activeOpacity={0.7}
                            >
                              <Text
                                style={[
                                  styles.dropdownItemText,
                                  state.reason === reason
                                    ? styles.dropdownItemSelected
                                    : null,
                                ]}
                              >
                                {reason}
                              </Text>
                              {state.reason === reason && (
                                <View style={styles.selectedDot} />
                              )}
                            </TouchableOpacity>
                            {idx < getReasonsForField(field.key).length - 1 && (
                              <View style={styles.dropdownDivider} />
                            )}
                          </React.Fragment>
                        ))}
                      </View>
                    )}

                    {state.errors.reason ? (
                      <Text style={styles.errorText}>{state.errors.reason}</Text>
                    ) : null}
                  </View>

                  {state.reason === 'Other' && (
                    <View style={styles.fieldGroup}>
                      <Text style={styles.inputLabel}>EXPLAIN REASON</Text>
                      <TextInput
                        style={[
                          styles.input,
                          styles.textArea,
                          state.errors.otherExplanation ? styles.inputError : null,
                        ]}
                        value={state.otherExplanation}
                        onChangeText={(text) => {
                          updateFieldState(field.key, { otherExplanation: text });
                          if (text.trim()) clearError(field.key, 'otherExplanation');
                        }}
                        placeholder="Enter explanation"
                        placeholderTextColor={Colors.textMuted}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                      {state.errors.otherExplanation ? (
                        <Text style={styles.errorText}>
                          {state.errors.otherExplanation}
                        </Text>
                      ) : null}
                    </View>
                  )}
                </View>
              );
            })}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => setStep(1)}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryButtonText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.button,
                isSubmitEnabled ? styles.primaryButton : styles.disabledButton,
              ]}
              onPress={handleSubmitClick}
              activeOpacity={0.7}
              disabled={!isSubmitEnabled}
            >
              <Text
                style={[
                  styles.buttonText,
                  isSubmitEnabled ? styles.primaryButtonText : styles.disabledButtonText,
                ]}
              >
                Submit Request
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showCategoryPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCategoryPicker(false)}
      >
        <Pressable
          style={styles.categoryOverlay}
          onPress={() => setShowCategoryPicker(false)}
        >
          <Pressable style={styles.categorySheet} onPress={() => {}}>
            <View style={styles.categorySheetHandle} />
            <View style={styles.categorySheetHeader}>
              <Text style={styles.categorySheetTitle}>Select Business Category</Text>
              <TouchableOpacity
                onPress={() => setShowCategoryPicker(false)}
                hitSlop={12}
              >
                <X size={22} color={Colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.categorySearchContainer}>
              <Search size={18} color={Colors.textMuted} />
              <TextInput
                style={styles.categorySearchInput}
                value={categorySearch}
                onChangeText={setCategorySearch}
                placeholder="Search categories"
                placeholderTextColor={Colors.textMuted}
                autoCorrect={false}
              />
            </View>

            <ScrollView
              style={styles.categoryList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredCategories.map((cat, idx) => {
                const isSelected =
                  categoryPickerFieldKey &&
                  fieldStates[categoryPickerFieldKey].newValue === cat.name;
                return (
                  <React.Fragment key={cat.id}>
                    <TouchableOpacity
                      style={[
                        styles.categoryItem,
                        isSelected ? styles.categoryItemSelected : null,
                      ]}
                      onPress={() => selectCategory(cat)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.categoryItemText,
                          isSelected ? styles.categoryItemTextSelected : null,
                        ]}
                      >
                        {cat.name}
                      </Text>
                      {isSelected && <Check size={18} color={Colors.primary} />}
                    </TouchableOpacity>
                    {idx < filteredCategories.length - 1 && (
                      <View style={styles.categoryDivider} />
                    )}
                  </React.Fragment>
                );
              })}
              {filteredCategories.length === 0 && (
                <View style={styles.categoryEmpty}>
                  <Text style={styles.categoryEmptyText}>No categories found</Text>
                </View>
              )}
              <View style={{ height: 24 }} />
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <LaektivaModal
        visible={showConfirmModal}
        title="Confirm submission"
        message="This request will be reviewed by theplatform. Changes will not apply until approved."
        primaryButton={{
          label: 'Submit request',
          onPress: handleConfirmSubmit,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowConfirmModal(false),
        }}
        onRequestClose={() => setShowConfirmModal(false)}
      />

      <LaektivaModal
        visible={showSuccessModal}
        title="Request Submitted"
        message="Your account detail change request has been submitted. You will be notified once it has been reviewed."
        primaryButton={{
          label: 'Done',
          onPress: handleSuccessClose,
        }}
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
  notice: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
    paddingHorizontal: 4,
    marginTop: 16,
    marginBottom: 20,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  checkboxRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  checkboxLabel: {
    fontSize: 17,
    color: Colors.text,
    marginLeft: 12,
    fontWeight: '400' as const,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  inputCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  currentValueContainer: {
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  currentValueLabel: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  currentValue: {
    fontSize: 15,
    color: Colors.textSecondary,
    fontWeight: '400' as const,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  inputError: {
    borderColor: Colors.error,
  },
  textArea: {
    minHeight: 88,
    paddingTop: 14,
  },
  errorText: {
    fontSize: 13,
    color: Colors.error,
    marginTop: 6,
    lineHeight: 18,
  },
  dropdown: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  dropdownOpen: {
    borderColor: Colors.primary,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  dropdownPlaceholder: {
    color: Colors.textMuted,
  },
  dropdownMenu: {
    backgroundColor: Colors.background,
    borderWidth: 1.5,
    borderTopWidth: 0,
    borderColor: Colors.primary,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  dropdownItemText: {
    fontSize: 15,
    color: Colors.text,
    flex: 1,
  },
  dropdownItemSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  buttonContainer: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  primaryButtonText: {
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    borderWidth: 2,
    borderColor: Colors.charcoal,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  disabledButton: {
    backgroundColor: Colors.border,
  },
  disabledButtonText: {
    color: Colors.textMuted,
  },
  bottomSpacer: {
    height: 40,
  },
  categoryOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end' as const,
  },
  categorySheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '75%' as unknown as number,
    paddingBottom: 16,
  },
  categorySheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center' as const,
    marginTop: 10,
    marginBottom: 8,
  },
  categorySheetHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  categorySheetTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  categorySearchContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.background,
    marginHorizontal: 20,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categorySearchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    marginLeft: 10,
    paddingVertical: 0,
  },
  categoryList: {
    paddingHorizontal: 20,
  },
  categoryItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  categoryItemSelected: {
    backgroundColor: 'rgba(255,140,66,0.06)',
    borderRadius: 10,
    paddingHorizontal: 10,
    marginHorizontal: -6,
  },
  categoryItemText: {
    fontSize: 16,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  categoryItemTextSelected: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  categoryDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
  categoryEmpty: {
    alignItems: 'center' as const,
    paddingVertical: 32,
  },
  categoryEmptyText: {
    fontSize: 15,
    color: Colors.textMuted,
  },
});
