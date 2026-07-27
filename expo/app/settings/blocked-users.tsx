import React, { useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { ChevronLeft, User } from 'lucide-react-native';
import { useBlockedUsers, BlockedUser } from '@/contexts/BlockedUsersContext';
import { CircularAvatar, OrderConversationListItem } from '@/components/OrderConversationListItem';
import { Colors } from '@/constants/colors';
import { Alert } from '@/utils/alert';

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { blockedUsers, unblockUser } = useBlockedUsers();

  const confirmUnblock = useCallback((user: BlockedUser) => {
    Alert.alert(
      'Unblock this user?',
      'They will be able to message you or place orders again if allowed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: () => unblockUser(user.id),
        },
      ],
    );
  }, [unblockUser]);

  const handleRowPress = useCallback((user: BlockedUser) => {
    Alert.alert(
      user.name,
      'Blocked',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'default',
          onPress: () => confirmUnblock(user),
        },
      ],
    );
  }, [confirmUnblock]);

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => {
    return (
      <OrderConversationListItem
        avatarContent={<CircularAvatar name={item.name} />}
        primaryText={item.name}
        secondaryText="Blocked"
        timestamp=""
        onPress={() => handleRowPress(item)}
        onUnarchive={() => confirmUnblock(item)}
        isBlockedUsersScreen={true}
      />
    );
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <SafeAreaView edges={['top']} style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <ChevronLeft size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Blocked Users</Text>
            <View style={styles.headerSpacer} />
          </View>
        </SafeAreaView>

        {blockedUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <User size={56} color={Colors.textSecondary} strokeWidth={1.5} />
            <Text style={styles.emptyTitle}>No blocked users</Text>
            <Text style={styles.emptyDescription}>
              When you block someone, they’ll appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.listWrapper}>
            <FlatList
              data={blockedUsers}
              renderItem={renderBlockedUser}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            />
          </View>
        )}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.cardBorder,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: Colors.text,
    flex: 1,
    textAlign: 'center' as const,
    marginRight: 40,
  },
  headerSpacer: {
    width: 40,
  },
  listWrapper: {
    flex: 1,
  },
  listContent: {
    paddingVertical: 0,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 40,
    paddingBottom: 80,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: Colors.text,
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center' as const,
  },
  emptyDescription: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center' as const,
    lineHeight: 22,
  },
});
