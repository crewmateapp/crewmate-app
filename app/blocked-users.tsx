// app/blocked-users.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    onSnapshot,
    query,
    where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

type BlockedUser = {
  id: string;
  blockedUserId: string;
  blockedUserName: string;
  blockedUserPhoto: string | null;
  blockedUserPosition: string | null;
  blockedAt: any;
};

export default function BlockedUsersScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;

    const blockedQuery = query(
      collection(db, 'blockedUsers'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(blockedQuery, async (snapshot) => {
      const blocks: BlockedUser[] = [];

      for (const blockDoc of snapshot.docs) {
        const blockData = blockDoc.data();
        
        // Fetch blocked user's current profile data
        try {
          const blockedUserDoc = await getDoc(doc(db, 'users', blockData.blockedUserId));
          if (blockedUserDoc.exists()) {
            const blockedUserData = blockedUserDoc.data();
            blocks.push({
              id: blockDoc.id,
              blockedUserId: blockData.blockedUserId,
              blockedUserName: blockedUserData.displayName || 'Unknown User',
              blockedUserPhoto: blockedUserData.photoURL || null,
              blockedUserPosition: blockedUserData.position || null,
              blockedAt: blockData.blockedAt,
            });
          }
        } catch (error) {
          console.error('Error fetching blocked user data:', error);
        }
      }

      setBlockedUsers(blocks);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleUnblock = (blockedUser: BlockedUser) => {
    Alert.alert(
      'Unblock User',
      `Unblock ${blockedUser.blockedUserName}? They will be able to see your profile and contact you again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'blockedUsers', blockedUser.id));
              Alert.alert('Unblocked', `${blockedUser.blockedUserName} has been unblocked.`);
            } catch (error) {
              console.error('Error unblocking user:', error);
              Alert.alert('Error', 'Could not unblock user. Please try again.');
            }
          }
        }
      ]
    );
  };

  const renderBlockedUser = ({ item }: { item: BlockedUser }) => (
    <View style={[styles.userCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* User Info */}
      <View style={styles.userInfo}>
        {item.blockedUserPhoto ? (
          <Image source={{ uri: item.blockedUserPhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: colors.primary }]}>
            <ThemedText style={styles.avatarText}>
              {item.blockedUserName.charAt(0).toUpperCase()}
            </ThemedText>
          </View>
        )}

        <View style={styles.userDetails}>
          <ThemedText style={styles.userName}>{item.blockedUserName}</ThemedText>
          {item.blockedUserPosition && (
            <ThemedText style={[styles.userPosition, { color: colors.text.secondary }]}>
              {item.blockedUserPosition}
            </ThemedText>
          )}
        </View>
      </View>

      {/* Unblock Button */}
      <TouchableOpacity
        style={[styles.unblockButton, { borderColor: colors.error }]}
        onPress={() => handleUnblock(item)}
      >
        <ThemedText style={[styles.unblockText, { color: colors.error }]}>Unblock</ThemedText>
      </TouchableOpacity>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="shield-checkmark" size={80} color={colors.text.secondary} />
      <ThemedText style={styles.emptyTitle}>No Blocked Users</ThemedText>
      <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
        You haven't blocked anyone. Blocking prevents users from seeing your profile or contacting you.
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Blocked Users</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Info Banner */}
      {blockedUsers.length > 0 && (
        <View style={[styles.infoBanner, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
          <Ionicons name="information-circle" size={20} color={colors.primary} />
          <ThemedText style={[styles.infoText, { color: colors.primary }]}>
            Blocked users can't see your profile, send you messages, or view when you're on layover.
          </ThemedText>
        </View>
      )}

      {/* Blocked Users Count */}
      {blockedUsers.length > 0 && (
        <View style={styles.countContainer}>
          <ThemedText style={[styles.countText, { color: colors.text.secondary }]}>
            {blockedUsers.length} {blockedUsers.length === 1 ? 'user' : 'users'} blocked
          </ThemedText>
        </View>
      )}

      {/* Blocked Users List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={blockedUsers}
          renderItem={renderBlockedUser}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  infoText: {
    fontSize: 13,
    flex: 1,
    lineHeight: 18,
  },
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  userPosition: {
    fontSize: 14,
  },
  unblockButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  unblockText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
