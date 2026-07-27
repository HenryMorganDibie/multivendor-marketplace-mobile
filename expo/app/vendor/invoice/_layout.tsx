import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';

export default function VendorInvoiceLayout() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: '',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.charcoal,
        headerShadowVisible: false,
      }}
    />
  );
}
