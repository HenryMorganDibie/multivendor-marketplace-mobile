import { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { auth } from '@/lib/firebase';

export interface ContactCard {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  note?: string;
}

interface ContactCardsContextType {
  cards: ContactCard[];
  addCard: (card: Omit<ContactCard, 'id'>) => void;
  updateCard: (id: string, card: Omit<ContactCard, 'id'>) => void;
  deleteCard: (id: string) => void;
  getCardById: (id: string) => ContactCard | undefined;
}

const ContactCardsContext = createContext<ContactCardsContextType | undefined>(undefined);

const CONTACT_CARDS_STORAGE_KEY_PREFIX = '@platform_contact_cards';
const contactCardsStorageKey = (uid: string) => `${CONTACT_CARDS_STORAGE_KEY_PREFIX}:${uid}`;

/**
 * These are saved name/phone/address entries — real customer PII, the exact
 * kind of data Phase 3's `users/{uid}/contactCards/{cardId}` collection
 * spec calls "the most security-sensitive collection in Phase 3," owner-only
 * with no exceptions. This was stored under one device-global AsyncStorage
 * key with no uid in it at all: Customer B signing in after Customer A
 * signed out on the same device would see A's saved names/phone
 * numbers/addresses, and any card B added while A's list was still loaded
 * (before this fix) would have merged into the same shared key. Still not
 * the real Firestore-backed, per-user collection the spec describes — that
 * would need a full backend migration — but at minimum it no longer leaks
 * across accounts on a shared device.
 */
export function ContactCardsProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<ContactCard[]>([]);
  const currentUidRef = useRef<string | null>(null);

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged((fbUser) => {
      const uid = fbUser?.uid ?? null;
      if (uid === currentUidRef.current) return;
      currentUidRef.current = uid;
      setCards([]);
      if (uid) void loadCards(uid);
    });
    return unsubscribe;
  }, []);

  const loadCards = async (uid: string) => {
    try {
      console.log('[CONTACT_CARDS] Loading contact cards from device storage');
      const stored = await AsyncStorage.getItem(contactCardsStorageKey(uid));
      if (currentUidRef.current !== uid) return; // identity moved on again before this resolved
      if (stored) {
        const parsed = JSON.parse(stored);
        setCards(parsed);
        console.log('[CONTACT_CARDS] Loaded', parsed.length, 'cards from device');
      } else {
        console.log('[CONTACT_CARDS] No stored cards found');
      }
    } catch (error) {
      console.error('[CONTACT_CARDS] Failed to load cards:', error);
    }
  };

  const saveCards = async (updatedCards: ContactCard[]) => {
    const uid = currentUidRef.current;
    if (!uid) return;
    try {
      await AsyncStorage.setItem(contactCardsStorageKey(uid), JSON.stringify(updatedCards));
      console.log('[CONTACT_CARDS] Saved', updatedCards.length, 'cards to device');
    } catch (error) {
      console.error('[CONTACT_CARDS] Failed to save cards:', error);
    }
  };

  const addCard = (card: Omit<ContactCard, 'id'>) => {
    const newCard: ContactCard = {
      ...card,
      id: `card-${Date.now()}`,
    };
    const updatedCards = [...cards, newCard];
    setCards(updatedCards);
    saveCards(updatedCards);
    console.log('[CONTACT_CARDS] Added new card:', newCard.label);
  };

  const updateCard = (id: string, card: Omit<ContactCard, 'id'>) => {
    const updatedCards = cards.map((c) => (c.id === id ? { ...card, id } : c));
    setCards(updatedCards);
    saveCards(updatedCards);
    console.log('[CONTACT_CARDS] Updated card:', id);
  };

  const deleteCard = (id: string) => {
    const updatedCards = cards.filter((c) => c.id !== id);
    setCards(updatedCards);
    saveCards(updatedCards);
    console.log('[CONTACT_CARDS] Deleted card:', id);
  };

  const getCardById = (id: string) => {
    return cards.find((c) => c.id === id);
  };

  return (
    <ContactCardsContext.Provider
      value={{ cards, addCard, updateCard, deleteCard, getCardById }}
    >
      {children}
    </ContactCardsContext.Provider>
  );
}

export function useContactCards() {
  const context = useContext(ContactCardsContext);
  if (!context) {
    throw new Error('useContactCards must be used within ContactCardsProvider');
  }
  return context;
}
