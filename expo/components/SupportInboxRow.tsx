import React from 'react';
import { ShieldCheck } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import {
  OrderConversationListItem,
  CircularIconAvatar,
} from '@/components/OrderConversationListItem';

const formatTimestamp = (timestamp: string): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

interface SupportInboxRowProps {
  /** Preview text for the most recent support message. */
  previewText: string;
  /** ISO timestamp of the latest support activity. */
  lastActivityAt: string;
  /** Number of unread support replies. */
  unreadCount: number;
  onPress: () => void;
}

/**
 * Pinned inbox row representing the official Platform Support conversation.
 * Rendered separately from commerce/order/AI chats. Uses an official support
 * icon avatar (Platform orange) rather than a vendor/customer avatar.
 *
 * MVP: fed from the local support-chat context. When the Firebase backend
 * adds `conversationType: 'support'` documents, this row can be driven from
 * the same inbox projection instead.
 */
export function SupportInboxRow({
  previewText,
  lastActivityAt,
  unreadCount,
  onPress,
}: SupportInboxRowProps) {
  const isUnread = unreadCount > 0;

  return (
    <OrderConversationListItem
      avatarContent={
        <CircularIconAvatar backgroundColor={Colors.primary}>
          <ShieldCheck size={24} color={Colors.white} strokeWidth={2} />
        </CircularIconAvatar>
      }
      primaryText="Platform Support"
      secondaryText="Official support account"
      previewText={previewText}
      timestamp={formatTimestamp(lastActivityAt)}
      isUnread={isUnread}
      unreadCount={unreadCount}
      unreadBadgeColor={isUnread ? Colors.primary : undefined}
      onPress={onPress}
      theme="light"
    />
  );
}
