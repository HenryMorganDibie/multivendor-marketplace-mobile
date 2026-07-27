import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function PlacingAnOrder() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Placing an Order',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerTitleStyle: { color: Colors.text },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>Browse Vendor Catalogs</Text>
          <Text style={styles.paragraph}>
            Each vendor has a catalog of items with descriptions, prices, and images. Browse freely to see what&apos;s available.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Adding to Cart</Text>
          <Text style={styles.paragraph}>
            Tap an item to view details, select quantity, and add to your cart. Your cart is vendor-specific—items from different vendors stay in separate carts.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Submit Order Request</Text>
          <Text style={styles.paragraph}>
            Review your cart, add any special instructions, and submit your order request. The vendor will receive your order request and can accept or decline it.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>After Placing an Order</Text>
          <Text style={styles.paragraph}>
            Your order appears in the Chat tab as an order preview card. Use this chat to communicate with the vendor about your order. Track status updates and coordinate payment and fulfillment.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: 8,
  },
});
