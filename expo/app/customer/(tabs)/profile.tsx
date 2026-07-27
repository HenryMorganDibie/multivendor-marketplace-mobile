import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ChevronRight,
  ShoppingBag,
  Heart,
  Settings,
  LogOut,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import LaektivaModal from '@/components/LaektivaModal';
import { useAuth } from '@/contexts/AuthContext';
import { formatCustomerDisplayName } from '@/utils/formatCustomerName';
import { Colors } from '@/constants/colors';

interface MenuRowProps {
  icon: React.ReactNode;
  iconBg?: string;
  label: string;
  subtitle?: string;
  onPress: () => void;
  showDivider?: boolean;
  destructive?: boolean;
}

function MenuRow({
  icon,
  iconBg,
  label,
  subtitle,
  onPress,
  showDivider = true,
  destructive = false,
}: MenuRowProps) {
  return (
    <>
      <TouchableOpacity
        style={styles.settingsRow}
        onPress={onPress}
        activeOpacity={0.55}
      >
        <View
          style={[
            styles.rowIconWrap,
            iconBg ? { backgroundColor: iconBg } : null,
            destructive && styles.rowIconWrapDestructive,
          ]}
        >
          {icon}
        </View>
        <View style={styles.rowTextWrap}>
          <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>
            {label}
          </Text>
          {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
        </View>
        {!destructive && (
          <ChevronRight size={15} color={Colors.textMuted} strokeWidth={2.5} />
        )}
      </TouchableOpacity>
      {showDivider && <View style={styles.rowDivider} />}
    </>
  );
}

export default function CustomerProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const displayName =
    formatCustomerDisplayName(user?.firstName, user?.lastName) ||
    user?.identifier ||
    'Customer';

  const getInitials = (): string => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
    }
    if (user?.firstName) {
      return user.firstName.substring(0, 2).toUpperCase();
    }
    if (displayName && displayName !== 'Customer') {
      return displayName.substring(0, 2).toUpperCase();
    }
    return 'ME';
  };

  const handleItemPress = (item: string) => {
    switch (item) {
      case 'orders':
        router.push('/orders' as any);
        break;
      case 'favorites':
        router.push('/favorites' as any);
        break;
      case 'settings':
        router.push('/settings' as any);
        break;
      case 'logout':
        setShowLogoutModal(true);
        break;
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(false);
    void logout();
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Profile</Text>
        </View>
      </SafeAreaView>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Avatar Hero ── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarRing}>
            <View style={styles.avatarInner}>
              <Text style={styles.initialsText}>{getInitials()}</Text>
            </View>
          </View>
          <Text style={styles.displayName}>{displayName}</Text>
          {user?.identifier && user.identifier !== displayName && (
            <View style={styles.identifierPill}>
              <Text style={styles.identifierText}>{user.identifier}</Text>
            </View>
          )}
          <TouchableOpacity
            style={styles.editProfileButton}
            onPress={() => router.push('/settings/profile' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.editProfileLabel}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* ── Account ── */}
        <Text style={styles.sectionLabel}>ACCOUNT</Text>
        <View style={styles.menuCard}>
          <MenuRow
            icon={<ShoppingBag size={16} color={Colors.primary} strokeWidth={2} />}
            label="Orders"
            subtitle="View your order history"
            onPress={() => handleItemPress('orders')}
          />
          <MenuRow
            icon={<Heart size={16} color="#E5484D" strokeWidth={2} />}
            iconBg="rgba(229,72,77,0.07)"
            label="Favorites"
            subtitle="Vendors you've saved"
            onPress={() => handleItemPress('favorites')}
          />
          <MenuRow
            icon={<Settings size={16} color={Colors.textSecondary} strokeWidth={2} />}
            iconBg={Colors.surface}
            label="Settings"
            subtitle="Account & preferences"
            onPress={() => handleItemPress('settings')}
            showDivider={false}
          />
        </View>

        {/* ── Session ── */}
        <Text style={[styles.sectionLabel, { marginTop: 22 }]}>SESSION</Text>
        <View style={styles.menuCard}>
          <MenuRow
            icon={<LogOut size={16} color={Colors.error} strokeWidth={2} />}
            label="Log Out"
            onPress={() => handleItemPress('logout')}
            showDivider={false}
            destructive
          />
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <LaektivaModal
        visible={showLogoutModal}
        title="Log Out"
        message="Are you sure you want to log out?"
        primaryButton={{ label: 'Log Out', onPress: handleLogout }}
        secondaryButton={{ label: 'Cancel', onPress: () => setShowLogoutModal(false) }}
        destructive
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.backgroundCanvas,
  },
  safeArea: {
    backgroundColor: Colors.backgroundCanvas,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    lineHeight: 34,
    letterSpacing: -0.5,
    color: Colors.text,
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 20 },

  // ── Avatar ──
  avatarSection: {
    alignItems: 'center' as const,
    paddingTop: 24,
    paddingBottom: 28,
  },
  avatarRing: {
    width: 92,
    height: 92,
    borderRadius: 46,
    padding: 3,
    backgroundColor: Colors.primarySoft,
    marginBottom: 13,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.20,
        shadowRadius: 14,
      },
      android: { elevation: 5 },
    }),
  },
  avatarInner: {
    flex: 1,
    borderRadius: 44,
    backgroundColor: Colors.primaryTint,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    borderWidth: 1.5,
    borderColor: 'rgba(255,122,40,0.15)',
  },
  initialsText: {
    fontSize: 30,
    fontWeight: '700' as const,
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  displayName: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  identifierPill: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    marginBottom: 12,
  },
  identifierText: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '400' as const,
    letterSpacing: 0.1,
  },
  editProfileButton: {
    marginTop: 4,
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: Colors.primary,
    backgroundColor: 'transparent',
  },
  editProfileLabel: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: Colors.primary,
    letterSpacing: -0.1,
  },

  // ── Sections ──
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700' as const,
    color: Colors.textTertiary,
    letterSpacing: 1.0,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  menuCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    overflow: 'hidden' as const,
    borderWidth: 1,
    borderColor: Colors.borderSoft,
    ...Platform.select({
      ios: {
        shadowColor: Colors.black,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
      },
      android: { elevation: 1 },
    }),
  },
  settingsRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingVertical: 13,
    paddingHorizontal: 16,
    gap: 13,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 9,
    backgroundColor: Colors.primarySofter,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    flexShrink: 0,
  },
  rowIconWrapDestructive: {
    backgroundColor: Colors.errorLight,
  },
  rowTextWrap: { flex: 1 },
  rowLabel: {
    fontSize: 15,
    color: Colors.text,
    fontWeight: '500' as const,
    letterSpacing: -0.1,
  },
  rowLabelDestructive: { color: Colors.error },
  rowSubtitle: {
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1.5,
    fontWeight: '400' as const,
  },
  rowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.borderSoft,
    marginLeft: 63,
  },
  bottomSpacer: { height: 100 },
});
