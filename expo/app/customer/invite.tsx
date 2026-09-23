import React, { useState } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Copy, Share2 } from 'lucide-react-native';
import * as Clipboard from 'expo-clipboard';
import { safeShare } from '@/utils/share';

export default function CustomerInviteScreen() {
  const [showConfirmation, setShowConfirmation] = useState(false);

  const inviteLink = Platform.select({
    ios: 'https://apps.apple.com/app/platform',
    android: 'https://play.google.com/store/apps/details?id=com.platform.app',
    default: 'https://example.com/download',
  });

  const handleCopyLink = async () => {
    try {
      await Clipboard.setStringAsync(inviteLink);
      console.log('[INVITE] Link copied to clipboard');
      setShowConfirmation(true);
    } catch (error) {
      console.error('[INVITE] Failed to copy link:', error);
    }
  };

  const handleShare = async () => {
    try {
      const message = `Know vendors who should be on Platform? Invite them to join so customers in your area can discover and order from them.\n\n${inviteLink}`;

      await safeShare({
        message,
        title: 'Invite vendors to Platform',
      });
      console.log('[INVITE] Share sheet opened');
    } catch (error) {
      console.error('[INVITE] Failed to share:', error);
    }
  };

  const handleConfirmationClose = () => {
    setShowConfirmation(false);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Invite to Platform',
          headerBackTitle: '',
          headerStyle: {
            backgroundColor: Colors.background,
          },
          headerTintColor: Colors.charcoal,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <Text style={styles.header}>Invite vendors to Platform</Text>
          
          <Text style={styles.description}>
            Know vendors who should be on Platform? Invite them to join so customers in your area can discover and order from them.
          </Text>

          <View style={styles.linkSection}>
            <Text style={styles.linkLabel}>Your invite link</Text>
            <View style={styles.linkInputContainer}>
              <TextInput
                style={styles.linkInput}
                value={inviteLink}
                editable={false}
                selectTextOnFocus
                multiline
              />
            </View>
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCopyLink}
            activeOpacity={0.8}
          >
            <Copy size={18} color={Colors.text} strokeWidth={2} />
            <Text style={styles.primaryButtonText}>Copy Invite Link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleShare}
            activeOpacity={0.7}
          >
            <Share2 size={18} color={Colors.primary} strokeWidth={2} />
            <Text style={styles.secondaryButtonText}>Share</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <Modal
        visible={showConfirmation}
        transparent
        animationType="fade"
        onRequestClose={handleConfirmationClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Copied to clipboard</Text>
            <Text style={styles.modalMessage}>
              You can now paste and share your invite.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleConfirmationClose}
              activeOpacity={0.8}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: 32,
  },
  linkSection: {
    marginBottom: 24,
  },
  linkLabel: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  linkInputContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  linkInput: {
    fontSize: 14,
    color: Colors.text,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 48,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
    marginBottom: 12,
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.primary,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    gap: 10,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center' as const,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  modalMessage: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center' as const,
  },
  modalButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
