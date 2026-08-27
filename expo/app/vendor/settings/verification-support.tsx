import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { ChevronDown } from 'lucide-react-native';
import { useVerification } from '@/contexts/VerificationContext';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { callable } from '@/lib/firebase';

interface CreateTicketResponse {
  success: true;
  ticketId: string;
  chatId: string;
  created: boolean;
}

const ISSUE_TYPES = [
  'ID rejected',
  'Photo unclear',
  'Name mismatch',
  'Business verification issue',
] as const;

export default function VerificationSupportScreen() {
  const router = useRouter();
  const { verificationData } = useVerification();
  const [issueType, setIssueType] = useState<string>('');
  const [message, setMessage] = useState('');
  const [showIssueTypePicker, setShowIssueTypePicker] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // Files into the same real support-ticket system as report-problem.tsx and
  // contact-support.tsx (createSupportTicket/sendChatMessage), rather than
  // the console.log-and-fake-success this screen previously did.
  const handleSubmit = async () => {
    if (!issueType || !message.trim()) return;

    setIsSending(true);
    const lines = [`Issue type: ${issueType}`];
    lines.push(`Verification reference: ${verificationData.referenceId || 'pending'}`);
    lines.push('', message.trim());
    const reportText = lines.join('\n');

    try {
      const createTicket = callable<{ subject: string; initialMessage: string }, CreateTicketResponse>(
        'createSupportTicket'
      );
      const res = await createTicket({ subject: `Verification Support: ${issueType}`, initialMessage: reportText });

      if (!res.data.created) {
        const sendMessage = callable<{ chatId: string; type: string; content: string }, unknown>(
          'sendChatMessage'
        );
        await sendMessage({ chatId: res.data.chatId, type: 'text', content: reportText });
      }

      setIsSending(false);
      Alert.alert(
        '',
        'Your request has been submitted. A support agent will review your case.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    } catch (error) {
      setIsSending(false);
      const msg = (error as { message?: string })?.message ?? 'Could not submit your request. Please try again.';
      Alert.alert('Submission failed', msg);
    }
  };

  const canSubmit = issueType && message.trim().length > 0 && message.trim().length <= 500;

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Verification Support" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {verificationData.referenceId ? (
            <View style={styles.referenceCard}>
              <Text style={styles.referenceLabel}>Verification Reference</Text>
              <Text style={styles.referenceValue}>{verificationData.referenceId}</Text>
            </View>
          ) : null}

          <Text style={styles.instructions}>
            Describe the issue you encountered during verification. Our support team will review your case and respond within 24-48 hours.
          </Text>

          <View style={styles.fieldContainer}>
            <Text style={styles.label}>Issue Type *</Text>
            <TouchableOpacity
              style={styles.pickerButton}
              onPress={() => setShowIssueTypePicker(!showIssueTypePicker)}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerText, !issueType && styles.placeholderText]}>
                {issueType || 'Select issue type'}
              </Text>
              <ChevronDown size={20} color={Colors.textMuted} />
            </TouchableOpacity>

            {showIssueTypePicker && (
              <View style={styles.pickerOptions}>
                {ISSUE_TYPES.map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={styles.pickerOption}
                    onPress={() => {
                      setIssueType(type);
                      setShowIssueTypePicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerOptionText}>{type}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={styles.fieldContainer}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Message</Text>
              <Text style={[
                styles.charCount,
                message.length > 500 && styles.charCountError
              ]}>
                {message.length}/500
              </Text>
            </View>
            <TextInput
              style={styles.messageInput}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe the issue in detail..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoText}>
              Do not include sensitive information like passwords or full ID numbers in this message.
            </Text>
          </View>

          <TouchableOpacity
            style={[styles.submitButton, (!canSubmit || isSending) && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!canSubmit || isSending}
            activeOpacity={0.8}
          >
            <Text style={[styles.submitButtonText, (!canSubmit || isSending) && styles.submitButtonTextDisabled]}>
              {isSending ? 'Submitting...' : 'Submit Request'}
            </Text>
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
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  referenceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    alignItems: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  referenceLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  referenceValue: {
    fontSize: 15,
    color: Colors.text,
    fontFamily: 'monospace',
  },
  instructions: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: 32,
  },
  fieldContainer: {
    marginBottom: 24,
  },
  label: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  labelRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  charCount: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  charCountError: {
    color: Colors.error,
  },
  pickerButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerText: {
    fontSize: 16,
    color: Colors.text,
  },
  placeholderText: {
    color: Colors.textMuted,
  },
  pickerOptions: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  pickerOptionText: {
    fontSize: 16,
    color: Colors.text,
  },
  messageInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 150,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  submitButtonTextDisabled: {
    color: Colors.textMuted,
  },
  bottomSpacer: {
    height: 40,
  },
});
