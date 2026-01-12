import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type Friend = {
  id: string;
  connectionDocId: string;
  userId: string;
  displayName: string;
  airline: string;
  base: string;
  photoURL?: string;
};

export default function FriendsScreen() {
  const { user } = useAuth();
  const [friends, setFriends] = useState<Friend[]>([]);
  const [filteredFriends, setFilteredFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [drawerVisible, setDrawerVisible] = useState(false);

  useEffect(() => {
    if (!user) return;

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(connectionsQuery, async (snapshot) => {
      const friendsList: Friend[] = [];

      for (const connectionDoc of snapshot.docs) {
        const data = connectionDoc.data();
        const otherUserId = data.userIds.find((id: string) => id !== user.uid);
        
        // Get full user profile
        try {
          const userDocRef = doc(db, 'users', otherUserId);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const userData = userDoc.data();
            friendsList.push({
              id: `${connectionDoc.id}-${otherUserId}`, // Unique composite key
              connectionDocId: connectionDoc.id,
              userId: otherUserId,
              displayName: data.userNames[otherUserId] || 'Unknown',
              airline: userData.airline || '',
              base: userData.base || '',
              photoURL: userData.photoURL,
            });
          }
        } catch (error) {
          console.error('Error fetching friend details:', error);
        }
      }

      // Sort alphabetically
      friendsList.sort((a, b) => a.displayName.localeCompare(b.displayName));
      
      setFriends(friendsList);
      setFilteredFriends(friendsList);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredFriends(friends);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = friends.filter(
      (friend) =>
        friend.displayName.toLowerCase().includes(query) ||
        friend.airline.toLowerCase().includes(query) ||
        friend.base.toLowerCase().includes(query)
    );
    setFilteredFriends(filtered);
  }, [searchQuery, friends]);

  const handleRemoveFriend = (friend: Friend) => {
    Alert.alert(
      'Remove Connection',
      `Remove ${friend.displayName} from your connections? You can always reconnect later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'connections', friend.connectionDocId));
              Alert.alert('Removed', `${friend.displayName} has been removed from your connections.`);
            } catch (error) {
              console.error('Error removing connection:', error);
              Alert.alert('Error', 'Failed to remove connection. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = (friend: Friend) => {
    Alert.alert(
      'Block User',
      `Block ${friend.displayName}? They won't be able to see you in searches or send you connection requests. This will also remove your connection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              // Add to blocked users
              await addDoc(collection(db, 'blockedUsers'), {
                blockerId: user?.uid,
                blockedUserId: friend.userId,
                blockedUserName: friend.displayName,
                createdAt: serverTimestamp(),
              });

              // Remove connection
              await deleteDoc(doc(db, 'connections', friend.connectionDocId));

              Alert.alert('Blocked', `${friend.displayName} has been blocked.`);
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  // FIXED: Use ActionSheetIOS on iOS which dismisses on tap outside
  const showFriendOptions = (friend: Friend) => {
    if (Platform.OS === 'ios') {
      // iOS: Use ActionSheetIOS which automatically dismisses when tapping outside
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: friend.displayName,
          options: [
            'View Profile',
            'Message',
            'Remove Connection',
            'Block User',
            'Cancel',
          ],
          destructiveButtonIndex: [2, 3], // Red color for Remove and Block
          cancelButtonIndex: 4, // Cancel button
        },
        (buttonIndex) => {
          switch (buttonIndex) {
            case 0: // View Profile
              router.push({
                pathname: '/profile/friend/[userId]',
                params: { userId: friend.userId }
              });
              break;
            case 1: // Message
              router.push({
                pathname: '/chat/[id]',
                params: { id: friend.connectionDocId, name: friend.displayName }
              });
              break;
            case 2: // Remove Connection
              handleRemoveFriend(friend);
              break;
            case 3: // Block User
              handleBlockUser(friend);
              break;
            // case 4 is Cancel - does nothing
          }
        }
      );
    } else {
      // Android: Use Alert (doesn't support tap outside dismiss on Android)
      Alert.alert(
        friend.displayName,
        'Choose an action',
        [
          {
            text: 'View Profile',
            onPress: () => {
              router.push({
                pathname: '/profile/friend/[userId]',
                params: { userId: friend.userId }
              });
            }
          },
          {
            text: 'Message',
            onPress: () => {
              router.push({
                pathname: '/chat/[id]',
                params: { id: friend.connectionDocId, name: friend.displayName }
              });
            }
          },
          {
            text: 'Remove Connection',
            style: 'destructive',
            onPress: () => handleRemoveFriend(friend),
          },
          {
            text: 'Block User',
            style: 'destructive',
            onPress: () => handleBlockUser(friend),
          },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
    }
  };

  const renderFriend = ({ item }: { item: Friend }) => (
    <TouchableOpacity
      style={styles.friendCard}
      onPress={() => showFriendOptions(item)}
    >
      <View style={styles.avatarContainer}>
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <ThemedText style={styles.avatarText}>
              {item.displayName.slice(0, 2).toUpperCase()}
            </ThemedText>
          </View>
        )}
      </View>

      <View style={styles.friendInfo}>
        <ThemedText style={styles.friendName}>{item.displayName}</ThemedText>
        <ThemedText style={styles.friendAirline}>{item.airline}</ThemedText>
        <ThemedText style={styles.friendBase}>📍 {item.base}</ThemedText>
      </View>

      <Ionicons name="ellipsis-horizontal" size={24} color={Colors.text.secondary} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <>
      <AppDrawer 
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      />
      
      <AppHeader 
        onMenuPress={() => setDrawerVisible(true)}
        onConnectionsPress={() => router.push('/(tabs)/connections')}
      />
      
      <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>Friends</ThemedText>
        <View style={styles.friendsBadge}>
          <ThemedText style={styles.friendsCount}>{friends.length}</ThemedText>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={Colors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search friends..."
          placeholderTextColor={Colors.text.secondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Friends List */}
      {filteredFriends.length > 0 ? (
        <FlatList
          data={filteredFriends}
          renderItem={renderFriend}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="people-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyTitle}>
            {searchQuery ? 'No friends found' : 'No friends yet'}
          </ThemedText>
          <ThemedText style={styles.emptyText}>
            {searchQuery
              ? 'Try a different search term'
              : 'Connect with crew members on the My Layover tab!'}
          </ThemedText>
        </View>
      )}
    </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20, // Reduced since AppHeader provides spacing
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 15,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    flex: 1,
  },
  friendsBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
  },
  friendsCount: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 12,
    paddingHorizontal: 15,
    paddingVertical: 12,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  friendCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  avatarContainer: {
    marginRight: 15,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  friendInfo: {
    flex: 1,
  },
  friendName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 3,
  },
  friendAirline: {
    fontSize: 14,
    color: Colors.primary,
    marginBottom: 2,
  },
  friendBase: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
