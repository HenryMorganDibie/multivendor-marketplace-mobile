import { Stack } from 'expo-router';

export default function CustomerStoreLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerBackTitle: '',
      }}
    />
  );
}
