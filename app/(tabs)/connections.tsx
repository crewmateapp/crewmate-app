import { NotificationBadge } from '@/components/NotificationBadge';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
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
  avatarContainer: {
    position: 'relative',
    marginRight: 12,
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