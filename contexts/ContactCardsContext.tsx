import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const CONTACT_CARDS_STORAGE_KEY = '@the platform_contact_cards';

export function ContactCardsProvider({ children }: { children: ReactNode }) {
  const [cards, setCards] = useState<ContactCard[]>([]);

  useEffect(() => {
    loadCards();
  }, []);

  const loadCards = async () => {
    try {
      console.log('[CONTACT_CARDS] Loading contact cards from device storage');
      const stored = await AsyncStorage.getItem(CONTACT_CARDS_STORAGE_KEY);
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
    try {
      await AsyncStorage.setItem(CONTACT_CARDS_STORAGE_KEY, JSON.stringify(updatedCards));
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
