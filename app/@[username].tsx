import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { formatUsername } from '@/utils/usernameValidation';
import { Colors } from '@/constants/colors';

export default function UsernameStorefrontRedirect() {
  const router = useRouter();
  const { username } = useLocalSearchParams<{ username: string }>();

  useEffect(() => {
    if (!username) {
      console.log('[@username] No username provided, redirecting to not found');
      router.replace('/+not-found' as any);
      return;
    }

    const formattedUsername = formatUsername(username);
    console.log('[@username] Looking up vendor with username:', formattedUsername);

    console.log('[@username] Redirecting to canonical store route:', formattedUsername);
    router.replace(`/store/${formattedUsername}` as any);
  }, [username, router]);

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.text} />
          <Text style={styles.loadingText}>Loading vendor...</Text>
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
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    gap: 16,
  },
  loadingText: {
    fontSize: 16,
    color: Colors.textMuted,
  },
});
