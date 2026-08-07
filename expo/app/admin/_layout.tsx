import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: '' }}>
      <Stack.Screen name="moderation" />
      <Stack.Screen name="audit-logs" />
    </Stack>
  );
}
