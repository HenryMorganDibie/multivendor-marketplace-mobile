import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function PlacingOrderHelp() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Placing an Order',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>How to Browse Vendors</Text>
          <Text style={styles.paragraph}>
            Browse vendors on the Home tab. You can explore different categories, view vendor profiles, and see their catalog items. Each vendor displays their items with images, descriptions, and prices.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Adding Items to Cart</Text>
          <Text style={styles.paragraph}>
            Tap any catalog item to view its details. Select quantity, add any notes, and tap &quot;Add to Cart&quot;. Your cart is vendor-specific — items from different vendors will be in separate carts.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Custom Orders</Text>
          <Text style={styles.paragraph}>
            Not all orders come from a catalog. You can request custom items by chatting with a vendor. If the vendor agrees, they&apos;ll create a Custom Order Proposal for you to review and accept.
          </Text>
          <Text style={styles.paragraph}>
            Custom orders let you request items that aren&apos;t in the vendor&apos;s catalog, specify special requirements, or negotiate pricing.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>When an Order Becomes Active</Text>
          <Text style={styles.paragraph}>
            After you place an order, it starts as &quot;Pending&quot;. The vendor will review it and either accept or decline.
          </Text>
          <Text style={styles.paragraph}>
            Once accepted, your order becomes active and the vendor will begin preparing it. You&apos;ll receive notifications at each stage of the order lifecycle.
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
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 12,
  },
  paragraph: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 22,
    marginBottom: 8,
  },
});
