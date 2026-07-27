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
import { ChevronLeft, Send, ShieldCheck, MoreVertical, X } from 'lucide-react-native';
import { useRouter, Stack } from 'expo-router';
import { useVendorSupportChat, SupportMessage } from '@/contexts/VendorSupportChatContext';

const THE PLATFORM_LOGO_URL = 'https://images.unsplash.com/photo-1614680376593-902f74cf0d41?w=200&h=200&fit=crop';

export default function VendorSupportChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const { supportChat, addMessage, getOrCreateSupportChat, endSupportChat, markSupportAsRead } = useVendorSupportChat();
  const [messageText, setMessageText] = useState('');
  const [showMenu, setShowMenu] = useState(false);

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

  const handleBackPress = () => {
    router.back();
  };

  const handleEndChat = () => {
    setShowMenu(false);
    endSupportChat();
    router.back();
  };

  const handleSendMessage = () => {
    if (messageText.trim() === '') return;

    const content = messageText.trim();
    addMessage(content, 'vendor');
    setMessageText('');
    console.log('Support message sent:', content);
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

    if (diffInDays === 0) {
      return 'Today';
    } else if (diffInDays === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
      });
    }
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

    const isOutgoing = message.sender === 'vendor';

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
              <ShieldCheck size={14} color={Colors.success} />
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
            <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
              <ChevronLeft size={28} color={Colors.charcoal} />
            </TouchableOpacity>
            <View style={styles.headerAvatarContainer}>
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>L</Text>
              </View>
            </View>
            <View style={styles.headerCenter}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle}>the platform Vendor Support</Text>
                <View style={styles.verifiedBadge}>
                  <ShieldCheck size={16} color={Colors.success} />
                </View>
              </View>
              <Text style={styles.headerSubtitle}>Official support channel</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowMenu(!showMenu)} 
              style={styles.headerButton}
            >
              <MoreVertical size={22} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {showMenu && (
            <View style={styles.menuOverlay}>
              <TouchableOpacity 
                style={styles.menuBackdrop} 
                onPress={() => setShowMenu(false)} 
                activeOpacity={1}
              />
              <View style={styles.menuContainer}>
                <TouchableOpacity 
                  style={styles.menuItem} 
                  onPress={handleEndChat}
                  activeOpacity={0.7}
                >
                  <X size={18} color={Colors.error} />
                  <Text style={styles.menuItemTextDestructive}>End chat</Text>
                </TouchableOpacity>
                <Text style={styles.menuHint}>
                  Chat history will be preserved. You can contact support again anytime.
                </Text>
              </View>
            </View>
          )}
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
              <Send
                size={20}
                color={Colors.text}
                fill={messageText.trim() === '' ? 'none' : Colors.white}
              />
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  headerButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    marginLeft: 8,
  },
  headerTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  verifiedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerSubtitle: {
    fontSize: 13,
    color: Colors.success,
    marginTop: 2,
  },
  headerAvatarContainer: {
    marginRight: 10,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.success,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  headerAvatarText: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  menuOverlay: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
  },
  menuBackdrop: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  menuContainer: {
    position: 'absolute' as const,
    top: 90,
    right: 16,
    backgroundColor: Colors.border,
    borderRadius: 12,
    padding: 8,
    minWidth: 200,
    shadowColor: Colors.text,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  menuItem: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  menuItemTextDestructive: {
    fontSize: 16,
    color: Colors.error,
    fontWeight: '500' as const,
  },
  menuHint: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: 14,
    paddingBottom: 8,
    lineHeight: 16,
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
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    maxWidth: '90%',
  },
  systemMessageText: {
    fontSize: 13,
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
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginRight: 8,
    marginBottom: 2,
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
    backgroundColor: Colors.border,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  outgoingMessageText: {
    color: Colors.text,
  },
  messageTime: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  outgoingMessageTime: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputSafeArea: {
    backgroundColor: Colors.surface,
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: Colors.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 8,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.border,
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
