import React from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Globe } from 'lucide-react-native';

export default function ComingSoonScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const countryName = typeof params.countryName === 'string' ? params.countryName : 'your country';
  const launchTimeline = typeof params.launchTimeline === 'string' ? params.launchTimeline : undefined;

  const handleBack = () => {
    console.log('[COMING_SOON] Back to onboarding');
    router.replace('/onboarding' as any);
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.iconCircle}>
            <Globe size={48} color={Colors.textSecondary} strokeWidth={2} />
          </View>

          <Text style={styles.title}>the platform is coming soon</Text>
          
          <Text style={styles.body}>
            the platform is not yet available in {countryName}. We're working hard to bring our platform to more countries.
          </Text>

          {launchTimeline ? (
            <View style={styles.timelineBox}>
              <Text style={styles.timelineLabel}>Expected launch:</Text>
              <Text style={styles.timelineText}>{launchTimeline}</Text>
            </View>
          ) : null}

          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>What happens when we launch?</Text>
            <Text style={styles.infoItem}>• Full customer and vendor access</Text>
            <Text style={styles.infoItem}>• Local payment options</Text>
            <Text style={styles.infoItem}>• Verified vendors near you</Text>
            <Text style={styles.infoItem}>• Zero commission selling</Text>
          </View>

          <Text style={styles.notifyText}>
            We'll announce availability updates on our website and social media.
          </Text>

          <TouchableOpacity
            style={styles.button}
            onPress={handleBack}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.charcoal,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 16,
  },
  body: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: 24,
  },
  timelineBox: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.charcoal,
    alignItems: 'center' as const,
  },
  timelineLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  timelineText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  infoBox: {
    width: '100%',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.charcoal,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  infoItem: {
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: 4,
  },
  notifyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    marginBottom: 32,
  },
  button: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    alignItems: 'center' as const,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.background,
  },
});
