import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Alert } from '@/utils/alert';
import { Trash2 } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { useTodaysNote } from '@/contexts/TodaysNoteContext';

const MAX_CHARS = 1000;

interface TodaysNoteModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function TodaysNoteModal({ visible, onClose }: TodaysNoteModalProps) {

  const { note, saveNote, clearNote } = useTodaysNote();
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (visible) {
      setDraft(note);
    }
  }, [visible, note]);

  const hasChanges = draft.trim() !== note.trim();
  const hasDraft = draft.trim().length > 0;

  const handleSave = () => {
    if (!hasChanges) return;
    void saveNote(draft.trim());
    onClose();
  };

  const handleCancel = () => {
     if (draft.trim() !== note.trim()) {

    Alert.alert(
      "Discard note?",
      "You have unsaved changes.",
      [
        { text: "Keep editing", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: () => onClose(),
        },
      ]
    );
    } else {
      onClose();
    }
  };

  const handleClear = () => {

    // Draft only → clear instantly
    if (!note.trim()) {
      setDraft('');
      return;
    }

    // Saved note → confirm deletion
    Alert.alert(
      "Clear today's note?",
      "This will delete your saved note.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            void clearNote();
            setDraft('');
          },
        },
      ]
    );
  };

  const handleTextChange = (text: string) => {
    if (text.length <= MAX_CHARS) {
      setDraft(text);
    }
  };

  const charCount = draft.length;
const isNearLimit = charCount > MAX_CHARS * 0.9;
const isAtLimit = charCount === MAX_CHARS;
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.backdrop} />

        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* HEADER */}
          <View style={styles.header}>

            <TouchableOpacity
              onPress={handleCancel}
              activeOpacity={0.7}
            >
              <Text style={styles.cancel}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Quick Note</Text>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!hasChanges}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.save,
                  { opacity: hasChanges ? 1 : 0.35 }
                ]}
              >
                Save
              </Text>
            </TouchableOpacity>

          </View>

          {/* BODY */}
          <View style={styles.body}>
            <TextInput
              style={styles.textInput}
              value={draft}
              onChangeText={handleTextChange}
              placeholder="Add today's note..."
              placeholderTextColor={Colors.textMuted}
              multiline
              maxLength={MAX_CHARS}
              textAlignVertical="top"
              autoFocus
            />

            {/* COUNTER + TRASH */}
            <View style={styles.bottomRow}>

              <Text
  style={[
    styles.counter,
    isNearLimit && styles.counterWarning,
    isAtLimit && styles.counterDanger,
  ]}
>
  {charCount}/{MAX_CHARS}
</Text>

              {hasDraft && (
                <TouchableOpacity
                  style={styles.trashButton}
                  onPress={handleClear}
                >
                  <Trash2 size={20} color={Colors.error} />
                </TouchableOpacity>
              )}

            </View>
          </View>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({

  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },

  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },

  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  height: '75%',

  },

  handle: {
    width: 36,
    height: 5,
    backgroundColor: '#E5E7EB',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 6,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },

  title: {
    position: 'absolute',
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: '#2B2B2B',
  },

  cancel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },

  save: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },

  body: {
    paddingHorizontal: 20,
  },

  textInput: {
   backgroundColor: '#F8F9FA',
  borderRadius: 14,
  borderWidth: 1,
  borderColor: '#E5E7EB',
  padding: 16,
  fontSize: 16,
  color: '#2B2B2B',
  height: 240,
  lineHeight: 24,
  },

  bottomRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },

  counter: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },

  trashButton: {
    padding: 6,
  },
  counterWarning: {
  color: '#F59E0B',
},

counterDanger: {
  color: '#DC2626',
},

});