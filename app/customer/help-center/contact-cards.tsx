import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function ContactCardsHelp() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Contact Cards',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>What Are Contact Cards?</Text>
          <Text style={styles.paragraph}>
            Contact cards are a secure way to share personal contact information (phone numbers, email addresses, social media handles) with vendors during an order.
          </Text>
          <Text style={styles.paragraph}>
            They&apos;re designed to protect your privacy while allowing necessary communication for order fulfillment.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>View-Once Behavior</Text>
          <Text style={styles.paragraph}>
            Contact cards are <Text style={styles.bold}>view-once</Text> messages. This means:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• The vendor can only view the card once</Text>
            <Text style={styles.bullet}>• After viewing, the card becomes a blurred placeholder</Text>
            <Text style={styles.bullet}>• The vendor cannot re-access the contact details</Text>
          </View>
          <Text style={styles.paragraph}>
            This encourages vendors to save important contact info immediately if they need it later.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Expiration After Order Completion</Text>
          <Text style={styles.paragraph}>
            Contact cards automatically expire when the order is completed or cancelled. After expiration:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• The card becomes permanently inaccessible</Text>
            <Text style={styles.bullet}>• Vendors cannot view it even if they haven&apos;t opened it yet</Text>
            <Text style={styles.bullet}>• Your information is no longer visible in chat history</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Screenshot Protection</Text>
          <Text style={styles.paragraph}>
            Screenshots are disabled when viewing contact cards. This adds an extra layer of privacy protection.
          </Text>
          <Text style={styles.paragraph}>
            However, vendors can manually copy or write down information, so only share contact details with vendors you trust.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>When to Use Contact Cards</Text>
          <Text style={styles.paragraph}>
            Contact cards are useful for:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Sharing delivery phone numbers</Text>
            <Text style={styles.bullet}>• Providing alternate contact methods</Text>
            <Text style={styles.bullet}>• Coordinating pickup logistics</Text>
            <Text style={styles.bullet}>• Emergency contact during order fulfillment</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Creating a Contact Card</Text>
          <Text style={styles.paragraph}>
            In the order chat, tap the attachment icon and select &quot;Contact Card&quot;. You can create a new card or select from saved cards in your profile.
          </Text>
          <Text style={styles.paragraph}>
            Once sent, the card appears as a view-once message bubble in the chat.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Privacy Best Practices</Text>
          <Text style={styles.paragraph}>
            Only share contact information when necessary for order fulfillment. Avoid including sensitive personal details unrelated to the transaction.
          </Text>
          <Text style={styles.paragraph}>
            If a vendor misuses your contact information, you can report them through their profile page.
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
  bold: {
    fontWeight: '600' as const,
    color: '#fff',
  },
  bulletList: {
    marginTop: 8,
    marginLeft: 8,
  },
  bullet: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 24,
  },
});
