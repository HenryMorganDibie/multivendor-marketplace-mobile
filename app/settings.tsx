import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChevronRight, User, Image, Lock, Bell, MapPin, Shield, Trash2, Globe, HelpCircle, Share2 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { safeShare } from '@/utils/share';
import { useUserLocation } from '@/contexts/UserLocationContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { countryName, currencyCode, currencySymbol } = useUserLocation();

  const handleBackPress = () => {
    router.back();
  };

  const handleItemPress = (item: string) => {
    console.log('Settings item pressed:', item);
    
    switch (item) {
      case 'displayName':
        router.push('/settings/display-name' as any);
        break;
      case 'profilePhoto':
        router.push('/settings/profile-photo' as any);
        break;
      case 'password':
        router.push('/settings/password' as any);
        break;
      case 'notifications':
        router.push('/settings/notifications' as any);
        break;
      case 'contactCards':
        router.push('/settings/contact-cards' as any);
        break;
      case 'privacy':
        router.push('/settings/privacy' as any);
        break;
      case 'deleteAccount':
        router.push('/settings/delete-account' as any);
        break;
      case 'country':
        router.push('/settings/country' as any);
        break;
      case 'helpCenter':
        router.push('/help-center' as any);
        break;
      case 'inviteTothe platform':
        handleInviteTothe platform();
        break;
    }
  };

  const handleInviteTothe platform = async () => {
    try {
      const appLink = Platform.select({
        ios: 'https://apps.apple.com/app/the platform',
        android: 'https://play.google.com/store/apps/details?id=com.the platform.app',
        default: 'https://the platform.com/download',
      });

      const message = `I use the platform to order directly from businesses without marketplace markups or ads.\nDownload the app and register to start ordering.\n\n${appLink}`;

      await safeShare({
        message,
        title: 'the platform - Order directly from businesses',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBackPress} style={styles.headerButton}>
            <ArrowLeft size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('displayName')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <User size={20} color="#E0E0E0" />
                <Text style={styles.rowLabel}>Display Name</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('profilePhoto')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Image size={20} color="#E0E0E0" />
                <Text style={styles.rowLabel}>Profile Photo</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('password')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Lock size={20} color="#E0E0E0" />
                <Text style={styles.rowLabel}>Password & Security</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('notifications')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Bell size={20} color="#E0E0E0" />
                <Text style={styles.rowLabel}>Notifications</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>REGION</Text>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('country')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Globe size={20} color="#E0E0E0" />
                <View>
                  <Text style={styles.rowLabel}>Country & Currency</Text>
                  <Text style={styles.rowSubtitle}>{countryName} ({currencySymbol} {currencyCode})</Text>
                </View>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PRIVACY & DATA</Text>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('contactCards')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <MapPin size={20} color="#E0E0E0" />
                <Text style={styles.rowLabel}>Contact Card Presets</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('privacy')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Shield size={20} color="#E0E0E0" />
                <Text style={styles.rowLabel}>Privacy & Data</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('deleteAccount')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Trash2 size={20} color="#FF3B30" />
                <Text style={[styles.rowLabel, styles.deleteText]}>Delete Account</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SUPPORT</Text>
          <View style={styles.glassCard}>
            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('helpCenter')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <HelpCircle size={20} color="#E0E0E0" />
                <Text style={styles.rowLabel}>Help & Support</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>

            <View style={styles.rowDivider} />

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => handleItemPress('inviteTothe platform')}
              activeOpacity={0.7}
            >
              <View style={styles.rowLeft}>
                <Share2 size={20} color="#E0E0E0" />
                <Text style={styles.rowLabel}>Invite to the platform</Text>
              </View>
              <ChevronRight size={20} color="#666" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0A0A',
  },
  safeArea: {
    backgroundColor: '#0A0A0A',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#0A0A0A',
  },
  headerButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#666',
    letterSpacing: 0.5,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  glassCard: {
    backgroundColor: '#1C1C1E',
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  rowLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 12,
  },
  rowLabel: {
    fontSize: 17,
    color: '#FFFFFF',
    fontWeight: '400' as const,
  },
  rowDivider: {
    height: 1,
    backgroundColor: '#2C2C2E',
    marginLeft: 48,
  },
  deleteText: {
    color: '#FF3B30',
  },
  rowSubtitle: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
  },
  bottomSpacer: {
    height: 40,
  },
});
