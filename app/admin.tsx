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
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type Spot = {
  id: string;
  name: string;
  type: string;
  city: string;
  address: string;
  description: string;
  status: string;
  addedBy: string;
  addedByName: string;
  createdAt: any;
};

type Report = {
  id: string;
  spotId: string;
  spotName: string;
  reportedBy: string;
  reportedByEmail: string;
  reason: string;
  createdAt: any;
};

type DeleteRequest = {
  id: string;
  spotId: string;
  spotName: string;
  requestedBy: string;
  requestedByEmail: string;
  reason: string;
  createdAt: any;
};

export default function AdminScreen() {
  const { user } = useAuth();
  const [pendingSpots, setPendingSpots] = useState<Spot[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [deleteRequests, setDeleteRequests] = useState<DeleteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'spots' | 'reports' | 'deletes'>('spots');

  useEffect(() => {
    if (!user) return;

    const spotsQuery = query(
      collection(db, 'spots'),
      where('status', '==', 'pending')
    );

    const unsubscribeSpots = onSnapshot(spotsQuery, (snapshot) => {
      const spots: Spot[] = [];
      snapshot.docs.forEach((doc) => {
        spots.push({ id: doc.id, ...doc.data() } as Spot);
      });
      setPendingSpots(spots);
      setLoading(false);
    });

    const unsubscribeReports = onSnapshot(
      collection(db, 'spotReports'),
      (snapshot) => {
        const fetchedReports: Report[] = [];
        snapshot.docs.forEach((doc) => {
          fetchedReports.push({ id: doc.id, ...doc.data() } as Report);
        });
        setReports(fetchedReports);
      }
    );

    const unsubscribeDeletes = onSnapshot(
      collection(db, 'deleteRequests'),
      (snapshot) => {
        const fetchedRequests: DeleteRequest[] = [];
        snapshot.docs.forEach((doc) => {
          fetchedRequests.push({ id: doc.id, ...doc.data() } as DeleteRequest);
        });
        setDeleteRequests(fetchedRequests);
      }
    );

    return () => {
      unsubscribeSpots();
      unsubscribeReports();
      unsubscribeDeletes();
    };
  }, [user]);

  const handleApproveSpot = async (spotId: string, spotData: any) => {
  try {
    await updateDoc(doc(db, 'spots', spotId), {
      status: 'approved',
      approvedAt: serverTimestamp(),
      approvedBy: user?.email,
    });

    // Get user's photo for activity
    let userPhoto = null;
    try {
      const userDoc = await getDoc(doc(db, 'users', spotData.addedBy));
      if (userDoc.exists()) {
        userPhoto = userDoc.data().photoURL || null;
      }
    } catch (error) {
      console.log('Could not fetch user photo');
    }

    // Create activity for approved spot
    await addDoc(collection(db, 'activities'), {
      type: 'spot_added',
      userId: spotData.addedBy,
      userName: spotData.addedByName,
      userPhoto: userPhoto,
      spotId: spotId,
      spotName: spotData.name,
      city: spotData.city,
      createdAt: serverTimestamp(),
    });

    Alert.alert('Success', 'Spot approved and added to the guide!');
  } catch (error) {
    console.error('Error approving spot:', error);
    Alert.alert('Error', 'Failed to approve spot.');
  }
};
  

  const handleRejectSpot = async (spotId: string) => {
    Alert.alert(
      'Reject Spot',
      'Are you sure you want to reject this spot? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'spots', spotId));
              Alert.alert('Rejected', 'Spot has been rejected and removed.');
            } catch (error) {
              console.error('Error rejecting spot:', error);
              Alert.alert('Error', 'Failed to reject spot.');
            }
          },
        },
      ]
    );
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await deleteDoc(doc(db, 'spotReports', reportId));
      Alert.alert('Dismissed', 'Report has been dismissed.');
    } catch (error) {
      console.error('Error dismissing report:', error);
      Alert.alert('Error', 'Failed to dismiss report.');
    }
  };

  const handleDeleteSpot = async (spotId: string, deleteRequestId: string) => {
    Alert.alert(
      'Delete Spot',
      'Are you sure you want to delete this spot? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'spots', spotId));
              await deleteDoc(doc(db, 'deleteRequests', deleteRequestId));
              Alert.alert('Deleted', 'Spot has been deleted.');
            } catch (error) {
              console.error('Error deleting spot:', error);
              Alert.alert('Error', 'Failed to delete spot.');
            }
          },
        },
      ]
    );
  };

  const handleDismissDeleteRequest = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, 'deleteRequests', requestId));
      Alert.alert('Dismissed', 'Delete request has been dismissed.');
    } catch (error) {
      console.error('Error dismissing request:', error);
      Alert.alert('Error', 'Failed to dismiss request.');
    }
  };

  const renderSpot = ({ item }: { item: Spot }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.spotName}>{item.name}</ThemedText>
        <View style={styles.typeTag}>
          <ThemedText style={styles.typeText}>{item.type}</ThemedText>
        </View>
      </View>
      
      <ThemedText style={styles.cityText}>📍 {item.city}</ThemedText>
      <ThemedText style={styles.addressText}>{item.address}</ThemedText>
      
      {item.description && (
        <ThemedText style={styles.description}>{item.description}</ThemedText>
      )}
      
      <ThemedText style={styles.addedBy}>
        Added by {item.addedByName}
      </ThemedText>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApproveSpot(item.id, item)}
        >
          <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>Approve</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleRejectSpot(item.id)}
        >
          <Ionicons name="close-circle" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>Reject</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderReport = ({ item }: { item: Report }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.spotName}>{item.spotName}</ThemedText>
        <View style={[styles.typeTag, { backgroundColor: Colors.error }]}>
          <ThemedText style={styles.typeText}>{item.reason}</ThemedText>
        </View>
      </View>
      
      <ThemedText style={styles.reportedBy}>
        Reported by {item.reportedByEmail}
      </ThemedText>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => router.push(`/spot/${item.spotId}`)}
        >
          <Ionicons name="eye" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>View Spot</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dismissButton]}
          onPress={() => handleDismissReport(item.id)}
        >
          <ThemedText style={styles.actionButtonText}>Dismiss</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderDeleteRequest = ({ item }: { item: DeleteRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.spotName}>{item.spotName}</ThemedText>
        <View style={[styles.typeTag, { backgroundColor: Colors.error }]}>
          <ThemedText style={styles.typeText}>{item.reason}</ThemedText>
        </View>
      </View>
      
      <ThemedText style={styles.reportedBy}>
        Requested by {item.requestedByEmail}
      </ThemedText>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => router.push(`/spot/${item.spotId}`)}
        >
          <Ionicons name="eye" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>View Spot</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleDeleteSpot(item.spotId, item.id)}
        >
          <Ionicons name="trash" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>Delete</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dismissButton]}
          onPress={() => handleDismissDeleteRequest(item.id)}
        >
          <ThemedText style={styles.actionButtonText}>Dismiss</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>
          Admin Panel
        </ThemedText>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'spots' && styles.tabActive]}
          onPress={() => setActiveTab('spots')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'spots' && styles.tabTextActive]}>
            Pending Spots
          </ThemedText>
          {pendingSpots.length > 0 && (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{pendingSpots.length}</ThemedText>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'reports' && styles.tabActive]}
          onPress={() => setActiveTab('reports')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'reports' && styles.tabTextActive]}>
            Reports
          </ThemedText>
          {reports.length > 0 && (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{reports.length}</ThemedText>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'deletes' && styles.tabActive]}
          onPress={() => setActiveTab('deletes')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'deletes' && styles.tabTextActive]}>
            Delete Requests
          </ThemedText>
          {deleteRequests.length > 0 && (
            <View style={styles.badge}>
              <ThemedText style={styles.badgeText}>{deleteRequests.length}</ThemedText>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {activeTab === 'spots' && (
        <FlatList
          data={pendingSpots}
          renderItem={renderSpot}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-done-circle-outline" size={80} color={Colors.text.secondary} />
              <ThemedText style={styles.emptyText}>
                No pending spots to review
              </ThemedText>
            </View>
          }
        />
      )}

      {activeTab === 'reports' && (
        <FlatList
          data={reports}
          renderItem={renderReport}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="shield-checkmark-outline" size={80} color={Colors.text.secondary} />
              <ThemedText style={styles.emptyText}>
                No reports to review
              </ThemedText>
            </View>
          }
        />
      )}

      {activeTab === 'deletes' && (
        <FlatList
          data={deleteRequests}
          renderItem={renderDeleteRequest}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="trash-outline" size={80} color={Colors.text.secondary} />
              <ThemedText style={styles.emptyText}>
                No delete requests
              </ThemedText>
            </View>
          }
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 8,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  badge: {
    backgroundColor: Colors.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  spotName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  typeTag: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  cityText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: Colors.text.primary,
    marginBottom: 8,
    lineHeight: 20,
  },
  addedBy: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  reportedBy: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  approveButton: {
    backgroundColor: Colors.success,
  },
  rejectButton: {
    backgroundColor: Colors.error,
  },
  viewButton: {
    backgroundColor: Colors.primary,
  },
  dismissButton: {
    backgroundColor: Colors.text.secondary,
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
});