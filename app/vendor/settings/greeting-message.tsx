import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Switch, Modal, Pressable, Dimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.55;

export default function GreetingMessageScreen() {
  const [isEnabled, setIsEnabled] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [tempMessage, setTempMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const handleToggle = (value: boolean) => {
    setIsEnabled(value);
    console.log('Greeting message enabled:', value);
  };

  const openEditor = () => {
    setTempMessage(messageText);
    setHasChanges(false);
    setIsEditorOpen(true);
  };

  const handleCancel = () => {
    setIsEditorOpen(false);
  };

  const handleSave = () => {
    setMessageText(tempMessage);
    setIsEditorOpen(false);
    setHasChanges(false);
    console.log('Greeting message saved:', tempMessage);
  };

  const handleTextChange = (text: string) => {
    setTempMessage(text);
    setHasChanges(text !== messageText);
  };

  const getMessagePreview = () => {
    if (!messageText) return 'Not set';
    return messageText.length > 40 ? `${messageText.substring(0, 40)}...` : messageText;
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Greeting message',
          headerTitleAlign: 'center',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerShadowVisible: false,
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.toggleSection}>
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Send greeting message</Text>
              <Switch
                value={isEnabled}
                onValueChange={handleToggle}
                trackColor={{ false: Colors.border, true: Colors.primary }}
                thumbColor={Colors.white}
                ios_backgroundColor={Colors.border}
              />
            </View>
          </View>

          <View style={styles.helperSection}>
            <Text style={styles.helperText}>
              Automatically send a greeting when a customer starts a new chat. This message is informational only and does not confirm orders.
            </Text>
          </View>

          {isEnabled && (
            <View style={styles.messageSection}>
              <TouchableOpacity
                style={styles.messageRow}
                onPress={openEditor}
                activeOpacity={0.7}
              >
                <View style={styles.messageRowContent}>
                  <Text style={styles.messageLabel}>Message</Text>
                  <View style={styles.messageValueContainer}>
                    <Text style={styles.messageValue} numberOfLines={1}>
                      {getMessagePreview()}
                    </Text>
                    <ChevronRight size={20} color={Colors.textSecondary} />
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={isEditorOpen}
        animationType="slide"
        transparent
        onRequestClose={handleCancel}
      >
        <Pressable style={styles.modalBackdrop} onPress={handleCancel}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <Pressable onPress={(e) => e.stopPropagation()}>
              <View style={[styles.modalContainer, { height: MODAL_HEIGHT }]}>
                <View style={styles.modalHeader}>
                  {hasChanges ? (
                    <TouchableOpacity
                      onPress={handleCancel}
                      style={styles.modalHeaderButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.modalCancelText}>Cancel</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.modalHeaderButton} />
                  )}
                  <Text style={styles.modalTitle}>Message</Text>
                  {hasChanges ? (
                    <TouchableOpacity
                      onPress={handleSave}
                      style={styles.modalHeaderButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.modalSaveText}>Save</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.modalHeaderButton} />
                  )}
                </View>

                <ScrollView
                  style={styles.modalContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.editorContainer}>
                    <TextInput
                      style={styles.messageEditor}
                      placeholder="Type your greeting message..."
                      placeholderTextColor={Colors.textSecondary}
                      value={tempMessage}
                      onChangeText={handleTextChange}
                      maxLength={300}
                      multiline
                      textAlignVertical="top"
                    />
                    <Text style={styles.charCounter}>{tempMessage.length} / 300</Text>
                  </View>
                </ScrollView>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
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
  },
  toggleSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  toggleLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  helperSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  helperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  messageSection: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  messageRow: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  messageRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  messageLabel: {
    fontSize: 17,
    color: Colors.text,
    fontWeight: '400' as const,
  },
  messageValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    justifyContent: 'flex-end',
    marginLeft: 16,
  },
  messageValue: {
    fontSize: 17,
    color: Colors.textSecondary,
    textAlign: 'right',
    flexShrink: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: Colors.background,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.white,
  },
  modalHeaderButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    minWidth: 60,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    textAlign: 'center',
  },
  modalCancelText: {
    fontSize: 17,
    color: Colors.primary,
  },
  modalSaveText: {
    fontSize: 17,
    color: Colors.primary,
    fontWeight: '600' as const,
    textAlign: 'right',
  },
  modalSaveTextDisabled: {
    opacity: 0.5,
  },
  modalContent: {
    paddingHorizontal: 16,
  },
  editorContainer: {
    paddingTop: 16,
    paddingBottom: 20,
  },
  messageEditor: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    textAlignVertical: 'top',
    minHeight: 140,
    maxHeight: 140,
  },
  charCounter: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginTop: 8,
    textAlign: 'right',
  },
});
