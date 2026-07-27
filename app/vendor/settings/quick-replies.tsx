import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Animated, PanResponder, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/utils/alert';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Plus } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '@/constants/colors';

interface QuickReply {
  id: string;
  shortcut: string;
  message: string;
}

export default function QuickRepliesScreen() {
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [shortcutInput, setShortcutInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);

  const MAX_REPLIES = 20;

  const loadQuickReplies = async () => {
    try {
      const stored = await AsyncStorage.getItem('quickReplies');
      if (stored) {
        setQuickReplies(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load quick replies:', error);
    }
  };

  const saveQuickReplies = useCallback(async () => {
    try {
      await AsyncStorage.setItem('quickReplies', JSON.stringify(quickReplies));
    } catch (error) {
      console.error('Failed to save quick replies:', error);
    }
  }, [quickReplies]);

  useEffect(() => {
    void loadQuickReplies();
  }, []);

  useEffect(() => {
    if (quickReplies.length > 0) {
      void saveQuickReplies();
    }
  }, [quickReplies, saveQuickReplies]);

  const handleAddNew = () => {
    if (quickReplies.length >= MAX_REPLIES) {
      return;
    }
    setEditingReply(null);
    setShortcutInput('');
    setMessageInput('');
    setShowModal(true);
  };

  const handleEdit = (reply: QuickReply) => {
    setEditingReply(reply);
    setShortcutInput(reply.shortcut);
    setMessageInput(reply.message);
    setShowModal(true);
  };

  const handleSave = () => {
    const trimmedShortcut = shortcutInput.trim();
    const trimmedMessage = messageInput.trim();

    if (!trimmedShortcut) {
      Alert.alert('Error', 'Shortcut is required.');
      return;
    }

    if (trimmedShortcut.includes(' ')) {
      Alert.alert('Error', 'Shortcut must be a single word with no spaces.');
      return;
    }

    if (trimmedShortcut.length > 25) {
      Alert.alert('Error', 'Shortcut must be 25 characters or less.');
      return;
    }

    if (!trimmedMessage) {
      Alert.alert('Error', 'Message is required.');
      return;
    }

    if (trimmedMessage.length > 300) {
      Alert.alert('Error', 'Message must be 300 characters or less.');
      return;
    }

    const isDuplicate = quickReplies.some(
      (r) => r.shortcut.toLowerCase() === trimmedShortcut.toLowerCase() && r.id !== editingReply?.id
    );

    if (isDuplicate) {
      Alert.alert('Error', 'A quick reply with this shortcut already exists.');
      return;
    }

    if (editingReply) {
      setQuickReplies(quickReplies.map(r => 
        r.id === editingReply.id 
          ? { ...r, shortcut: trimmedShortcut, message: trimmedMessage }
          : r
      ));
    } else {
      const newReply: QuickReply = {
        id: Date.now().toString(),
        shortcut: trimmedShortcut,
        message: trimmedMessage,
      };
      setQuickReplies([...quickReplies, newReply]);
    }

    setShowModal(false);
    setEditingReply(null);
    setShortcutInput('');
    setMessageInput('');
  };

  const handleDelete = (id: string) => {
    setQuickReplies(quickReplies.filter(r => r.id !== id));
  };

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newReplies = [...quickReplies];
    const [moved] = newReplies.splice(fromIndex, 1);
    newReplies.splice(toIndex, 0, moved);
    setQuickReplies(newReplies);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Quick Replies',
          headerRight: () => (
            <TouchableOpacity
              onPress={handleAddNew}
              disabled={quickReplies.length >= MAX_REPLIES}
              activeOpacity={0.7}
            >
              <Plus 
                size={24} 
                color={quickReplies.length >= MAX_REPLIES ? Colors.textSecondary : Colors.primary} 
              />
            </TouchableOpacity>
          ),
        }}
      />
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => setOpenSwipeId(null)}
        >
          {quickReplies.length >= MAX_REPLIES && (
            <View style={styles.limitMessage}>
              <Text style={styles.limitText}>You&apos;ve reached the maximum number of quick replies.</Text>
            </View>
          )}

          {quickReplies.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No quick replies yet</Text>
              <Text style={styles.emptyStateSubtext}>Tap + to create your first quick reply</Text>
            </View>
          ) : (
            <View style={styles.listContainer}>
              {quickReplies.map((reply, index) => (
                <QuickReplyRow
                  key={reply.id}
                  reply={reply}
                  index={index}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onReorder={handleReorder}
                  totalCount={quickReplies.length}
                  openSwipeId={openSwipeId}
                  setOpenSwipeId={setOpenSwipeId}
                />
              ))}
            </View>
          )}

          <View style={styles.bottomSpacer} />
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowModal(false);
          setEditingReply(null);
          setShortcutInput('');
          setMessageInput('');
        }}
      >
        <View style={styles.modalSheetOverlay}>
          <KeyboardAvoidingView
            style={styles.modalSheetContainer}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <View style={styles.modalSheetHandle} />
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  setShowModal(false);
                  setEditingReply(null);
                  setShortcutInput('');
                  setMessageInput('');
                }}
                activeOpacity={0.7}
                style={styles.cancelButton}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              
              <Text style={styles.modalTitle}>
                {editingReply ? 'Edit quick reply' : 'New quick reply'}
              </Text>
              
              <TouchableOpacity
                onPress={handleSave}
                activeOpacity={0.7}
                style={styles.saveButton}
                disabled={!shortcutInput.trim() || !messageInput.trim()}
              >
                <Text style={[
                  styles.saveButtonText,
                  (!shortcutInput.trim() || !messageInput.trim()) && styles.saveButtonTextDisabled
                ]}>
                  Save
                </Text>
              </TouchableOpacity>
            </View>

            <ScrollView 
              style={styles.modalContent} 
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.modalContentContainer}
            >
              <View style={styles.formContainer}>
                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Shortcut</Text>
                  <TextInput
                    style={styles.fieldInput}
                    placeholder="e.g. welcome"
                    placeholderTextColor={Colors.textSecondary}
                    value={shortcutInput}
                    onChangeText={(text) => {
                      const noSpaces = text.replace(/\s/g, '').toLowerCase();
                      if (noSpaces.length <= 25) {
                        setShortcutInput(noSpaces);
                      }
                    }}
                    maxLength={25}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="off"
                  />
                </View>

                <View style={styles.fieldContainer}>
                  <Text style={styles.fieldLabel}>Message</Text>
                  <TextInput
                    style={[styles.fieldInput, styles.messageFieldInput]}
                    placeholder="Type your message..."
                    placeholderTextColor={Colors.textSecondary}
                    value={messageInput}
                    onChangeText={(text) => {
                      if (text.length <= 300) {
                        setMessageInput(text);
                      }
                    }}
                    maxLength={300}
                    multiline
                    textAlignVertical="top"
                  />
                </View>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

