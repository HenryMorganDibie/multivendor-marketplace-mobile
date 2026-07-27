import React, { useState, useMemo } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Globe, AlertTriangle, Check, ChevronRight, MapPin, Info, ArrowLeft, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { useCart } from '@/contexts/CartContext';
import { 
  CountryInfo, 
  COUNTRY_CHANGE_COOLDOWN_DAYS,
  COUNTRY_CHANGE_REASONS,
  CountryChangeReason,
} from '@/constants/countries';

type FlowStep = 'idle' | 'reason' | 'country' | 'confirm';

export default function CountrySettingsScreen() {
  const router = useRouter();
  const { 
    countryCode, 
    countryName, 
    currencyCode, 
    currencySymbol,
    hasCompletedInitialLocationSetup,
    canChangeCountry,
    requestCountryChange,
    setInitialCountry,
    getAvailableCountries,
  } = useUserLocation();
  const { clearAllCartsForCountryChange, globalItemCount } = useCart();

  const [flowStep, setFlowStep] = useState<FlowStep>('idle');
  const [selectedReason, setSelectedReason] = useState<CountryChangeReason | null>(null);
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [countrySearch, setCountrySearch] = useState('');
  const countries = getAvailableCountries();
  const canChange = canChangeCountry();

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const query = countrySearch.toLowerCase().trim();
    return countries.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.currencyName.toLowerCase().includes(query) ||
      c.currencyCode.toLowerCase().includes(query)
    );
  }, [countries, countrySearch]);

  const handleBackPress = () => {
    router.back();
  };

  const handleRequestChange = () => {
    setError(null);
    setSelectedReason(null);
    setSelectedCountry(null);
    
    if (!hasCompletedInitialLocationSetup) {
      setFlowStep('country');
    } else {
      if (!canChange) return;
      setFlowStep('reason');
    }
  };

  const handleReasonSelect = (reason: CountryChangeReason) => {
    setSelectedReason(reason);
  };

  const handleReasonContinue = () => {
    if (!selectedReason) return;
    setFlowStep('country');
  };

  const handleCountrySelect = (country: CountryInfo) => {
    if (country.code === countryCode) return;
    setSelectedCountry(country);
  };

  const handleCountryContinue = () => {
    if (!selectedCountry) return;
    
    if (!hasCompletedInitialLocationSetup) {
      void handleFirstTimeSetup();
    } else {
      setFlowStep('confirm');
    }
  };

  const handleFirstTimeSetup = async () => {
    if (!selectedCountry) return;
    
    setIsChanging(true);
    setError(null);

    const success = await setInitialCountry(selectedCountry.code);
    
    if (success) {
      setFlowStep('idle');
      setShowSuccessModal(true);
    } else {
      setError('Unable to set your country. Please try again.');
      setFlowStep('idle');
    }
    
    setIsChanging(false);
  };

  const handleConfirmChange = async () => {
    if (!selectedCountry || !selectedReason) return;
    
    setIsChanging(true);
    setError(null);

    const result = await requestCountryChange(selectedCountry.code, selectedReason.id);
    
    if (result.success) {
      clearAllCartsForCountryChange();
      setFlowStep('idle');
      setShowSuccessModal(true);
    } else {
      setError(result.error || 'Unable to process your request at this time. Please try again later.');
      setFlowStep('idle');
    }
    
    setIsChanging(false);
  };

  const handleCancelFlow = () => {
    setFlowStep('idle');
    setSelectedReason(null);
    setSelectedCountry(null);
  };

  const handleSuccessDismiss = () => {
    setShowSuccessModal(false);
    router.back();
  };

  const renderReasonModal = () => (
    <Modal
      visible={flowStep === 'reason'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancelFlow}
    >
      <View style={styles.modalContainer}>
        <SafeAreaView edges={['top']} style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={handleCancelFlow} style={styles.modalHeaderButton}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Reason</Text>
            <TouchableOpacity 
              onPress={handleReasonContinue} 
              style={styles.modalHeaderButton}
              disabled={!selectedReason}
            >
              <Text style={[
                styles.modalNextText,
                !selectedReason && styles.modalNextTextDisabled
              ]}>Next</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.modalInfoCard}>
            <Info size={20} color={Colors.textSecondary} />
            <Text style={styles.modalInfoText}>
              Please select the reason for changing your country. This helps us provide better service.
            </Text>
          </View>

          <View style={styles.reasonsList}>
            {COUNTRY_CHANGE_REASONS.map((reason, index) => {
              const isSelected = selectedReason?.id === reason.id;
              return (
                <React.Fragment key={reason.id}>
                  <TouchableOpacity
                    style={[
                      styles.reasonRow,
                      isSelected && styles.reasonRowSelected,
                    ]}
                    onPress={() => handleReasonSelect(reason)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.reasonContent}>
                      <Text style={[
                        styles.reasonLabel,
                        isSelected && styles.reasonLabelSelected,
                      ]}>
                        {reason.label}
                      </Text>
                      <Text style={styles.reasonDescription}>
                        {reason.description}
                      </Text>
                    </View>
                    <View style={[
                      styles.radioOuter,
                      isSelected && styles.radioOuterSelected,
                    ]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                  {index < COUNTRY_CHANGE_REASONS.length - 1 && <View style={styles.reasonDivider} />}
                </React.Fragment>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </Modal>
  );

  const renderCountryModal = () => (
    <Modal
      visible={flowStep === 'country'}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleCancelFlow}
    >
      <View style={styles.modalContainer}>
        <SafeAreaView edges={['top']} style={styles.modalSafeArea}>
          <View style={styles.modalHeader}>
            <TouchableOpacity 
              onPress={() => {
                setCountrySearch('');
                if (hasCompletedInitialLocationSetup) {
                  setFlowStep('reason');
                } else {
                  handleCancelFlow();
                }
              }} 
              style={styles.modalBackButton}
            >
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Country</Text>
            <TouchableOpacity 
              onPress={handleCountryContinue} 
              style={styles.modalHeaderButton}
              disabled={!selectedCountry}
            >
              <Text style={[
                styles.modalNextText,
                !selectedCountry && styles.modalNextTextDisabled
              ]}>Next</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <View style={styles.searchInputWrapper}>
              <Search size={18} color={Colors.textSecondary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search country"
                placeholderTextColor={Colors.textSecondary}
                value={countrySearch}
                onChangeText={setCountrySearch}
                autoCorrect={false}
                autoCapitalize="none"
              />
            </View>
          </View>
        </SafeAreaView>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.countriesList}>
            {filteredCountries.map((country, index) => {
              const isCurrentCountry = country.code === countryCode;
              const isSelected = selectedCountry?.code === country.code;
              
              return (
                <React.Fragment key={country.code}>
                  <TouchableOpacity
                    style={[
                      styles.countryRow,
                      isCurrentCountry && styles.countryRowDisabled,
                    ]}
                    onPress={() => handleCountrySelect(country)}
                    activeOpacity={isCurrentCountry ? 1 : 0.7}
                    disabled={isCurrentCountry}
                  >
                    <View style={styles.countryLeft}>
                      <Text style={styles.countryFlag}>{country.flag}</Text>
                      <View style={styles.countryInfo}>
                        <Text style={[
                          styles.countryName,
                          isCurrentCountry && styles.countryNameDisabled,
                        ]}>
                          {country.name}
                        </Text>
                        <Text style={styles.countryCurrency}>
                          {country.currencySymbol} {country.currencyName}
                        </Text>
                      </View>
                    </View>
                    {isCurrentCountry ? (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current</Text>
                      </View>
                    ) : isSelected ? (
                      <View style={styles.selectedCheckmark}>
                        <Check size={18} color={Colors.white} />
                      </View>
                    ) : null}
                  </TouchableOpacity>
                  {index < filteredCountries.length - 1 && <View style={styles.divider} />}
                </React.Fragment>
              );
            })}
            {filteredCountries.length === 0 && (
              <View style={styles.emptySearchResult}>
                <Text style={styles.emptySearchText}>No countries found</Text>
              </View>
            )}
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </Modal>
  );

  const renderConfirmModal = () => (
    <Modal
      visible={flowStep === 'confirm'}
      animationType="fade"
      transparent
      onRequestClose={handleCancelFlow}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmModal}>
          <View style={styles.confirmHeader}>
            <MapPin size={32} color={Colors.text} />
            <Text style={styles.confirmTitle}>Confirm Country Change</Text>
          </View>

          <View style={styles.confirmChangePreview}>
            <View style={styles.confirmCountryBox}>
              <Text style={styles.confirmCountryLabel}>From</Text>
              <Text style={styles.confirmCountryName}>{countryName}</Text>
              <Text style={styles.confirmCountryCurrency}>{currencySymbol} {currencyCode}</Text>
            </View>
            <View style={styles.confirmArrow}>
              <ChevronRight size={24} color={Colors.textSecondary} />
            </View>
            <View style={styles.confirmCountryBox}>
              <Text style={styles.confirmCountryLabel}>To</Text>
              <Text style={styles.confirmCountryName}>{selectedCountry?.name}</Text>
              <Text style={styles.confirmCountryCurrency}>{selectedCountry?.currencySymbol} {selectedCountry?.currencyCode}</Text>
            </View>
          </View>

          <View style={styles.confirmImpactSection}>
            <Text style={styles.confirmImpactTitle}>What will happen:</Text>
            <View style={styles.confirmImpactList}>
              <Text style={styles.confirmImpactItem}>• Your currency will change to {selectedCountry?.currencySymbol} {selectedCountry?.currencyCode}</Text>
              {globalItemCount > 0 && (
                <Text style={styles.confirmImpactItem}>• Your cart ({globalItemCount} item{globalItemCount > 1 ? 's' : ''}) will be cleared</Text>
              )}
              <Text style={styles.confirmImpactItem}>• Vendor availability may change based on your new location</Text>
              <Text style={styles.confirmImpactItem}>• You will not be able to change your country again for {COUNTRY_CHANGE_COOLDOWN_DAYS} days</Text>
            </View>
          </View>

          <View style={styles.confirmReasonSection}>
            <Text style={styles.confirmReasonLabel}>Reason:</Text>
            <Text style={styles.confirmReasonValue}>{selectedReason?.label}</Text>
          </View>

          <View style={styles.confirmButtons}>
            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={handleCancelFlow}
            >
              <Text style={styles.confirmCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmSubmitButton}
              onPress={handleConfirmChange}
              disabled={isChanging}
            >
              {isChanging ? (
                <ActivityIndicator size="small" color={Colors.text} />
              ) : (
                <Text style={styles.confirmSubmitText}>Confirm Change</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderSuccessModal = () => (
    <Modal
      visible={showSuccessModal}
      animationType="fade"
      transparent
      onRequestClose={handleSuccessDismiss}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.successModal}>
          <View style={styles.successIcon}>
            <Check size={32} color={Colors.text} />
          </View>
          <Text style={styles.successTitle}>{hasCompletedInitialLocationSetup ? 'Country Changed' : 'Country Set'}</Text>
          <Text style={styles.successMessage}>
            {hasCompletedInitialLocationSetup 
              ? `Your country has been changed to ${selectedCountry?.name}. All prices will now be displayed in ${selectedCountry?.currencySymbol} ${selectedCountry?.currencyCode}.`
              : `Your country has been set to ${selectedCountry?.name}. All prices will be displayed in ${selectedCountry?.currencySymbol} ${selectedCountry?.currencyCode}.`}
          </Text>
          <TouchableOpacity
            style={styles.successButton}
            onPress={handleSuccessDismiss}
          >
            <Text style={styles.successButtonText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Country</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {hasCompletedInitialLocationSetup && (
          <View style={styles.currentSection}>
            <View style={styles.currentCard}>
              <View style={styles.currentHeader}>
                <Globe size={24} color={Colors.text} />
                <Text style={styles.currentLabel}>Current Country</Text>
              </View>
              <Text style={styles.currentCountry}>{countryName}</Text>
              <View style={styles.currencyRow}>
                <Text style={styles.currencyLabel}>Currency:</Text>
                <Text style={styles.currencyValue}>{currencySymbol} {currencyCode}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Info size={20} color={Colors.textSecondary} />
            <Text style={styles.infoText}>
              {hasCompletedInitialLocationSetup
                ? 'Your country determines available vendors, prices, and currency. Changing country will reset your region selection.'
                : 'Select your country to get started. This determines available vendors, prices, and currency.'}
            </Text>
          </View>
        </View>

        {hasCompletedInitialLocationSetup && (
          <View style={styles.cooldownSection}>
            <View style={styles.cooldownCard}>
              <Info size={18} color={Colors.textSecondary} />
              <Text style={styles.cooldownText}>
                You can change your country once every 30 days.
              </Text>
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorSection}>
            <View style={styles.errorCard}>
              <AlertTriangle size={20} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        )}

        <View style={styles.actionSection}>
          <TouchableOpacity
            style={[
              styles.requestButton,
              hasCompletedInitialLocationSetup && !canChange && styles.requestButtonDisabled,
            ]}
            onPress={handleRequestChange}
            disabled={hasCompletedInitialLocationSetup && !canChange}
            activeOpacity={0.7}
          >
            <Text style={[
              styles.requestButtonText,
              hasCompletedInitialLocationSetup && !canChange && styles.requestButtonTextDisabled,
            ]}>
              {hasCompletedInitialLocationSetup ? 'Request Country Change' : 'Set Country'}
            </Text>
          </TouchableOpacity>

        </View>

        {hasCompletedInitialLocationSetup && (
          <View style={styles.disclaimerSection}>
            <Text style={styles.disclaimerTitle}>Important Information</Text>
            <View style={styles.disclaimerList}>
              <Text style={styles.disclaimerItem}>• Changing country clears your cart</Text>
              <Text style={styles.disclaimerItem}>• Vendor availability may change</Text>
            </View>
          </View>
        )}

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {hasCompletedInitialLocationSetup && renderReasonModal()}
      {renderCountryModal()}
      {hasCompletedInitialLocationSetup && renderConfirmModal()}
      {renderSuccessModal()}
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
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  currentSection: {
    marginTop: 24,
  },
  currentCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  currentHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    marginBottom: 12,
  },
  currentLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  currentCountry: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  currencyRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 8,
  },
  currencyLabel: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  currencyValue: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  lockedBadge: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
    backgroundColor: Colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  lockedText: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500' as const,
  },
  infoSection: {
    marginTop: 16,
  },
  infoCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  cooldownSection: {
    marginTop: 16,
  },
cooldownCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
  },
  cooldownText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  errorSection: {
    marginTop: 16,
  },
  errorCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
  },
  actionSection: {
    marginTop: 24,
  },
  requestButton: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  requestButtonDisabled: {
    backgroundColor: Colors.border,
  },
  requestButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  requestButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  disclaimerSection: {
    marginTop: 24,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  disclaimerTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
disclaimerList: {
    gap: 6,
  },
  disclaimerItem: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalSafeArea: {
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalBackButton: {
    padding: 4,
    minWidth: 40,
  },
  modalHeaderButton: {
    minWidth: 60,
  },
  modalCancelText: {
    fontSize: 17,
    color: Colors.success,
  },
  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  searchInputWrapper: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    padding: 0,
  },
  modalNextText: {
    fontSize: 17,
    color: Colors.success,
    fontWeight: '600' as const,
    textAlign: 'right' as const,
  },
  modalNextTextDisabled: {
    color: Colors.textSecondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  modalInfoCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  modalInfoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  reasonsList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  reasonRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  reasonRowSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  reasonContent: {
    flex: 1,
  },
  reasonLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  reasonLabelSelected: {
    color: Colors.success,
  },
  reasonDescription: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.textSecondary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: 12,
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  reasonDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  countriesList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  countryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 18,
    paddingHorizontal: 20,
    minHeight: 72,
  },
  countryRowDisabled: {
    opacity: 0.6,
  },
  countryLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  countryFlag: {
    fontSize: 32,
  },
  countryInfo: {
    flex: 1,
  },
  countryName: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  countryNameDisabled: {
    color: Colors.textMuted,
  },
  countryCurrency: {
    fontSize: 14,
    color: Colors.textMuted,
    marginTop: 3,
  },
  currentBadge: {
    backgroundColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  currentBadgeText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  selectedCheckmark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptySearchResult: {
    paddingVertical: 32,
    alignItems: 'center' as const,
  },
  emptySearchText: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginLeft: 68,
  },
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  confirmModal: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  confirmHeader: {
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  confirmTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginTop: 12,
  },
  confirmChangePreview: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: Colors.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  confirmCountryBox: {
    flex: 1,
    alignItems: 'center' as const,
  },
  confirmCountryLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  confirmCountryName: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  confirmCountryCurrency: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  confirmArrow: {
    paddingHorizontal: 8,
  },
  confirmImpactSection: {
    marginBottom: 20,
  },
  confirmImpactTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  confirmImpactList: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    padding: 16,
  },
  confirmImpactItem: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  confirmReasonSection: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 24,
  },
  confirmReasonLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginRight: 8,
  },
  confirmReasonValue: {
    fontSize: 14,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  confirmButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  confirmCancelText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  confirmSubmitButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  confirmSubmitText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  successModal: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center' as const,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  successButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
    width: '100%',
    alignItems: 'center' as const,
  },
  successButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
