import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  mockConnections,
  mockIncomingRequests,
  type Connection
} from '@/data/mockConnections';
import { useState } from 'react';
import { ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ConnectionsScreen() {
  const [requests, setRequests] = useState(mockIncomingRequests);
  const [connections, setConnections] = useState(mockConnections);

  const handleAccept = (requestId: string) => {
    const request = requests.find(r => r.id === requestId);
    if (request) {
      // Add to connections
      const newConnection: Connection = {
        id: `conn-${Date.now()}`,
        userId: request.fromUserId,
        displayName: request.fromUser.displayName,
        airline: request.fromUser.airline,
        base: 'Unknown',
        photoURL: request.fromUser.photoURL,
      };
      setConnections([newConnection, ...connections]);
      
      // Remove from requests
      setRequests(requests.filter(r => r.id !== requestId));
    }
  };

  const handleDecline = (requestId: string) => {
    setRequests(requests.filter(r => r.id !== requestId));
  };

  const formatTimeAgo = (dateString?: string) => {
    if (!dateString) return '';
    const diff = Date.now() - new Date(dateString).getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <ScrollView style={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          💬 Connections
        </ThemedText>

        {/* Pending Requests Section */}
        {requests.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              📥 Pending Requests ({requests.length})
            </ThemedText>
            
            {requests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <View style={styles.requestInfo}>
                  <View style={styles.avatarFallback}>
                    <ThemedText style={styles.avatarText}>
                      {request.fromUser.displayName.split(' ').map(n => n[0]).join('')}
                    </ThemedText>
                  </View>
                  <View style={styles.requestDetails}>
                    <ThemedText style={styles.requestName}>
                      {request.fromUser.displayName}
                    </ThemedText>
                    <ThemedText style={styles.requestAirline}>
                      {request.fromUser.airline}
                    </ThemedText>
                  </View>
                </View>
                
                <View style={styles.requestActions}>
                  <TouchableOpacity 
                    style={styles.acceptButton}
                    onPress={() => handleAccept(request.id)}
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

        {/* Connections Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>
            ✈️ Your Connections ({connections.length})
          </ThemedText>
          
          {connections.length > 0 ? (
            connections.map((connection) => (
              <TouchableOpacity key={connection.id} style={styles.connectionCard}>
                <View style={styles.avatarFallback}>
                  <ThemedText style={styles.avatarText}>
                    {connection.displayName.split(' ').map(n => n[0]).join('')}
                  </ThemedText>
                </View>
                
                <View style={styles.connectionInfo}>
                  <View style={styles.connectionHeader}>
                    <ThemedText style={styles.connectionName}>
                      {connection.displayName}
                    </ThemedText>
                    {connection.lastMessageAt && (
                      <ThemedText style={styles.timeAgo}>
                        {formatTimeAgo(connection.lastMessageAt)}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText style={styles.connectionAirline}>
                    {connection.airline} · {connection.base}
                  </ThemedText>
                  {connection.lastMessage && (
                    <ThemedText style={styles.lastMessage} numberOfLines={1}>
                      {connection.lastMessage}
                    </ThemedText>
                  )}
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
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
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
  connectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarFallback: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  connectionInfo: {
    flex: 1,
  },
  connectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  timeAgo: {
    fontSize: 12,
    color: '#999',
  },
  connectionAirline: {
    fontSize: 13,
    color: '#2196F3',
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
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