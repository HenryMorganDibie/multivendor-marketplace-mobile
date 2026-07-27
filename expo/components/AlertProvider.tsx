import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';
import { registerAlertListener, AlertConfig, AlertButton } from '@/utils/alert';

export default function AlertProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AlertConfig | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      registerAlertListener((cfg) => {
        setConfig(cfg);
      });
    }
  }, []);

  const dismiss = useCallback(() => setConfig(null), []);

  const handlePress = useCallback(
    (btn: AlertButton) => {
      dismiss();
      btn.onPress?.();
    },
    [dismiss]
  );

  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const buttons: AlertButton[] = config?.buttons?.length
    ? config.buttons
    : [{ text: 'OK', style: 'default' }];

  const primaryBtn = buttons.find((b) => b.style !== 'cancel') ?? buttons[0];
  const cancelBtn = buttons.find((b) => b.style === 'cancel');
  const isDestructive = primaryBtn?.style === 'destructive';

  return (
    <>
      {children}
      <Modal
        visible={!!config}
        animationType="fade"
        transparent
        onRequestClose={dismiss}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            {config?.title ? (
              <Text style={styles.title}>{config.title}</Text>
            ) : null}
            {config?.message ? (
              <Text style={styles.message}>{config.message}</Text>
            ) : null}
            <View style={styles.buttonContainer}>
              {cancelBtn && (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={() => handlePress(cancelBtn)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.secondaryButtonText}>
                    {cancelBtn.text ?? 'Cancel'}
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  isDestructive && styles.destructiveButton,
                ]}
                onPress={() => handlePress(primaryBtn)}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonText}>
                  {primaryBtn?.text ?? 'OK'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 360,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#1A1A1A',
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    textAlign: 'center' as const,
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'column' as const,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 48,
  },
  primaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  destructiveButton: {
    backgroundColor: '#FF3B30',
  },
  secondaryButton: {
    backgroundColor: '#F5F5F5',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    minHeight: 48,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#1A1A1A',
  },
});
