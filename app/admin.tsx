import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    query,
    updateDoc,
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
    View,
} from 'react-native';

type PendingSpot = {
  id: string;
  name: string;
  category: string;
  city: string;
  area: string;
  description: string;
  addedByName: string;
  photoURLs?: string[];
  createdAt: Date;
};

type DeleteRequest = {
  id: string;
  spotId: string;
  spotName: string;
  requestedByName: string;
  reason: string;
  createdAt: Date;
};

type Report = {
  id: string;
  spotId: string;
  spotName: string;
  reportedByName: string;
  reason: string;
  createdAt: Date;
};

const categoryEmojis: { [key: string]: string } = {
  coffee: '☕',
  food: '🍽️',
  bar: '🍸',
  gym: '💪',
  activity: '🎯',
};

export default function AdminScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [pendingSpots, setPendingSpots] = useState<PendingSpot[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [activeTab, setActiveTab] = useState<'spots' | 'deletes' | 'reports'>('spots');

  // Check if user is admin (you can hardcode your email or use a Firestore admin field)
  const isAdmin = user?.email === 'zachary.tillman@aa.com' || user?.email === 'johnny.guzman@aa.com';

  useEffect(() => {
    if (!user || !isAdmin) {
      setLoading(false);
      return;
    }

    // Listen for pending spots
    const spotsQuery = query(
  collection(db, 'spots'),
  where('status', '==', 'pending')
);

    const unsubSpots = onSnapshot(spotsQuery, (snapshot) => {
      const spots = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as PendingSpot[];
      setPendingSpots(spots);
      setLoading(false);
    });

    // Listen for delete requests
    const deleteQuery = query(
  collection(db, 'deleteRequests')
);

    const unsubDeletes = onSnapshot(deleteQuery, (snapshot) => {
      const requests = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as DeleteRequest[];
      setDeleteRequests(requests);
    });

    // Listen for reports
    const reportsQuery = query(
  collection(db, 'spotReports')
);

    const unsubReports = onSnapshot(reportsQuery, (snapshot) => {
      const reps = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
      })) as Report[];
      setReports(reps);
    });

    return () => {
      unsubSpots();
      unsubDeletes();
      unsubReports();
    };
  }, [user, isAdmin]);

  const handleApproveSpot = async (spotId: string, spotName: string) => {
    try {
      await updateDoc(doc(db, 'spots', spotId), {
        status: 'approved',
      });
      Alert.alert('Approved ✅', `${spotName} is now visible to all users!`);
    } catch (error) {
      console.error('Error approving spot:', error);
      Alert.alert('Error', 'Failed to approve spot');
    }
  };

  const handleRejectSpot = async (spotId: string, spotName: string) => {
    Alert.alert(
      'Reject Spot?',
      `Are you sure you want to reject "${spotName}"? This will permanently delete it.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'spots', spotId));
              Alert.alert('Rejected', `${spotName} has been deleted.`);
            } catch (error) {
              console.error('Error rejecting spot:', error);
              Alert.alert('Error', 'Failed to reject spot');
            }
          },
        },
      ]
    );
  };

  const handleDeleteRequest = async (request: DeleteRequest) => {
    Alert.alert(
      'Delete Spot?',
      `Request from ${request.requestedByName}:\n"${request.reason}"\n\nDelete "${request.spotName}"?`,
      [
        { text: 'Keep Spot', style: 'cancel', onPress: () => dismissRequest(request.id) },
        {
          text: 'Delete Spot',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'spots', request.spotId));
              await deleteDoc(doc(db, 'deleteRequests', request.id));
              Alert.alert('Deleted', `${request.spotName} has been removed.`);
            } catch (error) {
              console.error('Error deleting spot:', error);
              Alert.alert('Error', 'Failed to delete spot');
            }
          },
        },
      ]
    );
  };

  const dismissRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'deleteRequests', requestId));
    } catch (error) {
      console.error('Error dismissing request:', error);
    }
  };

  const handleReport = async (report: Report) => {
    Alert.alert(
      'Report Review',
      `Reported by ${report.reportedByName}\nReason: ${report.reason}\nSpot: ${report.spotName}\n\nWhat do you want to do?`,
      [
        { text: 'Dismiss Report', onPress: () => dismissReport(report.id) },
        {
          text: 'Delete Spot',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'spots', report.spotId));
              await deleteDoc(doc(db, 'spotReports', report.id));
              Alert.alert('Deleted', `${report.spotName} has been removed.`);
            } catch (error) {
              console.error('Error deleting spot:', error);
              Alert.alert('Error', 'Failed to delete spot');
            }
          },
        },
      ]
    );
  };

  const dismissReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'spotReports', reportId));
      Alert.alert('Dismissed', 'Report has been dismissed.');
    } catch (error) {
      console.error('Error dismissing report:', error);
    }
  };

  if (!isAdmin) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Admin</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.noAccessContainer}>
          <Ionicons name="lock-closed" size={48} color="#888" />
          <ThemedText style={styles.noAccessText}>
            Admin access only
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Admin Panel</ThemedText>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Admin Panel</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'spots' && styles.tabActive]}
          onPress={() => setActiveTab('spots')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'spots' && styles.tabTextActive]}>
            Pending ({pendingSpots.length})
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'deletes' && styles.tabActive]}
          onPress={() => setActiveTab('deletes')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'deletes' && styles.tabTextActive]}>
            Deletes ({deleteRequests.length})
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => setActiveTab('reports')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            Reports ({reports.length})
          </ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {/* Pending Spots Tab */}
        {activeTab === 'spots' && (
          <View style={styles.section}>
            {pendingSpots.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle-outline" size={48} color="#888" />
                <ThemedText style={styles.emptyText}>No pending spots!</ThemedText>
              </View>
            ) : (
              pendingSpots.map((spot) => (
                <View key={spot.id} style={styles.card}>
                  {spot.photoURLs && spot.photoURLs[0] && (
                    <Image source={{ uri: spot.photoURLs[0] }} style={styles.spotImage} />
                  )}
                  <View style={styles.spotInfo}>
                    <View style={styles.spotHeader}>
                      <ThemedText style={styles.spotEmoji}>
                        {categoryEmojis[spot.category] || '📍'}
                      </ThemedText>
                      <ThemedText style={styles.spotName}>{spot.name}</ThemedText>
                    </View>
                    <ThemedText style={styles.spotLocation}>
                      {spot.area}, {spot.city}
                    </ThemedText>
                    <ThemedText style={styles.spotDescription}>{spot.description}</ThemedText>
                    <ThemedText style={styles.spotMeta}>
                      Added by {spot.addedByName} • {spot.createdAt.toLocaleDateString()}
                    </ThemedText>
                  </View>
                  <View style={styles.spotActions}>
                    <TouchableOpacity
                      style={styles.approveButton}
                      onPress={() => handleApproveSpot(spot.id, spot.name)}
                    >
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <ThemedText style={styles.approveButtonText}>Approve</ThemedText>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.rejectButton}
                      onPress={() => handleRejectSpot(spot.id, spot.name)}
                    >
                      <Ionicons name="close-circle" size={20} color="#fff" />
                      <ThemedText style={styles.rejectButtonText}>Reject</ThemedText>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {/* Delete Requests Tab */}
        {activeTab === 'deletes' && (
          <View style={styles.section}>
            {deleteRequests.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="trash-outline" size={48} color="#888" />
                <ThemedText style={styles.emptyText}>No delete requests</ThemedText>
              </View>
            ) : (
              deleteRequests.map((request) => (
                <TouchableOpacity
                  key={request.id}
                  style={styles.requestCard}
                  onPress={() => handleDeleteRequest(request)}
                >
                  <View style={styles.requestHeader}>
                    <Ionicons name="trash" size={20} color="#f44336" />
                    <ThemedText style={styles.requestSpotName}>{request.spotName}</ThemedText>
                  </View>
                  <ThemedText style={styles.requestReason}>"{request.reason}"</ThemedText>
                  <ThemedText style={styles.requestMeta}>
                    Requested by {request.requestedByName} •{' '}
                    {request.createdAt.toLocaleDateString()}
                  </ThemedText>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <View style={styles.section}>
            {reports.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="flag-outline" size={48} color="#888" />
                <ThemedText style={styles.emptyText}>No reports</ThemedText>
              </View>
            ) : (
              reports.map((report) => (
                <TouchableOpacity
                  key={report.id}
                  style={styles.requestCard}
                  onPress={() => handleReport(report)}
                >
                  <View style={styles.requestHeader}>
                    <Ionicons name="flag" size={20} color="#ff9800" />
                    <ThemedText style={styles.requestSpotName}>{report.spotName}</ThemedText>
                  </View>
                  <ThemedText style={styles.requestReason}>
                    Reason: {report.reason.replace('_', ' ')}
                  </ThemedText>
                  <ThemedText style={styles.requestMeta}>
                    Reported by {report.reportedByName} • {report.createdAt.toLocaleDateString()}
                  </ThemedText>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}
      </ScrollView>
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
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    backgroundColor: '#2196F3',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 5,
  },
  tab: {
    flex: 1,
    paddingVertical: 15,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#2196F3',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#888',
  },
  tabTextActive: {
    color: '#2196F3',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 20,
  },
  card: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    marginBottom: 15,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#333',
  },
  spotImage: {
    width: '100%',
    height: 150,
    resizeMode: 'cover',
  },
  spotInfo: {
    padding: 15,
  },
  spotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 5,
  },
  spotEmoji: {
    fontSize: 20,
  },
  spotName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  spotLocation: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  spotDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
    color: '#ccc',
  },
  spotMeta: {
    fontSize: 12,
    color: '#666',
  },
  spotActions: {
    flexDirection: 'row',
    padding: 15,
    gap: 10,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  approveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
  },
  approveButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  rejectButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#f44336',
    padding: 12,
    borderRadius: 8,
  },
  rejectButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  requestCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  requestHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requestSpotName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  requestReason: {
    fontSize: 14,
    color: '#ccc',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  requestMeta: {
    fontSize: 12,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: '#888',
    marginTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  noAccessContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  noAccessText: {
    fontSize: 18,
    color: '#888',
    marginTop: 15,
  },
});