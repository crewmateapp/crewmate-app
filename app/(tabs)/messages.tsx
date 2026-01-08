// app/(tabs)/messages.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type Conversation = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserPhoto?: string;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
};

export default function MessagesScreen() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!user) return;

    // FIXED: Listen for connections where user is in userIds
    const connectionsRef = collection(db, 'connections');
    const q = query(
      connectionsRef,
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const convos: Conversation[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          // Only show connections that have messages (lastMessage exists and isn't empty)
          if (!data.lastMessage && data.lastMessage !== '') continue;
          
          // FIXED: Get the other user's ID from userIds array
          const otherUserId = data.userIds.find(
            (id: string) => id !== user.uid
          );

          if (!otherUserId) continue;

          // Get other user's name from userNames map, or fetch from users collection
          let otherUserName = data.userNames?.[otherUserId] || 'Unknown User';
          let otherUserPhoto: string | undefined;

          // Fetch other user's photo
          try {
            const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
            const otherUserData = otherUserDoc.data();
            if (otherUserData) {
              otherUserPhoto = otherUserData.photoURL;
              // Update name if we have a better one from the user doc
              if (otherUserData.displayName) {
                otherUserName = otherUserData.displayName;
              }
            }
          } catch (error) {
            console.error('Error fetching user data:', error);
          }

          convos.push({
            id: docSnap.id,
            otherUserId,
            otherUserName,
            otherUserPhoto,
            lastMessage: data.lastMessage || 'No messages yet',
            lastMessageTime: data.lastMessageTime?.toDate() || new Date(),
            unreadCount: data.unreadCount?.[user.uid] || 0,
          });
        }

        // Sort by lastMessageTime (most recent first)
        convos.sort((a, b) => b.lastMessageTime.getTime() - a.lastMessageTime.getTime());

        setConversations(convos);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Error loading conversations:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const handleRefresh = () => {
    setRefreshing(true);
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  };

  const openChat = (conversation: Conversation) => {
    router.push({
      pathname: '/chat/[id]',
      params: {
        id: conversation.id,
        name: conversation.otherUserName,
      },
    });
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {conversations.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyTitle}>No Messages Yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Start a conversation with your connections!
          </ThemedText>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)/connections')}
          >
            <ThemedText style={styles.primaryButtonText}>
              View Connections
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.conversationItem}
              onPress={() => openChat(item)}
            >
              {/* Profile Picture */}
              <View style={styles.avatarContainer}>
                {item.otherUserPhoto ? (
                  <Image source={{ uri: item.otherUserPhoto }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <ThemedText style={styles.avatarText}>
                      {item.otherUserName.charAt(0).toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                {item.unreadCount > 0 && (
                  <View style={styles.unreadBadge}>
                    <ThemedText style={styles.unreadBadgeText}>
                      {item.unreadCount > 9 ? '9+' : item.unreadCount}
                    </ThemedText>
                  </View>
                )}
              </View>

              {/* Message Info */}
              <View style={styles.messageInfo}>
                <View style={styles.messageHeader}>
                  <ThemedText style={styles.userName} numberOfLines={1}>
                    {item.otherUserName}
                  </ThemedText>
                  <ThemedText style={styles.timestamp}>
                    {formatTime(item.lastMessageTime)}
                  </ThemedText>
                </View>
                <ThemedText
                  style={[
                    styles.lastMessage,
                    item.unreadCount > 0 && styles.lastMessageUnread,
                  ]}
                  numberOfLines={1}
                >
                  {item.lastMessage}
                </ThemedText>
              </View>

              {/* Chevron */}
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </TouchableOpacity>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingTop: 20,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
  },
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: Colors.error,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  unreadBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  messageInfo: {
    flex: 1,
    gap: 4,
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  timestamp: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  lastMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  lastMessageUnread: {
    fontWeight: '600',
    color: Colors.text.primary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
    color: Colors.text.primary,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
});
