import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Platform,
  Dimensions,
} from 'react-native';
import { Colors } from '@/constants/colors';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LaektivaModalProps {
  visible: boolean;
  title: string;
  message: string;
  customContent?: React.ReactNode;
  primaryButton: {
    label: string;
    onPress: () => void;
  };
  secondaryButton?: {
    label: string;
    onPress: () => void;
    variant?: 'outlined' | 'text';
  };
  tertiaryButton?: {
    label: string;
    onPress: () => void;
  };
  onRequestClose?: () => void;
  destructive?: boolean;
}

export default function LaektivaModal({
  visible,
  title,
  message,
  customContent,
  primaryButton,
  secondaryButton,
  tertiaryButton,
  onRequestClose,
  destructive = false,
}: LaektivaModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onRequestClose || secondaryButton?.onPress}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {message ? <Text style={styles.message}>{message}</Text> : null}
          {customContent ? <>{customContent}</> : null}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, destructive && styles.destructiveButton]}
              onPress={primaryButton.onPress}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>
                {primaryButton.label}
              </Text>
            </TouchableOpacity>
            {secondaryButton && (
              <TouchableOpacity
                style={secondaryButton.variant === 'text' ? styles.textButton : styles.secondaryButton}
                onPress={secondaryButton.onPress}
                activeOpacity={0.8}
              >
                <Text style={secondaryButton.variant === 'text' ? styles.textButtonText : styles.secondaryButtonText}>
                  {secondaryButton.label}
                </Text>
              </TouchableOpacity>
            )}
            {tertiaryButton && (
              <TouchableOpacity
                style={styles.textButton}
                onPress={tertiaryButton.onPress}
                activeOpacity={0.8}
              >
                <Text style={styles.textButtonText}>{tertiaryButton.label}</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    maxHeight: SCREEN_HEIGHT * 0.5,
    ...Platform.select({
      ios: {
        shadowColor: Colors.text,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 21,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'column' as const,
    gap: 10,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
    textAlign: 'center' as const,
  },
  secondaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center' as const,
  },
  destructiveButton: {
    backgroundColor: Colors.destructive,
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  textButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
});
