import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { CheckCircle, XCircle, Clock, Circle } from 'lucide-react-native';
import { Colors } from '@/constants/colors';
import EditScreenHeader from '@/components/EditScreenHeader';

type ChangeAction = 'Approved' | 'Rejected' | 'Requested' | 'Pending';

type ChangeHistoryItem = {
  id: string;
  date: string;
  time: string;
  action: ChangeAction;
  methodType: string;
  detail: string;
};

const mockHistory: ChangeHistoryItem[] = [
  {
    id: '1',
    date: 'Dec 15, 2024',
    time: '2:41 PM',
    action: 'Approved',
    methodType: 'Bank Transfer',
    detail: 'GTBank ••••4321 approved as primary method',
  },
  {
    id: '2',
    date: 'Nov 28, 2024',
    time: '10:05 AM',
    action: 'Rejected',
    methodType: 'Card Payment',
    detail: 'Request declined — incomplete verification',
  },
  {
    id: '3',
    date: 'Nov 25, 2024',
    time: '4:18 PM',
    action: 'Requested',
    methodType: 'Card Payment',
    detail: 'Change request submitted for review',
  },
  {
    id: '4',
    date: 'Oct 10, 2024',
    time: '9:30 AM',
    action: 'Pending',
    methodType: 'Bank Transfer',
    detail: 'Awaiting admin review',
  },
];

const ACTION_CONFIG: Record<ChangeAction, { color: string; bg: string; label: string }> = {
  Approved: { color: Colors.success, bg: 'rgba(22, 163, 74, 0.1)', label: 'Approved' },
  Rejected: { color: Colors.error, bg: 'rgba(220, 38, 38, 0.1)', label: 'Rejected' },
  Requested: { color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.12)', label: 'Requested' },
  Pending: { color: Colors.textSecondary, bg: 'rgba(107, 114, 128, 0.12)', label: 'Pending' },
};

function TimelineIcon({ action }: { action: ChangeAction }) {
  const size = 18;
  switch (action) {
    case 'Approved':
      return <CheckCircle size={size} color={Colors.success} />;
    case 'Rejected':
      return <XCircle size={size} color={Colors.error} />;
    case 'Requested':
      return <Clock size={size} color="#F59E0B" />;
    case 'Pending':
      return <Circle size={size} color={Colors.textSecondary} />;
  }
}

export default function PaymentChangeHistoryScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView edges={['top']} style={styles.headerSafe}>
        <EditScreenHeader title="Change History" onBack={() => router.back()} showSave={false} />
      </SafeAreaView>
      <SafeAreaView edges={['bottom']} style={styles.safeArea}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {mockHistory.length > 0 ? (
            <View style={styles.timeline}>
              {mockHistory.map((item, index) => {
                const config = ACTION_CONFIG[item.action];
                const isLast = index === mockHistory.length - 1;
                return (
                  <View key={item.id} style={styles.timelineRow}>
                    <View style={styles.timelineLeft}>
                      <View style={[styles.iconCircle, { backgroundColor: config.bg }]}>
                        <TimelineIcon action={item.action} />
                      </View>
                      {!isLast && <View style={styles.timelineLine} />}
                    </View>

                    <View style={[styles.timelineCard, isLast && styles.timelineCardLast]}>
                      <View style={styles.cardHeader}>
                        <View style={styles.cardMeta}>
                          <Text style={styles.cardDate}>{item.date}</Text>
                          <Text style={styles.cardTime}>{item.time}</Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: config.bg }]}>
                          <Text style={[styles.badgeText, { color: config.color }]}>{config.label}</Text>
                        </View>
                      </View>

                      <Text style={styles.cardMethod}>{item.methodType}</Text>
                      <Text style={styles.cardDetail}>{item.detail}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Clock size={32} color={Colors.border} />
              <Text style={styles.emptyTitle}>No history yet</Text>
              <Text style={styles.emptySubtitle}>Payment method changes will appear here.</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerSafe: {
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  timeline: {
    gap: 0,
  },
  timelineRow: {
    flexDirection: 'row' as const,
    gap: 16,
  },
  timelineLeft: {
    alignItems: 'center' as const,
    width: 44,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: Colors.border,
    marginVertical: 4,
    minHeight: 20,
  },
  timelineCard: {
    flex: 1,
    paddingBottom: 24,
  },
  timelineCardLast: {
    paddingBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    justifyContent: 'space-between' as const,
    marginTop: 10,
    marginBottom: 6,
  },
  cardMeta: {
    gap: 2,
  },
  cardDate: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  cardTime: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  cardMethod: {
    fontSize: 15,
    fontWeight: '500' as const,
    color: Colors.text,
    marginBottom: 4,
  },
  cardDetail: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  emptyState: {
    paddingVertical: 64,
    alignItems: 'center' as const,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
  },
});
