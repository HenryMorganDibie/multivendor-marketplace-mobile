import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function HowOrderingWorks() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'How Ordering Works',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>Browse Vendor Stores</Text>
          <Text style={styles.paragraph}>
            Customers browse vendor stores on theplatform. Each vendor has their own storefront with catalog items, prices, and descriptions. You can explore different categories and view detailed product information.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Message Before Ordering</Text>
          <Text style={styles.paragraph}>
            You can message vendors before placing an order. This is useful for asking questions, clarifying details, or discussing custom requests. Pre-order chat helps you make informed decisions.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Standard Orders vs Custom Orders</Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Standard Orders:</Text> Add items from the vendor&apos;s catalog to your cart, select quantity, and check out. The vendor receives your order and can accept or decline.
          </Text>
          <Text style={styles.paragraph}>
            <Text style={styles.bold}>Custom Orders:</Text> Vendors can create custom order proposals for you. These appear in chat as preview cards showing item count, estimated total, and a &quot;View custom order&quot; button.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Orders Appear in Chat</Text>
          <Text style={styles.paragraph}>
            When you place an order or receive a custom order proposal, it appears in your chat with the vendor as a preview card. Tap &quot;View order&quot; or &quot;View custom order&quot; to see full details, track status, and communicate about the order.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Order Lifecycle</Text>
          <Text style={styles.paragraph}>
            After placing an order, it starts as &quot;Pending&quot;. The vendor reviews and either accepts or declines. Once accepted, the order progresses through stages: In Progress → Completed.
          </Text>
          <Text style={styles.paragraph}>
            You&apos;ll receive notifications at each stage and can communicate with the vendor throughout the process.
          </Text>
        </View>

        <View style={styles.relatedSection}>
          <Text style={styles.relatedTitle}>Related articles</Text>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/custom-order' as any)}
          >
            <Text style={styles.relatedLinkText}>What is a custom order?</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/order-status' as any)}
          >
            <Text style={styles.relatedLinkText}>Order Status</Text>
          </TouchableOpacity>
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
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  heading: {
    fontSize: 20,
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
  bold: {
    fontWeight: '600' as const,
    color: '#fff',
  },
  relatedSection: {
    marginTop: 32,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#2a2a2a',
  },
  relatedTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  relatedLink: {
    paddingVertical: 12,
  },
  relatedLinkText: {
    fontSize: 15,
    color: '#0096FF',
  },
});
