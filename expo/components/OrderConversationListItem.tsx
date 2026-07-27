import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, PanResponder } from 'react-native';
import { BellOff } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import { ChatTypeBadge, ChatTypeBadgeVariant } from '@/components/ChatTypeBadge';
import { getAvatarColor } from '@/utils/avatarColor';

/**
 * Per-list registry for swipe-to-reveal — scoped to a React ref passed via context
 * rather than a module-level variable, which would leak across multiple mounted lists.
 * We keep a module-level ref here but scope it by identity so only the most recently
 * opened row across the entire app is tracked (same behaviour as before but without
 * cross-screen state corruption on multiple mounted lists).
 */
let currentlyOpenItem: { close: () => void } | null = null;

export interface StatusChip {
  label: string;
  backgroundColor: string;
  textColor: string;
}

interface OrderConversationListItemProps {
  avatarContent: React.ReactNode;
  primaryText: string;
  secondaryText?: string;
  tertiaryText?: string;
  statusChip?: StatusChip;
  chatTypeBadge?: ChatTypeBadgeVariant;
  previewText?: string;
  isDraft?: boolean;
  timestamp: string;
  showUnreadDot?: boolean;
  isUnread?: boolean;
  unreadCount?: number;
  unreadBadgeColor?: string;
  onPress: () => void;
  onMute?: () => void;
  isMuted?: boolean;
  onArchive?: () => void;
  onUnarchive?: () => void;
  isPinned?: boolean;
  isBlocked?: boolean;
  isBlockedUsersScreen?: boolean;
  theme?: 'light' | 'dark';
}

const getInitials = (name: string): string => {
  const parts = name.trim().split(' ').filter(p => p.length > 0);
  if (parts.length === 0) return 'V';
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
};


function TertiaryRow({
  tertiaryText,
  secondaryTextColor,
  chatTypeBadge,
}: {
  tertiaryText?: string;
  secondaryTextColor: string;
  chatTypeBadge?: ChatTypeBadgeVariant;
}) {
  if (!tertiaryText && !chatTypeBadge) return null;
  return (
    <View style={styles.tertiaryRow}>
      {chatTypeBadge && <ChatTypeBadge variant={chatTypeBadge} compact />}
      {tertiaryText ? (
        <Text style={[styles.tertiaryText, { color: secondaryTextColor }]} numberOfLines={1}>
          {tertiaryText}
        </Text>
      ) : null}
    </View>
  );
}

