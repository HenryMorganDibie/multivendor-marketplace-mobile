import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Check, X } from 'lucide-react-native';
import { OrderStatus } from '@/mocks/ordersData';
import { Colors } from '@/constants/colors';

interface TimelineStep {
  status: OrderStatus;
  label: string;
}

const LIFECYCLE_STEPS: TimelineStep[] = [
  { status: 'requested', label: 'Requested' },
  { status: 'accepted', label: 'Accepted' },
  { status: 'confirmed', label: 'Confirmed' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'completed', label: 'Completed' },
];

const STATUS_INDEX: Record<string, number> = {
  requested: 0,
  accepted: 1,
  confirmed: 2,
  in_progress: 3,
  completed: 4,
  rejected: -1,
  cancelled: -1,
};

interface Props {
  status: OrderStatus;
  vendorName?: string;
}

export function OrderTimelineCard({ status, vendorName: _vendorName }: Props) {
  const currentIndex = STATUS_INDEX[status] ?? 0;
  const isCancelled = status === 'cancelled';
  const isRejected = status === 'rejected';

  if (isRejected) {
    return (
      <View style={styles.wrapper}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Progress</Text>
          <View style={styles.terminalRow}>
            <View style={[styles.terminalDot, styles.terminalDotRequested]}>
              <Check size={10} color="#fff" strokeWidth={3} />
            </View>
            <View style={[styles.connectorShort, styles.connectorError]} />
            <View style={[styles.terminalDot, styles.terminalDotError]}>
              <X size={10} color="#fff" strokeWidth={3} />
            </View>
            <View style={styles.terminalLabels}>
              <Text style={styles.terminalLabelRequested}>Requested</Text>
              <Text style={styles.terminalLabelError}>Declined</Text>
            </View>
          </View>
        </View>
      </View>
    );
  }

  if (isCancelled) {
    const cancelledAtIndex = currentIndex >= 0 ? currentIndex : 0;
    const stepsUntilCancel = LIFECYCLE_STEPS.slice(0, cancelledAtIndex + 1);

    return (
      <View style={styles.wrapper}>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Order Progress</Text>
          <View style={styles.stepsRow}>
            {stepsUntilCancel.map((step, index) => {
              const isDone = index < cancelledAtIndex;
              const isLast = index === stepsUntilCancel.length - 1;

              return (
                <React.Fragment key={step.status}>
                  <View style={styles.stepCol}>
                    <View style={[styles.stepDot, isDone ? styles.stepDotDone : styles.stepDotCancelled]}>
                      {isDone ? (
                        <Check size={10} color="#fff" strokeWidth={3} />
                      ) : (
                        <X size={10} color="#fff" strokeWidth={3} />
                      )}
                    </View>
                    <Text style={[styles.stepLabel, isDone ? styles.stepLabelDone : styles.stepLabelCancelled]} numberOfLines={1}>
                      {isLast ? 'Cancelled' : step.label}
                    </Text>
                  </View>
                  {index < stepsUntilCancel.length - 1 && (
                    <View style={[styles.connector, styles.connectorDone]} />
                  )}
                </React.Fragment>
              );
            })}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Order Progress</Text>
        <View style={styles.stepsRow}>
          {LIFECYCLE_STEPS.map((step, index) => {
            const isDone = index < currentIndex;
            const isActive = index === currentIndex;
            const isPending = index > currentIndex;

            return (
              <React.Fragment key={step.status}>
                <View style={styles.stepCol}>
                  <View
                    style={[
                      styles.stepDot,
                      isDone && styles.stepDotDone,
                      isActive && styles.stepDotActive,
                      isPending && styles.stepDotPending,
                    ]}
                  >
                    {isDone ? (
                      <Check size={10} color="#fff" strokeWidth={3} />
                    ) : isActive ? (
                      <View style={styles.activePulse} />
                    ) : null}
                  </View>
                  <Text
                    style={[
                      styles.stepLabel,
                      isDone && styles.stepLabelDone,
                      isActive && styles.stepLabelActive,
                      isPending && styles.stepLabelPending,
                    ]}
                    numberOfLines={1}
                  >
                    {step.label}
                  </Text>
                </View>
                {index < LIFECYCLE_STEPS.length - 1 && (
                  <View
                    style={[
                      styles.connector,
                      index < currentIndex ? styles.connectorDone : styles.connectorPending,
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600' as const,
    color: Colors.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  stepsRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  stepCol: {
    alignItems: 'center' as const,
    width: 52,
  },
  stepDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 6,
  },
  stepDotDone: {
    backgroundColor: Colors.success,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotPending: {
    backgroundColor: Colors.border,
    borderWidth: 1.5,
    borderColor: Colors.borderDark,
  },
  stepDotCancelled: {
    backgroundColor: Colors.error,
  },
  activePulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  stepLabel: {
    fontSize: 9,
    textAlign: 'center' as const,
    fontWeight: '500' as const,
  },
  stepLabelDone: {
    color: Colors.success,
  },
  stepLabelActive: {
    color: Colors.primary,
    fontWeight: '700' as const,
  },
  stepLabelPending: {
    color: Colors.textMuted,
  },
  stepLabelCancelled: {
    color: Colors.error,
    fontWeight: '600' as const,
  },
  connector: {
    flex: 1,
    height: 2,
    marginTop: 10,
    borderRadius: 1,
  },
  connectorDone: {
    backgroundColor: Colors.success,
  },
  connectorPending: {
    backgroundColor: Colors.border,
  },
  connectorError: {
    backgroundColor: Colors.error,
    flex: 1,
    height: 2,
    marginTop: 10,
    borderRadius: 1,
  },
  connectorShort: {
    width: 32,
    height: 2,
    marginTop: 10,
    borderRadius: 1,
  },
  terminalRow: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'center' as const,
  },
  terminalDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 6,
  },
  terminalDotRequested: {
    backgroundColor: Colors.success,
  },
  terminalDotError: {
    backgroundColor: Colors.error,
  },
  terminalLabels: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 4,
  },
  terminalLabelRequested: {
    fontSize: 9,
    color: Colors.success,
    fontWeight: '500' as const,
  },
  terminalLabelError: {
    fontSize: 9,
    color: Colors.error,
    fontWeight: '600' as const,
  },
});
