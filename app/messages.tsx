// app/(tabs)/messages.tsx
// Primary social tab — connection requests + conversations
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { notifyConnectionAccepted } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type ConnectionRequest = {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: string;
  photoURL?: string;
  airline?: string;
  position?: string;
  base?: string;
};

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
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestsExpanded, setRequestsExpanded] = useState(true);

  // Listen for incoming connection requests
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'connectionRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const requests = await Promise.all(
        snapshot.docs.map(async (requestDoc) => {
          const data = requestDoc.data();
          let photoURL: string | undefined;
          let airline: string | undefined;
          let position: string | undefined;
          let base: string | undefined;

          try {
            const userDoc = await getDoc(doc(db, 'users', data.fromUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              photoURL = userData?.photoURL;
              airline = userData?.airline;
              position = userData?.position;
              base = userData?.base;
            }
          } catch (error) {
            console.error('Error fetching request user profile:', error);
          }

          return {
            id: requestDoc.id,
            ...data,
            photoURL,
            airline,
            position,
            base,
          };
        })
      );
      setIncomingRequests(requests as ConnectionRequest[]);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for conversations
  useEffect(() => {
    if (!user?.uid) return;

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

          // Only show connections that have messages
          if (!data.lastMessage && data.lastMessage !== '') continue;

          const otherUserId = data.userIds.find(
            (id: string) => id !== user.uid
          );
          if (!otherUserId) continue;

          let otherUserName = data.userNames?.[otherUserId] || 'Unknown User';
          let otherUserPhoto: string | undefined;

          try {
            const otherUserDoc = await getDoc(doc(db, 'users', otherUserId));
            const otherUserData = otherUserDoc.data();
            if (otherUserData) {
              otherUserPhoto = otherUserData.photoURL;
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

  const handleAccept = async (request: ConnectionRequest) => {
    try {
      // Check if already connected
      const existingQuery = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', user!.uid)
      );
      const existingSnap = await getDocs(existingQuery);
      const alreadyConnected = existingSnap.docs.some(d =>
        d.data().userIds.includes(request.fromUserId)
      );

      if (alreadyConnected) {
        setIncomingRequests(prev => prev.filter(r => r.id !== request.id));
        try { await deleteDoc(doc(db, 'connectionRequests', request.id)); } catch {}
        return;
      }

      // Create the connection
      await addDoc(collection(db, 'connections'), {
        userIds: [request.fromUserId, request.toUserId],
        userNames: {
          [request.fromUserId]: request.fromUserName,
          [request.toUserId]: request.toUserName,
        },
        createdAt: serverTimestamp(),
      });

      // Notify the requester
      await notifyConnectionAccepted(
        request.fromUserId,
        request.toUserId,
        request.toUserName
      );

      // Remove from UI immediately
      setIncomingRequests(prev => prev.filter(r => r.id !== request.id));

      // Delete the request doc
      try { await deleteDoc(doc(db, 'connectionRequests', request.id)); } catch {}

      Alert.alert('Connected! ✈️', `You and ${request.fromUserName} are now crew!`);
    } catch (error: any) {
      console.error('Error accepting connection:', error);
      Alert.alert('Error', `Failed to accept: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDecline = async (requestId: string) => {
    setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    try { await deleteDoc(doc(db, 'connectionRequests', requestId)); } catch {}
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

  const hasContent = conversations.length > 0 || incomingRequests.length > 0;

  return (
    <ThemedView style={styles.container}>
      {!hasContent ? (
        /* ─── EMPTY STATE ─────────────────────────────────────────────── */
        <View style={styles.emptyState}>
          <Ionicons name="chatbubbles-outline" size={80} color={Colors.text.disabled} />
          <ThemedText style={styles.emptyTitle}>No Messages Yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Connect with crew to start chatting!
          </ThemedText>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.push('/qr-code')}
          >
            <Ionicons name="person-add" size={20} color={Colors.white} />
            <ThemedText style={styles.primaryButtonText}>Add Crew</ThemedText>
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
          ListHeaderComponent={
            /* ─── CONNECTION REQUESTS BANNER ─────────────────────────── */
            incomingRequests.length > 0 ? (
              <View style={styles.requestsSection}>
                <TouchableOpacity
                  style={styles.requestsHeader}
                  onPress={() => setRequestsExpanded(!requestsExpanded)}
                  activeOpacity={0.7}
                >
                  <View style={styles.requestsHeaderLeft}>
                    <View style={styles.requestsBadge}>
                      <ThemedText style={styles.requestsBadgeText}>
                        {incomingRequests.length}
                      </ThemedText>
                    </View>
                    <ThemedText style={styles.requestsTitle}>
                      Connection Request{incomingRequests.length !== 1 ? 's' : ''}
                    </ThemedText>
                  </View>
                  <Ionicons
                    name={requestsExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={Colors.text.secondary}
                  />
                </TouchableOpacity>

                {requestsExpanded && (
                  <View style={styles.requestsList}>
                    {incomingRequests.map((request) => (
                      <View key={request.id} style={styles.requestCard}>
                        <View style={styles.requestInfo}>
                          {request.photoURL ? (
                            <Image source={{ uri: request.photoURL }} style={styles.requestAvatar} />
                          ) : (
                            <View style={styles.requestAvatarFallback}>
                              <ThemedText style={styles.requestAvatarText}>
                                {request.fromUserName.slice(0, 2).toUpperCase()}
                              </ThemedText>
                            </View>
                          )}
                          <View style={styles.requestDetails}>
                            <ThemedText style={styles.requestName}>
                              {request.fromUserName}
                            </ThemedText>
                            <ThemedText style={styles.requestMeta} numberOfLines={1}>
                              {[request.position, request.airline, request.base].filter(Boolean).join(' · ') || 'Crew Member'}
                            </ThemedText>
                          </View>
                        </View>
                        <View style={styles.requestActions}>
                          <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleAccept(request)}
                          >
                            <Ionicons name="checkmark" size={18} color={Colors.white} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.declineButton}
                            onPress={() => handleDecline(request.id)}
                          >
                            <Ionicons name="close" size={18} color={Colors.text.secondary} />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            /* Show when there are requests but no conversations yet */
            <View style={styles.noConversations}>
              <ThemedText style={styles.noConversationsText}>
                No conversations yet — accept a request to start chatting!
              </ThemedText>
            </View>
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
    paddingBottom: 40,
  },

  // ── Connection Requests Section ──────────────────────────────────────
  requestsSection: {
    backgroundColor: Colors.primary + '08',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  requestsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  requestsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  requestsBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    minWidth: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  requestsBadgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.white,
  },
  requestsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  requestsList: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  requestCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
  },
  requestAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  requestAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  requestAvatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  requestDetails: {
    flex: 1,
    marginLeft: 12,
  },
  requestName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  requestMeta: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 8,
  },
  acceptButton: {
    backgroundColor: Colors.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineButton: {
    backgroundColor: Colors.border,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Conversations ────────────────────────────────────────────────────
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

  // ── Empty States ─────────────────────────────────────────────────────
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
  noConversations: {
    padding: 30,
    alignItems: 'center',
  },
  noConversationsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
