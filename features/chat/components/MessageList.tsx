import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { ChatMessage, ContactCardData } from '@/mocks/chatData';
import { MessageBubble } from './MessageBubble';
import {
  buildMessageGroups,
  formatTimestampDivider,
} from '@/features/chat/selectors/chatSelectors';

type SystemActionMessage = {
  id: string;
  content: string;
};

type Props = {
  messages: ChatMessage[];
  scrollViewRef: React.RefObject<ScrollView>;
  orderId: string;
  publicOrderId?: string;
  isCompleted: boolean;
  orderStatus: string;
  systemActionMessages: SystemActionMessage[];
  onShowCopyToast?: () => void;
  onViewContactDetails: (data: ContactCardData) => void;
  transformSystemMessage: (content: string) => string | null;
  headerComponent?: React.ReactNode;
  footerComponent?: React.ReactNode;
};

export const MessageList = React.memo(({
  messages,
  scrollViewRef,
  orderId,
  publicOrderId,
  isCompleted,
  orderStatus,
  systemActionMessages,
  onShowCopyToast,
  onViewContactDetails,
  transformSystemMessage,
  headerComponent,
  footerComponent,
}: Props) => {
  const groups = buildMessageGroups(messages);

  return (
    <ScrollView
      ref={scrollViewRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      testID="message-list"
    >
      {headerComponent}
      {groups.map(({ message, groupInfo, showDivider }, _index) => (
        <React.Fragment key={message.id}>
          {showDivider && (
            <View style={styles.timestampDivider}>
              <Text style={styles.timestampDividerText}>
                {formatTimestampDivider(message.timestamp)}
              </Text>
            </View>
          )}
          <MessageBubble
            message={message}
            groupInfo={groupInfo}
            orderId={orderId}
            publicOrderId={publicOrderId}
            isCompleted={isCompleted}
            orderStatus={orderStatus}
            onShowCopyToast={onShowCopyToast}
            onViewContactDetails={onViewContactDetails}
            transformSystemMessage={transformSystemMessage}
          />
        </React.Fragment>
      ))}
      {footerComponent}
      {systemActionMessages.map((msg) => (
        <View key={msg.id} style={styles.systemActionContainer}>
          <View style={styles.systemActionBubble}>
            <Text style={styles.systemActionText}>{msg.content}</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
});

MessageList.displayName = 'MessageList';

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  content: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  timestampDivider: {
    alignItems: 'center',
    marginVertical: 12,
  },
  timestampDividerText: {
    fontSize: 11,
    color: '#8E8E93',
    backgroundColor: 'rgba(142,142,147,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    overflow: 'hidden',
    fontWeight: '500',
  },
  systemActionContainer: {
    alignItems: 'center',
    marginVertical: 8,
    paddingHorizontal: 24,
  },
  systemActionBubble: {
    backgroundColor: 'rgba(0,0,0,0.055)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
  },
  systemActionText: {
    fontSize: 12,
    color: '#8E8E93',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
