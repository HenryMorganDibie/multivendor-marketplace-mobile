import { CustomOrderProposal, OrderRequest, CustomOrderItem, CustomOrderProposalState, OrderRequestState } from '@/contexts/CustomOrderContext';

export interface CreateProposalParams {
  chatId: string;
  customerId: string;
  customerName: string;
  vendorId: string;
  vendorSlug: string;
}

export interface UpdateProposalParams {
  state?: CustomOrderProposalState;
  items?: CustomOrderItem[];
  fulfillmentMethod?: 'pickup' | 'delivery';
  preferredDate?: string;
  preferredTime?: string;
  orderNote?: string;
  subtotal?: number;
  taxAmount?: number;
  total?: number;
  sentAt?: string;
}

let proposals: CustomOrderProposal[] = [];
let orderRequests: OrderRequest[] = [];

export const customOrderService = {
  async getAllProposals(): Promise<CustomOrderProposal[]> {
    return [...proposals];
  },

  async getProposalById(proposalId: string): Promise<CustomOrderProposal | undefined> {
    return proposals.find(p => p.id === proposalId);
  },

  async getProposalsByChat(chatId: string): Promise<CustomOrderProposal[]> {
    return proposals.filter(p => p.chatId === chatId);
  },

  async createProposal(params: CreateProposalParams): Promise<CustomOrderProposal> {
    const newProposal: CustomOrderProposal = {
      id: `proposal-${Date.now()}`,
      chatId: params.chatId,
      customerId: params.customerId,
      customerName: params.customerName,
      vendorId: params.vendorId,
      vendorSlug: params.vendorSlug,
      state: 'DRAFT',
      items: [],
      subtotal: 0,
      total: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    proposals = [...proposals, newProposal];
    console.log('[CustomOrderService] Created proposal:', newProposal.id);
    return newProposal;
  },

  async updateProposal(proposalId: string, updates: UpdateProposalParams): Promise<CustomOrderProposal | null> {
    const proposalIndex = proposals.findIndex(p => p.id === proposalId);
    if (proposalIndex === -1) {
      console.error('[CustomOrderService] Proposal not found:', proposalId);
      return null;
    }

    proposals = proposals.map(p => 
      p.id === proposalId 
        ? { ...p, ...updates, updatedAt: new Date().toISOString() } 
        : p
    );

    console.log('[CustomOrderService] Updated proposal:', proposalId);
    return proposals[proposalIndex];
  },

  async deleteProposal(proposalId: string): Promise<boolean> {
    const initialLength = proposals.length;
    proposals = proposals.filter(p => p.id !== proposalId);
    const deleted = proposals.length < initialLength;
    
    if (deleted) {
      console.log('[CustomOrderService] Deleted proposal:', proposalId);
    }
    return deleted;
  },

  async convertToOrderRequest(proposalId: string): Promise<OrderRequest | null> {
    const proposal = proposals.find(p => p.id === proposalId);
    if (!proposal) {
      console.error('[CustomOrderService] Proposal not found:', proposalId);
      return null;
    }

    const timestamp = Date.now();
    const dateStr = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const randomPart = Math.floor(10000000 + Math.random() * 90000000);
    const publicOrderId = `${proposal.vendorSlug.toLowerCase()}-${dateStr}-${randomPart}`;

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

    orderRequests = [...orderRequests, orderRequest];
    await this.deleteProposal(proposalId);

    console.log('[CustomOrderService] Converted proposal to order request:', orderRequest.id);
    return orderRequest;
  },

  async getAllOrderRequests(): Promise<OrderRequest[]> {
    return [...orderRequests];
  },

  async getOrderRequestById(orderId: string): Promise<OrderRequest | undefined> {
    return orderRequests.find(o => o.id === orderId);
  },

  async updateOrderRequest(orderId: string, updates: Partial<OrderRequest>): Promise<OrderRequest | null> {
    const orderIndex = orderRequests.findIndex(o => o.id === orderId);
    if (orderIndex === -1) {
      console.error('[CustomOrderService] Order request not found:', orderId);
      return null;
    }

    orderRequests = orderRequests.map(o => 
      o.id === orderId 
        ? { ...o, ...updates, updatedAt: new Date().toISOString() } 
        : o
    );

    console.log('[CustomOrderService] Updated order request:', orderId);
    return orderRequests[orderIndex];
  },

  async updateOrderRequestState(orderId: string, state: OrderRequestState): Promise<OrderRequest | null> {
    return this.updateOrderRequest(orderId, { state });
  },
};
