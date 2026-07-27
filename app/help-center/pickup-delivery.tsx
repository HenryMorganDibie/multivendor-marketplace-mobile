import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function PickupDeliveryHelp() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Pickup & Delivery',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.charcoal,
          headerTitleStyle: { color: Colors.text },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>Pickup vs Delivery</Text>
          <Text style={styles.paragraph}>
            Vendors can offer pickup, delivery, or both. When placing an order, you&apos;ll select your preferred fulfillment method if multiple options are available.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Pickup:</Text> You collect the order from the vendor&apos;s location at an agreed time.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Delivery:</Text> The vendor brings the order to your specified address.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>When Pickup Details Are Shown</Text>
          <Text style={styles.paragraph}>
            Pickup information becomes visible once the vendor marks your order as ready. This includes:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Pickup address</Text>
            <Text style={styles.bullet}>• Special instructions (gate codes, parking, etc.)</Text>
            <Text style={styles.bullet}>• Vendor contact information</Text>
            <Text style={styles.bullet}>• Operating hours or pickup window</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Vendor-Controlled Pickup Instructions</Text>
          <Text style={styles.paragraph}>
            Each vendor sets their own pickup details. These may include specific directions, preferred pickup times, or requirements like showing ID or order confirmation.
          </Text>
          <Text style={styles.paragraph}>
            If you have questions about pickup, use the order chat to contact the vendor directly.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Delivery Details</Text>
          <Text style={styles.paragraph}>
            For delivery orders, you&apos;ll provide your address when submitting your order request. The vendor will coordinate delivery timing with you via the order chat.
          </Text>
          <Text style={styles.paragraph}>
            Delivery fees, minimum order amounts, and delivery zones vary by vendor.
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
  bold: {
    fontWeight: '600' as const,
    color: Colors.text,
  },
  bulletList: {
    marginTop: 8,
    marginLeft: 8,
  },
  bullet: {
    fontSize: 15,
    color: Colors.textMuted,
    lineHeight: 24,
  },
});
