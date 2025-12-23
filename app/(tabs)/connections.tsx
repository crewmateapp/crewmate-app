import { NotificationBadge } from '@/components/NotificationBadge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { router } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  query,
  serverTimestamp,
  where
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
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
};

type Connection = {
  id: string;
  userId: string;
  displayName: string;
};

export default function ConnectionsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [incomingRequests, setIncomingRequests] = useState<ConnectionRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<ConnectionRequest[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);

  useEffect(() => {
    if (!user) return;

    // Listen for incoming requests (where I'm the recipient)
    const incomingQuery = query(
      collection(db, 'connectionRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubIncoming = onSnapshot(incomingQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ConnectionRequest[];
      setIncomingRequests(requests);
      setLoading(false);
    });

    // Listen for outgoing requests (where I'm the sender)
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

    // Listen for accepted connections (I'm either sender or recipient)
    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubConnections = onSnapshot(connectionsQuery, (snapshot) => {
      const conns = snapshot.docs.map(doc => {
        const data = doc.data();
        const otherUserId = data.userIds.find((id: string) => id !== user.uid);
        const otherUserName = data.userNames[otherUserId] || 'Unknown';
        return {
          id: doc.id,
          userId: otherUserId,
          displayName: otherUserName,
        };
      }) as Connection[];
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
      await addDoc(collection(db, 'connections'), {
        userIds: [request.fromUserId, request.toUserId],
        userNames: {
          [request.fromUserId]: request.fromUserName,
          [request.toUserId]: request.toUserName,
        },
        createdAt: serverTimestamp(),
      });
      await deleteDoc(doc(db, 'connectionRequests', request.id));
    } catch (error) {
      console.error('Error accepting request:', error);
    }
  };

  const handleDecline = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'connectionRequests', requestId));
    } catch (error) {
      console.error('Error declining request:', error);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        {/* Title with Badge */}
        <View style={styles.titleContainer}>
          <ThemedText type="title" style={styles.title}>
            💬 Connections
          </ThemedText>
          {incomingRequests.length > 0 && (
            <NotificationBadge count={incomingRequests.length} />
          )}
        </View>

        {/* Incoming Requests */}
        {incomingRequests.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              🔥 Requests for You ({incomingRequests.length})
            </ThemedText>
            
            {incomingRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <View style={styles.avatarFallback}>
                    <ThemedText style={styles.avatarText}>
                      {request.fromUserName.slice(0, 2).toUpperCase()}
                    </ThemedText>
                  </View>
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

        {/* Outgoing Requests */}
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

        {/* Connections */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            ✈️ Your Connections ({connections.length})
          </ThemedText>
          
          {connections.length > 0 ? (
            connections.map((connection) => (
              <TouchableOpacity 
                key={connection.id} 
                style={styles.connectionCard}
                onPress={() => router.push({
                  pathname: '/chat/[id]',
                  params: { id: connection.id, name: connection.displayName }
                })}
              >
                <View style={styles.avatarContainer}>
                  <View style={styles.avatarFallback}>
                    <ThemedText style={styles.avatarText}>
                      {connection.displayName.slice(0, 2).toUpperCase()}
                    </ThemedText>
                  </View>
                  {/* TODO: Add real unread count from messages */}
                  {/* <View style={styles.unreadDot} /> */}
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
  scrollContainer: { flex: 1 },
  container: { 
    flex: 1, 
    padding: 20,
    paddingTop: 60,
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
    color: '#fff',
  },
  requestCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
  },
  pendingCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
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
    color: '#000',
  },
  requestAirline: {
    fontSize: 14,
    color: '#2196F3',
  },
  pendingName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  pendingStatus: {
    fontSize: 14,
    color: '#888',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 10,
  },
  acceptButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  declineButton: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  declineButtonText: {
    color: '#666',
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: '#ff4444',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  connectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  unreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#f44336',
    borderWidth: 2,
    borderColor: '#fff',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  tapToChat: {
    fontSize: 13,
    color: '#2196F3',
  },
  emptyState: {
    padding: 30,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});