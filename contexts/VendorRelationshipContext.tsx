import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { mockVendors, Vendor } from '@/mocks/vendorData';

const STORAGE_KEY = 'platform_vendor_relationships';

export interface VendorRelationship {
  vendorId: string;
  createdAt: string;
  reason: 'cart_created' | 'order_submitted' | 'order_completed';
}

export const [VendorRelationshipProvider, useVendorRelationships] = createContextHook(() => {
  const queryClient = useQueryClient();
  const [relationships, setRelationships] = useState<VendorRelationship[]>([]);

  const relationshipsQuery = useQuery({
    queryKey: ['vendor-relationships'],
    queryFn: async () => {
      console.log('[VENDOR_REL] Loading relationships from storage');
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const parsed: VendorRelationship[] = stored ? JSON.parse(stored) : [];
      console.log('[VENDOR_REL] Loaded relationships:', parsed.length);
      return parsed;
    },
  });

  useEffect(() => {
    if (relationshipsQuery.data) {
      setRelationships(relationshipsQuery.data);
    }
  }, [relationshipsQuery.data]);

  const persistMutation = useMutation({
    mutationFn: async (updated: VendorRelationship[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['vendor-relationships'], data);
    },
  });

  const { mutate: persistRelationships } = persistMutation;

  const addRelationship = useCallback((vendorId: string, reason: VendorRelationship['reason']) => {
    const exists = relationships.some(r => r.vendorId === vendorId);
    if (exists) {
      console.log('[VENDOR_REL] Relationship already exists for vendor:', vendorId);
      return;
    }

    console.log('[VENDOR_REL] Adding relationship for vendor:', vendorId, 'reason:', reason);
    const newRel: VendorRelationship = {
      vendorId,
      createdAt: new Date().toISOString(),
      reason,
    };
    const updated = [...relationships, newRel];
    setRelationships(updated);
    persistRelationships(updated);
  }, [relationships, persistRelationships]);

  const hasRelationship = useCallback((vendorId: string): boolean => {
    return relationships.some(r => r.vendorId === vendorId);
  }, [relationships]);

  const getRelatedVendors = useCallback((): Vendor[] => {
    const relatedIds = new Set(relationships.map(r => r.vendorId));
    return mockVendors.filter(v => relatedIds.has(v.id));
  }, [relationships]);

  return {
    relationships,
    addRelationship,
    hasRelationship,
    getRelatedVendors,
    isLoading: relationshipsQuery.isLoading,
  };
});
