import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Users, Store } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

export default function InviteToLaektivaScreen() {
  const router = useRouter();
  
  const handleInviteCustomers = () => {
    router.push('/vendor/settings/invite-customers' as any);
  };

  const handleInviteVendors = () => {
    router.push('/vendor/settings/invite-vendors' as any);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Invite to Platform" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.inviteCard}
            onPress={handleInviteCustomers}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Users size={32} color="#007AFF" strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>Invite Customers</Text>
            <Text style={styles.cardDescription}>
              Share with potential customers
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.inviteCard}
            onPress={handleInviteVendors}
            activeOpacity={0.7}
          >
            <View style={styles.iconContainer}>
              <Store size={32} color="#007AFF" strokeWidth={2} />
            </View>
            <Text style={styles.cardTitle}>Invite Vendors</Text>
            <Text style={styles.cardDescription}>
              Share with other vendors
            </Text>
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
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 16,
  },
  inviteCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(0, 122, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 6,
  },
  cardDescription: {
    fontSize: 15,
    color: '#666',
    textAlign: 'center',
  },
});
