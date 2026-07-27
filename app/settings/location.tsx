import React, { useState, useMemo } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight, Globe, MapPin, Check, AlertTriangle, ArrowLeft, Search } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useUserLocation } from '@/contexts/UserLocationContext';
import { useCart } from '@/contexts/CartContext';
import {
  CountryInfo,
  COUNTRY_CHANGE_REASONS,
  CountryChangeReason,
} from '@/constants/countries';

type ModalState = 'none' | 'reason' | 'country' | 'confirm' | 'success';

export default function LocationSettingsScreen() {
  const router = useRouter();
  const {
    countryCode,
    countryName,
    regionName,
    currencyCode,
    hasCompletedInitialLocationSetup,
    canChangeCountry,
    requestCountryChange,
    setInitialCountry,
    getAvailableCountries,
  } = useUserLocation();
  const { clearAllCartsForCountryChange, globalItemCount } = useCart();

  const [modalState, setModalState] = useState<ModalState>('none');
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo | null>(null);
  const [selectedReason, setSelectedReason] = useState<CountryChangeReason | null>(null);
  const [isChanging, setIsChanging] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const handleCountryPress = () => {
    setError(null);
    setSelectedCountry(null);
    setSelectedReason(null);

    if (!hasCompletedInitialLocationSetup) {
      setModalState('country');
    } else {
      if (!canChange) return;
      setModalState('reason');
    }
  };

  const handleRegionPress = () => {
    router.push('/settings/region' as any);
  };

  const handleReasonSelect = (reason: CountryChangeReason) => {
    setSelectedReason(reason);
  };

  const handleReasonContinue = () => {
    if (!selectedReason) return;
    setModalState('country');
  };

  const handleCountrySelect = (country: CountryInfo) => {
    if (country.code === countryCode) return;
    setSelectedCountry(country);
    setModalState('confirm');
  };

  const handleConfirmChange = async () => {
    if (!selectedCountry) return;

    setIsChanging(true);
    setError(null);

    if (!hasCompletedInitialLocationSetup) {
      const success = await setInitialCountry(selectedCountry.code);
      if (success) {
        setModalState('success');
      } else {
        setError('Unable to set your country. Please try again.');
        setModalState('none');
      }
    } else {
      if (!selectedReason) return;
      const result = await requestCountryChange(selectedCountry.code, selectedReason.id);
      if (result.success) {
        clearAllCartsForCountryChange();
        setModalState('success');
      } else {
        setError(result.error || 'Unable to process your request. Please try again.');
        setModalState('none');
      }
    }

    setIsChanging(false);
  };

  const handleCancelFlow = () => {
    setModalState('none');
    setSelectedCountry(null);
    setSelectedReason(null);
  };

  const handleSuccessDismiss = () => {
    setModalState('none');
    setSelectedCountry(null);
    setSelectedReason(null);
  };

  const renderReasonModal = () => (
    <Modal
      visible={modalState === 'reason'}
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
                !selectedReason && styles.modalNextTextDisabled,
              ]}>Next</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
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
      visible={modalState === 'country'}
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
                  setModalState('reason');
                } else {
                  handleCancelFlow();
                }
              }}
              style={styles.modalBackButton}
            >
              <ArrowLeft size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Select Country</Text>
            <View style={styles.modalHeaderButton} />
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
                  {index < filteredCountries.length - 1 && <View style={styles.countryDivider} />}
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
      visible={modalState === 'confirm'}
      animationType="fade"
      transparent
      onRequestClose={handleCancelFlow}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.confirmModal}>
          <Text style={styles.confirmTitle}>Change Country?</Text>

          <View style={styles.confirmBody}>
            <Text style={styles.confirmDescription}>Changing your country will:</Text>
            <View style={styles.confirmImpactList}>
              <Text style={styles.confirmImpactItem}>• Update your currency</Text>
              <Text style={styles.confirmImpactItem}>• Update available vendors</Text>
              {globalItemCount > 0 && (
                <Text style={styles.confirmImpactItem}>• Clear your cart</Text>
              )}
            </View>
          </View>

          <View style={styles.confirmNewCountrySection}>
            <Text style={styles.confirmNewCountryLabel}>New Country:</Text>
            <Text style={styles.confirmNewCountryValue}>
              {selectedCountry?.name} ({selectedCountry?.currencyCode})
            </Text>
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
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.confirmSubmitText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderSuccessModal = () => (
    <Modal
      visible={modalState === 'success'}
      animationType="fade"
      transparent
      onRequestClose={handleSuccessDismiss}
    >
      <View style={styles.confirmOverlay}>
        <View style={styles.successModal}>
          <View style={styles.successIcon}>
            <Check size={28} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Country Updated</Text>
          <Text style={styles.successMessage}>
            Prices will now be displayed in {selectedCountry?.currencyCode}.{'\n'}
            Available vendors will update based on your location.
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
          <Text style={styles.headerTitle}>Location</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={[
                styles.settingsRow,
                hasCompletedInitialLocationSetup && !canChange && styles.settingsRowDisabled,
              ]}
              onPress={handleCountryPress}
              activeOpacity={0.7}
              disabled={hasCompletedInitialLocationSetup && !canChange}
            >
              <View style={styles.rowLeft}>
                <Globe size={20} color={Colors.textSecondary} />
                <View>
                  <Text style={styles.rowLabel}>Country</Text>
                  <Text style={styles.rowValue}>
                    {countryName ? `${countryName} (${currencyCode})` : 'Not set'}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.textSecondary} />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={handleRegionPress}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <MapPin size={20} color={Colors.textSecondary} />
                <View>
                  <Text style={styles.rowLabel}>Region</Text>
                  <Text style={styles.rowValue}>{regionName || 'Not set'}</Text>
                </View>
              </View>
              <ChevronRight size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {error && (
          <View style={styles.errorSection}>
            <View style={styles.errorCard}>
              <AlertTriangle size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          </View>
        )}

        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            Your country determines currency and available vendors.{'\n'}
            Region (State/Province) filters vendors in your area.
          </Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      {hasCompletedInitialLocationSetup && renderReasonModal()}
      {renderCountryModal()}
      {renderConfirmModal()}
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
  section: {
    marginTop: 24,
  },
  glassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
  },
  settingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  settingsRowDisabled: {
    opacity: 0.5,
  },
  rowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  rowLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  rowValue: {
    fontSize: 15,
    color: Colors.textMuted,
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 48,
  },
  errorSection: {
    marginTop: 16,
  },
  errorCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.2)',
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
  },
  infoSection: {
    marginTop: 24,
    paddingHorizontal: 4,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 21,
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
  reasonsList: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden' as const,
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
    overflow: 'hidden' as const,
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
  countryDivider: {
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
    width: '100%' as const,
    maxWidth: 360,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  confirmBody: {
    marginBottom: 20,
  },
  confirmDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  confirmImpactList: {
    gap: 6,
  },
  confirmImpactItem: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  confirmNewCountrySection: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 24,
  },
  confirmNewCountryLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  confirmNewCountryValue: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  confirmButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  confirmCancelButton: {
    flex: 1,
    backgroundColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 14,
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
    borderRadius: 12,
    paddingVertical: 14,
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
    width: '100%' as const,
    maxWidth: 340,
    alignItems: 'center' as const,
  },
  successIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
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
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    width: '100%' as const,
    alignItems: 'center' as const,
  },
  successButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
