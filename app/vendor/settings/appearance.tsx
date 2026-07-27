import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Check } from 'lucide-react-native';
import { useTheme } from '@/contexts/ThemeContext';

type Theme = 'light' | 'dark';

export default function AppearanceScreen() {
  const { theme, updateTheme } = useTheme();

  const themes: { value: Theme; label: string; description: string }[] = [
    { value: 'light', label: 'Light', description: 'Always use light mode' },
    { value: 'dark', label: 'Dark', description: 'Always use dark mode' },
  ];

  const handleThemeSelect = (newTheme: Theme) => {
    updateTheme(newTheme);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Appearance',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: '#0A0A0A' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionTitle}>THEME</Text>
          <View style={styles.card}>
            {themes.map((themeOption, index) => (
              <React.Fragment key={themeOption.value}>
                <TouchableOpacity
                  style={styles.themeRow}
                  onPress={() => handleThemeSelect(themeOption.value)}
                  activeOpacity={0.7}
                >
                  <View style={styles.themeInfo}>
                    <Text style={styles.themeLabel}>{themeOption.label}</Text>
                    <Text style={styles.themeDescription}>{themeOption.description}</Text>
                  </View>
                  {theme === themeOption.value && (
                    <Check size={24} color="#0A84FF" strokeWidth={3} />
                  )}
                </TouchableOpacity>
                {index < themes.length - 1 && <View style={styles.divider} />}
              </React.Fragment>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    letterSpacing: 0.5,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  themeRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  themeInfo: {
    flex: 1,
    marginRight: 12,
  },
  themeLabel: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '400' as const,
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: 15,
    color: '#666',
    fontWeight: '400' as const,
  },
  divider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginLeft: 16,
  },
  bottomSpacer: {
    height: 40,
  },
});
