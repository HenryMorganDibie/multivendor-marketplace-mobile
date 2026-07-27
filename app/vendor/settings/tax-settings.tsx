import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, TextInput, ScrollView } from 'react-native';
import { Alert } from '@/utils/alert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';

export default function TaxSettingsScreen() {
  const [collectTax, setCollectTax] = useState(false);
  const [taxPercentage, setTaxPercentage] = useState('');
  const [_savedCollectTax, setSavedCollectTax] = useState(false);
  const [savedTaxPercentage, setSavedTaxPercentage] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    void loadTaxSettings();
  }, []);

  const loadTaxSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem('taxSettings');
      if (stored) {
        const settings = JSON.parse(stored);
        const saved = settings.collectTax || false;
        const savedRate = settings.taxPercentage ? settings.taxPercentage.toString() : '';
        
        setCollectTax(saved);
        setTaxPercentage(savedRate);
        setSavedCollectTax(saved);
        setSavedTaxPercentage(savedRate);
      }
    } catch (error) {
      console.error('Error loading tax settings:', error);
    }
  };

  const handleToggleChange = (value: boolean) => {
    if (!value) {
      setCollectTax(false);
      setSavedCollectTax(false);
      setTaxPercentage('');
      setSavedTaxPercentage('');
      setIsEditing(false);
      void saveTaxSettings(false, '');
    } else {
      setCollectTax(true);
      setIsEditing(true);
    }
  };

  const saveTaxSettings = async (enabled: boolean, rate: string) => {
    try {
      const settings = {
        collectTax: enabled,
        taxPercentage: rate ? parseFloat(rate) : 0,
      };
      await AsyncStorage.setItem('taxSettings', JSON.stringify(settings));
    } catch (error) {
      console.error('Error saving tax settings:', error);
    }
  };

  const isValidTaxRate = () => {
    const numValue = parseFloat(taxPercentage);
    return taxPercentage.trim() !== '' && !isNaN(numValue) && numValue > 0;
  };

  const canSave = collectTax && isValidTaxRate();

  const getHelperText = () => {
    if (!collectTax) {
      return 'Tax is not currently applied to orders.';
    }
    if (!isEditing && savedTaxPercentage) {
      return 'Tax is calculated per order and shown to customers before payment.';
    }
    if (!taxPercentage || taxPercentage.trim() === '') {
      return 'Set a tax rate before enabling tax collection.';
    }
    const numValue = parseFloat(taxPercentage);
    if (isNaN(numValue) || numValue <= 0) {
      return 'Tax rate must be greater than 0%.';
    }
    return 'Tax is calculated per order and shown to customers before payment.';
  };

  const handleSave = async () => {
    try {
      await saveTaxSettings(true, taxPercentage);
      console.log('Tax settings saved:', { collectTax: true, taxPercentage });
      
      setSavedCollectTax(true);
      setSavedTaxPercentage(taxPercentage);
      setIsEditing(false);
      
      Alert.alert('Success', 'Tax settings have been saved.');
    } catch (error) {
      console.error('Error saving tax settings:', error);
      Alert.alert('Error', 'Failed to save tax settings. Please try again.');
    }
  };



  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Tax Settings',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
          headerRight: () => collectTax && isEditing ? (
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              activeOpacity={0.7}
            >
              <Text style={[taxHeaderStyles.saveText, !canSave && taxHeaderStyles.saveTextDisabled]}>Save</Text>
            </TouchableOpacity>
          ) : undefined,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <View style={styles.toggleSection}>
              <View style={styles.toggleRow}>
                <Text style={styles.toggleLabel}>Collect Tax</Text>
                <Switch
                  value={collectTax}
                  onValueChange={handleToggleChange}
                  trackColor={{ false: Colors.border, true: Colors.primary }}
                  thumbColor={Colors.white}
                  ios_backgroundColor={Colors.border}
                />
              </View>
              <Text style={styles.helperText}>
                {getHelperText()}
              </Text>
              
              {collectTax && !isEditing && savedTaxPercentage && (
                <View style={styles.savedValueSection}>
                  <View style={styles.savedValueRow}>
                    <View>
                      <Text style={styles.savedValueLabel}>Tax rate</Text>
                      <Text style={styles.savedValue}>{savedTaxPercentage}%</Text>
                    </View>
                    <TouchableOpacity onPress={() => setIsEditing(true)} activeOpacity={0.7}>
                      <Text style={styles.editButton}>Edit</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {collectTax && isEditing && (
                <View style={styles.percentageSection}>
                  <Text style={styles.fieldLabel}>Tax percentage</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      value={taxPercentage}
                      onChangeText={setTaxPercentage}
                      placeholder="e.g. 7.5"
                      placeholderTextColor={Colors.textSecondary}
                      keyboardType="decimal-pad"
                      maxLength={6}
                    />
                    <Text style={styles.percentSymbol}>%</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>


      </SafeAreaView>
    </View>
  );
}

const taxHeaderStyles = StyleSheet.create({
  saveText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  saveTextDisabled: {
    color: Colors.textMuted,
    opacity: 0.5,
  },
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  toggleSection: {
    paddingTop: 16,
  },
  toggleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 8,
    paddingHorizontal: 4,
  },
  percentageSection: {
    marginTop: 24,
  },
  fieldLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: Colors.text,
  },
  percentSymbol: {
    fontSize: 17,
    color: Colors.textSecondary,
    marginLeft: 8,
  },

  savedValueSection: {
    marginTop: 24,
  },
  savedValueRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  savedValueLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  savedValue: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '600' as const,
  },
  editButton: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '500' as const,
  },
});
