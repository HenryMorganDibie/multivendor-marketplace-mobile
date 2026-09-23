import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronDown, AlertTriangle } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import { allowedPaymentProvidersByCountry, PaymentProvider, getBanksForCountry, supportsAccountNameResolution } from '@/constants/paymentProviders';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

type ChangeType = 'primary' | 'secondary';
type AccountResolutionStatus = 'idle' | 'loading' | 'success' | 'error';

export default function RequestPaymentChangeScreen() {
  const router = useRouter();
  const { businessCountry } = useVendorPlan();
  const [showSecurityModal, setShowSecurityModal] = useState(true);
  const [password, setPassword] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [isSecurityVerified, setIsSecurityVerified] = useState(false);
  const [selectedChangeType, setSelectedChangeType] = useState<ChangeType>('primary');
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null);
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [showBankPicker, setShowBankPicker] = useState(false);
  
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountResolutionEnabled, setAccountResolutionEnabled] = useState(true);
  const [accountResolutionStatus, setAccountResolutionStatus] = useState<AccountResolutionStatus>('idle');
  const [resolvedAccountName, setResolvedAccountName] = useState('');
  
  const [externalPaymentLink, setExternalPaymentLink] = useState('');
  const [businessDisplayName, setBusinessDisplayName] = useState('');
  
  const [walletHandle, setWalletHandle] = useState('');
  
  const [attestationChecked, setAttestationChecked] = useState(false);

  const availableProviders = allowedPaymentProvidersByCountry[businessCountry];
  const availableBanks = getBanksForCountry(businessCountry);
  const supportsNameResolution = supportsAccountNameResolution(businessCountry);

  const handleSecurityContinue = () => {
    if (!password) {
      return;
    }
    console.log('Security verification passed');
    setIsSecurityVerified(true);
    setShowSecurityModal(false);
  };

  const handleResolveAccountName = async () => {
    if (!accountNumber || accountNumber.length < 10 || !bankName) {
      return;
    }
    
    setAccountResolutionStatus('loading');
    
    setTimeout(() => {
      const mockNames = ['John Doe', 'Jane Smith', 'Business Corp Ltd'];
      const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
      setResolvedAccountName(randomName);
      setAccountResolutionStatus('success');
    }, 1500);
  };

  const handleSubmitRequest = () => {
    if (!selectedProvider || !attestationChecked) {
      return;
    }
    
    let isValid = false;
    let requestData: any = {
      changeType: selectedChangeType,
      provider: selectedProvider,
      attestation: true,
    };
    
    if (selectedProvider.type === 'bank') {
      if (bankName && accountNumber && accountNumber.length >= 10) {
        isValid = true;
        requestData.bankName = bankName;
        requestData.accountNumber = accountNumber;
        requestData.resolvedName = resolvedAccountName;
        requestData.nameResolved = accountResolutionStatus === 'success';
      }
    } else if (selectedProvider.type === 'card') {
      if (externalPaymentLink && externalPaymentLink.startsWith('http')) {
        isValid = true;
        requestData.externalLink = externalPaymentLink;
        requestData.businessDisplayName = businessDisplayName;
      }
    } else if (selectedProvider.type === 'wallet') {
      if (walletHandle && walletHandle.length > 2) {
        isValid = true;
        requestData.walletHandle = walletHandle;
      }
    }
    
    if (!isValid) {
      return;
    }
    
    console.log('Payment method change request submitted:', requestData);
    router.back();
  };

  const isSubmitEnabled = () => {
    if (!selectedProvider || !attestationChecked) {
      return false;
    }
    
    if (selectedProvider.type === 'bank') {
      return bankName && accountNumber && accountNumber.length >= 10;
    } else if (selectedProvider.type === 'card') {
      return externalPaymentLink && externalPaymentLink.startsWith('http');
    } else if (selectedProvider.type === 'wallet') {
      return walletHandle && walletHandle.length > 2;
    }
    
    return false;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Request Payment Change" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isSecurityVerified && (
            <>
              <View style={styles.infoCard}>
                <Text style={styles.infoText}>
                  You are requesting to change your payment method.
                </Text>
              </View>

              <View style={styles.currentMethodCard}>
                <Text style={styles.sectionLabel}>Current Method</Text>
                <View style={styles.methodRow}>
                  <Text style={styles.methodLabel}>Bank Transfer</Text>
                  <Text style={styles.methodValue}>GTBank ****4321</Text>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>SELECT PAYMENT METHOD TO CHANGE</Text>
                <View style={styles.radioGroup}>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setSelectedChangeType('primary')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.radioCircle}>
                      {selectedChangeType === 'primary' && <View style={styles.radioSelected} />}
                    </View>
                    <Text style={styles.radioLabel}>Primary Payment Method</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.radioOption}
                    onPress={() => setSelectedChangeType('secondary')}
                    activeOpacity={0.7}
                  >
                    <View style={styles.radioCircle}>
                      {selectedChangeType === 'secondary' && <View style={styles.radioSelected} />}
                    </View>
                    <Text style={styles.radioLabel}>Secondary Payment Method</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.section}>
                <Text style={styles.sectionTitle}>PAYMENT PROVIDER</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowProviderPicker(true)}
                  activeOpacity={0.7}
                >
                  <Text style={selectedProvider ? styles.dropdownValue : styles.dropdownPlaceholder}>
                    {selectedProvider ? selectedProvider.label : 'Select payment provider'}
                  </Text>
                  <ChevronDown size={20} color={Colors.textSecondary} />
                </TouchableOpacity>
                <Text style={styles.helperText}>
                  Only payment providers available in your registered country can be selected.
                </Text>
              </View>

              {selectedProvider && selectedProvider.type === 'bank' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>BANK DETAILS</Text>
                  
                  <TouchableOpacity
                    style={styles.dropdownButton}
                    onPress={() => setShowBankPicker(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={bankName ? styles.dropdownValue : styles.dropdownPlaceholder}>
                      {bankName || 'Select bank'}
                    </Text>
                    <ChevronDown size={20} color={Colors.textSecondary} />
                  </TouchableOpacity>
                  
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Account Number</Text>
                    <TextInput
                      style={styles.input}
                      value={accountNumber}
                      onChangeText={(text) => {
                        setAccountNumber(text.replace(/[^0-9]/g, ''));
                        setAccountResolutionStatus('idle');
                        setResolvedAccountName('');
                      }}
                      placeholder="Enter account number"
                      placeholderTextColor={Colors.textSecondary}
                      keyboardType="number-pad"
                      maxLength={10}
                    />
                  </View>
                  
                  {supportsNameResolution && (
                    <>
                      <TouchableOpacity
                        style={styles.toggleRow}
                        onPress={() => setAccountResolutionEnabled(!accountResolutionEnabled)}
                        activeOpacity={0.7}
                      >
                        <Text style={styles.toggleLabel}>Resolve account name</Text>
                        <View style={[styles.toggle, accountResolutionEnabled && styles.toggleActive]}>
                          <View style={[styles.toggleThumb, accountResolutionEnabled && styles.toggleThumbActive]} />
                        </View>
                      </TouchableOpacity>
                      
                      {accountResolutionEnabled && (
                        <View style={styles.resolutionCard}>
                          {accountResolutionStatus === 'idle' && (
                            <TouchableOpacity
                              style={[styles.resolveButton, (!bankName || accountNumber.length < 10) && styles.resolveButtonDisabled]}
                              onPress={handleResolveAccountName}
                              disabled={!bankName || accountNumber.length < 10}
                              activeOpacity={0.7}
                            >
                              <Text style={styles.resolveButtonText}>Resolve Name</Text>
                            </TouchableOpacity>
                          )}
                          
                          {accountResolutionStatus === 'loading' && (
                            <View style={styles.resolutionStatus}>
                              <ActivityIndicator size="small" color={Colors.primary} />
                              <Text style={styles.resolutionText}>Resolving...</Text>
                            </View>
                          )}
                          
                          {accountResolutionStatus === 'success' && (
                            <View style={styles.resolutionSuccess}>
                              <Text style={styles.resolutionLabel}>Account Name (resolved)</Text>
                              <Text style={styles.resolutionValue}>{resolvedAccountName}</Text>
                            </View>
                          )}
                          
                          {accountResolutionStatus === 'error' && (
                            <View style={styles.resolutionError}>
                              <Text style={styles.resolutionErrorText}>Could not resolve name. Please verify details.</Text>
                            </View>
                          )}
                        </View>
                      )}
                    </>
                  )}
                  
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeBoxText}>Only share bank accounts you control.</Text>
                  </View>
                </View>
              )}
              
              {selectedProvider && selectedProvider.type === 'card' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>CARD PAYMENT DETAILS</Text>
                  
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>External payment link</Text>
                    <TextInput
                      style={styles.input}
                      value={externalPaymentLink}
                      onChangeText={setExternalPaymentLink}
                      placeholder="https://your-payment-provider.com"
                      placeholderTextColor={Colors.textSecondary}
                      keyboardType="url"
                      autoCapitalize="none"
                    />
                    <Text style={styles.helperText}>
                      Customer may be redirected to the provider. Platform does not process payments.
                    </Text>
                  </View>
                  
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Business display name (optional)</Text>
                    <TextInput
                      style={styles.input}
                      value={businessDisplayName}
                      onChangeText={setBusinessDisplayName}
                      placeholder="Your business name"
                      placeholderTextColor={Colors.textSecondary}
                    />
                  </View>
                  
                  <View style={styles.warningBox}>
                    <AlertTriangle size={16} color={Colors.primary} />
                    <Text style={styles.warningBoxText}>
                      You&apos;ll be redirected to the vendor&apos;s payment provider. Platform does not process card payments.
                    </Text>
                  </View>
                </View>
              )}
              
              {selectedProvider && selectedProvider.type === 'wallet' && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>WALLET DETAILS</Text>
                  
                  <View style={styles.inputWrapper}>
                    <Text style={styles.inputLabel}>Wallet handle / tag</Text>
                    <TextInput
                      style={styles.input}
                      value={walletHandle}
                      onChangeText={setWalletHandle}
                      placeholder="@username or wallet address"
                      placeholderTextColor={Colors.textSecondary}
                      autoCapitalize="none"
                    />
                  </View>
                  
                  <View style={styles.noticeBox}>
                    <Text style={styles.noticeBoxText}>Only share wallet handles you control.</Text>
                  </View>
                </View>
              )}

              {selectedProvider && (
                <TouchableOpacity
                  style={styles.attestationContainer}
                  onPress={() => setAttestationChecked(!attestationChecked)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.attestationCheckbox, attestationChecked && styles.attestationCheckboxChecked]}>
                    {attestationChecked && <Text style={styles.checkboxIcon}>✓</Text>}
                  </View>
                  <Text style={styles.attestationText}>
                    I confirm this payment information belongs to me or my business.
                  </Text>
                </TouchableOpacity>
              )}
              
              <View style={styles.noticeCard}>
                <Text style={styles.noticeText}>
                  This request requires admin approval. Your existing payment method remains active until approved.
                </Text>
              </View>

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => router.back()}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, !isSubmitEnabled() && styles.disabledButton]}
                  onPress={handleSubmitRequest}
                  activeOpacity={0.7}
                  disabled={!isSubmitEnabled()}
                >
                  <Text style={[styles.submitButtonText, !isSubmitEnabled() && styles.disabledButtonText]}>
                    Submit Request
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showSecurityModal}
        animationType="fade"
        transparent
        onRequestClose={() => router.back()}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Security Verification</Text>
            <Text style={styles.modalSubtitle}>To continue, please confirm your identity.</Text>

            <View style={styles.inputContainer}>
              <Text style={styles.modalInputLabel}>Password</Text>
              <TextInput
                style={styles.modalInput}
                value={password}
                onChangeText={setPassword}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textSecondary}
                secureTextEntry
                autoCapitalize="none"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.modalInputLabel}>2FA Code (if enabled)</Text>
              <TextInput
                style={styles.modalInput}
                value={twoFactorCode}
                onChangeText={setTwoFactorCode}
                placeholder="Enter 2FA code"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
                maxLength={6}
              />
            </View>

            <View style={styles.modalButtonContainer}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => router.back()}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalContinueButton, !password && styles.disabledButton]}
                onPress={handleSecurityContinue}
                activeOpacity={0.7}
                disabled={!password}
              >
                <Text style={[styles.modalContinueText, !password && styles.disabledButtonText]}>
                  Continue
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showProviderPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowProviderPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowProviderPicker(false)}
          />
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Payment Provider</Text>
              <TouchableOpacity
                onPress={() => setShowProviderPicker(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {availableProviders.map((provider) => (
                <TouchableOpacity
                  key={provider.id}
                  style={[
                    styles.pickerOption,
                    selectedProvider?.id === provider.id && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedProvider(provider);
                    setShowProviderPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.pickerOptionLabel}>{provider.label}</Text>
                    <Text style={styles.pickerOptionType}>
                      {provider.type === 'bank' ? 'Bank Transfer' : provider.type === 'card' ? 'Card Payment' : 'Wallet'}
                    </Text>
                  </View>
                  {selectedProvider?.id === provider.id && (
                    <View style={styles.pickerCheckmark} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showBankPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBankPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <TouchableOpacity
            style={styles.pickerBackdrop}
            activeOpacity={1}
            onPress={() => setShowBankPicker(false)}
          />
          <View style={styles.pickerCard}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>Select Bank</Text>
              <TouchableOpacity
                onPress={() => setShowBankPicker(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.pickerDone}>Done</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              {availableBanks.map((bank) => (
                <TouchableOpacity
                  key={bank}
                  style={[
                    styles.pickerOption,
                    bankName === bank && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    setBankName(bank);
                    setAccountResolutionStatus('idle');
                    setResolvedAccountName('');
                    setShowBankPicker(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.pickerOptionLabel}>{bank}</Text>
                  {bankName === bank && (
                    <View style={styles.pickerCheckmark} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  infoText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  currentMethodCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  methodRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  methodLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  methodValue: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  radioGroup: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  radioOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.primary,
    marginRight: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  radioSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: 17,
    color: Colors.text,
  },
  dropdownButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  dropdownValue: {
    fontSize: 17,
    color: Colors.text,
  },
  dropdownPlaceholder: {
    fontSize: 17,
    color: Colors.textSecondary,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    lineHeight: 18,
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end' as const,
  },
  pickerBackdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  pickerCard: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '70%',
  },
  pickerHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  pickerDone: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerOptionSelected: {
    backgroundColor: 'rgba(10, 132, 255, 0.1)',
  },
  pickerOptionLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
    marginBottom: 4,
  },
  pickerOptionType: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  pickerCheckmark: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  inputWrapper: {
    marginTop: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 12,
    marginTop: 16,
  },
  toggleLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    backgroundColor: Colors.border,
    padding: 2,
    justifyContent: 'center' as const,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: Colors.background,
  },
  toggleThumbActive: {
    transform: [{ translateX: 20 }] as any,
  },
  resolutionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  resolveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center' as const,
  },
  resolveButtonDisabled: {
    backgroundColor: Colors.border,
    opacity: 0.5,
  },
  resolveButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  resolutionStatus: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  resolutionText: {
    fontSize: 15,
    color: Colors.primary,
  },
  resolutionSuccess: {
    gap: 8,
  },
  resolutionLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  resolutionValue: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.success,
  },
  resolutionError: {
    padding: 12,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 8,
  },
  resolutionErrorText: {
    fontSize: 14,
    color: Colors.error,
    lineHeight: 20,
  },
  noticeBox: {
    backgroundColor: 'rgba(142, 142, 147, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
  },
  noticeBoxText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  warningBox: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  warningBoxText: {
    flex: 1,
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
  },
  attestationContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
    padding: 16,
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginTop: 24,
  },
  attestationCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginTop: 2,
  },
  attestationCheckboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkboxIcon: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  attestationText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
  noticeCard: {
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderRadius: 16,
    padding: 16,
    marginTop: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  noticeText: {
    fontSize: 14,
    color: Colors.primary,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 24,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: Colors.white,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.charcoal,
    minHeight: 52,
  },
  cancelButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  submitButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  disabledButton: {
    backgroundColor: Colors.disabled,
  },
  disabledButtonText: {
    color: Colors.textSecondary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  modalCard: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 380,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  modalSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 24,
    textAlign: 'center' as const,
  },
  inputContainer: {
    marginBottom: 20,
  },
  modalInputLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  modalInput: {
    backgroundColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: Colors.text,
  },
  modalButtonContainer: {
    flexDirection: 'row' as const,
    gap: 12,
    marginTop: 8,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    backgroundColor: Colors.border,
  },
  modalCancelText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  modalContinueButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    backgroundColor: Colors.primary,
  },
  modalContinueText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  bottomSpacer: {
    height: 40,
  },
});
