import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Check, AlertCircle } from 'lucide-react-native';
import { useChatPrivacy } from '@/contexts/ChatPrivacyContext';

export type MessageStatusType = 'sent' | 'delivered' | 'read' | 'failed';

interface MessageStatusIconProps {
  status: MessageStatusType;
  size?: number;
  outgoingBubble?: boolean;
}

export default function MessageStatusIcon({
  status,
  size = 11,
  outgoingBubble = true,
}: MessageStatusIconProps) {
  const { readReceiptsEnabled } = useChatPrivacy();

  const displayStatus: MessageStatusType =
    !readReceiptsEnabled && status === 'read' ? 'delivered' : status;

  const greyColor = outgoingBubble ? 'rgba(255,255,255,0.55)' : '#9CA3AF';
  const blueColor = '#60A5FA';
  const errorColor = '#EF4444';
  const color = displayStatus === 'read' ? blueColor : greyColor;

  if (displayStatus === 'failed') {
    return (
      <View style={styles.container}>
        <AlertCircle size={size} color={errorColor} strokeWidth={2.5} />
      </View>
    );
  }

  if (displayStatus === 'sent') {
    return (
      <View style={styles.container}>
        <Check size={size} color={greyColor} strokeWidth={2.5} />
      </View>
    );
  }

  return (
    <View style={styles.doubleCheck}>
      <Check size={size} color={color} strokeWidth={2.5} />
      <View style={{ marginLeft: -(size * 0.45) }}>
        <Check size={size} color={color} strokeWidth={2.5} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  doubleCheck: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
