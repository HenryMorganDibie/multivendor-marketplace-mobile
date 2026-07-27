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
void SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function NotificationHandler() {
  const router = useRouter();

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
    });

    return () => subscription.remove();
  }, [router]);

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
