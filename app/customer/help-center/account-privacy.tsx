import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Stack } from 'expo-router';

export default function AccountPrivacyHelp() {
  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Account & Privacy',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={styles.heading}>Profile Management</Text>
          <Text style={styles.paragraph}>
            Manage your the platform account through the Profile tab. You can:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Update your display name</Text>
            <Text style={styles.bullet}>• Change your profile photo</Text>
            <Text style={styles.bullet}>• Manage saved contact cards</Text>
            <Text style={styles.bullet}>• Update password and security settings</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Notification Settings</Text>
          <Text style={styles.paragraph}>
            Control what notifications you receive:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Order status updates</Text>
            <Text style={styles.bullet}>• New messages from vendors</Text>
            <Text style={styles.bullet}>• Payment requests</Text>
            <Text style={styles.bullet}>• Promotional offers</Text>
          </View>
          <Text style={styles.paragraph}>
            Access notification settings from Profile → Settings → Notifications.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Data Handling</Text>
          <Text style={styles.paragraph}>
            the platform stores your profile information, order history, and chat messages to provide marketplace services.
          </Text>
          <Text style={styles.paragraph}>
            We do not sell your personal information to third parties. Your data is used only to facilitate transactions between you and vendors.
          </Text>
          <Text style={styles.paragraph}>
            Contact cards you send are encrypted and automatically deleted after order completion.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Blocking Vendors</Text>
          <Text style={styles.paragraph}>
            If you have a negative experience with a vendor, you can block them:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Open the vendor&apos;s profile</Text>
            <Text style={styles.bullet}>• Tap the menu icon (three dots)</Text>
            <Text style={styles.bullet}>• Select &quot;Block Vendor&quot;</Text>
          </View>
          <Text style={styles.paragraph}>
            Blocked vendors cannot message you or see your activity. Active orders will remain accessible, but no new orders can be placed with blocked vendors.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Managing Blocked Users</Text>
          <Text style={styles.paragraph}>
            View and manage your blocked vendors list:
          </Text>
          <Text style={styles.paragraph}>
            Profile → Settings → Privacy → Blocked Users
          </Text>
          <Text style={styles.paragraph}>
            You can unblock vendors at any time from this page.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Reporting Vendors</Text>
          <Text style={styles.paragraph}>
            If a vendor violates the platform policies, you can report them:
          </Text>
          <View style={styles.bulletList}>
            <Text style={styles.bullet}>• Open the vendor&apos;s profile</Text>
            <Text style={styles.bullet}>• Tap &quot;Report Vendor&quot;</Text>
            <Text style={styles.bullet}>• Select the reason and provide details</Text>
          </View>
          <Text style={styles.paragraph}>
            Our team will review reports and take appropriate action.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Account Deletion</Text>
          <Text style={styles.paragraph}>
            You can request account deletion at any time:
          </Text>
          <Text style={styles.paragraph}>
            Profile → Settings → Delete Account
          </Text>
          <Text style={styles.paragraph}>
            Deleting your account permanently removes your profile, order history, and chat messages. This action cannot be undone.
          </Text>
          <Text style={styles.paragraph}>
            Active orders must be completed or cancelled before account deletion.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.heading}>Privacy Questions</Text>
          <Text style={styles.paragraph}>
            For questions about data privacy, security, or account management, contact the platform Support through the Help Center or email support@theplatform.com.
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
    paddingBottom: 40,
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
