import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';

export default function AllowExternalOrdersScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Allow External Orders" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Purpose</Text>
            <Text style={styles.infoText}>
              Allow vendors to manually record orders received outside the platform for internal tracking purposes.
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Rules</Text>
            <Text style={styles.infoBullet}>• External orders are labeled &quot;External Order&quot;</Text>
            <Text style={styles.infoBullet}>• External orders do NOT trigger order questionnaires</Text>
            <Text style={styles.infoBullet}>• External orders do NOT support promo codes</Text>
            <Text style={styles.infoBullet}>• External orders do NOT allow payment requests</Text>
            <Text style={styles.infoBullet}>• External orders do NOT affect customer-facing metrics</Text>
            <Text style={styles.infoBullet}>• External orders are for internal tracking only</Text>
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
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 20,
    marginTop: 16,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
  },
  infoBullet: {
    fontSize: 15,
    color: '#666',
    lineHeight: 22,
    marginBottom: 6,
  },
  bottomSpacer: {
    height: 40,
  },
});
