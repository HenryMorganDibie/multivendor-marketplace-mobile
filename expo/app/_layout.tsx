import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as Notifications from "expo-notifications";
import React, { useEffect } from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { trpc, trpcClient } from "@/lib/trpc";
import { AuthProviders } from "@/providers/AuthProviders";
import { DeferredProviders } from "@/providers/DeferredProviders";
import AlertProvider from "@/components/AlertProvider";
import { isAbandonedCartNotification } from "@/contexts/AbandonedCartContext";
import { isAppointmentReminderNotification } from "@/contexts/AppointmentReminderContext";
import { useAuth } from "@/contexts/AuthContext";
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

/**
 * Real backend push payloads (sendPushNotification, notificationFunctions.ts)
 * carry `data: { deepLink, notificationId }`, with deepLink in the form
 * `the platform://chat/{chatId}` — chat message pushes, pickup-details-ready
 * pushes, and new-inquiry pushes all use this. Nothing here ever inspected
 * it, so tapping any real chat push did nothing. The dominant real chatId
 * shape is `commerce_{customerId}_{vendorId}` (createCommerceConversation.ts),
 * which is parsed below to route a customer to the existing canonical chat
 * screen. Vendor-side deep links route to /vendor/chats/{chatId} — that
 * screen's [orderId] param doubles as a thread id via its
 * `chats.find(c => c.id === orderId)` fallback (see that screen), so it
 * opens the right customer thread even without a real order id.
 */
function handleChatDeepLink(deepLink: string, role: string | undefined, router: ReturnType<typeof useRouter>): boolean {
  const prefix = 'the platform://chat/';
  if (!deepLink.startsWith(prefix)) return false;
  const chatId = deepLink.slice(prefix.length);

  if (chatId.startsWith('commerce_')) {
    const rest = chatId.slice('commerce_'.length);
    const separatorIndex = rest.indexOf('_');
    if (separatorIndex > 0) {
      const vendorId = rest.slice(separatorIndex + 1);
      if (role === 'vendor') {
        router.push(`/vendor/chats/${chatId}` as any);
        return true;
      }
      if (vendorId) {
        router.push(`/chat/${vendorId}` as any);
        return true;
      }
    }
  }

  // Unrecognized chatId shape (support/ai threads, etc.) — route to the
  // right list rather than doing nothing.
  router.push((role === 'vendor' ? '/vendor/(tabs)/chats' : '/customer/(tabs)/chats') as any);
  return true;
}

/**
 * verification_approved/rejected and catalog_item_approved/rejected
 * (createNotificationInternal, domain: "system") carry a real app route as
 * their deepLink — `the platform://vendor/settings/verification`,
 * `the platform://vendor/catalog` — rather than a chat id. These fired the push
 * and appeared in the in-app list correctly, but tapping the OS notification
 * did nothing, since only handleChatDeepLink ever inspected `data.deepLink`.
 * Routes generically off the path after `the platform://` so any future
 * non-chat deepLink of this shape is handled without another code change.
 */
function handleAppDeepLink(deepLink: string, router: ReturnType<typeof useRouter>): boolean {
  const prefix = 'the platform://';
  if (!deepLink.startsWith(prefix)) return false;
  const path = deepLink.slice(prefix.length);
  if (!path || path.startsWith('chat/')) return false;
  router.push(`/${path}` as any);
  return true;
}

function NotificationHandler() {
  const router = useRouter();
  const { user } = useAuth();

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      console.log('[NotificationHandler] Notification tapped, data:', data);

      if (isAbandonedCartNotification(data)) {
        console.log('[NotificationHandler] Abandoned cart tap, navigating to global-cart for vendor:', data.vendorId);
        router.push('/global-cart' as any);
        return;
      }

      if (isAppointmentReminderNotification(data)) {
        console.log('[NotificationHandler] Appointment reminder tap, orderId:', data.orderId, 'type:', data.type);
        if (data.type === 'appointment_reminder_vendor') {
          router.push(`/vendor/orders/${data.orderId}` as any);
        } else {
          router.push(`/order/${data.orderId}` as any);
        }
        return;
      }

      const deepLink = typeof data?.deepLink === 'string' ? data.deepLink : undefined;
      if (deepLink && handleChatDeepLink(deepLink, user?.role, router)) {
        console.log('[NotificationHandler] Chat deep link handled:', deepLink);
        return;
      }

      if (deepLink && handleAppDeepLink(deepLink, router)) {
        console.log('[NotificationHandler] App deep link handled:', deepLink);
        return;
      }
    });

    return () => subscription.remove();
  }, [router, user?.role]);

  return null;
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "" }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
      <Stack.Screen name="create-account" />
      <Stack.Screen name="register" />
      <Stack.Screen name="register/customer" />
      <Stack.Screen name="register/vendor" />
      <Stack.Screen name="verify-otp" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="role-error" />
      <Stack.Screen name="customer" />
      <Stack.Screen name="vendor" />
      <Stack.Screen name="admin" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="onboarding-customer" />
      <Stack.Screen name="onboarding-vendor" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void SplashScreen.hideAsync();
    
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        input, textarea {
          outline: none !important;
          border: none !important;
        }
        input:focus, textarea:focus {
          outline: none !important;
          border: none !important;
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <AuthProviders>
          <DeferredProviders>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <AlertProvider>
                <NotificationHandler />
                <RootLayoutNav />
              </AlertProvider>
            </GestureHandlerRootView>
          </DeferredProviders>
        </AuthProviders>
      </QueryClientProvider>
    </trpc.Provider>
  );
}
