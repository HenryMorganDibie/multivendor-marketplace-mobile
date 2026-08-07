import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Animated, PanResponder, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { Alert } from '@/utils/alert';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';

import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { MessageSquareText, ChevronRight } from 'lucide-react-native';
import EditScreenHeader from '@/components/EditScreenHeader';
import { auth, callable, db } from '@/lib/firebase';
import { Colors } from '@/constants/colors';

interface QuickReply {
  id: string;
  shortcut: string;
  message: string;
  text?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  isActive?: boolean;
}

export default function QuickRepliesScreen() {
  const router = useRouter();
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingReply, setEditingReply] = useState<QuickReply | null>(null);
  const [shortcutInput, setShortcutInput] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [openSwipeId, setOpenSwipeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const MAX_REPLIES = 20;

  /**
   * Live subscription to the vendor's real quick replies.
   *
   * createQuickReply/updateQuickReply/deleteQuickReply have been deployed
   * since this screen was built and nothing called them — the list lived in
   * a single global AsyncStorage key, shared by every vendor account on the
   * device and gone on reinstall. Reading the vendor's own subcollection
   * directly (same pattern as CatalogContext/PromoContext) means an edit
   * from this screen, another device, or eventually the vendor portal all
   * show up here without a manual refresh.
   */
  useEffect(() => {
    let unsubscribeReplies: (() => void) | null = null;

    const unsubscribeAuth = auth.onIdTokenChanged(async (user) => {
      unsubscribeReplies?.();
      unsubscribeReplies = null;
      if (!user) return;

      const token = await user.getIdTokenResult();
      const vendorId = token.claims.vendorId as string | undefined;
      if (!vendorId) return;

      unsubscribeReplies = onSnapshot(
        query(collection(db, 'vendors', vendorId, 'quickReplies'), orderBy('sortOrder', 'asc')),
        (snap) => {
          setQuickReplies(
            snap.docs.map((d) => {
              const data = d.data();
              const shortcutRaw = String(data.shortcut ?? '');
              return {
                id: d.id,
                shortcut: shortcutRaw.startsWith('/') ? shortcutRaw.slice(1) : shortcutRaw,
                message: (data.message as string) ?? '',
                text: (data.message as string) ?? '',
                isActive: Boolean(data.isActive),
              };
            }),
          );
        },
        (err) => {
          console.error('[QuickReplies] Live subscription failed:', err);
          setQuickReplies([]);
        },
      );
    });

    return () => {
      unsubscribeReplies?.();
      unsubscribeAuth();
    };
  }, []);

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

  const handleSave = useCallback(async () => {
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

    setIsSaving(true);
    try {
      if (editingReply) {
        const update = callable<
          { replyId: string; shortcut: string; message: string },
          { success: true }
        >('updateQuickReply');
        await update({ replyId: editingReply.id, shortcut: trimmedShortcut, message: trimmedMessage });
      } else {
        // No separate "title" field exists in this UI — the shortcut is the
        // only label a vendor gives a reply, so it doubles as the title the
        // backend stores for display elsewhere (e.g. the vendor portal).
        const create = callable<
          { title: string; shortcut: string; message: string; sortOrder?: number },
          { success: true; replyId: string }
        >('createQuickReply');
        await create({
          title: trimmedShortcut,
          shortcut: trimmedShortcut,
          message: trimmedMessage,
          sortOrder: quickReplies.length,
        });
      }
      setShowModal(false);
      setEditingReply(null);
      setShortcutInput('');
      setMessageInput('');
    } catch (error) {
      console.error('[QuickReplies] Save failed:', error);
      const message = (error as { message?: string })?.message ?? 'Could not save this quick reply. Please try again.';
      Alert.alert('Something went wrong', message);
    } finally {
      setIsSaving(false);
    }
  }, [shortcutInput, messageInput, editingReply, quickReplies]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      const del = callable<{ replyId: string }, { success: true }>('deleteQuickReply');
      await del({ replyId: id });
    } catch (error) {
      console.error('[QuickReplies] Delete failed:', error);
      const message = (error as { message?: string })?.message ?? 'Could not delete this quick reply. Please try again.';
      Alert.alert('Something went wrong', message);
    }
  }, []);

  const handleReorder = (fromIndex: number, toIndex: number) => {
    const newReplies = [...quickReplies];
    const [moved] = newReplies.splice(fromIndex, 1);
    newReplies.splice(toIndex, 0, moved);
    setQuickReplies(newReplies);
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader
          title="Quick Replies"
          onBack={() => router.back()}
          onSave={handleAddNew}
          saveLabel="+"
          saveEnabled={quickReplies.length < MAX_REPLIES}
        />
      </SafeAreaView>
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
              <View style={styles.emptyIconCircle}>
                <MessageSquareText size={28} color={Colors.primary} strokeWidth={2} />
              </View>
              <Text style={styles.emptyStateText}>No quick replies yet</Text>
              <Text style={styles.emptyStateSubtext}>
                Save manual message templates for common questions. Quick replies never auto-send.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddButton}
                onPress={handleAddNew}
                activeOpacity={0.72}
                disabled={quickReplies.length >= MAX_REPLIES}
              >
                <Text style={styles.emptyAddButtonText}>Add Quick Reply</Text>
              </TouchableOpacity>
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
                activeOpacity={0.85}
                style={[
                  styles.saveButton,
                  (!shortcutInput.trim() || !messageInput.trim() || isSaving) && styles.saveButtonDisabled,
                ]}
                disabled={!shortcutInput.trim() || !messageInput.trim() || isSaving}
              >
                <Text style={[
                  styles.saveButtonText,
                  (!shortcutInput.trim() || !messageInput.trim() || isSaving) && styles.saveButtonTextDisabled
                ]}>
                  {isSaving ? 'Saving…' : 'Save'}
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
                  <Text style={styles.charCount}>{messageInput.length}/300</Text>
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
          activeOpacity={0.8}
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
            <View style={styles.shortcutPill}>
              <Text style={styles.shortcutText} numberOfLines={1}>/{reply.shortcut}</Text>
            </View>
            <Text style={styles.messagePreview} numberOfLines={2}>
              {reply.message}
            </Text>
          </View>
          <ChevronRight size={18} color={Colors.textMuted} strokeWidth={2} />
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
  headerSafe: {
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
    minHeight: 360,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 18,
  },
  emptyStateText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.2,
    marginBottom: 6,
  },
  emptyStateSubtext: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textTertiary,
    textAlign: 'center' as const,
  },
  emptyAddButton: {
    minHeight: 46,
    borderRadius: 15,
    backgroundColor: Colors.charcoal,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 18,
    marginTop: 18,
  },
  emptyAddButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
  },
  listContainer: {
    marginTop: 12,
  },
  rowContainer: {
    position: 'relative' as const,
    overflow: 'hidden' as const,
    borderRadius: 16,
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: Colors.error,
  },
  deleteButtonContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 88,
  },
  deleteButton: {
    width: 88,
    height: '100%',
    backgroundColor: Colors.error,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: '#FFFFFF',
  },
  rowContent: {
    backgroundColor: Colors.surfaceElevated,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  textContent: {
    flex: 1,
  },
  shortcutPill: {
    alignSelf: 'flex-start' as const,
    backgroundColor: Colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 7,
  },
  shortcutText: {
    fontSize: 13,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: -0.1,
  },
  messagePreview: {
    fontSize: 14,
    color: Colors.textSecondary,
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '82%',
    shadowColor: Colors.black,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 16,
  },
  modalSheetHandle: {
    width: 40,
    height: 5,
    backgroundColor: Colors.borderDark,
    borderRadius: 3,
    alignSelf: 'center' as const,
    marginTop: 8,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    backgroundColor: Colors.background,
  },
  cancelButton: {
    minWidth: 64,
    paddingVertical: 8,
    paddingHorizontal: 8,
    alignItems: 'flex-start' as const,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: Colors.textSecondary,
  },
  saveButton: {
    minWidth: 64,
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  saveButtonDisabled: {
    backgroundColor: Colors.surfaceMuted,
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.primaryText,
  },
  saveButtonTextDisabled: {
    color: Colors.textMuted,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    letterSpacing: -0.2,
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
    paddingBottom: 32,
  },
  fieldContainer: {
    marginBottom: 22,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  fieldInput: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  messageFieldInput: {
    minHeight: 120,
    paddingTop: 13,
    textAlignVertical: 'top' as const,
  },
  charCount: {
    alignSelf: 'flex-end' as const,
    marginTop: 6,
    fontSize: 12,
    color: Colors.textMuted,
  },
});
