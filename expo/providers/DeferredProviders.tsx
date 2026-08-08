import React, { type ReactNode, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Colors } from '@/constants/colors';
import { VendorProviders } from './VendorProviders';
import { CustomerProviders } from './CustomerProviders';
import { DiscoveryProviders } from './DiscoveryProviders';
import { ChatProviders } from './ChatProviders';
import { CustomerNotificationProvider } from '@/contexts/CustomerNotificationContext';
import { VendorRelationshipProvider } from '@/contexts/VendorRelationshipContext';
import { VendorFilterProvider } from '@/contexts/VendorFilterContext';
import { CustomerSupportChatProvider } from '@/contexts/CustomerSupportChatContext';
import { VendorSupportChatProvider } from '@/contexts/VendorSupportChatContext';
import { VendorDraftProvider } from '@/contexts/VendorDraftContext';

interface Props {
  children: ReactNode;
}

/**
 * Mounts Discovery + Chat providers immediately (needed for initial route render),
 * then defers the heavy Vendor + Customer trees (~28 providers) until after the
 * first frame so the Rork preview doesn't hit the 6000ms timeout.
 *
 * All notification providers (push, quiet-hours, etc.) live inside their
 * respective Vendor / Customer / Chat trees — no separate wrapper needed.
 */
function DeferredVendorCustomerProviders({ children }: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  /**
   * An empty backdrop for the one frame before the provider tree exists —
   * NOT `children`.
   *
   * Rendering children here (what this did originally) meant every screen
   * got one render pass with the entire Vendor/Customer provider tree
   * absent. `createContextHook` returns undefined outside its provider, so
   * any screen reading one of those ~28 contexts on first render crashed on
   * the destructure — `Cannot destructure property 'externalOrders' of
   * useExternalOrders(...) as it is undefined` — and took the whole screen
   * down to a blank white page. Confirmed live on Business Insights
   * (useExternalOrders) and vendor username selection (useVendorOnboarding),
   * and it was latent for any other screen touching a deferred context
   * during its first pass.
   *
   * The three providers hoisted into the eager tree below were each found
   * this same way, one crash at a time. Gating the children instead fixes
   * the whole class: no screen code runs until every provider it might read
   * is mounted. The deferral still does its job — provider construction
   * stays off the first frame, so the Rork preview's 6000ms budget is
   * unaffected — and the visible cost is a single frame of background
   * colour rather than a crash.
   */
  if (!mounted) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return (
    <VendorFilterProvider>
      <VendorProviders>
        <CustomerProviders>{children}</CustomerProviders>
      </VendorProviders>
    </VendorFilterProvider>
  );
}

export function DeferredProviders({ children }: Props) {
  return (
    <CustomerNotificationProvider>
      <VendorRelationshipProvider>
        <DiscoveryProviders>
        <ChatProviders>
          {/*
           * Support-chat providers are mounted eagerly (NOT deferred) because the
           * customer landing screen (chats) and vendor chats list consume them on
           * first render. Leaving them in the deferred Customer/Vendor trees made
           * the hooks return undefined during the initial frame, which crashed the
           * tree (black screen). They only use AsyncStorage, so early mount is cheap.
           */}
          <CustomerSupportChatProvider>
            <VendorSupportChatProvider>
              {/*
               * VendorDraftProvider is here for the same reason, found the same way.
               * The vendor chats list calls useVendorDrafts() on its first render, but
               * that provider lived in the deferred Vendor tree, which does not exist
               * on the first frame. Tapping through to Chat hid the problem because by
               * then the tree had mounted. Cold-loading straight onto the route (web
               * refresh, or a notification deep link on native) threw
               * "useVendorDrafts must be used within VendorDraftProvider" and took the
               * screen down.
               *
               * It consumes no other context and only touches AsyncStorage, so
               * mounting it eagerly costs nothing and keeps the deferral's benefit for
               * the ~28 providers that actually are heavy.
               */}
              <VendorDraftProvider>
                <DeferredVendorCustomerProviders>
                  {children}
                </DeferredVendorCustomerProviders>
              </VendorDraftProvider>
            </VendorSupportChatProvider>
          </CustomerSupportChatProvider>
        </ChatProviders>
      </DiscoveryProviders>
        </VendorRelationshipProvider>
    </CustomerNotificationProvider>
  );
}
