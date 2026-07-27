import { Stack } from 'expo-router';
import { Colors } from '@/constants/colors';
//test
export default function CustomerCategoryLayout() {
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
