import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AlertTriangle } from 'lucide-react-native';
import { useAuth } from '@/contexts/AuthContext';
import { Colors } from '@/constants/colors';

export default function RoleErrorScreen() {
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    console.log('[ROLE ERROR] User logging out due to invalid role');
    await logout();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <View style={styles.iconContainer}>
            <AlertTriangle size={64} color={Colors.error} strokeWidth={1.5} />
          </View>
          
          <Text style={styles.title}>Account Error</Text>
          
          <Text style={styles.message}>
            Your account has an invalid role configuration. This is a critical error that prevents access to the app.
          </Text>

          {user && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugLabel}>Debug Information:</Text>
              <Text style={styles.debugText}>User ID: {user.id}</Text>
              <Text style={styles.debugText}>Role: {user.role || '(missing)'}</Text>
              <Text style={styles.debugText}>Status: {user.status}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutButtonText}>Log Out</Text>
          </TouchableOpacity>

          <Text style={styles.footer}>
            Please contact support if this problem persists.
          </Text>
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
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: 16,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 24,
    marginBottom: 32,
  },
  debugInfo: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  debugLabel: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  debugText: {
    fontSize: 14,
    color: Colors.text,
    fontFamily: 'Courier' as const,
    marginBottom: 4,
  },
  logoutButton: {
    backgroundColor: Colors.error,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  logoutButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
    textAlign: 'center' as const,
  },
  footer: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
});
