import { NotificationBadge } from '@/components/NotificationBadge';
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
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

type ConnectionRequest = {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  status: 'pending' | 'accepted' | 'declined';
  photoURL?: string;
};

type Connection = {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
};

export default function ConnectionsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    if (!user) return;

    const incomingQuery = query(
      collection(db, 'connectionRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubIncoming = onSnapshot(incomingQuery, async (snapshot) => {
      const requests = await Promise.all(
        snapshot.docs.map(async (requestDoc) => {
          const data = requestDoc.data();
          
          // Fetch the sender's profile photo
          let photoURL: string | undefined = undefined;
          try {
            const userDoc = await getDoc(doc(db, 'users', data.fromUserId));
            if (userDoc.exists()) {
              photoURL = userDoc.data()?.photoURL;
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
          
          return {
            id: requestDoc.id,
            ...data,
            photoURL,
          };
        })
      );
      setIncomingRequests(requests as ConnectionRequest[]);
      setLoading(false);
    });

    const outgoingQuery = query(
      collection(db, 'connectionRequests'),
      where('fromUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubOutgoing = onSnapshot(outgoingQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ConnectionRequest[];
      setOutgoingRequests(requests);
    });

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubConnections = onSnapshot(connectionsQuery, async (snapshot) => {
      const conns = await Promise.all(
        snapshot.docs.map(async (connectionDoc) => {
          const data = connectionDoc.data();
          const otherUserId = data.userIds.find((id: string) => id !== user.uid);
          const otherUserName = data.userNames[otherUserId] || 'Unknown';
          
          // Fetch the user's profile to get their photo
          let photoURL: string | undefined = undefined;
          try {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              photoURL = userDoc.data()?.photoURL;
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
          
          return {
            id: connectionDoc.id,
            userId: otherUserId,
            displayName: otherUserName,
            photoURL,
          };
        })
      );
      setConnections(conns);
    });

    return () => {
      unsubIncoming();
      unsubOutgoing();
      unsubConnections();
    };
  }, [user]);

  const handleAccept = async (request: ConnectionRequest) => {
    try {
      // First check if connection already exists
      const existingConnectionQuery = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', user!.uid)
      );
      
      const existingConnections = await getDocs(existingConnectionQuery);
      const alreadyConnected = existingConnections.docs.some(doc => {
        const data = doc.data();
        return data.userIds.includes(request.fromUserId);
      });
      
      if (alreadyConnected) {
        // Already connected - just remove the request
        setIncomingRequests(prev => prev.filter(r => r.id !== request.id));
        
        try {
          await deleteDoc(doc(db, 'connectionRequests', request.id));
        } catch (deleteError) {
          console.error('Error deleting duplicate request:', deleteError);
        }
        
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
      
      // Immediately remove from UI for better UX
      setIncomingRequests(prev => prev.filter(r => r.id !== request.id));
      
      // Then delete the request from Firestore
      try {
        await deleteDoc(doc(db, 'connectionRequests', request.id));
      } catch (deleteError) {
        console.error('Error deleting connection request:', deleteError);
        // UI already updated, this is just cleanup
      }
    } catch (error) {
      console.error('Error accepting request:', error);
      Alert.alert('Error', 'Failed to accept connection request. Please try again.');
    }
  };

  const handleDecline = async (requestId: string) => {
    // Immediately remove from UI
    setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
    setOutgoingRequests(prev => prev.filter(r => r.id !== requestId));
    
    try {
      await deleteDoc(doc(db, 'connectionRequests', requestId));
    } catch (error) {
      console.error('Error declining request:', error);
      // Don't show alert since UI already updated
      // The Firestore delete might fail due to security rules but that's okay
    }
  };

  const handleOpenChat = async (connection: Connection) => {
    if (!user) return;
    
    try {
      // Create conversation ID by sorting user IDs
      const conversationId = [user.uid, connection.userId].sort().join('_');
      
      // Check if conversation exists, if not create it
      const conversationRef = doc(db, 'conversations', conversationId);
      const conversationSnap = await getDoc(conversationRef);
      
      if (!conversationSnap.exists()) {
        // Create new conversation document
        await setDoc(conversationRef, {
          participantIds: [user.uid, connection.userId],
          lastMessage: '',
          lastMessageTime: serverTimestamp(),
          unreadCount: {
            [user.uid]: 0,
            [connection.userId]: 0,
          },
          createdAt: serverTimestamp(),
        });
      }
      
      // Navigate to chat
      router.push({
        pathname: '/chat/[id]',
        params: { 
          id: conversationId, 
          name: connection.displayName,
          otherUserId: connection.userId,
        }
      });
    } catch (error) {
      console.error('Error opening chat:', error);
      Alert.alert('Error', 'Failed to open chat. Please try again.');
    }
  };

  const handleDeleteConnection = (connection: Connection) => {
    Alert.alert(
      'Remove Connection',
      `Are you sure you want to remove ${connection.displayName} from your connections?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'connections', connection.id));
            } catch (error) {
              console.error('Error deleting connection:', error);
              Alert.alert('Error', 'Failed to remove connection. Please try again.');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        <View style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            💬 Connections
          </ThemedText>
          {incomingRequests.length > 0 && (
            <NotificationBadge count={incomingRequests.length} />
          )}
        </View>

        {incomingRequests.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              🔥 Requests for You ({incomingRequests.length})
            </ThemedText>
            
            {incomingRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  {request.photoURL ? (
                    <Image 
                      source={{ uri: request.photoURL }} 
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <ThemedText style={styles.avatarText}>
                        {request.fromUserName.slice(0, 2).toUpperCase()}
                      </ThemedText>
                    </View>
                  )}
                  <View style={styles.requestDetails}>
                    <ThemedText style={styles.requestName}>
                      {request.fromUserName}
                    </ThemedText>
                    <ThemedText style={styles.requestAirline}>
                      Wants to connect
                    </ThemedText>
                  </View>
                </View>
                
                <View style={styles.requestActions}>
                  <TouchableOpacity 
                    style={styles.acceptButton}
                    onPress={() => handleAccept(request)}
                  >
                    <ThemedText style={styles.acceptButtonText}>Accept</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={styles.declineButton}
                    onPress={() => handleDecline(request.id)}
                  >
                    <ThemedText style={styles.declineButtonText}>Decline</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {outgoingRequests.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              📤 Pending Requests ({outgoingRequests.length})
            </ThemedText>
            
            {outgoingRequests.map((request) => (
              <View key={request.id} style={styles.pendingCard}>
                <View style={styles.avatarFallback}>
                  <ThemedText style={styles.avatarText}>
                    {request.toUserName.slice(0, 2).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.requestDetails}>
                  <ThemedText style={styles.pendingName}>
                    {request.toUserName}
                  </ThemedText>
                  <ThemedText style={styles.pendingStatus}>
                    ⏳ Waiting for response
                  </ThemedText>
                </View>
                <TouchableOpacity 
                  style={styles.cancelButton}
                  onPress={() => handleDecline(request.id)}
                >
                  <ThemedText style={styles.cancelButtonText}>Cancel</ThemedText>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            ✈️ Your Connections ({connections.length})
          </ThemedText>
          
          {connections.length > 0 ? (
            connections.map((connection) => (
              <View key={connection.id} style={styles.connectionCard}>
                <TouchableOpacity 
                  style={styles.connectionMain}
                  onPress={() => handleOpenChat(connection)}
                >
                  <View style={styles.avatarContainer}>
                    {connection.photoURL ? (
                      <Image 
                        source={{ uri: connection.photoURL }} 
                        style={styles.avatar}
                      />
                    ) : (
                      <View style={styles.avatarFallback}>
                        <ThemedText style={styles.avatarText}>
                          {connection.displayName.slice(0, 2).toUpperCase()}
                        </ThemedText>
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.connectionInfo}>
                    <ThemedText style={styles.connectionName}>
                      {connection.displayName}
                    </ThemedText>
                    <ThemedText style={styles.tapToChat}>
                      Tap to chat
                    </ThemedText>
                  </View>
                </TouchableOpacity>

                {/* Delete button */}
                <TouchableOpacity 
                  style={styles.deleteButton}
                  onPress={() => handleDeleteConnection(connection)}
                >
                  <Ionicons name="trash-outline" size={20} color={Colors.error} />
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={styles.emptyText}>
                No connections yet. Find crew on the My Layover tab!
              </ThemedText>
            </View>
          )}
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { 
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: { 
    flex: 1, 
    padding: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: Colors.text.primary,
  },
  requestCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pendingCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestDetails: {
    flex: 1,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  requestAirline: {
    fontSize: 14,
    color: Colors.primary,
  },
  pendingName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  pendingStatus: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: Colors.success,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: Colors.white,
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  declineButtonText: {
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  connectionCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  connectionMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
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
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tapToChat: {
    fontSize: 13,
    color: Colors.primary,
  },
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
  emptyState: {
    padding: 30,
    backgroundColor: Colors.background,
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
