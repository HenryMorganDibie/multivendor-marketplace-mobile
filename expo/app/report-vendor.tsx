import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';

type VendorReportReason =
  | 'suspicious_payment'
  | 'scam_fraud'
  | 'harassment'
  | 'inappropriate_content'
  | 'fake_business'
  | 'unresponsive'
  | 'other';

type CustomerReportReason =
  | 'inappropriate'
  | 'unresponsive'
  | 'fraudulent_info'
  | 'other';

type ReportReason = VendorReportReason | CustomerReportReason;

interface ReasonOption {
  id: ReportReason;
  label: string;
  description?: string;
}

const VENDOR_REASONS: ReasonOption[] = [
  { id: 'suspicious_payment', label: 'Suspicious payment request', description: 'Asking for unusual payment methods or outside-platform transfers' },
  { id: 'scam_fraud', label: 'Scam or fraud concern', description: 'Suspected deceptive behavior or taking payment without fulfilling orders' },
  { id: 'harassment', label: 'Harassment or abusive behavior', description: 'Threatening, abusive, or intimidating messages' },
  { id: 'inappropriate_content', label: 'Inappropriate content', description: 'Offensive, adult, or illegal content in listings or messages' },
  { id: 'fake_business', label: 'Fake business information', description: 'Business name, photos, or details appear fabricated' },
  { id: 'unresponsive', label: 'Vendor not responding', description: 'Persistent failure to respond to legitimate orders or messages' },
  { id: 'other', label: 'Other' },
];

const CUSTOMER_REASONS: ReasonOption[] = [
  { id: 'inappropriate', label: 'Inappropriate behavior', description: 'Offensive or threatening messages' },
  { id: 'unresponsive', label: 'Unresponsive customer', description: 'Customer placed orders then stopped communicating' },
  { id: 'fraudulent_info', label: 'Fraudulent information', description: 'False identity or suspicious activity' },
  { id: 'other', label: 'Other' },
];

export default function ReportVendorScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const reportType = (params.type as 'vendor' | 'customer') || 'vendor';
  const reportName = (params.vendorName as string) || (params.name as string) || (reportType === 'customer' ? 'Customer' : 'Vendor');
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(null);
  const [additionalDetails, setAdditionalDetails] = useState('');

  const handleBackPress = () => {
    router.back();
  };

  const handleSubmit = () => {
    if (!selectedReason) {
      Alert.alert('Select Reason', `Please select a reason for reporting this ${reportType}.`);
      return;
    }

    console.log(`${reportType} report submitted:`, {
      type: reportType,
      name: reportName,
      reason: selectedReason,
      details: additionalDetails.trim(),
    });

    Alert.alert(
      'Report Submitted',
      'Thank you for your report. We will review it and take appropriate action.',
      [
        {
          text: 'OK',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const reportReasons = reportType === 'customer' ? CUSTOMER_REASONS : VENDOR_REASONS;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report {reportType === 'customer' ? 'Customer' : 'Vendor'}</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            {reportType === 'customer'
              ? 'Help us maintain a safe community by reporting customers with inappropriate behavior or fraudulent activity.'
              : `Your report about ${reportName} will be reviewed by the platform safety team. All reports are confidential.`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>WHAT HAPPENED?</Text>
          <View style={styles.reasonsList}>
            {reportReasons.map((reason, index) => (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonOption,
                  selectedReason === reason.id && styles.reasonOptionSelected,
                  index === 0 && styles.reasonOptionFirst,
                  index === reportReasons.length - 1 && styles.reasonOptionLast,
                ]}
                onPress={() => setSelectedReason(reason.id)}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.radioCircle,
                    selectedReason === reason.id && styles.radioCircleSelected,
                  ]}
                >
                  {selectedReason === reason.id && (
                    <View style={styles.radioCircleInner} />
                  )}
                </View>
                <View style={styles.reasonTextWrap}>
                  <Text style={styles.reasonText}>{reason.label}</Text>
                  {reason.description && (
                    <Text style={styles.reasonDescription}>{reason.description}</Text>
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ADDITIONAL DETAILS (Optional)</Text>
          <TextInput
            style={styles.textInput}
            placeholder="Provide more context..."
            placeholderTextColor={Colors.textSecondary}
            value={additionalDetails}
            onChangeText={(text) => setAdditionalDetails(text.slice(0, 250))}
            maxLength={250}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
          <Text style={styles.characterCount}>{additionalDetails.length}/250</Text>
        </View>

        <View style={styles.submitContainer}>
          <TouchableOpacity
            style={[styles.submitButton, !selectedReason && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={!selectedReason}
            activeOpacity={0.8}
          >
            <Text style={styles.submitButtonText}>Submit Report</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
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
  infoBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 24,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  reasonsList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  reasonOption: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  reasonOptionFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  reasonOptionLast: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  reasonOptionSelected: {
    backgroundColor: Colors.border,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.textMuted ?? Colors.textSecondary,
    backgroundColor: 'transparent' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: '#2B2B2B',
    borderWidth: 2,
  },
  radioCircleInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#2B2B2B',
  },
  reasonTextWrap: {
    flex: 1,
  },
  reasonText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  reasonDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 2,
    lineHeight: 16,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: Colors.text,
    minHeight: 120,
  },
  characterCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'right' as const,
    marginTop: 8,
  },
  submitContainer: {
    marginTop: 8,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 52,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.disabled,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  bottomSpacer: {
    height: 40,
  },
});
