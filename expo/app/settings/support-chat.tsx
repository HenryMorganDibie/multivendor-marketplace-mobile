import React, { useState, useRef, useEffect } from 'react';
import { Colors } from '@/constants/colors';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Send, Check, Plus } from 'lucide-react-native';
import { useRouter, Stack } from 'expo-router';
import { useCustomerSupportChat, SupportMessage } from '@/contexts/CustomerSupportChatContext';

export default function CustomerSupportChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { supportChat, addMessage, getOrCreateSupportChat, markSupportAsRead } = useCustomerSupportChat();
  const [messageText, setMessageText] = useState<string>('');

  useEffect(() => {
    if (!supportChat) {
      getOrCreateSupportChat();
    } else {
      markSupportAsRead();
    }
  }, [supportChat, getOrCreateSupportChat, markSupportAsRead]);

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: false });
    }, 100);
  }, [supportChat?.messages]);

  const handleSendMessage = () => {
    if (messageText.trim() === '') return;
    const content = messageText.trim();
    addMessage(content, 'customer');
    setMessageText('');
    console.log('Customer support message sent:', content);
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffInDays === 0) return 'Today';
    if (diffInDays === 1) return 'Yesterday';
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const shouldShowDateHeader = (messages: SupportMessage[], index: number): boolean => {
    if (index === 0) return true;
    const currentDate = new Date(messages[index].timestamp).toDateString();
    const prevDate = new Date(messages[index - 1].timestamp).toDateString();
    return currentDate !== prevDate;
  };

  const renderMessage = (message: SupportMessage, index: number, messages: SupportMessage[]) => {
    const showDateHeader = shouldShowDateHeader(messages, index);

    if (message.type === 'system') {
      return (
        <View key={message.id}>
          {showDateHeader && (
            <View style={styles.dateHeaderContainer}>
              <Text style={styles.dateHeaderText}>{formatDate(message.timestamp)}</Text>
            </View>
          )}
          <View style={styles.systemMessageContainer}>
            <View style={styles.systemMessageBubble}>
              <Text style={styles.systemMessageText}>{message.content}</Text>
            </View>
          </View>
        </View>
      );
    }

    const isOutgoing = message.sender === 'customer';

    return (
      <View key={message.id}>
        {showDateHeader && (
          <View style={styles.dateHeaderContainer}>
            <Text style={styles.dateHeaderText}>{formatDate(message.timestamp)}</Text>
          </View>
        )}
        <View
          style={[
            styles.messageBubbleContainer,
            isOutgoing ? styles.outgoingMessageContainer : styles.incomingMessageContainer,
          ]}
        >
          {!isOutgoing && (
            <View style={styles.supportAvatarSmall}>
              <Text style={styles.supportAvatarSmallText}>L</Text>
            </View>
          )}
          <View
            style={[
              styles.messageBubble,
              isOutgoing ? styles.outgoingBubble : styles.incomingBubble,
            ]}
          >
            <Text style={[styles.messageText, isOutgoing && styles.outgoingMessageText]}>
              {message.content}
            </Text>
            <Text style={[styles.messageTime, isOutgoing && styles.outgoingMessageTime]}>
              {formatTime(message.timestamp)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const messages = supportChat?.messages || [];

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.headerButton}>
              <ChevronLeft size={28} color={Colors.text} />
            </TouchableOpacity>
            <View style={styles.headerAvatarContainer}>
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>L</Text>
              </View>
              <View style={styles.headerAvatarBadge}>
                <Check size={10} color={Colors.white} strokeWidth={3} />
              </View>
            </View>
            <View style={styles.headerCenter}>
              <Text style={styles.headerTitle} numberOfLines={1}>Platform Support</Text>
              <Text style={styles.headerSubtitle} numberOfLines={1}>Official support account</Text>
            </View>
            <View style={styles.headerButton} />
          </View>
        </SafeAreaView>

        <View style={styles.contentWrapper}>
          <ScrollView
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((message, index) => renderMessage(message, index, messages))}
          </ScrollView>
        </View>

        <SafeAreaView edges={['bottom']} style={styles.inputSafeArea}>
          <View style={styles.inputContainer}>
            <TouchableOpacity style={styles.attachButton} activeOpacity={0.7}>
              <Plus size={22} color={Colors.textSecondary} />
            </TouchableOpacity>
            <TextInput
              style={styles.input}
              placeholder="Type a message…"
              placeholderTextColor={Colors.textSecondary}
              value={messageText}
              onChangeText={setMessageText}
              multiline
              maxLength={1000}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                messageText.trim() === '' && styles.sendButtonDisabled,
              ]}
              onPress={handleSendMessage}
              disabled={messageText.trim() === ''}
              activeOpacity={0.7}
            >
              <Send size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  headerButton: {
    padding: 8,
    width: 44,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.primary,
    marginTop: 1,
  },
  headerAvatarContainer: {
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerAvatarText: {
    fontSize: 20,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  headerAvatarBadge: {
    position: 'absolute' as const,
    bottom: -2,
    right: -2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  contentWrapper: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  messagesContent: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexGrow: 1,
  },
  dateHeaderContainer: {
    alignItems: 'center' as const,
    marginVertical: 12,
  },
  dateHeaderText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  systemMessageContainer: {
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  systemMessageBubble: {
    backgroundColor: Colors.primarySoft,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '90%',
  },
  systemMessageText: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 18,
  },
  messageBubbleContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    marginBottom: 8,
  },
  outgoingMessageContainer: {
    justifyContent: 'flex-end' as const,
  },
  incomingMessageContainer: {
    justifyContent: 'flex-start' as const,
  },
  supportAvatarSmall: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
    marginBottom: 2,
  },
  supportAvatarSmallText: {
    fontSize: 13,
    fontWeight: '800' as const,
    color: Colors.white,
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
  },
  outgoingBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  incomingBubble: {
    backgroundColor: Colors.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  messageText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  outgoingMessageText: {
    color: Colors.white,
  },
  messageTime: {
    fontSize: 11,
    color: Colors.textSecondary,
  },
  outgoingMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputSafeArea: {
    backgroundColor: Colors.background,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.cardBorder,
    gap: 8,
  },
  attachButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 16,
    color: Colors.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.border,
  },
});
