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

interface DiscardChangesModalProps {
  visible: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  title?: string;
  message?: string;
}

export default function DiscardChangesModal({
  visible,
  onKeepEditing,
  onDiscard,
  title = 'Discard changes?',
  message = 'You have unsaved changes. If you leave now, your changes will be lost.',
}: DiscardChangesModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onKeepEditing}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.keepEditingButton}
              onPress={onKeepEditing}
              activeOpacity={0.8}
            >
              <Text style={styles.keepEditingText}>Keep Editing</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.discardButton}
              onPress={onDiscard}
              activeOpacity={0.8}
            >
              <Text style={styles.discardText}>Discard</Text>
            </TouchableOpacity>
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
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 21,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  actions: {
    gap: 10,
  },
  keepEditingButton: {
    backgroundColor: Colors.white,
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  keepEditingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  discardButton: {
    backgroundColor: Colors.destructive,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  discardText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
