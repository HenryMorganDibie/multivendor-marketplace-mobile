import React from 'react';
import { Tabs } from 'expo-router';
import CustomerTabBar from '@/components/navigation/CustomerTabBar';
import { Home, Search, MessageSquare, User } from 'lucide-react-native';
import { useInbox } from '@/contexts/InboxContext';

export default function CustomerTabsLayout() {
  const inbox = useInbox() as ReturnType<typeof useInbox> | undefined;
  const customerUnreadCount: number = inbox && typeof inbox.customerUnreadCount === 'number' ? inbox.customerUnreadCount : 0;
  console.log('[CustomerTabsLayout] inbox ready:', !!inbox, 'unread:', customerUnreadCount);

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <CustomerTabBar {...props} />}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          title: 'Explore',
          tabBarIcon: ({ color, size }) => (
            <Search size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      <Tabs.Screen
        name="chats"
        options={{
          title: 'Chats',
          tabBarBadge: customerUnreadCount > 0 ? customerUnreadCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <MessageSquare size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <User size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}
