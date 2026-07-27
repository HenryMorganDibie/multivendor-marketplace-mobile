import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, Phone } from 'lucide-react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { ContactCardData } from '@/mocks/chatData';
import { Colors } from '@/constants/colors';

interface SecureContactModalProps {
  visible: boolean;
  onClose: () => void;
  contactData: ContactCardData | null;
}

export default function SecureContactModal({
  visible,
  onClose,
  contactData,
}: SecureContactModalProps) {
  useEffect(() => {
    if (visible && Platform.OS !== 'web') {
      console.log('[SECURE_CONTACT] Enabling screen capture prevention');
      ScreenCapture.preventScreenCaptureAsync('secure-contact-view');
      return () => {
        console.log('[SECURE_CONTACT] Disabling screen capture prevention');
        ScreenCapture.allowScreenCaptureAsync('secure-contact-view');
      };
    }
  }, [visible]);

  if (!contactData) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Contact Details</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
          >
            <X size={24} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.content}>
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              {'🔒 Secure View · Screenshots and screen recording are disabled'}
            </Text>
          </View>

          {contactData.name && (
            <View style={styles.section}>
              <Text style={styles.label}>Full Name</Text>
              <Text style={styles.value}>{contactData.name}</Text>
            </View>
          )}

          {contactData.phone && (
            <View style={styles.section}>
              <Text style={styles.label}>Phone Number</Text>
              <Text style={styles.value}>{contactData.phone}</Text>
              <TouchableOpacity
                style={styles.callButton}
                onPress={() => {
                  const phoneNumber = contactData.phone?.replace(/[^0-9+]/g, '') || '';
                  Linking.openURL(`tel:${phoneNumber}`);
                }}
                activeOpacity={0.7}
              >
                <Phone size={20} color="#fff" />
                <Text style={styles.callButtonText}>Call</Text>
              </TouchableOpacity>
            </View>
          )}

          {contactData.address && (
            <View style={styles.section}>
              <Text style={styles.label}>Address</Text>
              <Text style={styles.value}>{contactData.address}</Text>
            </View>
          )}

          {contactData.deliveryNote && (
            <View style={styles.section}>
              <Text style={styles.label}>Delivery / Pickup Note</Text>
              <Text style={[styles.value, styles.valueMultiline]}>
                {contactData.deliveryNote}
              </Text>
            </View>
          )}

          <View style={styles.privacyNotice}>
            <Text style={styles.privacyTitle}>
              {'⚠️ Privacy Notice'}
            </Text>
            <Text style={styles.privacyDescription}>
              {'• Contact details are order-scoped and time-bound\n• Access expires automatically when order is completed\n• Do not share or save this information externally'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#2C2C2E',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  warningBanner: {
    backgroundColor: 'rgba(255,140,66,0.15)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 24,
  },
  warningText: {
    fontSize: 13,
    color: Colors.primary,
    lineHeight: 18,
  },
  section: {
    marginBottom: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '500' as const,
    color: '#8E8E93',
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  value: {
    fontSize: 17,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  valueMultiline: {
    lineHeight: 24,
  },
  callButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 10,
    alignSelf: 'flex-start' as const,
    gap: 8,
  },
  callButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  privacyNotice: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  privacyTitle: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    marginBottom: 8,
  },
  privacyDescription: {
    fontSize: 13,
    color: '#8E8E93',
    lineHeight: 20,
  },
});
