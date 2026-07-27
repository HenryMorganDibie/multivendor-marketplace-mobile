import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

interface OrderActionsPanelProps {
  showAcceptDecline: boolean;
  showMarkInProgress: boolean;
  isInProgress: boolean;
  isExternal: boolean;
  showCancel: boolean;
  isProcessing: boolean;
  isAwaitingCustomerUpdate?: boolean;
  onAccept: () => void;
  onRequestChanges: () => void;
  onMarkInProgress: () => void;
  onMarkCompleted: () => void;
  onNotifyUpdate: () => void;
  onCancelOrder: () => void;
}

export default function OrderActionsPanel({
  showAcceptDecline,
  showMarkInProgress,
  isInProgress,
  isExternal,
  showCancel,
  isProcessing,
  isAwaitingCustomerUpdate = false,
  onAccept,
  onRequestChanges,
  onMarkInProgress,
  onMarkCompleted,
  onNotifyUpdate,
  onCancelOrder,
}: OrderActionsPanelProps) {
  if (isAwaitingCustomerUpdate) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <View style={styles.awaitingBanner}>
          <View style={styles.awaitingDot} />
          <Text style={styles.awaitingText}>Waiting for customer to review your changes</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (showAcceptDecline) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.requestChangesButton}
            onPress={onRequestChanges}
            disabled={isProcessing}
            activeOpacity={0.7}
            testID="request-changes-button"
          >
            <Text style={styles.requestChangesText}>Request Changes</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.acceptButton, isProcessing && styles.acceptButtonDisabled]}
            onPress={onAccept}
            disabled={isProcessing}
            activeOpacity={0.7}
            testID="accept-order-button"
          >
            <Check size={18} color="#FFFFFF" strokeWidth={2.5} />
            <Text style={styles.acceptText}>
              {isProcessing ? 'Processing…' : 'Accept Order'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showMarkInProgress) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={onMarkInProgress}
            disabled={isProcessing}
            activeOpacity={0.7}
            testID="mark-in-progress-button"
          >
            <Text style={styles.primaryButtonText}>
              {isProcessing ? 'Processing…' : 'Mark In Progress'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (isInProgress && !isExternal) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.outlineButton}
            onPress={onNotifyUpdate}
            activeOpacity={0.7}
            testID="notify-update-button"
          >
            <Text style={styles.outlineButtonText}>Notify or Update</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.primaryButton, { flex: 1 }]}
            onPress={onMarkCompleted}
            disabled={isProcessing}
            activeOpacity={0.7}
            testID="complete-order-button"
          >
            <Text style={styles.primaryButtonText}>
              {isProcessing ? 'Processing…' : 'Complete'}
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (showCancel && !showAcceptDecline && !showMarkInProgress && !isInProgress) {
    return (
      <SafeAreaView edges={['bottom']} style={styles.container}>
        <View style={styles.row}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onCancelOrder}
            disabled={isProcessing}
            activeOpacity={0.7}
            testID="cancel-order-button"
          >
            <Text style={styles.cancelButtonText}>Cancel Order</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  row: {
    flexDirection: 'row' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  requestChangesButton: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    minHeight: 50,
  },
  requestChangesText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#2B2B2B',
  },
  acceptButton: {
    flex: 1.4,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FF8C42',
    paddingVertical: 15,
    borderRadius: 12,
    gap: 6,
    minHeight: 50,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  acceptButtonDisabled: {
    opacity: 0.6,
    shadowOpacity: 0,
    elevation: 0,
  },
  acceptText: {
    fontSize: 15,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  primaryButton: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FF8C42',
    paddingVertical: 15,
    borderRadius: 12,
    minHeight: 50,
    shadowColor: '#FF8C42',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  outlineButton: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  outlineButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cancelButton: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    backgroundColor: '#FFFFFF',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
    minHeight: 50,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600' as const,
    color: '#DC2626',
  },
  awaitingBanner: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
  },
  awaitingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#B45309',
  },
  awaitingText: {
    fontSize: 14,
    fontWeight: '500' as const,
    color: '#B45309',
  },
});
