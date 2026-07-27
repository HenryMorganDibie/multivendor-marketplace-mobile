import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { ThemedTextInput } from '@/components/ThemedTextInput';
import { Stack, useRouter } from 'expo-router';
import { ChevronRight, Search, BookOpen, MessageSquare, ShoppingBag, CreditCard, Shield, Mail } from 'lucide-react-native';

interface HelpCategory {
  id: string;
  title: string;
  icon: any;
  route: string;
  description: string;
}

const helpCategories: HelpCategory[] = [
  { 
    id: '1', 
    title: 'How Ordering Works', 
    icon: BookOpen,
    route: '/help-center/how-ordering-works',
    description: 'Browse vendors and place orders'
  },
  { 
    id: '2', 
    title: 'Custom Orders', 
    icon: ShoppingBag,
    route: '/help-center/custom-order',
    description: 'Request custom items from vendors'
  },
  { 
    id: '3', 
    title: 'Payments & Safety', 
    icon: CreditCard,
    route: '/help-center/payment-safety',
    description: 'How payments work and tips'
  },
  { 
    id: '4', 
    title: 'Messaging Vendors Safely', 
    icon: MessageSquare,
    route: '/help-center/messaging-safely',
    description: 'Chat safely with vendors'
  },
  { 
    id: '5', 
    title: 'Order Status', 
    icon: ShoppingBag,
    route: '/help-center/order-status',
    description: 'Track your orders'
  },
  { 
    id: '6', 
    title: 'Contact Cards', 
    icon: Shield,
    route: '/help-center/contact-cards',
    description: 'View-once contact information'
  },
  { 
    id: '7', 
    title: 'Reporting a Problem', 
    icon: Shield,
    route: '/help-center/reporting-problem',
    description: 'Report issues or suspicious activity'
  },
  { 
    id: '8', 
    title: 'Contact Support', 
    icon: Mail,
    route: '/help-center/contact-support',
    description: 'Get help from our team'
  },
];

export default function CustomerHelpCenter() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState<string>('');

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Help Center',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerTitleStyle: { color: '#fff' },
          headerBackVisible: true,
        }}
      />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.subtitle}>How can we help?</Text>
        
        <View style={styles.searchContainer}>
          <Search size={18} color="#666" style={styles.searchIcon} />
          <ThemedTextInput
            style={styles.searchInput}
            placeholder="Search help articles"
            placeholderTextColor="#666"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <Text style={styles.sectionTitle}>Browse by topic</Text>
        
        <View style={styles.categoriesGrid}>
          {helpCategories.map((category) => {
            const IconComponent = category.icon;
            return (
              <TouchableOpacity
                key={category.id}
                style={styles.categoryCard}
                onPress={() => router.push(category.route as any)}
                activeOpacity={0.7}
              >
                <View style={styles.categoryIcon}>
                  <IconComponent size={24} color="#fff" />
                </View>
                <Text style={styles.categoryTitle}>{category.title}</Text>
                <Text style={styles.categoryDescription}>{category.description}</Text>
                <View style={styles.categoryArrow}>
                  <ChevronRight size={16} color="#666" />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  subtitle: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: '#fff',
    marginBottom: 20,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 32,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600' as const,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  categoriesGrid: {
    gap: 12,
  },
  categoryCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 20,
    position: 'relative',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#fff',
    marginBottom: 4,
  },
  categoryDescription: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
  },
  categoryArrow: {
    position: 'absolute',
    top: 20,
    right: 20,
  },
});
