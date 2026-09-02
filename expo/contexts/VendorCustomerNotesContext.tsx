import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface CustomerNote {
  customerId: string;
  vendorId: string;
  note: string;
  updatedAt: string;
}

interface NoteWithMeta {
  note: string;
  updatedAt: string | null;
}

interface VendorCustomerNotesContextType {
  getNote: (vendorId: string, customerId: string) => string;
  getNoteWithMeta: (vendorId: string, customerId: string) => NoteWithMeta;
  saveNote: (vendorId: string, customerId: string, note: string) => void;
}

const VendorCustomerNotesContext = createContext<VendorCustomerNotesContextType | undefined>(undefined);

const NOTES_KEY = '@platform_vendor_customer_notes';

export function VendorCustomerNotesProvider({ children }: { children: React.ReactNode }) {
  const [notes, setNotes] = useState<CustomerNote[]>([]);

  useEffect(() => {
    void loadNotes();
  }, []);

  const loadNotes = async () => {
    try {
      const data = await AsyncStorage.getItem(NOTES_KEY);
      if (data) {
        setNotes(JSON.parse(data));
      }
    } catch (error) {
      console.error('Error loading vendor customer notes:', error);
    }
  };

  const saveNotes = useCallback(async (updatedNotes: CustomerNote[]) => {
    try {
      await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(updatedNotes));
    } catch (error) {
      console.error('Error saving vendor customer notes:', error);
    }
  }, []);

  const getNote = useCallback((vendorId: string, customerId: string): string => {
    const note = notes.find(
      (n) => n.vendorId === vendorId && n.customerId === customerId
    );
    return note?.note || '';
  }, [notes]);

  const getNoteWithMeta = useCallback((vendorId: string, customerId: string): NoteWithMeta => {
    const found = notes.find(
      (n) => n.vendorId === vendorId && n.customerId === customerId
    );
    return { note: found?.note || '', updatedAt: found?.updatedAt || null };
  }, [notes]);

  const saveNote = useCallback((vendorId: string, customerId: string, note: string) => {
    setNotes((prev) => {
      const existing = prev.find(
        (n) => n.vendorId === vendorId && n.customerId === customerId
      );
      
      let updated: CustomerNote[];
      if (existing) {
        updated = prev.map((n) =>
          n.vendorId === vendorId && n.customerId === customerId
            ? { ...n, note, updatedAt: new Date().toISOString() }
            : n
        );
      } else {
        updated = [
          ...prev,
          {
            vendorId,
            customerId,
            note,
            updatedAt: new Date().toISOString(),
          },
        ];
      }
      
      void saveNotes(updated);
      return updated;
    });
  }, [saveNotes]);

  const value = useMemo(() => ({ getNote, getNoteWithMeta, saveNote }), [getNote, getNoteWithMeta, saveNote]);

  return (
    <VendorCustomerNotesContext.Provider value={value}>
      {children}
    </VendorCustomerNotesContext.Provider>
  );
}

export function useVendorCustomerNotes() {
  const context = useContext(VendorCustomerNotesContext);
  if (context === undefined) {
    throw new Error('useVendorCustomerNotes must be used within a VendorCustomerNotesProvider');
  }
  return context;
}
