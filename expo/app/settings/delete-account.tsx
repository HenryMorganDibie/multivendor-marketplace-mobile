import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import LaektivaModal from '@/components/LaektivaModal';
import { callable } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Alert } from '@/utils/alert';

const DELETION_REASONS = [
  "I'm no longer using Platform",
  'I had a bad experience with a vendor',
  'I had a bad experience with the app',
  'Privacy concerns',
  'Too many notifications',
  'Other',
];

const sanitizeInput = (text: string): string => {
  const urlPattern = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi;
  const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const phonePattern = /[\d\s()+-]{10,}/g;
  
  return text
    .replace(urlPattern, '')
    .replace(emailPattern, '')
    .replace(phonePattern, '')
    .trim();
};

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { logout } = useAuth();
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showReasonDropdown, setShowReasonDropdown] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [otherReasonText, setOtherReasonText] = useState('');
  const [additionalFeedback, setAdditionalFeedback] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleBackPress = () => {
    router.back();
  };

  const handleReasonSelect = (reason: string) => {
    setSelectedReason(reason);
    setShowReasonDropdown(false);
    if (reason !== 'Other') {
      setOtherReasonText('');
    }
  };

  const handleDeleteAccount = async () => {
    setIsSubmitting(true);
    try {
      const requestDeletion = callable<{ reason?: string; feedback?: string }, { success: true }>(
        'requestAccountDeletion'
      );
      const reason = selectedReason === 'Other' ? (otherReasonText || 'Other') : selectedReason;
      await requestDeletion({
        reason: reason || undefined,
        feedback: additionalFeedback || undefined,
      });

      setShowConfirmModal(false);
      void logout();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not submit your deletion request.';
      setShowConfirmModal(false);
      Alert.alert('Something went wrong', message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canRequestDeletion = selectedReason !== '';

  const handleRequestDeletion = () => {
    if (!canRequestDeletion) return;
    setShowConfirmModal(true);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Delete Account</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.warningSection}>
          <Text style={styles.warningTitle}>Account deletion is scheduled</Text>
          <Text style={styles.warningText}>
            Your account will be deactivated immediately and scheduled for permanent deletion.
            You can restore your account within 90 days by logging back in.
          </Text>
        </View>

        <View style={styles.infoSection}>
          <Text style={styles.infoTitle}>What happens when you request deletion</Text>
          <View style={styles.infoItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.infoText}>Your account will be deactivated immediately</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.infoText}>Your profile will no longer be visible</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.infoText}>You will be logged out of Platform</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.bulletPoint}>•</Text>
            <Text style={styles.infoText}>Your data will be scheduled for deletion after 90 days</Text>
          </View>
          
          <Text style={styles.footnote}>
            Some records may be retained temporarily for legal, fraud prevention, or dispute resolution purposes, as required by law.
          </Text>
        </View>

        <View style={styles.reasonSection}>
          <Text style={styles.sectionLabel}>
            Reason for deletion <Text style={styles.required}>*</Text>
          </Text>
          <Text style={styles.sectionSubLabel}>Why are you deleting your account?</Text>
          
          <TouchableOpacity
            style={styles.dropdown}
            onPress={() => setShowReasonDropdown(!showReasonDropdown)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dropdownText, !selectedReason && styles.dropdownPlaceholder]}>
              {selectedReason || 'Select a reason'}
            </Text>
            <ChevronDown size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          {showReasonDropdown && (
            <View style={styles.dropdownMenu}>
              {DELETION_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason}
                  style={styles.dropdownItem}
                  onPress={() => handleReasonSelect(reason)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dropdownItemText}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {selectedReason === 'Other' && (
            <TextInput
              style={styles.textInput}
              placeholder="Please specify"
              placeholderTextColor={Colors.textSecondary}
              value={otherReasonText}
              onChangeText={(text) => setOtherReasonText(sanitizeInput(text))}
              maxLength={300}
              multiline
            />
          )}
        </View>

        <View style={styles.feedbackSection}>
          <Text style={styles.sectionLabel}>Additional feedback (optional)</Text>
          <Text style={styles.sectionSubLabel}>Anything you&apos;d like us to know?</Text>
          
          <TextInput
            style={styles.textInput}
            placeholder="Your feedback helps us improve..."
            placeholderTextColor={Colors.textSecondary}
            value={additionalFeedback}
            onChangeText={(text) => setAdditionalFeedback(sanitizeInput(text))}
            maxLength={300}
            multiline
            numberOfLines={4}
          />
          <Text style={styles.charCount}>{additionalFeedback.length}/300</Text>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <SafeAreaView edges={['bottom']} style={styles.bottomButtons}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleBackPress}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.deleteButton, !canRequestDeletion && styles.deleteButtonDisabled]}
          onPress={handleRequestDeletion}
          activeOpacity={0.8}
          disabled={!canRequestDeletion}
        >
          <Text style={[styles.deleteButtonText, !canRequestDeletion && styles.deleteButtonTextDisabled]}>
            Delete Account
          </Text>
        </TouchableOpacity>
      </SafeAreaView>

      <LaektivaModal
        visible={showConfirmModal}
        title="Confirm Account Deletion"
        message="Your account will be deactivated immediately and scheduled for deletion. You can restore it within 90 days by logging back in."
        primaryButton={{
          label: 'Confirm Deletion',
          onPress: handleDeleteAccount,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowConfirmModal(false),
        }}
        destructive={true}
      />
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
  warningSection: {
    marginTop: 32,
    marginBottom: 32,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  warningText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  infoSection: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 32,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    marginBottom: 12,
  },
  bulletPoint: {
    fontSize: 16,
    color: Colors.textMuted,
    marginRight: 12,
    width: 12,
  },
  infoText: {
    fontSize: 15,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 22,
  },
  footnote: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 16,
    fontStyle: 'italic' as const,
  },
  reasonSection: {
    marginBottom: 24,
  },
  feedbackSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  required: {
    color: Colors.error,
  },
  sectionSubLabel: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 12,
  },
  dropdown: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  dropdownText: {
    fontSize: 16,
    color: Colors.text,
    flex: 1,
  },
  dropdownPlaceholder: {
    color: Colors.textSecondary,
  },
  dropdownMenu: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden' as const,
  },
  dropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  dropdownItemText: {
    fontSize: 16,
    color: Colors.text,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
    marginTop: 8,
    minHeight: 100,
    textAlignVertical: 'top' as const,
  },
  charCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'right' as const,
  },
  bottomButtons: {
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 12,
    flexDirection: 'row' as const,
    gap: 12,
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
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  deleteButton: {
    flex: 1,
    backgroundColor: Colors.error,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  deleteButtonDisabled: {
    backgroundColor: Colors.charcoal,
    opacity: 0.6,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  deleteButtonTextDisabled: {
    color: Colors.textMuted,
  },
  bottomSpacer: {
    height: 100,
  },
});
