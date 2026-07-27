import { useLocalSearchParams } from 'expo-router';
import CustomerOrderUpdateScreen from '@/features/orders/screens/CustomerOrderUpdateScreen';

export default function OrderUpdateRoute() {
  const { orderId } = useLocalSearchParams();
  return <CustomerOrderUpdateScreen orderId={orderId as string} />;
}
