import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { AlertCircle, Upload, Clock, CheckCircle } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';

export default function CountryChangeGuideScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Changing Your Country" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <AlertCircle size={24} color="#FF9500" />
            <Text style={styles.infoText}>
              Country changes require approval and may temporarily affect your store visibility.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>HOW TO REQUEST A COUNTRY CHANGE</Text>
            <View style={styles.glassCard}>
              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>1</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Navigate to Business Location</Text>
                  <Text style={styles.stepDescription}>
                    Go to Settings → Account → Business Location
                  </Text>
                </View>
              </View>

              <View style={styles.stepDivider} />

              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>2</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Request Country Change</Text>
                  <Text style={styles.stepDescription}>
                    Tap &ldquo;Request Country Change&rdquo; and select your new country
                  </Text>
                </View>
              </View>

              <View style={styles.stepDivider} />

              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>3</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Upload Proof Documents</Text>
                  <Text style={styles.stepDescription}>
                    Provide required documentation to verify your business location
                  </Text>
                </View>
              </View>

              <View style={styles.stepDivider} />

              <View style={styles.step}>
                <View style={styles.stepNumber}>
                  <Text style={styles.stepNumberText}>4</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>Submit for Review</Text>
                  <Text style={styles.stepDescription}>
                    Submit your request and wait for approval
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>IMPORTANT NOTES</Text>
            <View style={styles.glassCard}>
              <View style={styles.noteRow}>
                <View style={styles.iconContainer}>
                  <AlertCircle size={20} color="#FF9500" />
                </View>
                <View style={styles.noteContent}>
                  <Text style={styles.noteTitle}>Store Visibility</Text>
                  <Text style={styles.noteDescription}>
                    Your store will be temporarily hidden during the review process
                  </Text>
                </View>
              </View>

              <View style={styles.noteDivider} />

              <View style={styles.noteRow}>
                <View style={styles.iconContainer}>
                  <CheckCircle size={20} color="#0A84FF" />
                </View>
                <View style={styles.noteContent}>
                  <Text style={styles.noteTitle}>Price Review Required</Text>
                  <Text style={styles.noteDescription}>
                    You must review and update all prices after approval
                  </Text>
                </View>
              </View>

              <View style={styles.noteDivider} />

              <View style={styles.noteRow}>
                <View style={styles.iconContainer}>
                  <Upload size={20} color="#8E8E93" />
                </View>
                <View style={styles.noteContent}>
                  <Text style={styles.noteTitle}>No Automatic Conversion</Text>
                  <Text style={styles.noteDescription}>
                    Prices are not automatically converted to the new currency
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>REVIEW TIMELINE</Text>
            <View style={styles.timelineCard}>
              <Clock size={32} color="#0A84FF" />
              <Text style={styles.timelineTitle}>1-3 Business Days</Text>
              <Text style={styles.timelineDescription}>
                Most country change requests are reviewed within this timeframe
              </Text>
            </View>
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
  infoCard: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: 'rgba(255, 149, 0, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#FF9500',
    lineHeight: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
  },
  step: {
    flexDirection: 'row' as const,
    gap: 16,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0A84FF',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 15,
    color: '#8E8E93',
    lineHeight: 22,
  },
  stepDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 16,
    marginLeft: 48,
  },
  noteRow: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#2C2C2E',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  noteContent: {
    flex: 1,
  },
  noteTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  noteDescription: {
    fontSize: 14,
    color: '#8E8E93',
    lineHeight: 20,
  },
  noteDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginVertical: 16,
  },
  timelineCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center' as const,
  },
  timelineTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  timelineDescription: {
    fontSize: 15,
    color: '#8E8E93',
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 40,
  },
});
