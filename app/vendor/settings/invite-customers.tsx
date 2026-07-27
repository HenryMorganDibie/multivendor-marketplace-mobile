import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Alert, Modal, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Share2, QrCode, X } from 'lucide-react-native';
import { useVendorPlan } from '@/contexts/VendorPlanContext';
import * as Clipboard from 'expo-clipboard';
import { safeShare } from '@/utils/share';
import { Colors } from '@/constants/colors';

export default function ShareYourStoreScreen() {
  const { username, systemGeneratedUsername } = useVendorPlan();
  const [showQR, setShowQR] = useState(false);
  const [showPromiseModal, setShowPromiseModal] = useState(false);
  const pendingAction = useRef<'share' | 'copy' | 'qr' | null>(null);
  const hasAcknowledgedPromise = useRef(false);
  
  const displayUsername = username || systemGeneratedUsername || 'loading';
  const storeLink = `the platform://@${displayUsername}`;
  const webLink = `https://the platform.com/@${displayUsername}`;

  const executeShare = async () => {
    await safeShare({
      message: `Order from my store on the platform! Install the app and visit ${webLink}\n\nAvailable on iOS and Android.`,
      title: 'Visit my store on the platform',
    });
  };

  const executeCopyLink = async () => {
    await Clipboard.setStringAsync(webLink);
    Alert.alert('Link Copied', 'Store link copied to clipboard');
  };

  const executeQRCode = () => {
    setShowQR(true);
    Alert.alert(
      'QR Code',
      'Customers can scan this QR code to visit your store. They must install the the platform app first.',
      [{ text: 'OK', onPress: () => setShowQR(false) }]
    );
  };

  const handleShare = () => {
    if (!hasAcknowledgedPromise.current) {
      pendingAction.current = 'share';
      setShowPromiseModal(true);
    } else {
      executeShare();
    }
  };

  const handleCopyLink = () => {
    if (!hasAcknowledgedPromise.current) {
      pendingAction.current = 'copy';
      setShowPromiseModal(true);
    } else {
      executeCopyLink();
    }
  };

  const handleQRCode = () => {
    if (!hasAcknowledgedPromise.current) {
      pendingAction.current = 'qr';
      setShowPromiseModal(true);
    } else {
      executeQRCode();
    }
  };

  const handlePromiseContinue = () => {
    hasAcknowledgedPromise.current = true;
    setShowPromiseModal(false);
    
    const action = pendingAction.current;
    pendingAction.current = null;
    
    if (action === 'share') {
      executeShare();
    } else if (action === 'copy') {
      executeCopyLink();
    } else if (action === 'qr') {
      executeQRCode();
    }
  };

  const handlePromiseCancel = () => {
    setShowPromiseModal(false);
    pendingAction.current = null;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Invite Customers',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>SC</Text>
            </View>
          </View>

          <Text style={styles.title}>Invite Customers</Text>
          <Text style={styles.username}>@{displayUsername}</Text>
          
          <View style={styles.linkCard}>
            <Text style={styles.linkLabel}>Your store link:</Text>
            <Text style={styles.linkText} numberOfLines={1}>{webLink}</Text>
          </View>

          <Text style={styles.description}>
            Share your store link with customers. They must install the app and register to order from you.
          </Text>

          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShare}
            activeOpacity={0.8}
          >
            <Share2 size={20} color={Colors.text} />
            <Text style={styles.shareButtonText}>Share Store Link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleCopyLink}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>Copy Link</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.qrButton}
            onPress={handleQRCode}
            activeOpacity={0.8}
          >
            <QrCode size={20} color={Colors.primary} />
            <Text style={styles.qrButtonText}>Show QR Code</Text>
          </TouchableOpacity>
        </View>

        <Modal
          visible={showPromiseModal}
          transparent
          animationType="fade"
          onRequestClose={handlePromiseCancel}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
              <ScrollView
                style={styles.modalScroll}
                contentContainerStyle={styles.modalContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.modalTitle}>🛡️ Your customers stay yours</Text>
                
                <Text style={styles.modalBody}>
                  When customers open your the platform link:
                </Text>
                
                <View style={styles.bulletList}>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>They see only your business</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>No competitor listings</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>No ads</Text>
                  </View>
                  <View style={styles.bulletItem}>
                    <Text style={styles.bullet}>•</Text>
                    <Text style={styles.bulletText}>No marketplace distractions</Text>
                  </View>
                </View>
                
                <Text style={styles.modalBody}>
                  Your storefront opens directly and ordering starts immediately.
                </Text>
                
                <Text style={styles.modalFooter}>Powered by the platform</Text>
              </ScrollView>
              
              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={styles.modalPrimaryButton}
                  onPress={handlePromiseContinue}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalPrimaryButtonText}>Continue to share</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.modalSecondaryButton}
                  onPress={handlePromiseCancel}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalSecondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
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
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 24,
  },
  logoPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  title: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  username: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.primary,
    textAlign: 'center',
    marginBottom: 24,
  },
  linkCard: {
    backgroundColor: Colors.surface,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    width: '100%',
    marginBottom: 16,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  linkText: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  shareButton: {
    flexDirection: 'row' as const,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 12,
  },
  shareButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.charcoal,
    minHeight: 52,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.charcoal,
  },
  qrButton: {
    flexDirection: 'row' as const,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  qrButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  modalScroll: {
    maxHeight: 500,
  },
  modalContent: {
    padding: 24,
    paddingBottom: 8,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalBody: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: 16,
  },
  bulletList: {
    marginBottom: 16,
    paddingLeft: 8,
  },
  bulletItem: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  bullet: {
    fontSize: 16,
    color: Colors.text,
    marginRight: 12,
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    lineHeight: 24,
  },
  modalFooter: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  modalButtons: {
    padding: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalPrimaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalPrimaryButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.white,
  },
  modalSecondaryButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSecondaryButtonText: {
    fontSize: 17,
    fontWeight: '400' as const,
    color: Colors.textSecondary,
  },
});