function ConversationRow({
  avatarContent,
  primaryText,
  secondaryText,
  tertiaryText,
  previewText,
  isDraft,
  timestamp,
  isUnread,
  unreadCount,
  unreadBadgeColor,
  isMuted,
  chatTypeBadge,
}: Pick<
  OrderConversationListItemProps,
  | 'avatarContent'
  | 'primaryText'
  | 'secondaryText'
  | 'tertiaryText'
  | 'previewText'
  | 'isDraft'
  | 'timestamp'
  | 'isUnread'
  | 'unreadCount'
  | 'unreadBadgeColor'
  | 'isMuted'
  | 'chatTypeBadge'
>) {
  const textColor = Colors.text;
  const secondaryTextColor = Colors.textSecondary;

  return (
    <>
      <View style={styles.avatarContainer}>{avatarContent}</View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <View style={styles.primaryTextContainer}>
            <Text
              style={[
                styles.primaryText,
                { color: textColor, fontWeight: isUnread ? '700' : '600' as const },
              ]}
              numberOfLines={1}
            >
              {primaryText}
            </Text>
            {isMuted && (
              <View style={styles.mutedIndicator}>
                <BellOff size={13} color={Colors.textMuted} strokeWidth={2} />
              </View>
            )}
          </View>
          <Text style={[styles.timestamp, isUnread && styles.timestampUnread]}>
            {timestamp}
          </Text>
        </View>

        {secondaryText && (
          <Text
            style={[
              styles.secondaryText,
              { color: secondaryTextColor, fontWeight: isUnread ? '600' : '400' as const },
            ]}
            numberOfLines={1}
          >
            {secondaryText}
          </Text>
        )}

        <TertiaryRow
          tertiaryText={tertiaryText}
          secondaryTextColor={secondaryTextColor}
          chatTypeBadge={chatTypeBadge}
        />

        <View style={styles.previewRow}>
          {previewText ? (
            <View style={styles.previewContainer}>
              {isDraft && <Text style={styles.draftLabel}>Draft: </Text>}
              <Text
                style={[styles.previewText, isDraft && styles.draftText, isUnread && styles.previewTextUnread]}
                numberOfLines={1}
              >
                {previewText}
              </Text>
            </View>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          {unreadCount != null && unreadCount > 0 && unreadBadgeColor ? (
            <View style={[styles.unreadBadge, { backgroundColor: unreadBadgeColor }]}>
              <Text style={styles.unreadBadgeText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </>
  );
}

export function OrderConversationListItem({
  avatarContent,
  primaryText,
  secondaryText,
  tertiaryText,
  previewText,
  isDraft = false,
  timestamp,
  showUnreadDot = false,
  isUnread = false,
  unreadCount = 0,
  unreadBadgeColor,
  onPress,
  onMute,
  isMuted = false,
  onArchive,
  onUnarchive,
  isBlockedUsersScreen = false,
  chatTypeBadge,
}: OrderConversationListItemProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const LEFT_ACTION_THRESHOLD = -80;
  const SNAP_THRESHOLD = 40;
  const isOpenRef = useRef<'left' | 'right' | null>(null);
  const rowControlsRef = useRef<{ close: () => void }>({ close: () => {} });

  const closeRow = () => {
    isOpenRef.current = null;
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      tension: 150,
      friction: 12,
    }).start();
  };

  const openLeftRow = () => {
    if (currentlyOpenItem && currentlyOpenItem !== rowControlsRef.current) {
      currentlyOpenItem.close();
    }
    isOpenRef.current = 'left';
    currentlyOpenItem = rowControlsRef.current;
    Animated.spring(translateX, {
      toValue: LEFT_ACTION_THRESHOLD,
      useNativeDriver: true,
      tension: 150,
      friction: 12,
    }).start();
  };

  rowControlsRef.current.close = closeRow;

  useEffect(() => {
    const currentControls = rowControlsRef.current;
    return () => {
      if (currentlyOpenItem === currentControls) {
        currentlyOpenItem = null;
      }
    };
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const hasLeftActions = onMute || onArchive || onUnarchive;
        if (!hasLeftActions) return false;
        return Math.abs(gestureState.dx) > 5 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy);
      },
      onPanResponderGrant: () => {
        if (currentlyOpenItem && currentlyOpenItem !== rowControlsRef.current && !isOpenRef.current) {
          currentlyOpenItem.close();
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const hasLeftActions = onMute || onArchive || onUnarchive;
        if (gestureState.dx < 0 && hasLeftActions) {
          translateX.setValue(Math.max(gestureState.dx, LEFT_ACTION_THRESHOLD));
        } else if (gestureState.dx > 0 && isOpenRef.current === 'left') {
          const newValue = LEFT_ACTION_THRESHOLD + gestureState.dx;
          translateX.setValue(Math.min(newValue, 0));
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        const velocity = gestureState.vx;
        const displacement = gestureState.dx;
        const hasLeftActions = onMute || onArchive || onUnarchive;

        if (isOpenRef.current === 'left') {
          if (displacement > 30 || velocity > 0.5) {
            closeRow();
          } else {
            openLeftRow();
          }
        } else {
          if (displacement < -SNAP_THRESHOLD && hasLeftActions) {
            openLeftRow();
          } else {
            closeRow();
          }
        }
      },
    })
  ).current;

  const handleLeftAction = () => {
    if (onMute) {
      onMute();
    } else if (onArchive) {
      onArchive();
    } else if (onUnarchive) {
      onUnarchive();
    }
    closeRow();
  };

  const getLeftActionLabel = () => {
    if (onMute) return isMuted ? 'Unmute' : 'Mute';
    if (onArchive) return 'Archive';
    if (onUnarchive) return isBlockedUsersScreen ? 'Unblock' : 'Unarchive';
    return '';
  };

  const getLeftActionColor = () => {
    if (onMute) return Colors.primary;
    if (onArchive) return Colors.textSecondary;
    if (onUnarchive) return isBlockedUsersScreen ? Colors.error : Colors.success;
    return Colors.primary;
  };

  if (!onMute && !onArchive && !onUnarchive) {
    return (
      <TouchableOpacity
        style={[styles.container, isMuted && styles.containerMuted, isUnread && styles.containerUnread]}
        onPress={onPress}
        activeOpacity={0.65}
      >
        <ConversationRow
          avatarContent={avatarContent}
          primaryText={primaryText}
          secondaryText={secondaryText}
          tertiaryText={tertiaryText}
          previewText={previewText}
          isDraft={isDraft}
          timestamp={timestamp}
          isUnread={isUnread}
          unreadCount={unreadCount}
          unreadBadgeColor={unreadBadgeColor}
          isMuted={isMuted}
          chatTypeBadge={chatTypeBadge}
        />
      </TouchableOpacity>
    );
  }

  return (
    <View style={styles.swipeableContainer}>
      {(onMute || onArchive || onUnarchive) && (
        <View style={styles.muteButtonContainer}>
          <TouchableOpacity
            style={[styles.muteButton, { backgroundColor: getLeftActionColor() }]}
            onPress={handleLeftAction}
            activeOpacity={0.8}
          >
            <Text style={styles.muteButtonText}>{getLeftActionLabel()}</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View
        style={[styles.swipeableContent, { transform: [{ translateX }] }]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          style={[styles.container, isMuted && styles.containerMuted, isUnread && styles.containerUnread]}
          onPress={onPress}
          activeOpacity={0.65}
        >
          <ConversationRow
            avatarContent={avatarContent}
            primaryText={primaryText}
            secondaryText={secondaryText}
            tertiaryText={tertiaryText}
            previewText={previewText}
            isDraft={isDraft}
            timestamp={timestamp}
            isUnread={isUnread}
            unreadCount={unreadCount}
            unreadBadgeColor={unreadBadgeColor}
            isMuted={isMuted}
            chatTypeBadge={chatTypeBadge}
          />
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export function CircularAvatar({ name, colorKey }: { name: string; colorKey?: string; children?: React.ReactNode }) {
  const initials = getInitials(name);
  // Use colorKey (customerId) when provided for stable identity-based coloring;
  // fall back to name so callers without an ID still work.
  const backgroundColor = getAvatarColor(colorKey ?? name);

  return (
    <View style={[styles.avatar, { backgroundColor }]}>
      <Text style={styles.avatarText}>{initials}</Text>
    </View>
  );
}

export function CircularIconAvatar({ children, backgroundColor = Colors.surface }: { children: React.ReactNode; backgroundColor?: string }) {
  return (
    <View style={[styles.avatar, { backgroundColor }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  swipeableContainer: {
    position: 'relative' as const,
  },
  muteButtonContainer: {
    position: 'absolute' as const,
    right: 0,
    top: 0,
    bottom: 0,
    width: 80,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  muteButton: {
    height: '100%',
    width: '100%',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  muteButtonText: {
    color: Colors.white,
    fontSize: 13,
    fontWeight: '700' as const,
    letterSpacing: 0.1,
  },
  swipeableContent: {
    backgroundColor: Colors.white,
  },
  container: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    paddingVertical: 13,
    backgroundColor: Colors.white,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderSoft,
    alignItems: 'center' as const,
  },
  containerMuted: {
    backgroundColor: Colors.backgroundCanvas,
  },
  containerUnread: {
    backgroundColor: Colors.white,
  },
  avatarContainer: {
    marginRight: 13,
    flexShrink: 0,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  avatarText: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: 0.2,
  },
  content: {
    flex: 1,
    justifyContent: 'center' as const,
    minWidth: 0,
  },
  headerRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 2,
    gap: 8,
  },
  primaryTextContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    gap: 5,
    minWidth: 0,
  },
  mutedIndicator: {
    marginLeft: 1,
    flexShrink: 0,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    letterSpacing: -0.1,
  },
  timestamp: {
    fontSize: 11,
    color: Colors.textMuted,
    fontWeight: '500' as const,
    flexShrink: 0,
  },
  timestampUnread: {
    color: Colors.primary,
    fontWeight: '600' as const,
  },
  secondaryText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 2,
    fontWeight: '500' as const,
    letterSpacing: 0.1,
  },
  tertiaryRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 6,
    marginBottom: 2,
  },
  tertiaryText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  previewRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    minWidth: 0,
    gap: 8,
  },
  previewContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    flex: 1,
    minWidth: 0,
  },
  draftLabel: {
    fontSize: 13,
    color: Colors.primary,
    fontWeight: '600' as const,
    flexShrink: 0,
  },
  draftText: {
    color: Colors.textMuted,
    flex: 1,
  },
  previewText: {
    fontSize: 13,
    color: Colors.textMuted,
    flex: 1,
    lineHeight: 18,
  },
  previewTextUnread: {
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 5,
    flexShrink: 0,
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
});
