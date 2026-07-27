import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/colors';
import { Alert } from '@/utils/alert';

export interface ChatActionItem {
  id: string;
  label: string;
  destructive?: boolean;
  requireConfirm?: { title: string; message: string; confirmLabel?: string };
  onPress: () => void;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  actions: ChatActionItem[];
}

/**
 * Reusable bottom-sheet action menu for chat thread headers (ellipsis).
 * Destructive actions are visually separated and prompt confirmation.
 * Backend-ready: caller provides actions; this component is fully data-driven.
 */
export function ChatActionMenu({ visible, onClose, actions }: Props) {
  const standard = actions.filter((a) => !a.destructive);
  const destructive = actions.filter((a) => a.destructive);

  const handlePress = (item: ChatActionItem) => {
    onClose();
    if (item.requireConfirm) {
      setTimeout(() => {
        Alert.alert(
          item.requireConfirm!.title,
          item.requireConfirm!.message,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: item.requireConfirm!.confirmLabel || 'Confirm',
              style: 'destructive',
              onPress: item.onPress,
            },
          ]
        );
      }, 150);
    } else {
      setTimeout(item.onPress, 100);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheetWrap}>
              <SafeAreaView edges={['bottom']} style={styles.sheet}>
                <View style={styles.handle} />
                {standard.map((a, idx) => (
                  <Pressable
                    key={a.id}
                    onPress={() => handlePress(a)}
                    style={({ pressed }) => [
                      styles.row,
                      idx < standard.length - 1 && styles.rowBorder,
                      pressed && styles.rowPressed,
                    ]}
                    testID={`chat-action-${a.id}`}
                  >
                    <Text style={styles.rowText}>{a.label}</Text>
                  </Pressable>
                ))}
                {destructive.length > 0 && <View style={styles.destructiveSep} />}
                {destructive.map((a, idx) => (
                  <Pressable
                    key={a.id}
                    onPress={() => handlePress(a)}
                    style={({ pressed }) => [
                      styles.row,
                      idx < destructive.length - 1 && styles.rowBorder,
                      pressed && styles.rowPressed,
                    ]}
                    testID={`chat-action-${a.id}`}
                  >
                    <Text style={[styles.rowText, styles.rowTextDestructive]}>{a.label}</Text>
                  </Pressable>
                ))}
                <TouchableOpacity
                  onPress={onClose}
                  style={styles.cancelButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
              </SafeAreaView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

export function useChatActionMenu() {
  const [visible, setVisible] = useState<boolean>(false);
  return {
    visible,
    open: () => setVisible(true),
    close: () => setVisible(false),
  };
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end' as const,
  },
  sheetWrap: {
    width: '100%',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 6,
    paddingHorizontal: 8,
  },
  handle: {
    alignSelf: 'center' as const,
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderSoft,
    marginBottom: 8,
  },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.borderSoft,
  },
  rowPressed: {
    backgroundColor: Colors.surface,
  },
  rowText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.text,
  },
  rowTextDestructive: {
    color: Colors.error,
    fontWeight: '600' as const,
  },
  destructiveSep: {
    height: 8,
    backgroundColor: Colors.backgroundCanvas,
    marginHorizontal: -8,
    marginVertical: 4,
  },
  cancelButton: {
    marginTop: 8,
    marginBottom: 4,
    paddingVertical: 14,
    alignItems: 'center' as const,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginHorizontal: 4,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
});

export default ChatActionMenu;
