import createContextHook from '@nkzw/create-context-hook';
import { useState, useCallback, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useMutation } from '@tanstack/react-query';

export type CustomOrderProposalState =
  | 'DRAFT'
  | 'PROPOSAL_SENT'
  | 'ORDER_REQUESTED';

export type OrderRequestState =
  | 'ORDER_REQUESTED'
  | 'CONFIRMED'
  | 'READY'
  | 'COMPLETED'
  | 'CANCELLED';

export interface CustomOrderItem {
  id: string;
  name: string;
  description?: string;
  note?: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CustomOrderProposal {
  id: string;
  chatId: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorSlug: string;
  state: CustomOrderProposalState;
  items: CustomOrderItem[];
  fulfillmentMethod?: 'pickup' | 'delivery';
  preferredDate?: string;
  preferredTime?: string;
  orderNote?: string;
  subtotal: number;
  taxAmount?: number;
  total: number;
  createdAt: string;
  updatedAt: string;
  sentAt?: string;
  linkedOrderRequestId?: string;
}

export interface OrderRequest {
  id: string;
  publicOrderId: string;
  proposalId: string;
  chatId: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorSlug: string;
  state: OrderRequestState;
  items: CustomOrderItem[];
  subtotal: number;
  taxAmount?: number;
  total: number;
  paymentStatus: 'unpaid' | 'partially_paid' | 'paid';
  createdAt: string;
  updatedAt: string;
}

export interface ChatControl {
  chatId: string;
  muted: boolean;
  muteUntil?: string | 'completed' | 'indefinite';
  archived: boolean;
  messagesBlocked: boolean;
  bookingsBlocked: boolean;
}

export const [CustomOrderProvider, useCustomOrders] = createContextHook(() => {
  const [proposals, setProposals] = useState<CustomOrderProposal[]>([]);
  const [orderRequests, setOrderRequests] = useState<OrderRequest[]>([]);
  const [chatControls, setChatControls] = useState<Record<string, ChatControl>>({});

  const proposalsQuery = useQuery({
    queryKey: ['customOrderProposals'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem('customOrderProposals');
      return stored ? JSON.parse(stored) : [];
    }
  });

  const orderRequestsQuery = useQuery({
    queryKey: ['customOrderRequests'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem('customOrderRequests');
      return stored ? JSON.parse(stored) : [];
    }
  });

  const chatControlsQuery = useQuery({
    queryKey: ['chatControls'],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem('chatControls');
      return stored ? JSON.parse(stored) : {};
    }
  });

  const proposalsData = proposalsQuery.data;
  const orderRequestsData = orderRequestsQuery.data;
  const chatControlsData = chatControlsQuery.data;
  const initializedRef = useRef({ proposals: false, orderRequests: false, chatControls: false });

  useEffect(() => {
    if (proposalsData && !initializedRef.current.proposals) {
      initializedRef.current.proposals = true;
      setProposals(proposalsData);
    }
  }, [proposalsData]);

  useEffect(() => {
    if (orderRequestsData && !initializedRef.current.orderRequests) {
      initializedRef.current.orderRequests = true;
      setOrderRequests(orderRequestsData);
    }
  }, [orderRequestsData]);

  useEffect(() => {
    if (chatControlsData && !initializedRef.current.chatControls) {
      initializedRef.current.chatControls = true;
      setChatControls(chatControlsData);
    }
  }, [chatControlsData]);

  const { mutate: syncProposals } = useMutation({
    mutationFn: async (updated: CustomOrderProposal[]) => {
      await AsyncStorage.setItem('customOrderProposals', JSON.stringify(updated));
      return updated;
    }
  });

  const { mutate: syncOrderRequests } = useMutation({
    mutationFn: async (requests: OrderRequest[]) => {
      await AsyncStorage.setItem('customOrderRequests', JSON.stringify(requests));
      return requests;
    }
  });

  const { mutate: syncChatControls } = useMutation({
    mutationFn: async (controls: Record<string, ChatControl>) => {
      await AsyncStorage.setItem('chatControls', JSON.stringify(controls));
      return controls;
    }
  });

  const createProposal = useCallback((proposalId: string, chatId: string, customerName: string, vendorId: string, vendorSlug: string) => {
    const newProposal: CustomOrderProposal = {
      id: proposalId,
      chatId,
      customerId: `customer-${chatId}`,
      customerName,
      vendorId,
      vendorSlug,
      state: 'DRAFT',
      items: [],
      subtotal: 0,
      total: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [...proposals, newProposal];
    setProposals(updated);
    syncProposals(updated);
    return newProposal;
  }, [proposals, syncProposals]);

  const updateProposal = useCallback((proposalId: string, updates: Partial<CustomOrderProposal>) => {
    const updated = proposals.map(proposal =>
      proposal.id === proposalId
        ? { ...proposal, ...updates, updatedAt: new Date().toISOString() }
        : proposal
    );
    setProposals(updated);
    syncProposals(updated);
  }, [proposals, syncProposals]);

  const deleteProposal = useCallback((proposalId: string) => {
    const updated = proposals.filter(p => p.id !== proposalId);
    setProposals(updated);
    syncProposals(updated);
  }, [proposals, syncProposals]);

  const sendProposal = useCallback((proposalId: string) => {
    console.log('[CustomOrder] Vendor sending proposal to customer:', proposalId);
    const updated = proposals.map(proposal =>
      proposal.id === proposalId
        ? { ...proposal, state: 'PROPOSAL_SENT' as CustomOrderProposalState, sentAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        : proposal
    );
    setProposals(updated);
    syncProposals(updated);
  }, [proposals, syncProposals]);

  const recallProposal = useCallback((proposalId: string) => {
    console.log('[CustomOrder] Vendor recalling proposal back to DRAFT:', proposalId);
    const updated = proposals.map(proposal =>
      proposal.id === proposalId
        ? { ...proposal, state: 'DRAFT' as CustomOrderProposalState, updatedAt: new Date().toISOString() }
        : proposal
    );
    setProposals(updated);
    syncProposals(updated);
  }, [proposals, syncProposals]);

  const acceptProposal = useCallback((proposalId: string) => {
    console.log('[CustomOrder] Customer accepting proposal:', proposalId);
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) {
      console.error('[CustomOrder] Cannot accept: proposal not found');
      return null;
    }
    if (proposal.state !== 'PROPOSAL_SENT') {
      console.warn('[CustomOrder] Cannot accept: proposal is not in PROPOSAL_SENT state');
      return null;
    }

    const timestamp = Date.now();
    const randomPart = Math.floor(10000000 + Math.random() * 90000000);
    const publicOrderId = `${proposal.vendorSlug.toLowerCase()}-${randomPart}`;

    const orderRequest: OrderRequest = {
      id: `order-${timestamp}`,
      publicOrderId,
      proposalId: proposal.id,
      chatId: proposal.chatId,
      customerId: proposal.customerId,
      customerName: proposal.customerName,
      vendorId: proposal.vendorId,
      vendorSlug: proposal.vendorSlug,
      state: 'ORDER_REQUESTED',
      items: proposal.items,
      subtotal: proposal.subtotal,
      taxAmount: proposal.taxAmount,
      total: proposal.total,
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedRequests = [...orderRequests, orderRequest];
    setOrderRequests(updatedRequests);
    syncOrderRequests(updatedRequests);

    const updatedProposals = proposals.map(p =>
      p.id === proposalId
        ? { ...p, state: 'ORDER_REQUESTED' as CustomOrderProposalState, linkedOrderRequestId: orderRequest.id, updatedAt: new Date().toISOString() }
        : p
    );
    setProposals(updatedProposals);
    syncProposals(updatedProposals);

    console.log('[CustomOrder] Order request created:', orderRequest.id, 'Public ID:', publicOrderId);
    return orderRequest;
  }, [proposals, orderRequests, syncOrderRequests, syncProposals]);

  const rejectProposal = useCallback((proposalId: string) => {
    console.log('[CustomOrder] Customer rejecting proposal, returning to DRAFT:', proposalId);
    const updated = proposals.map(proposal =>
      proposal.id === proposalId
        ? { ...proposal, state: 'DRAFT' as CustomOrderProposalState, sentAt: undefined, updatedAt: new Date().toISOString() }
        : proposal
    );
    setProposals(updated);
    syncProposals(updated);
  }, [proposals, syncProposals]);

  const convertProposalToOrderRequest = useCallback((proposalId: string) => {
    console.warn('[CustomOrder] convertProposalToOrderRequest is deprecated. Use acceptProposal instead.');
    return acceptProposal(proposalId);
  }, [acceptProposal]);

  const muteChat = useCallback((chatId: string, until: string | 'completed' | 'indefinite') => {
    const updated = {
      ...chatControls,
      [chatId]: {
        ...chatControls[chatId],
        chatId,
        muted: true,
        muteUntil: until,
        archived: chatControls[chatId]?.archived || false,
        messagesBlocked: chatControls[chatId]?.messagesBlocked || false,
        bookingsBlocked: chatControls[chatId]?.bookingsBlocked || false,
      }
    };
    setChatControls(updated);
    syncChatControls(updated);
  }, [chatControls, syncChatControls]);

  const unmuteChat = useCallback((chatId: string) => {
    const updated = {
      ...chatControls,
      [chatId]: {
        ...chatControls[chatId],
        chatId,
        muted: false,
        muteUntil: undefined,
      }
    };
    setChatControls(updated);
    syncChatControls(updated);
  }, [chatControls, syncChatControls]);

  const archiveChat = useCallback((chatId: string, archived: boolean) => {
    const updated = {
      ...chatControls,
      [chatId]: {
        ...chatControls[chatId],
        chatId,
        archived,
        muted: chatControls[chatId]?.muted || false,
        messagesBlocked: chatControls[chatId]?.messagesBlocked || false,
        bookingsBlocked: chatControls[chatId]?.bookingsBlocked || false,
      }
    };
    setChatControls(updated);
    syncChatControls(updated);
  }, [chatControls, syncChatControls]);

  const blockMessages = useCallback((chatId: string, blocked: boolean) => {
    const updated = {
      ...chatControls,
      [chatId]: {
        ...chatControls[chatId],
        chatId,
        messagesBlocked: blocked,
        muted: chatControls[chatId]?.muted || false,
        archived: chatControls[chatId]?.archived || false,
        bookingsBlocked: chatControls[chatId]?.bookingsBlocked || false,
      }
    };
    setChatControls(updated);
    syncChatControls(updated);
  }, [chatControls, syncChatControls]);

  const blockBookings = useCallback((chatId: string, blocked: boolean) => {
    const updated = {
      ...chatControls,
      [chatId]: {
        ...chatControls[chatId],
        chatId,
        bookingsBlocked: blocked,
        muted: chatControls[chatId]?.muted || false,
        archived: chatControls[chatId]?.archived || false,
        messagesBlocked: chatControls[chatId]?.messagesBlocked || false,
      }
    };
    setChatControls(updated);
    syncChatControls(updated);
  }, [chatControls, syncChatControls]);

  return {
    proposals,
    orderRequests,
    chatControls,
    createProposal,
    updateProposal,
    deleteProposal,
    sendProposal,
    recallProposal,
    acceptProposal,
    rejectProposal,
    convertProposalToOrderRequest,
    muteChat,
    unmuteChat,
    archiveChat,
    blockMessages,
    blockBookings,
    isLoading: proposalsQuery.isLoading || orderRequestsQuery.isLoading || chatControlsQuery.isLoading,
  };
});
