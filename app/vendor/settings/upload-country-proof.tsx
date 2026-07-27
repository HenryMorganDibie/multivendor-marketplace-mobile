import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, Upload, FileText, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface UploadedDocument {
  id: string;
  name: string;
  type: string;
}

export default function UploadCountryProofScreen() {
  const router = useRouter();
  const [uploadedDocuments, setUploadedDocuments] = useState<UploadedDocument[]>([]);

  const handleUpload = () => {
    const newDoc: UploadedDocument = {
      id: Date.now().toString(),
      name: `Document ${uploadedDocuments.length + 1}.pdf`,
      type: 'pdf',
    };
    setUploadedDocuments([...uploadedDocuments, newDoc]);
    console.log('Document uploaded:', newDoc);
  };

  const handleRemove = (id: string) => {
    setUploadedDocuments(uploadedDocuments.filter(doc => doc.id !== id));
  };

  const handleSubmit = () => {
    if (uploadedDocuments.length === 0) return;
    console.log('Submitting country change request with documents:', uploadedDocuments);
    router.push('/vendor/settings/country-change-status' as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={Colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Upload Proof</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Please upload one or more documents</Text>
          <Text style={styles.infoText}>
            Upload documents showing your business presence in the new country.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCEPTED DOCUMENTS</Text>
          <View style={styles.acceptedCard}>
            <Text style={styles.acceptedItem}>• Government ID</Text>
            <Text style={styles.acceptedItem}>• Business registration</Text>
            <Text style={styles.acceptedItem}>• Utility bill</Text>
            <Text style={styles.acceptedItem}>• Lease agreement</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={handleUpload}
          activeOpacity={0.7}
        >
          <Upload size={20} color={Colors.primary} />
          <Text style={styles.uploadButtonText}>Upload Document</Text>
        </TouchableOpacity>

        {uploadedDocuments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>UPLOADED DOCUMENTS</Text>
            <View style={styles.documentsList}>
              {uploadedDocuments.map((doc, index) => (
                <View key={doc.id}>
                  <View style={styles.documentItem}>
                    <View style={styles.documentInfo}>
                      <FileText size={20} color={Colors.primary} />
                      <Text style={styles.documentName}>{doc.name}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => handleRemove(doc.id)}
                      style={styles.removeButton}
                      activeOpacity={0.7}
                    >
                      <X size={20} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                  {index < uploadedDocuments.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[styles.submitButton, uploadedDocuments.length === 0 && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          activeOpacity={0.7}
          disabled={uploadedDocuments.length === 0}
        >
          <Text style={[styles.submitButtonText, uploadedDocuments.length === 0 && styles.submitButtonTextDisabled]}>
            Submit Request
          </Text>
        </TouchableOpacity>

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
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  placeholder: {
    width: 32,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  section: {
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  acceptedCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
  },
  acceptedItem: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
  },
  uploadButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 8,
    marginTop: 24,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed' as const,
  },
  uploadButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  documentsList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  documentItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  documentInfo: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    flex: 1,
  },
  documentName: {
    fontSize: 17,
    color: Colors.text,
    flex: 1,
  },
  removeButton: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 32,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.border,
  },
  submitButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  submitButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
