import { Stack, useRouter } from 'expo-router';
import { TouchableOpacity } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

export default function VendorRatingsLayout() {
  const router = useRouter();

  return (
    <Stack
      screenOptions={{
        headerBackTitle: '',
        headerStyle: { backgroundColor: Colors.background },
        headerTintColor: Colors.charcoal,
        headerShadowVisible: false,
        headerTitleAlign: 'center',
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ padding: 4, marginLeft: -4 }}
            activeOpacity={0.7}
          >
            <ChevronLeft size={28} color={Colors.charcoal} />
          </TouchableOpacity>
        ),
      }}
    />
  );
}
