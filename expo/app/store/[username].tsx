import React, { useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Store, ShieldOff, Ban } from 'lucide-react-native';
import { Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Colors } from '@/constants/colors';
import { useSafeBack } from '@/utils/useSafeBack';
import { useVendor as useVendorContext } from '@/contexts/VendorContext';
import { useVendor } from '@/data/hooks';
import { isVendorAccountBlocked } from '@/utils/vendorDiscovery';
import StorefrontScreen from '@/features/storefront/screens/StorefrontScreen';

function StoreNotFound({ username }: { username: string }) {
  const safeBack = useSafeBack();
  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
          <View style={styles.headerRight} />
        </View>
      </SafeAreaView>
      <View style={styles.notFoundContainer}>
        <View style={styles.notFoundIconContainer}>
          <Store size={48} color={Colors.textMuted} />
        </View>
        <Text style={styles.notFoundTitle}>Store not found</Text>
        <Text style={styles.notFoundSubtitle}>
          The store @{username} does not exist or may have been removed.
        </Text>
        <TouchableOpacity style={styles.notFoundButton} onPress={() => safeBack()} activeOpacity={0.8}>
          <Text style={styles.notFoundButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function BlockedStorefront({ vendorName, blockType }: { vendorName: string; blockType: 'SUSPENDED' | 'DEACTIVATED' }) {
  const safeBack = useSafeBack();
  const isSuspended = blockType === 'SUSPENDED';
  const Icon = isSuspended ? ShieldOff : Ban;
  const iconColor = isSuspended ? '#DC2626' : '#374151';
  const bgColor = isSuspended ? 'rgba(220,38,38,0.08)' : 'rgba(107,114,128,0.12)';
  const title = isSuspended
    ? 'This store is temporarily unavailable'
    : 'This store is no longer available on the platform';
  const message = isSuspended
    ? `${vendorName} is currently unavailable. Please contact support if you have an active order.`
    : `${vendorName} has been removed from theplatform. Please contact support if you have an active order.`;

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => safeBack()} style={styles.headerButton}>
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <View style={styles.notFoundContainer}>
        <View style={[styles.notFoundIconContainer, { backgroundColor: bgColor }]}>
          <Icon size={40} color={iconColor} strokeWidth={1.5} />
        </View>
        <Text style={styles.notFoundTitle}>{title}</Text>
        <Text style={styles.notFoundSubtitle}>{message}</Text>
        <TouchableOpacity style={styles.notFoundButton} onPress={() => safeBack()} activeOpacity={0.8}>
          <Text style={styles.notFoundButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function StoreRoute() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const vendorCtx = useVendorContext();

  const normalizedUsername = (username ?? '').trim().toLowerCase().replace(/^@/, '');
  const { data: resolvedVendor, isLoading: vendorLoading } = useVendor(normalizedUsername);

  const vendor = useMemo(() => {
    if (!resolvedVendor) return null;
    const contextVendor = vendorCtx?.vendor;
    if (contextVendor && resolvedVendor.username.toLowerCase() === contextVendor.username.toLowerCase()) {
      console.log('[STORE] Using context vendor for:', normalizedUsername);
      return contextVendor;
    }
    return resolvedVendor;
  }, [resolvedVendor, vendorCtx, normalizedUsername]);

  console.log('[STORE] Vendor storefront opened via username:', normalizedUsername);

  if (vendorLoading) {
    return (
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity style={styles.headerButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (!vendor) {
    return <StoreNotFound username={normalizedUsername} />;
  }

  // Blocked vendors (suspended/deactivated) — show blocked UI
  if (isVendorAccountBlocked(vendor)) {
    const blockType = vendor.vendorStatus === 'DEACTIVATED'
      ? 'DEACTIVATED' as const
      : 'SUSPENDED' as const;
    return <BlockedStorefront vendorName={vendor.name} blockType={blockType} />;
  }

  return <StorefrontScreen vendor={vendor} />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButton: {
    padding: 8,
  },
  headerRight: {
    width: 40,
  },
  notFoundContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 32,
  },
  notFoundIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.surface,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  notFoundTitle: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: Colors.text,
    marginBottom: 10,
    textAlign: 'center' as const,
  },
  notFoundSubtitle: {
    fontSize: 15,
    color: Colors.textMuted,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 32,
  },
  notFoundButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
  },
  notFoundButtonText: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.white,
  },
});
