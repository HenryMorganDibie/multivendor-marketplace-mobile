import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Platform,
} from 'react-native';
import { Colors } from '@/constants/colors';

interface DiscardChangesModalProps {
  visible: boolean;
  onKeepEditing: () => void;
  onDiscard: () => void;
  title?: string;
  message?: string;
  keepEditingLabel?: string;
  discardLabel?: string;
}

export default function DiscardChangesModal({
  visible,
  onKeepEditing,
  onDiscard,
  title = 'Discard changes?',
  message = 'You have unsaved changes. If you leave now, your changes will be lost.',
  keepEditingLabel = 'Keep Editing',
  discardLabel = 'Discard',
}: DiscardChangesModalProps) {
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 200,
          friction: 18,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.92);
      opacityAnim.setValue(0);
    }
  }, [visible, scaleAnim, opacityAnim]);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onKeepEditing}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              opacity: opacityAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.keepEditingButton}
              onPress={onKeepEditing}
              activeOpacity={0.75}
            >
              <Text style={styles.keepEditingText}>{keepEditingLabel}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.discardButton}
              onPress={onDiscard}
              activeOpacity={0.75}
            >
              <Text style={styles.discardText}>{discardLabel}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
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
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.15,
        shadowRadius: 24,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    textAlign: 'center' as const,
    marginBottom: 24,
  },
  actions: {
    gap: 10,
  },
  keepEditingButton: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  keepEditingText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  discardButton: {
    backgroundColor: Colors.destructive,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  discardText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
