import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Stack, useRouter } from 'expo-router';

export default function ReportingProblem() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Reporting a Problem',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>Technical Issues</Text>
          <Text style={styles.paragraph}>
            If you&apos;re experiencing technical problems with the the platform app:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• App crashes or freezes</Text>
            <Text style={styles.bullet}>• Features not working properly</Text>
            <Text style={styles.bullet}>• Issues with notifications</Text>
            <Text style={styles.bullet}>• Problems loading vendor stores</Text>
          </View>
          <Text style={styles.paragraph}>
            Contact the platform Support through the Contact Support page with details about the issue, including your device type and what you were doing when the problem occurred.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Suspicious Vendors</Text>
          <Text style={styles.paragraph}>
            Report vendors who:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Send inappropriate messages</Text>
            <Text style={styles.bullet}>• Request payment outside the platform guidelines</Text>
            <Text style={styles.bullet}>• Misrepresent products or services</Text>
            <Text style={styles.bullet}>• Fail to fulfill confirmed orders</Text>
            <Text style={styles.bullet}>• Violate the platform policies</Text>
          </View>
          <Text style={styles.paragraph}>
            To report a vendor:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>1. Open the vendor&apos;s profile</Text>
            <Text style={styles.bullet}>2. Tap the menu icon (three dots)</Text>
            <Text style={styles.bullet}>3. Select &quot;Report Vendor&quot;</Text>
            <Text style={styles.bullet}>4. Choose the reason for reporting</Text>
            <Text style={styles.bullet}>5. Provide additional details</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Order Issues</Text>
          <Text style={styles.paragraph}>
            If you have problems with an order:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• First, try to resolve the issue with the vendor via order chat</Text>
            <Text style={styles.bullet}>• Keep records of all communication and agreements</Text>
            <Text style={styles.bullet}>• If unresolved, report the vendor through their profile</Text>
          </View>
          <Text style={styles.paragraph}>
            Common order issues:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Vendor not responding</Text>
            <Text style={styles.bullet}>• Wrong items received</Text>
            <Text style={styles.bullet}>• Order not completed as agreed</Text>
            <Text style={styles.bullet}>• Pricing disputes</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Contact Support</Text>
          <Text style={styles.paragraph}>
            For issues that require the platform team assistance:
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/customer/help-center/contact-support' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.buttonText}>Go to Contact Support</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>What Happens After Reporting</Text>
          <Text style={styles.paragraph}>
            When you report a vendor or submit a support request:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Our team reviews your report</Text>
            <Text style={styles.bullet}>• We may contact you for additional information</Text>
            <Text style={styles.bullet}>• Action is taken based on policy violations</Text>
            <Text style={styles.bullet}>• You&apos;ll be notified of the outcome when appropriate</Text>
          </View>
          <Text style={styles.paragraph}>
            Reports are taken seriously and help keep the the platform community safe.
          </Text>
        </View>

        <View style={styles.relatedSection}>
          <Text style={styles.relatedTitle}>Related articles</Text>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/messaging-safely' as any)}
          >
            <Text style={styles.relatedLinkText}>Messaging vendors safely</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.relatedLink}
            onPress={() => router.push('/customer/help-center/account-privacy' as any)}
          >
            <Text style={styles.relatedLinkText}>Account & Privacy</Text>
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
  bulletList: {
    marginTop: 8,
    marginLeft: 8,
  },
  bullet: {
    fontSize: 15,
    color: '#ccc',
    lineHeight: 24,
  },
  button: {
    backgroundColor: '#0096FF',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  buttonText: {
    fontSize: 16,
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
