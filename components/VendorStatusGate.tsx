import React, { createContext, useContext } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ShieldOff, Ban, Clock3 } from 'lucide-react-native';
import { useSafeBack } from '@/utils/useSafeBack';
import { Colors } from '@/constants/colors';

export type VendorStatus = 'ACTIVE' | 'UNVERIFIED' | 'WAITLISTED' | 'SUSPENDED' | 'DEACTIVATED';

export interface VendorStatusPermissions {
  canViewStorefront: boolean;
  canChat: boolean;
  canAddToCart: boolean;
  canSubmitOrder: boolean;
  canCreateCustomOrder: boolean;
  canAccessAI: boolean;
  canMakePayment: boolean;
  isBlocked: boolean;
  blockType: 'WAITLISTED' | 'SUSPENDED' | 'DEACTIVATED' | null;
  vendorStatus: VendorStatus;
}

export function normalizeVendorStatus(raw?: string): VendorStatus {
  switch (raw) {
    case 'ACTIVE':
    case 'active':
    case 'verified':
      return 'ACTIVE';
    case 'UNVERIFIED':
    case 'registered':
      return 'UNVERIFIED';
    case 'WAITLISTED':
    case 'waitlisted':
      return 'WAITLISTED';
    case 'SUSPENDED':
    case 'suspended':
      return 'SUSPENDED';
    case 'DEACTIVATED':
    case 'deactivated':
      return 'DEACTIVATED';
    default:
      return 'ACTIVE';
  }
}

export function getVendorStatusPermissions(status: VendorStatus): VendorStatusPermissions {
  switch (status) {
    case 'ACTIVE':
      return {
        canViewStorefront: true,
        canChat: true,
        canAddToCart: true,
        canSubmitOrder: true,
        canCreateCustomOrder: true,
        canAccessAI: true,
        canMakePayment: true,
        isBlocked: false,
        blockType: null,
        vendorStatus: 'ACTIVE',
      };
    case 'UNVERIFIED':
      return {
        canViewStorefront: true,
        canChat: true,
        canAddToCart: false,
        canSubmitOrder: false,
        canCreateCustomOrder: false,
        canAccessAI: false,
        canMakePayment: false,
        isBlocked: false,
        blockType: null,
        vendorStatus: 'UNVERIFIED',
      };
    case 'WAITLISTED':
      return {
        canViewStorefront: false,
        canChat: false,
        canAddToCart: false,
        canSubmitOrder: false,
        canCreateCustomOrder: false,
        canAccessAI: false,
        canMakePayment: false,
        isBlocked: true,
        blockType: 'WAITLISTED',
        vendorStatus: 'WAITLISTED',
      };
    case 'SUSPENDED':
      return {
        canViewStorefront: false,
        canChat: false,
        canAddToCart: false,
        canSubmitOrder: false,
        canCreateCustomOrder: false,
        canAccessAI: false,
        canMakePayment: false,
        isBlocked: true,
        blockType: 'SUSPENDED',
        vendorStatus: 'SUSPENDED',
      };
    case 'DEACTIVATED':
      return {
        canViewStorefront: false,
        canChat: false,
        canAddToCart: false,
        canSubmitOrder: false,
        canCreateCustomOrder: false,
        canAccessAI: false,
        canMakePayment: false,
        isBlocked: true,
        blockType: 'DEACTIVATED',
        vendorStatus: 'DEACTIVATED',
      };
  }
}

const VendorStatusContext = createContext<VendorStatusPermissions | null>(null);

export function useVendorStatusPermissions(): VendorStatusPermissions {
  const ctx = useContext(VendorStatusContext);
  if (!ctx) {
    console.warn('[VendorStatusGate] useVendorStatusPermissions used outside VendorStatusGate — defaulting to ACTIVE');
    return getVendorStatusPermissions('ACTIVE');
  }
  return ctx;
}

type BlockType = 'WAITLISTED' | 'SUSPENDED' | 'DEACTIVATED';

const BLOCK_CONFIG: Record<BlockType, {
  Icon: React.ComponentType<{ size: number; color: string; strokeWidth: number }>;
  iconColor: string;
  bgColor: string;
  title: string;
  message: string;
  accentColor: string;
}> = {
  WAITLISTED: {
    Icon: Clock3,
    iconColor: '#B45309',
    bgColor: 'rgba(245,158,11,0.12)',
    title: 'This store is not yet active on the platform.',
    message: 'This vendor has not yet launched their store.\nCheck back later or explore other vendors.',
    accentColor: '#F59E0B',
  },
  SUSPENDED: {
    Icon: ShieldOff,
    iconColor: '#DC2626',
    bgColor: 'rgba(220,38,38,0.08)',
    title: 'This store is temporarily unavailable.',
    message: 'This vendor is currently unavailable on the platform.\nPlease contact support if you have an active order.',
    accentColor: '#DC2626',
  },
  DEACTIVATED: {
    Icon: Ban,
    iconColor: '#374151',
    bgColor: 'rgba(107,114,128,0.12)',
    title: 'This store is no longer available on the platform.',
    message: 'This vendor has been removed from the platform.\nPlease contact support if you have an active order.',
    accentColor: '#6B7280',
  },
};

function BlockedStorefront({ blockType }: { blockType: BlockType }) {
  const safeBack = useSafeBack();
  const config = BLOCK_CONFIG[blockType];
  const { Icon, iconColor, bgColor, title, message, accentColor } = config;

  console.log('[VendorStatusGate] Rendering blocked storefront:', blockType);

  return (
    <View style={blockStyles.container}>
      <SafeAreaView edges={['top']} style={blockStyles.safeArea}>
        <View style={blockStyles.header}>
          <TouchableOpacity
            onPress={() => safeBack()}
            style={blockStyles.headerButton}
            activeOpacity={0.7}
          >
            <ChevronLeft size={24} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <View style={blockStyles.content}>
        <View style={[blockStyles.iconWrap, { backgroundColor: bgColor }]}>
          <Icon size={40} color={iconColor} strokeWidth={1.5} />
        </View>
        <Text style={blockStyles.title}>{title}</Text>
        <Text style={blockStyles.message}>{message}</Text>
        <TouchableOpacity
          style={[blockStyles.button, { borderColor: accentColor }]}
          onPress={() => safeBack()}
          activeOpacity={0.8}
        >
          <Text style={[blockStyles.buttonText, { color: accentColor }]}>Go Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

interface VendorStatusGateProps {
  vendorStatus: VendorStatus;
  vendorName?: string;
  children: React.ReactNode;
}

export default function VendorStatusGate({ vendorStatus, vendorName, children }: VendorStatusGateProps) {
  const permissions = getVendorStatusPermissions(vendorStatus);

  console.log('[VendorStatusGate] status:', vendorStatus, '| blocked:', permissions.isBlocked, '| vendor:', vendorName ?? '—');

  if (permissions.isBlocked && permissions.blockType) {
    return <BlockedStorefront blockType={permissions.blockType} />;
  }

  return (
    <VendorStatusContext.Provider value={permissions}>
      {children}
    </VendorStatusContext.Provider>
  );
}

const blockStyles = StyleSheet.create({
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
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  headerButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
    textAlign: 'center' as const,
    lineHeight: 26,
    marginBottom: 12,
  },
  message: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
    marginBottom: 32,
  },
  button: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
