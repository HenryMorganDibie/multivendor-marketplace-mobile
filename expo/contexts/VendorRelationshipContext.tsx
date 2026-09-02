import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Vendor } from '@/mocks/vendorData';
import { vendorService } from '@/services/vendorService';

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

  /**
   * The vendors behind the recorded relationships.
   *
   * The relationship list itself is local and correctly so: "vendors I have
   * ordered from or messaged" belongs to the device. What was wrong is where
   * the vendor records came from. The ids are real, produced by real orders and
   * conversations, but they were being matched against the mock vendor array,
   * so a real id matched nothing and this always returned an empty list.
   *
   * Vendors are now resolved through the repository, which reads Firestore.
   * They are held in state so the signature stays synchronous, since the home
   * screen calls this during render.
   */
  const [relatedVendors, setRelatedVendors] = useState<Vendor[]>([]);

  useEffect(() => {
    let active = true;
    const ids = Array.from(new Set(relationships.map(r => r.vendorId)));
    if (ids.length === 0) {
      setRelatedVendors([]);
      return;
    }
    Promise.all(ids.map(id => vendorService.getById(id)))
      .then(found => {
        if (!active) return;
        // A vendor that has since been deactivated or hidden resolves to
        // nothing, and is dropped rather than shown as a broken row.
        setRelatedVendors(found.filter((v): v is Vendor => Boolean(v)));
      })
      .catch(error => {
        console.error('[VendorRelationship] Could not resolve related vendors:', error);
        if (active) setRelatedVendors([]);
      });
    return () => { active = false; };
  }, [relationships]);

  const getRelatedVendors = useCallback((): Vendor[] => relatedVendors, [relatedVendors]);

  return {
    relationships,
    addRelationship,
    hasRelationship,
    getRelatedVendors,
    isLoading: relationshipsQuery.isLoading,
  };
});
