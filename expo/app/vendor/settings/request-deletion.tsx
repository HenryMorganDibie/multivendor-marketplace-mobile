import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AlertTriangle, CheckSquare, Square } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

const DELETION_REASONS = [
  'No longer using the platform',
  'Business closed',
  'Switching to another platform',
  'Too complicated to use',
  'Not enough customers',
  'Payment or trust concerns',
  'Privacy concerns',
  'Other',
] as const;

export default function RequestDeletionScreen() {
  const router = useRouter();
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [isConfirmationChecked, setIsConfirmationChecked] = useState(false);

  const sanitizeInput = (text: string): string => {
    const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
    const phonePattern = /\+?[0-9]{1,4}[\s-]?\(?[0-9]{1,3}\)?[\s-]?[0-9]{1,4}[\s-]?[0-9]{1,4}[\s-]?[0-9]{1,9}/gi;
    
    return text
      .replace(urlPattern, '[link removed]')
      .replace(emailPattern, '[email removed]')
      .replace(phonePattern, '[phone removed]')
      .slice(0, 300);
  };

  const handleFeedbackChange = (text: string) => {
    const sanitized = sanitizeInput(text);
    setAdditionalFeedback(sanitized);
  };

  const handleRequestDeletion = () => {
    if (!isConfirmationChecked) {
      Alert.alert('Confirmation Required', 'Please confirm that you understand the deletion terms.');
      return;
    }

    console.log('Account deletion request submitted');
    console.log('Reason:', selectedReason || 'Not provided');
    console.log('Feedback:', additionalFeedback || 'Not provided');
    console.log('Timestamp:', new Date().toISOString());
    
    Alert.alert(
      'Request Submitted',
      'Your account has been marked as "Pending Deletion". You will be logged out immediately. You have 90 days to contact support if you wish to undo this request.',
      [
        {
          text: 'Understood',
          onPress: () => {
            router.replace('/' as any);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Delete Account" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.warningCard}>
            <AlertTriangle size={48} color="#FF3B30" />
            <Text style={styles.warningText}>
              Deleting your the platform account will disable access to your storefront, orders, chats, and reports. Your account will be scheduled for permanent deletion after 90 days. During this 90-day period, you may undo this request by contacting support.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Optional Deletion Feedback</Text>
            
            <Text style={styles.fieldLabel}>Why are you deleting your account? (Optional)</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowReasonDropdown(!showReasonDropdown)}
              activeOpacity={0.7}
            >
              <Text style={selectedReason ? styles.dropdownTextSelected : styles.dropdownTextPlaceholder}>
                {selectedReason || 'Select a reason'}
              </Text>
            </TouchableOpacity>

            {showReasonDropdown && (
              <View style={styles.dropdownMenu}>
                {DELETION_REASONS.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={styles.dropdownItem}
                    onPress={() => {
                      setSelectedReason(reason);
                      setShowReasonDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.dropdownItemText}>{reason}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <Text style={[styles.fieldLabel, { marginTop: 24 }]}>Additional feedback (optional)</Text>
            <TextInput
              style={styles.textArea}
              value={additionalFeedback}
              onChangeText={handleFeedbackChange}
              placeholder="Share your thoughts..."
              placeholderTextColor="#666"
              multiline
              maxLength={300}
              textAlignVertical="top"
            />
            <Text style={styles.helperText}>
              This feedback helps us improve. This is not a support or dispute request.
            </Text>
            <Text style={styles.characterCount}>{additionalFeedback.length}/300</Text>
          </View>

          <View style={styles.section}>
            <TouchableOpacity
              style={styles.checkboxContainer}
              onPress={() => setIsConfirmationChecked(!isConfirmationChecked)}
              activeOpacity={0.7}
            >
              {isConfirmationChecked ? (
                <CheckSquare size={24} color="#0A84FF" />
              ) : (
                <Square size={24} color="#666" />
              )}
              <Text style={styles.checkboxLabel}>
                I understand that the platform does not process payments or issue refunds, and that deleting my account does not resolve disputes with customers.
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              !isConfirmationChecked && styles.primaryButtonDisabled,
            ]}
            onPress={handleRequestDeletion}
            activeOpacity={0.7}
            disabled={!isConfirmationChecked}
          >
            <Text style={[
              styles.primaryButtonText,
              !isConfirmationChecked && styles.primaryButtonTextDisabled,
            ]}>
              Request Account Deletion
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
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
  warningCard: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderRadius: 16,
    padding: 24,
    marginTop: 16,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  warningText: {
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
    textAlign: 'center' as const,
    marginTop: 16,
  },
  section: {
    marginTop: 32,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  dropdown: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  dropdownTextSelected: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  dropdownTextPlaceholder: {
    fontSize: 17,
    color: '#666',
  },
  dropdownMenu: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    overflow: 'hidden' as const,
  },
  dropdownItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  dropdownItemText: {
    fontSize: 17,
    color: '#FFFFFF',
  },
  textArea: {
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#2C2C2E',
    fontSize: 17,
    color: '#FFFFFF',
    minHeight: 120,
  },
  helperText: {
    fontSize: 13,
    color: '#666',
    marginTop: 8,
    lineHeight: 18,
  },
  characterCount: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
    textAlign: 'right' as const,
  },
  checkboxContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    gap: 12,
  },
  checkboxLabel: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    lineHeight: 22,
  },
  primaryButton: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 32,
  },
  primaryButtonDisabled: {
    backgroundColor: '#2C2C2E',
  },
  primaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  primaryButtonTextDisabled: {
    color: '#666',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#0A84FF',
  },
  bottomSpacer: {
    height: 40,
  },
});
