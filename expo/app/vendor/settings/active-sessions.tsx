import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { Smartphone, Monitor } from 'lucide-react-native';
import LaektivaModal from '@/components/LaektivaModal';
import EditScreenHeader from '@/components/EditScreenHeader';
import { Colors } from '@/constants/colors';

interface Session {
  id: string;
  deviceName: string;
  platform: 'iOS' | 'Android' | 'Web';
  location: string;
  lastActive: string;
  isCurrent: boolean;
}

export default function ActiveSessionsScreen() {
  const router = useRouter();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showLogoutAllModal, setShowLogoutAllModal] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([
    {
      id: '1',
      deviceName: 'iPhone 14 Pro',
      platform: 'iOS',
      location: 'Toronto, Canada',
      lastActive: 'Active now',
      isCurrent: true,
    },
    {
      id: '2',
      deviceName: 'Chrome on Windows',
      platform: 'Web',
      location: 'Toronto, Canada',
      lastActive: '2 hours ago',
      isCurrent: false,
    },
    {
      id: '3',
      deviceName: 'Samsung Galaxy S23',
      platform: 'Android',
      location: 'Montreal, Canada',
      lastActive: '1 day ago',
      isCurrent: false,
    },
  ]);

  const handleLogoutSession = (sessionId: string) => {
    setSelectedSessionId(sessionId);
    setShowLogoutModal(true);
  };

  const confirmLogoutSession = () => {
    if (selectedSessionId) {
      setSessions(sessions.filter(s => s.id !== selectedSessionId));
      console.log('Logged out session:', selectedSessionId);
    }
    setShowLogoutModal(false);
    setSelectedSessionId(null);
  };

  const handleLogoutAllOthers = () => {
    setShowLogoutAllModal(true);
  };

  const confirmLogoutAllOthers = () => {
    setSessions(sessions.filter(s => s.isCurrent));
    console.log('Logged out all other devices');
    setShowLogoutAllModal(false);
  };

  const getDeviceIcon = (platform: string) => {
    if (platform === 'Web') {
      return <Monitor size={24} color="#0A84FF" />;
    }
    return <Smartphone size={24} color="#0A84FF" />;
  };

  const nonCurrentSessions = sessions.filter(s => !s.isCurrent);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Active Sessions" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.description}>
            These are devices currently signed into your account.
          </Text>

          {sessions.map((session) => (
            <View key={session.id} style={styles.sessionCard}>
              <View style={styles.sessionHeader}>
                {getDeviceIcon(session.platform)}
                <View style={styles.sessionInfo}>
                  <View style={styles.sessionTitleRow}>
                    <Text style={styles.deviceName}>{session.deviceName}</Text>
                    {session.isCurrent && (
                      <View style={styles.currentBadge}>
                        <Text style={styles.currentBadgeText}>Current device</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.platform}>{session.platform}</Text>
                  <Text style={styles.location}>{session.location}</Text>
                  <Text style={styles.lastActive}>{session.lastActive}</Text>
                </View>
              </View>

              {!session.isCurrent && (
                <TouchableOpacity
                  style={styles.logoutButton}
                  onPress={() => handleLogoutSession(session.id)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.logoutButtonText}>Log out</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}

          {nonCurrentSessions.length > 0 && (
            <TouchableOpacity
              style={styles.logoutAllButton}
              onPress={handleLogoutAllOthers}
              activeOpacity={0.7}
            >
              <Text style={styles.logoutAllButtonText}>Log out of all other devices</Text>
            </TouchableOpacity>
          )}

          {nonCurrentSessions.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Only this device is currently signed in.
              </Text>
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <LaektivaModal
        visible={showLogoutModal}
        title="Log out device?"
        message="This will sign you out of the selected device immediately."
        primaryButton={{
          label: 'Log out',
          onPress: confirmLogoutSession,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowLogoutModal(false),
        }}
      />

      <LaektivaModal
        visible={showLogoutAllModal}
        title="Log out of other devices?"
        message="This will sign you out of all other devices. Your current session will remain active."
        primaryButton={{
          label: 'Log out',
          onPress: confirmLogoutAllOthers,
        }}
        secondaryButton={{
          label: 'Cancel',
          onPress: () => setShowLogoutAllModal(false),
        }}
      />
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
  description: {
    fontSize: 15,
    color: '#999',
    lineHeight: 22,
    marginTop: 16,
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  sessionCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
  },
  sessionInfo: {
    flex: 1,
    marginLeft: 12,
  },
  sessionTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 4,
    flexWrap: 'wrap' as const,
  },
  deviceName: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginRight: 8,
  },
  currentBadge: {
    backgroundColor: '#34C759',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  currentBadgeText: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  platform: {
    fontSize: 15,
    color: '#999',
    marginBottom: 2,
  },
  location: {
    fontSize: 15,
    color: '#999',
    marginBottom: 2,
  },
  lastActive: {
    fontSize: 15,
    color: '#666',
  },
  logoutButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  logoutAllButton: {
    backgroundColor: '#FF3B30',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 24,
    marginBottom: 12,
  },
  logoutAllButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  emptyState: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center' as const,
    marginTop: 24,
  },
  emptyStateText: {
    fontSize: 15,
    color: '#999',
    textAlign: 'center' as const,
    lineHeight: 22,
  },
  bottomSpacer: {
    height: 40,
  },
});
