import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus, ArrowUp, X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { ReplyToData } from '@/mocks/chatData';

const SEND_ACTIVE = '#FF8C42';

type Props = {
  messageText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onPlusPress: () => void;
  isDisabled: boolean;
  disabledReason?: string;
  validationError?: string | null;
  isBlocked: boolean;
  quickReplies: Array<{ id: string; shortcut: string; message: string }>;
  onQuickReplyTrigger?: () => void;
  replyTo?: ReplyToData | null;
  onCancelReply?: () => void;
};

export const ChatComposer = React.memo(({
  messageText,
  onChangeText,
  onSend,
  onPlusPress,
  isDisabled,
  disabledReason,
  validationError,
  isBlocked,
  quickReplies,
  onQuickReplyTrigger,
  replyTo,
  onCancelReply,
}: Props) => {
  const handleTextChange = (text: string) => {
    onChangeText(text);
    if (text === '/' && quickReplies.length > 0 && onQuickReplyTrigger) {
      onQuickReplyTrigger();
    }
  };

  const hasText = messageText.trim().length > 0;

  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        {validationError && (
          <View style={styles.validationErrorContainer}>
            <Text style={styles.validationErrorText}>{validationError}</Text>
          </View>
        )}
        {isDisabled && disabledReason ? (
          <View style={[
            styles.disabledContainer,
            isBlocked && styles.blockedContainer,
          ]}>
            <Text style={[
              styles.disabledText,
              isBlocked && styles.blockedText,
            ]}>
              {disabledReason}
            </Text>
          </View>
        ) : isBlocked ? (
          <View style={styles.blockedContainer}>
            <Text style={styles.blockedText}>Unblock to send messages</Text>
          </View>
        ) : (
          <View style={styles.composerWrapper} testID="chat-composer">
            {replyTo && (
              <View style={styles.replyPreviewBar}>
                <View style={styles.replyPreviewAccent} />
                <View style={styles.replyPreviewContent}>
                  <Text style={styles.replyPreviewSender} numberOfLines={1}>
                    {replyTo.sender === 'vendor' ? 'Vendor' : replyTo.sender === 'customer' ? 'Customer' : 'System'}
                  </Text>
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {replyTo.content || 'Message'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.replyPreviewClose}
                  onPress={onCancelReply}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <X size={18} color={Colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.inputRow}>
              <TouchableOpacity
                style={styles.plusButton}
                onPress={onPlusPress}
                activeOpacity={0.7}
                testID="chat-plus-button"
              >
                <View style={styles.plusCircle}>
                  <Plus size={20} color={Colors.textSecondary} strokeWidth={2.5} />
                </View>
              </TouchableOpacity>

              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  placeholder="Send a message…"
                  placeholderTextColor="#AEAEB2"
                  value={messageText}
                  onChangeText={handleTextChange}
                  multiline
                  maxLength={500}
                  editable={!isDisabled}
                  testID="chat-input"
                />
              </View>

              <TouchableOpacity
                style={[styles.sendButton, hasText && styles.sendButtonActive]}
                onPress={onSend}
                disabled={!hasText}
                activeOpacity={0.8}
                testID="chat-send-button"
              >
                <ArrowUp
                  size={18}
                  color={hasText ? '#FFFFFF' : '#AEAEB2'}
                  strokeWidth={2.5}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}
    </SafeAreaView>
  );
});

ChatComposer.displayName = 'ChatComposer';

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: '#FFFFFF',
  },
  validationErrorContainer: {
    backgroundColor: '#FFF7ED',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#FDE68A',
  },
  validationErrorText: {
    fontSize: 13,
    color: '#92400E',
    textAlign: 'center',
    lineHeight: 18,
  },
  disabledContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#FFFFFF',
  },
  disabledText: {
    fontSize: 13,
    color: '#8E8E93',
    textAlign: 'center',
  },
  blockedContainer: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.errorLight,
  },
  blockedText: {
    fontSize: 13,
    color: Colors.error,
    textAlign: 'center',
  },
  composerWrapper: {
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingBottom: 8,
    paddingHorizontal: 10,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  plusButton: {
    paddingBottom: 2,
  },
  plusCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputWrapper: {
    flex: 1,
    backgroundColor: '#F2F2F7',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 9 : 6,
    minHeight: 38,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    color: '#1C1C1E',
    maxHeight: 100,
    lineHeight: 21,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E5EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  sendButtonActive: {
    backgroundColor: SEND_ACTIVE,
  },
  replyPreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F2F7',
    borderRadius: 12,
    marginBottom: 6,
    marginHorizontal: 2,
    overflow: 'hidden',
  },
  replyPreviewAccent: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: '#FF8C42',
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  replyPreviewContent: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  replyPreviewSender: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#FF8C42',
    marginBottom: 1,
  },
  replyPreviewText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  replyPreviewClose: {
    padding: 8,
    marginRight: 4,
  },
});
