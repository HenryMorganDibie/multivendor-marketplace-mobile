import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useRouter } from 'expo-router';
import { Upload, Image as ImageIcon } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';
import { useUnsavedChanges } from '@/utils/useUnsavedChanges';
import DiscardChangesModal from '@/components/DiscardChangesModal';
import type { DocumentTemplateId } from '@/constants/documentBranding';

export default function ReceiptBrandingScreen() {
  const routerNav = useRouter();
  const [businessName, setBusinessName] = useState('Sanste Catering');
  // businessAddress deliberately not collected here — kept out of the invoice
  // branding contract. Many vendors operate from home, and a verification/
  // private address must never end up on a public-facing invoice by
  // accident. An optional public invoice address may be introduced later as
  // its own explicit field if needed.
  const [footerText, setFooterText] = useState('Thank you for your order!');
  const [selectedTemplate, setSelectedTemplate] = useState<DocumentTemplateId>('classic');
  const [hasLogo, setHasLogo] = useState(false);

  const unsavedChanges = useUnsavedChanges(
    { businessName, footerText, selectedTemplate, hasLogo },
    false
  );



  const handleSave = () => {
    console.log('Save branding settings');
    unsavedChanges.resetChanges();
    router.back();
  };

  const handleUploadLogo = () => {
    console.log('Upload logo');
    setHasLogo(true);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Receipt Branding"
          onBack={() => routerNav.back()}
          onSave={handleSave}
          saveEnabled={unsavedChanges.hasUnsavedChanges}
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>LOGO</Text>
            <View style={styles.glassCard}>
              {hasLogo ? (
                <View style={styles.logoPreview}>
                  <View style={styles.logoPlaceholder}>
                    <ImageIcon size={32} color={Colors.textSecondary} />
                  </View>
                  <TouchableOpacity
                    style={styles.changeLogoButton}
                    onPress={handleUploadLogo}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.changeLogoText}>Change Logo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={handleUploadLogo}
                  activeOpacity={0.8}
                >
                  <Upload size={24} color={Colors.primary} />
                  <Text style={styles.uploadButtonText}>Upload Logo</Text>
                  <Text style={styles.uploadHint}>PNG or JPG, max 2MB</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>BUSINESS INFORMATION</Text>
            <View style={styles.glassCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Business Name</Text>
                <TextInput
                  style={styles.input}
                  value={businessName}
                  onChangeText={setBusinessName}
                  placeholder="Enter business name"
                  placeholderTextColor={Colors.textSecondary}
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>FOOTER TEXT</Text>
            <View style={styles.glassCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Optional</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={footerText}
                  onChangeText={setFooterText}
                  placeholder="Add a custom message (optional)"
                  placeholderTextColor={Colors.textSecondary}
                  multiline
                  numberOfLines={2}
                  textAlignVertical="top"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>TEMPLATE</Text>
            <View style={styles.glassCard}>
              <TouchableOpacity
                style={[styles.templateOption, selectedTemplate === 'classic' && styles.templateOptionSelected]}
                onPress={() => setSelectedTemplate('classic')}
                activeOpacity={0.8}
              >
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>Classic</Text>
                  <Text style={styles.templateDescription}>Clean and professional</Text>
                </View>
                {selectedTemplate === 'classic' && (
                  <View style={styles.selectedBadge} />
                )}
              </TouchableOpacity>

              <View style={styles.divider} />

              <TouchableOpacity
                style={[styles.templateOption, selectedTemplate === 'modern' && styles.templateOptionSelected]}
                onPress={() => setSelectedTemplate('modern')}
                activeOpacity={0.8}
              >
                <View style={styles.templateInfo}>
                  <Text style={styles.templateName}>Modern</Text>
                  <Text style={styles.templateDescription}>Bold and contemporary</Text>
                </View>
                {selectedTemplate === 'modern' && (
                  <View style={styles.selectedBadge} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewPreviewButton}
            onPress={() => router.push('/vendor/settings/receipt-preview' as any)}
            activeOpacity={0.8}
          >
            <Text style={styles.viewPreviewButtonText}>View Sample Receipt</Text>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <DiscardChangesModal
        visible={unsavedChanges.showDiscardModal}
        onKeepEditing={unsavedChanges.handleKeepEditing}
        onDiscard={() => {
          unsavedChanges.handleDiscard();
          router.back();
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
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
  },
  uploadButton: {
    alignItems: 'center' as const,
    paddingVertical: 32,
  },
  uploadButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
    marginTop: 12,
  },
  uploadHint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  logoPreview: {
    alignItems: 'center' as const,
  },
  logoPlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: Colors.border,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 16,
  },
  changeLogoButton: {
    paddingVertical: 8,
  },
  changeLogoText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  inputGroup: {
    gap: 12,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.textMuted,
  },
  input: {
    fontSize: 17,
    color: Colors.text,
    padding: 0,
  },
  multilineInput: {
    minHeight: 60,
    paddingTop: 0,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 16,
  },
  templateOption: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
  },
  templateOptionSelected: {
    opacity: 1,
  },
  templateInfo: {
    flex: 1,
  },
  templateName: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  templateDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
  },
  viewPreviewButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 24,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  viewPreviewButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
