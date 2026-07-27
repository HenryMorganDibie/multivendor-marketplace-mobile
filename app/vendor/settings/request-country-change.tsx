import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, ChevronDown } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function RequestCountryChangeScreen() {
  const router = useRouter();
  const [selectedCountry, setSelectedCountry] = useState('');
  const [reason, setReason] = useState('');
  const [showCountryPicker, setShowCountryPicker] = useState(false);

  const countries = [
    'Canada',
    'United States',
    'United Kingdom',
    'Nigeria',
    'Ghana',
    'Kenya',
    'South Africa',
  ];

  const canContinue = selectedCountry && reason.trim().length > 0;

  const handleContinue = () => {
    if (!canContinue) return;
    console.log('Country change request:', { country: selectedCountry, reason });
    router.push('/vendor/settings/upload-country-proof' as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <ChevronLeft size={28} color={Colors.charcoal} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Request Country Change</Text>
          <View style={styles.placeholder} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Changing your country requires admin approval.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>New Country</Text>
          <TouchableOpacity
            style={styles.pickerButton}
            onPress={() => setShowCountryPicker(!showCountryPicker)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pickerText, !selectedCountry && styles.placeholderText]}>
              {selectedCountry || 'Select country'}
            </Text>
            <ChevronDown size={20} color={Colors.textSecondary} />
          </TouchableOpacity>

          {showCountryPicker && (
            <View style={styles.pickerList}>
              {countries.map((country, index) => (
                <View key={country}>
                  <TouchableOpacity
                    style={styles.pickerItem}
                    onPress={() => {
                      setSelectedCountry(country);
                      setShowCountryPicker(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.pickerItemText}>{country}</Text>
                  </TouchableOpacity>
                  {index < countries.length - 1 && <View style={styles.divider} />}
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Reason for change</Text>
          <TextInput
            style={styles.textArea}
            placeholder="Explain why you need to change your country..."
            placeholderTextColor={Colors.textSecondary}
            value={reason}
            onChangeText={setReason}
            multiline
            textAlignVertical="top"
            maxLength={500}
          />
          <Text style={styles.charCount}>{reason.length} / 500</Text>
        </View>

        <TouchableOpacity
          style={[styles.continueButton, !canContinue && styles.continueButtonDisabled]}
          onPress={handleContinue}
          activeOpacity={0.7}
          disabled={!canContinue}
        >
          <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>
            Continue
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
  infoText: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
  },
  section: {
    marginTop: 24,
  },
  label: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  pickerButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  pickerText: {
    fontSize: 17,
    color: Colors.text,
  },
  placeholderText: {
    color: Colors.textSecondary,
  },
  pickerList: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  pickerItem: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  pickerItemText: {
    fontSize: 17,
    color: Colors.text,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginLeft: 16,
  },
  textArea: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    minHeight: 120,
  },
  charCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'right' as const,
  },
  continueButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center' as const,
    marginTop: 32,
  },
  continueButtonDisabled: {
    backgroundColor: Colors.border,
  },
  continueButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  continueButtonTextDisabled: {
    color: Colors.textSecondary,
  },
  bottomSpacer: {
    height: 40,
  },
});
