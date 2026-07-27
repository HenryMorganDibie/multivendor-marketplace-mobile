import { Stack } from 'expo-router';

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: '' }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="search" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="vendors" />
      <Stack.Screen name="sections" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="category" />
      <Stack.Screen name="recently-viewed" />
      <Stack.Screen name="vendors-for-you" />
      <Stack.Screen name="vendors-near-you" />
      <Stack.Screen name="open-now" />
      <Stack.Screen name="all-vendors" />
      <Stack.Screen name="browse-food" />
      <Stack.Screen name="browse-electronics" />
      <Stack.Screen name="browse-services" />
      <Stack.Screen name="store" />
      <Stack.Screen name="help-center" />
    </Stack>
  );
}
