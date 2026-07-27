import { Stack } from 'expo-router';

export default function VendorLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="growth-insights" 
        options={{
    headerShown: false,
    presentation: 'card',
  }}
        />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="pending" />
      <Stack.Screen name="archived-chats" />
      <Stack.Screen name="catalog" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="chats" />
      <Stack.Screen name="custom-order" />
      <Stack.Screen name="customer-orders" />
      <Stack.Screen name="invoice" />
      <Stack.Screen name="orders" />
      <Stack.Screen name="ratings" />
      <Stack.Screen name="receipt" />
      <Stack.Screen name="send-payment-request" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="storefront-preview" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
