import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useVendorNotifications } from '@/contexts/VendorNotificationContext';
import { useInbox } from '@/contexts/InboxContext';
import VendorTabBar from '@/components/navigation/VendorTabBar';

export default function VendorTabsLayout() {
  const { unreadHighPriorityCount } = useVendorNotifications();
  const inbox = useInbox();
  const unreadChatCount = inbox?.vendorUnreadCount ?? 0;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <VendorTabBar {...props} />}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'Orders',
          tabBarBadge: unreadHighPriorityCount > 0 ? unreadHighPriorityCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="receipt-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="catalog"
        options={{
          title: 'Catalog',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="grid-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: 'Messages',
          tabBarBadge: unreadChatCount > 0 ? unreadChatCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Account',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