interface QuickReplyRowProps {
  reply: QuickReply;
  index: number;
  onEdit: (reply: QuickReply) => void;
  onDelete: (id: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  totalCount: number;
  openSwipeId: string | null;
  setOpenSwipeId: (id: string | null) => void;
}

function QuickReplyRow({ reply, onEdit, onDelete, openSwipeId, setOpenSwipeId }: QuickReplyRowProps) {
  const [panX] = useState(new Animated.Value(0));
  const isSwiped = openSwipeId === reply.id;

  const SWIPE_THRESHOLD = 40;
  const DELETE_WIDTH = 80;

  useEffect(() => {
    if (openSwipeId !== reply.id && openSwipeId !== null) {
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 12,
      }).start();
    }
  }, [openSwipeId, reply.id, panX]);

  const panResponder = PanResponder.create({
    onMoveShouldSetPanResponder: (_, gestureState) => {
      return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
    },
    onPanResponderMove: (_, gestureState) => {
      if (gestureState.dx < 0) {
        panX.setValue(Math.max(gestureState.dx, -DELETE_WIDTH));
      } else if (isSwiped && gestureState.dx > 0) {
        panX.setValue(Math.min(-DELETE_WIDTH + gestureState.dx, 0));
      }
    },
    onPanResponderRelease: (_, gestureState) => {
      if (gestureState.dx < -SWIPE_THRESHOLD && !isSwiped) {
        setOpenSwipeId(reply.id);
        Animated.spring(panX, {
          toValue: -DELETE_WIDTH,
          useNativeDriver: true,
          tension: 65,
          friction: 12,
        }).start();
      } else if (gestureState.dx > SWIPE_THRESHOLD && isSwiped) {
        setOpenSwipeId(null);
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 12,
        }).start();
      } else if (isSwiped) {
        Animated.spring(panX, {
          toValue: -DELETE_WIDTH,
          useNativeDriver: true,
          tension: 65,
          friction: 12,
        }).start();
      } else {
        Animated.spring(panX, {
          toValue: 0,
          useNativeDriver: true,
          tension: 65,
          friction: 12,
        }).start();
      }
    },
  });

  const handleDelete = () => {
    Animated.timing(panX, {
      toValue: -400,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      setOpenSwipeId(null);
      onDelete(reply.id);
    });
  };

  const handleTap = () => {
    if (!isSwiped) {
      onEdit(reply);
    } else {
      setOpenSwipeId(null);
      Animated.spring(panX, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 12,
      }).start();
    }
  };

  return (
    <View style={styles.rowContainer}>
      <View style={styles.deleteButtonContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={handleDelete}
          activeOpacity={0.7}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
      
      <Animated.View
        style={[
          styles.rowContent,
          {
            transform: [{ translateX: panX }],
          },
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={styles.row}
          onPress={handleTap}
          activeOpacity={0.7}
        >
          <View style={styles.textContent}>
            <Text style={styles.shortcut}>{reply.shortcut}</Text>
            <Text style={styles.messagePreview} numberOfLines={2}>
              {reply.message}
            </Text>
          </View>
        </TouchableOpacity>
      </Animated.View>
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
  limitMessage: {
    backgroundColor: 'rgba(255, 193, 7, 0.15)',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    marginHorizontal: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 193, 7, 0.3)',
  },
  limitText: {
    fontSize: 15,
    color: Colors.primary,
    lineHeight: 22,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    minHeight: 300,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
  },
  listContainer: {
    marginTop: 0,
  },
  rowContainer: {
    height: 80,
    position: 'relative' as const,
    overflow: 'hidden' as const,
  },
  deleteButtonContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
  },
  deleteButton: {
    width: 80,
    height: '100%',
    backgroundColor: Colors.error,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  rowContent: {
    position: 'absolute' as const,
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.surface,
  },
  row: {
    height: 80,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
    justifyContent: 'center' as const,
  },
  textContent: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  shortcut: {
    fontSize: 17,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  messagePreview: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 20,
  },
  bottomSpacer: {
    height: 40,
  },
  modalSheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end' as const,
  },
  modalSheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalSheetHandle: {
    width: 36,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    alignSelf: 'center' as const,
    marginTop: 10,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  cancelButton: {
    minWidth: 60,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  cancelButtonText: {
    fontSize: 17,
    color: Colors.primary,
  },
  saveButton: {
    minWidth: 60,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.primary,
  },
  saveButtonTextDisabled: {
    color: Colors.textSecondary,
    opacity: 0.5,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
  },
  modalContent: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalContentContainer: {
    paddingBottom: 20,
  },
  formContainer: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 40,
  },
  fieldContainer: {
    marginBottom: 28,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    fontSize: 17,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageFieldInput: {
    minHeight: 120,
    paddingTop: 16,
    textAlignVertical: 'top' as const,
  },

});
