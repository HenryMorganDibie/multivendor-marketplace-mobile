import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function OrderStatusHelp() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Order Status',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <Text style={styles.intro}>
          Orders go through several stages. Here&apos;s what each status means:
        </Text>

        <View style={styles.statusCard}>
          <View style={[styles.badge, styles.pendingBadge]}>
            <Text style={styles.badgeText}>PENDING</Text>
          </View>
          <Text style={styles.statusDescription}>
            Your order has been submitted and is waiting for the vendor to review and accept it. The vendor may contact you via chat if they have questions.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={[styles.badge, styles.acceptedBadge]}>
            <Text style={styles.badgeText}>ACCEPTED</Text>
          </View>
          <Text style={styles.statusDescription}>
            The vendor has accepted your order and will begin preparing it. You can track progress and communicate via the order chat.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={[styles.badge, styles.inProgressBadge]}>
            <Text style={styles.badgeText}>IN PROGRESS</Text>
          </View>
          <Text style={styles.statusDescription}>
            Your order is being actively prepared. The vendor is working on your items. Payment requests may be sent during this stage.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={[styles.badge, styles.completedBadge]}>
            <Text style={styles.badgeText}>COMPLETED</Text>
          </View>
          <Text style={styles.statusDescription}>
            Your order is complete and ready for pickup or has been delivered. The vendor has marked it as fulfilled. The order chat will remain accessible for a short time after completion.
          </Text>
        </View>

        <View style={styles.statusCard}>
          <View style={[styles.badge, styles.cancelledBadge]}>
            <Text style={styles.badgeText}>CANCELLED</Text>
          </View>
          <Text style={styles.statusDescription}>
            This order was cancelled by either you or the vendor. If payment was made, coordinate refunds directly with the vendor.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  intro: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 24,
  },
  statusCard: {
    backgroundColor: '#1a1a1a',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 12,
  },
  pendingBadge: {
    backgroundColor: '#FFB800',
  },
  acceptedBadge: {
    backgroundColor: '#0096FF',
  },
  inProgressBadge: {
    backgroundColor: '#9C6ADE',
  },
  completedBadge: {
    backgroundColor: '#00C853',
  },
  cancelledBadge: {
    backgroundColor: '#666',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: '#000',
    letterSpacing: 0.5,
  },
  statusDescription: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
  },
});
