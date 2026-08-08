import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Check, Lock } from 'lucide-react-native';
import { useVendor } from '@/contexts/VendorContext';
import { Alert } from '@/utils/alert';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';
import { callable } from '@/lib/firebase';
import { DAY_ONE_CATEGORIES } from '@/constants/categories';

/**
 * The screen the "Add business details" onboarding step has always pointed
 * to (ONBOARDING_STEP_ROUTES.business_details) but never had. business_name
 * + category are the two fields resolveOnboardingStatus.ts actually requires
 * to publish (blocksPublication: true) — and completeRegistration's
 * progressive-onboarding payload deliberately leaves both blank at signup —
 * so with no screen here, a vendor had no path anywhere in the app to ever
 * satisfy the one thing standing between them and going live.
 */
export default function BusinessProfileScreen() {
  const router = useRouter();
  const { vendor } = useVendor();

  const isLocked = vendor.isVerified === true;
  const [businessName, setBusinessName] = useState(vendor.name ?? '');
  const [category, setCategory] = useState(vendor.category ?? '');
  const [isSaving, setIsSaving] = useState(false);

  const trimmedName = businessName.trim();
  const canSave = !isLocked && trimmedName.length > 0 && category.length > 0 && !isSaving;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const update = callable<
        { businessName: string; categoryName: string },
        { success: true }
      >('updateVendorBusinessDetails');
      await update({ businessName: trimmedName, categoryName: category });
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save business details.';
      Alert.alert('Could not save', message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Business Details"
          onBack={() => router.back()}
          onSave={handleSave}
          saveEnabled={canSave}
          showSave={!isLocked}
        />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {isLocked && (
            <View style={styles.lockedBanner}>
              <Lock size={16} color={Colors.textSecondary} strokeWidth={2} />
              <Text style={styles.lockedBannerText}>
                Your business is verified, so name and category are locked. Contact support if this needs to change.
              </Text>
            </View>
          )}

          <Text style={styles.label}>Business name</Text>
          <TextInput
            style={[styles.input, isLocked && styles.inputLocked]}
            value={businessName}
            onChangeText={setBusinessName}
            placeholder="e.g. Sanste Foods"
            placeholderTextColor={Colors.textMuted}
            editable={!isLocked}
            maxLength={100}
          />

          <Text style={[styles.label, { marginTop: 24 }]}>Category</Text>
          <View style={styles.categoryGrid}>
            {DAY_ONE_CATEGORIES.map((cat) => {
              const selected = category === cat;
              return (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryChip, selected && styles.categoryChipSelected]}
                  onPress={() => !isLocked && setCategory(cat)}
                  activeOpacity={0.7}
                  disabled={isLocked}
                >
                  {selected && <Check size={14} color="#FFFFFF" strokeWidth={2.5} />}
                  <Text style={[styles.categoryChipText, selected && styles.categoryChipTextSelected]}>{cat}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>

        {!isLocked && (
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
              onPress={handleSave}
              activeOpacity={0.7}
              disabled={!canSave}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.saveButtonText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  headerSafe: { backgroundColor: Colors.background },
  safeArea: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  lockedBanner: {
    flexDirection: 'row' as const,
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.surfaceMuted ?? '#F8F9FA',
    marginBottom: 20,
  },
  lockedBannerText: { flex: 1, fontSize: 13, lineHeight: 18, color: Colors.textSecondary },
  label: { fontSize: 13, fontWeight: '600' as const, color: Colors.textMuted, marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: Colors.text,
  },
  inputLocked: { opacity: 0.6 },
  categoryGrid: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
  categoryChip: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryChipText: { fontSize: 14, color: Colors.text },
  categoryChipTextSelected: { color: '#FFFFFF', fontWeight: '600' as const },
  bottomSpacer: { height: 100 },
  footer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.surface,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
  },
  saveButtonDisabled: { opacity: 0.5 },
  saveButtonText: { fontSize: 17, fontWeight: '600' as const, color: '#FFFFFF' },
});
