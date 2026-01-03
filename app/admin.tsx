// app/admin.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { canManageCity, isSuperAdmin, useAdminRole } from '@/hooks/useAdminRole';
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
  city: string;
  reportedBy: string;
  reportedByEmail: string;
  reason: string;
  createdAt: any;
};

type RemovalRequest = {
  id: string;
  spotId: string;
  spotName: string;
  city: string;
  requestedBy: string;
  requestedByName: string;
  requestedByEmail: string;
  reason: string;
  status: string;
  createdAt: any;
};

export default function AdminScreen() {
  const { user } = useAuth();
  const { role, cities, loading: roleLoading } = useAdminRole();
  const [pendingSpots, setPendingSpots] = useState<Spot[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'spots' | 'reports' | 'removals'>('spots');

  // Filter data based on admin role
  const filterByCity = (items: any[]) => {
    if (isSuperAdmin(role)) return items;
    return items.filter(item => cities.includes(item.city));
  };

  useEffect(() => {
    if (!user || roleLoading) return;
    if (!role) {
      setLoading(false);
      return;
    }

    // Listen to pending spots
    const spotsQuery = query(
      collection(db, 'spots'),
      where('status', '==', 'pending')
    );

    const unsubscribeSpots = onSnapshot(spotsQuery, (snapshot) => {
      const spots: Spot[] = [];
      snapshot.docs.forEach((doc) => {
        spots.push({ id: doc.id, ...doc.data() } as Spot);
      });
      setPendingSpots(filterByCity(spots));
      setLoading(false);
    });

    // Listen to reports
    const unsubscribeReports = onSnapshot(
      collection(db, 'spotReports'),
      (snapshot) => {
        const fetchedReports: Report[] = [];
        snapshot.docs.forEach((doc) => {
          fetchedReports.push({ id: doc.id, ...doc.data() } as Report);
        });
        setReports(filterByCity(fetchedReports));
      }
    );

    // Listen to removal requests (only pending for city admins, all for super)
    const removalsQuery = isSuperAdmin(role)
      ? query(collection(db, 'removalRequests'), where('status', '==', 'pending'))
      : query(
          collection(db, 'removalRequests'),
          where('status', '==', 'pending'),
          where('city', 'in', cities.length > 0 ? cities : ['__none__'])
        );

    const unsubscribeRemovals = onSnapshot(removalsQuery, (snapshot) => {
      const requests: RemovalRequest[] = [];
      snapshot.docs.forEach((doc) => {
        requests.push({ id: doc.id, ...doc.data() } as RemovalRequest);
      });
      setRemovalRequests(requests);
    });

    return () => {
      unsubscribeSpots();
      unsubscribeReports();
      unsubscribeRemovals();
    };
  }, [user, role, cities, roleLoading]);

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

  // City admin: Request removal (goes to super admin queue)
  const handleRequestRemoval = async (spotId: string, spotName: string, city: string) => {
    Alert.prompt(
      'Request Removal',
      'Why should this spot be removed?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Please provide a reason.');
              return;
            }
            try {
              // Get current user info
              const userDoc = await getDoc(doc(db, 'users', user!.uid));
              const userData = userDoc.data();

              await addDoc(collection(db, 'removalRequests'), {
                spotId,
                spotName,
                city,
                requestedBy: user!.uid,
                requestedByName: userData?.displayName || 'Unknown',
                requestedByEmail: user!.email,
                reason: reason.trim(),
                status: 'pending',
                createdAt: serverTimestamp(),
              });
              Alert.alert('Submitted', 'Removal request sent to super admins.');
            } catch (error) {
              console.error('Error creating removal request:', error);
              Alert.alert('Error', 'Failed to submit removal request.');
            }
          },
        },
      ],
      'plain-text'
    );
  };

  // Super admin: Approve removal request and delete spot
  const handleApproveRemoval = async (request: RemovalRequest) => {
    Alert.alert(
      'Approve Removal',
      `Delete "${request.spotName}" permanently?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Delete the spot
              await deleteDoc(doc(db, 'spots', request.spotId));
              // Update request status
              await updateDoc(doc(db, 'removalRequests', request.id), {
                status: 'approved',
                approvedBy: user?.email,
                approvedAt: serverTimestamp(),
              });
              Alert.alert('Deleted', 'Spot has been permanently removed.');
            } catch (error) {
              console.error('Error deleting spot:', error);
              Alert.alert('Error', 'Failed to delete spot.');
            }
          },
        },
      ]
    );
  };

  // Super admin: Reject removal request
  const handleRejectRemoval = async (requestId: string) => {
    try {
      await updateDoc(doc(db, 'removalRequests', requestId), {
        status: 'rejected',
        rejectedBy: user?.email,
        rejectedAt: serverTimestamp(),
      });
      Alert.alert('Rejected', 'Removal request has been rejected.');
    } catch (error) {
      console.error('Error rejecting removal:', error);
      Alert.alert('Error', 'Failed to reject removal request.');
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
      
      <ThemedText style={styles.cityText}>📍 {item.city}</ThemedText>
      <ThemedText style={styles.reportedBy}>
        Reported by {item.reportedByEmail}
      </ThemedText>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => router.push({ pathname: '/spot/[id]', params: { id: item.spotId } })}
        >
          <Ionicons name="eye" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>View</ThemedText>
        </TouchableOpacity>

        {isSuperAdmin(role) ? (
          // Super admin can delete directly
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={() => handleApproveRemoval({
              id: item.id,
              spotId: item.spotId,
              spotName: item.spotName,
              city: item.city,
            } as RemovalRequest)}
          >
            <Ionicons name="trash" size={20} color={Colors.white} />
            <ThemedText style={styles.actionButtonText}>Delete</ThemedText>
          </TouchableOpacity>
        ) : (
          // City admin requests removal
          <TouchableOpacity
            style={[styles.actionButton, styles.warningButton]}
            onPress={() => handleRequestRemoval(item.spotId, item.spotName, item.city)}
          >
            <Ionicons name="flag" size={20} color={Colors.white} />
            <ThemedText style={styles.actionButtonText}>Request Removal</ThemedText>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.actionButton, styles.dismissButton]}
          onPress={() => handleDismissReport(item.id)}
        >
          <Ionicons name="close" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>Dismiss</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderRemovalRequest = ({ item }: { item: RemovalRequest }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText style={styles.spotName}>{item.spotName}</ThemedText>
        <View style={[styles.typeTag, { backgroundColor: '#FF9800' }]}>
          <ThemedText style={styles.typeText}>Removal Request</ThemedText>
        </View>
      </View>
      
      <ThemedText style={styles.cityText}>📍 {item.city}</ThemedText>
      <ThemedText style={styles.description}>"{item.reason}"</ThemedText>
      <ThemedText style={styles.reportedBy}>
        Requested by {item.requestedByName} ({item.requestedByEmail})
      </ThemedText>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.viewButton]}
          onPress={() => router.push({ pathname: '/spot/[id]', params: { id: item.spotId } })}
        >
          <Ionicons name="eye" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>View</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApproveRemoval(item)}
        >
          <Ionicons name="trash" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>Delete</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.dismissButton]}
          onPress={() => handleRejectRemoval(item.id)}
        >
          <Ionicons name="close" size={20} color={Colors.white} />
          <ThemedText style={styles.actionButtonText}>Reject</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading || roleLoading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  if (!role) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.noAccessContainer}>
          <Ionicons name="lock-closed" size={60} color={Colors.text.secondary} />
          <ThemedText style={styles.noAccessText}>Admin access required</ThemedText>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <ThemedText style={styles.backBtnText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View>
          <ThemedText type="title" style={styles.title}>
            Admin Panel
          </ThemedText>
          <ThemedText style={styles.roleText}>
            {isSuperAdmin(role) ? '🛡️ Super Admin' : `📍 City Admin: ${cities.join(', ')}`}
          </ThemedText>
        </View>
      </View>

      {/* Super Admin: Manage Admins Button */}
      {isSuperAdmin(role) && (
        <TouchableOpacity
          style={styles.manageAdminsBtn}
          onPress={() => router.push('/manage-admins')}
        >
          <Ionicons name="people" size={20} color={Colors.white} />
          <ThemedText style={styles.manageAdminsBtnText}>Manage Admins</ThemedText>
        </TouchableOpacity>
      )}

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'spots' && styles.tabActive]}
          onPress={() => setActiveTab('spots')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'spots' && styles.tabTextActive]}>
            Pending
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

        {/* Removal requests tab - only for super admins */}
        {isSuperAdmin(role) && (
          <TouchableOpacity
            style={[styles.tab, activeTab === 'removals' && styles.tabActive]}
            onPress={() => setActiveTab('removals')}
          >
            <ThemedText style={[styles.tabText, activeTab === 'removals' && styles.tabTextActive]}>
              Removals
            </ThemedText>
            {removalRequests.length > 0 && (
              <View style={styles.badge}>
                <ThemedText style={styles.badgeText}>{removalRequests.length}</ThemedText>
              </View>
            )}
          </TouchableOpacity>
        )}
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

      {activeTab === 'removals' && isSuperAdmin(role) && (
        <FlatList
          data={removalRequests}
          renderItem={renderRemovalRequest}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="trash-outline" size={80} color={Colors.text.secondary} />
              <ThemedText style={styles.emptyText}>
                No removal requests
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
    marginBottom: 15,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  roleText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  manageAdminsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#9C27B0',
    marginHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginBottom: 15,
  },
  manageAdminsBtnText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
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
    flexWrap: 'wrap',
  },
  actionButton: {
    flex: 1,
    minWidth: 80,
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
  warningButton: {
    backgroundColor: '#FF9800',
  },
  actionButtonText: {
    color: Colors.white,
    fontSize: 13,
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
  noAccessContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  noAccessText: {
    fontSize: 18,
    color: Colors.text.secondary,
  },
  backBtn: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 10,
  },
  backBtnText: {
    color: Colors.white,
    fontWeight: '600',
  },
});
