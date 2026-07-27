import React, { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface ListStateViewProps {
  isLoading: boolean;
  isError: boolean;
  isEmpty: boolean;
  onRetry?: () => void;
  emptyIcon?: ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: {
    label: string;
    onPress: () => void;
  };
  loadingSkeleton: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
}

export default function ListStateView({
  isLoading,
  isError,
  isEmpty,
  onRetry,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  loadingSkeleton,
  children,
  style,
}: ListStateViewProps) {
  if (isLoading) {
    return <View style={style}>{loadingSkeleton}</View>;
  }

  if (isError) {
    return (
      <View style={[styles.center, style]}>
        <View style={styles.errorIconContainer}>
          <WifiOff size={28} color={Colors.textMuted} strokeWidth={1.5} />
        </View>
        <Text style={styles.errorTitle}>Something went wrong</Text>
        <Text style={styles.errorDescription}>
          We could not load this content. Check your connection and try again.
        </Text>
        {onRetry && (
          <TouchableOpacity style={styles.retryButton} onPress={onRetry} activeOpacity={0.75}>
            <RefreshCw size={15} color={Colors.white} strokeWidth={2} />
            <Text style={styles.retryButtonText}>Try again</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  if (isEmpty) {
    return (
      <View style={[styles.center, style]}>
        {emptyIcon && <View style={styles.emptyIconContainer}>{emptyIcon}</View>}
        <Text style={styles.emptyTitle}>{emptyTitle}</Text>
        {emptyDescription && (
          <Text style={styles.emptyDescription}>{emptyDescription}</Text>
        )}
        {emptyAction && (
          <TouchableOpacity
            style={styles.emptyActionButton}
            onPress={emptyAction.onPress}
            activeOpacity={0.75}
          >
            <Text style={styles.emptyActionButtonText}>{emptyAction.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return <>{children}</>;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  errorIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  errorTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  errorDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 24,
  },
  retryButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 7,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 13,
    borderRadius: 14,
    minHeight: 48,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: -0.1,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySofter,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.primarySoft,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 21,
    marginBottom: 24,
  },
  emptyActionButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  emptyActionButtonText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: Colors.white,
    letterSpacing: -0.1,
  },
});
