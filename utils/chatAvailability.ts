const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface ChatAvailability {
  isChatEnabled: boolean;
  isVendorInputDisabled: boolean;
  isCustomerInputDisabled: boolean;
  isCustomerRestrictedMode: boolean;
  vendorReason?: string;
  customerReason?: string;
  reason?: string;
}

// Backend Enforced Rule — UI Display Only
export function getChatAvailability(
  orderStatus: string,
  completedAt?: string
): ChatAvailability {
  if (orderStatus === 'cancelled') {
    return {
      isChatEnabled: true,
      isVendorInputDisabled: false,
      isCustomerInputDisabled: false,
      isCustomerRestrictedMode: false,
    };
  }

  if (orderStatus === 'completed') {
    return {
      isChatEnabled: true,
      isVendorInputDisabled: false,
      isCustomerInputDisabled: false,
      isCustomerRestrictedMode: false,
    };
  }

  if (orderStatus === 'requested') {
    return {
      isChatEnabled: true,
      isVendorInputDisabled: false,
      isCustomerInputDisabled: false,
      isCustomerRestrictedMode: false,
    };
  }

  return {
    isChatEnabled: true,
    isVendorInputDisabled: false,
    isCustomerInputDisabled: false,
    isCustomerRestrictedMode: false,
  };
}
