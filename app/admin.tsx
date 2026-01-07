// app/admin.tsx - Enhanced Admin Portal with City Migration
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

type TabType = 'spots' | 'reports' | 'removals' | 'cities' | 'cityRequests' | 'analytics' | 'migration';

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

type City = {
  id: string;
  name: string;
  code: string;
  lat: number;
  lng: number;
  areas: string[];
  status?: string;
  createdAt: any;
};

type CityRequest = {
  id: string;
  airportCode: string;
  requestedBy: string;
  requestedByName: string;
  requestedByEmail: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: any;
};

export default function AdminScreen() {
  const { user } = useAuth();
  const { role, cities, loading: roleLoading } = useAdminRole();
  const [activeTab, setActiveTab] = useState<TabType>('spots');
  const [loading, setLoading] = useState(true);

  // Spot moderation data
  const [pendingSpots, setPendingSpots] = useState<Spot[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);

  // City management data
  const [allCities, setAllCities] = useState<City[]>([]);
  const [cityRequests, setCityRequests] = useState<CityRequest[]>([]);
  const [newAirportCode, setNewAirportCode] = useState('');
  const [addingCity, setAddingCity] = useState(false);
  
  // City edit modal
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Migration
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string>('');

  // Analytics data
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeThisWeek: 0,
    totalSpots: 0,
    totalConnections: 0,
    totalMessages: 0,
  });

  // Check admin access
  useEffect(() => {
    if (!user || roleLoading) return;
    if (!role) {
      Alert.alert('Access Denied', 'You do not have admin access.');
      router.back();
      return;
    }
    setLoading(false);
  }, [user, role, roleLoading]);

  // Load data based on active tab
  useEffect(() => {
    if (!user || !role) return;

    let unsubscribe: (() => void) | undefined;

    switch (activeTab) {
      case 'spots':
        unsubscribe = loadPendingSpots();
        break;
      case 'reports':
        unsubscribe = loadReports();
        break;
      case 'removals':
        unsubscribe = loadRemovalRequests();
        break;
      case 'cities':
        loadCities();
        break;
      case 'cityRequests':
        unsubscribe = loadCityRequests();
        break;
      case 'analytics':
        loadAnalytics();
        break;
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [activeTab, user, role]);

  // Spot Moderation Functions
  const loadPendingSpots = () => {
    const q = query(collection(db, 'spots'), where('status', '==', 'pending'));
    return onSnapshot(q, (snapshot) => {
      const spots: Spot[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Spot));
      setPendingSpots(filterByCity(spots));
    });
  };

  const loadReports = () => {
    const q = collection(db, 'spotReports');
    return onSnapshot(q, (snapshot) => {
      const reportsList: Report[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Report));
      setReports(filterByCity(reportsList));
    });
  };

  const loadRemovalRequests = () => {
    const q = query(
      collection(db, 'deleteRequests'),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (snapshot) => {
      const requests: RemovalRequest[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as RemovalRequest));
      setRemovalRequests(filterByCity(requests));
    });
  };

  // City Management Functions
  const loadCities = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'cities'));
      const citiesList: City[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as City));
      setAllCities(citiesList.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error('Error loading cities:', error);
    }
  };

  const loadCityRequests = () => {
    const q = query(
      collection(db, 'cityRequests'),
      where('status', '==', 'pending')
    );
    return onSnapshot(q, (snapshot) => {
      const requests: CityRequest[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as CityRequest));
      setCityRequests(requests);
    });
  };

  const handleAddCityByCode = async () => {
    if (!newAirportCode.trim()) {
      Alert.alert('Error', 'Please enter an airport code');
      return;
    }

    setAddingCity(true);
    try {
      // Fetch airport data from OpenSky Network (FREE API)
      const code = newAirportCode.toUpperCase().trim();
      const response = await fetch(
        `https://opensky-network.org/api/airports/?icao=${code}`
      );
      
      if (!response.ok) {
        throw new Error('Airport not found');
      }

      const data = await response.json();
      
      if (!data || data.length === 0) {
        Alert.alert('Not Found', 'Could not find airport with that code. Please add manually.');
        setAddingCity(false);
        return;
      }

      const airport = data[0];

      // Create city document with your structure
      const newCity: Partial<City> = {
        name: airport.city || airport.name,
        code: code,
        lat: airport.latitude,
        lng: airport.longitude,
        areas: [`${code} Airport Area`, 'Downtown'], // Default areas
        status: 'active',
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'cities', code), newCity);

      Alert.alert('Success', `Added ${newCity.name}! You can now edit to add neighborhoods.`);
      setNewAirportCode('');
      loadCities();
    } catch (error) {
      console.error('Error adding city:', error);
      Alert.alert('Error', 'Failed to add city. Please try again.');
    } finally {
      setAddingCity(false);
    }
  };

  const handleEditCity = (city: City) => {
    setEditingCity({ ...city });
    setEditModalVisible(true);
  };

  const handleSaveCity = async () => {
    if (!editingCity) return;

    try {
      await updateDoc(doc(db, 'cities', editingCity.id), {
        name: editingCity.name,
        code: editingCity.code,
        lat: editingCity.lat,
        lng: editingCity.lng,
        areas: editingCity.areas,
      });

      Alert.alert('Success', 'City updated!');
      setEditModalVisible(false);
      setEditingCity(null);
      loadCities();
    } catch (error) {
      console.error('Error updating city:', error);
      Alert.alert('Error', 'Failed to update city');
    }
  };

  const handleDeleteCity = async (city: City) => {
    Alert.alert(
      'Delete City',
      `Are you sure you want to delete ${city.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'cities', city.id));
              Alert.alert('Deleted', `${city.name} has been removed`);
              loadCities();
            } catch (error) {
              console.error('Error deleting city:', error);
              Alert.alert('Error', 'Failed to delete city');
            }
          }
        }
      ]
    );
  };

  const handleApproveCityRequest = async (request: CityRequest) => {
    try {
      // Fetch airport data
      const response = await fetch(
        `https://opensky-network.org/api/airports/?icao=${request.airportCode.toUpperCase()}`
      );
      
      if (!response.ok) {
        throw new Error('Airport not found');
      }

      const data = await response.json();
      const airport = data[0];

      // Create city document
      await setDoc(doc(db, 'cities', request.airportCode.toUpperCase()), {
        name: airport.city || airport.name,
        code: request.airportCode.toUpperCase(),
        lat: airport.latitude,
        lng: airport.longitude,
        areas: [`${request.airportCode.toUpperCase()} Airport Area`, 'Downtown'],
        status: 'active',
        createdAt: serverTimestamp(),
        requestedBy: request.requestedBy,
      });

      // Update request status
      await updateDoc(doc(db, 'cityRequests', request.id), {
        status: 'approved',
        approvedBy: user!.uid,
        approvedAt: serverTimestamp(),
      });

      Alert.alert('Success', `City request approved! You can now edit to add neighborhoods.`);
      loadCities();
    } catch (error) {
      console.error('Error approving city request:', error);
      Alert.alert('Error', 'Failed to approve request. Please try again.');
    }
  };

  const handleRejectCityRequest = async (request: CityRequest) => {
    Alert.alert(
      'Reject Request',
      'Are you sure you want to reject this city request?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'cityRequests', request.id), {
                status: 'rejected',
                rejectedBy: user!.uid,
                rejectedAt: serverTimestamp(),
              });
            } catch (error) {
              console.error('Error rejecting request:', error);
            }
          }
        }
      ]
    );
  };

  // Migration Functions
  const handleMigrateCities = async () => {
    Alert.alert(
      'Migrate Cities to Firestore',
      'This will copy all 50 cities from cities.ts to Firestore. Run this ONCE only. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Migrate',
          onPress: async () => {
            setMigrating(true);
            setMigrationStatus('Starting migration...');

            try {
              // Import the cities data from the correct location
              const { cities } = await import('@/data/cities');
              
              let successCount = 0;
              let errorCount = 0;

              for (const city of cities) {
                try {
                  await setDoc(doc(db, 'cities', city.code), {
                    name: city.name,
                    code: city.code,
                    lat: city.lat,
                    lng: city.lng,
                    areas: city.areas,
                    status: 'active',
                    createdAt: serverTimestamp(),
                    migratedFrom: 'cities.ts',
                  });

                  successCount++;
                  setMigrationStatus(`Migrated ${successCount}/${cities.length}: ${city.name}`);
                } catch (error) {
                  errorCount++;
                  console.error(`Failed to migrate ${city.name}:`, error);
                }
              }

              setMigrationStatus('');
              Alert.alert(
                'Migration Complete!',
                `✓ Success: ${successCount}\n✗ Errors: ${errorCount}\nTotal: ${cities.length}`,
                [{ text: 'OK', onPress: () => loadCities() }]
              );
            } catch (error) {
              console.error('Migration error:', error);
              Alert.alert('Error', 'Migration failed. Check console for details.');
            } finally {
              setMigrating(false);
            }
          }
        }
      ]
    );
  };

  // Analytics Functions
  const loadAnalytics = async () => {
    try {
      const [usersSnap, spotsSnap, connectionsSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'spots'), where('status', '==', 'approved'))),
        getDocs(collection(db, 'connections')),
      ]);

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      let activeCount = 0;
      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.lastActive && data.lastActive.toDate() > oneWeekAgo) {
          activeCount++;
        }
      });

      setStats({
        totalUsers: usersSnap.size,
        activeThisWeek: activeCount,
        totalSpots: spotsSnap.size,
        totalConnections: connectionsSnap.size,
        totalMessages: 0,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };

  // Helper Functions
  const filterByCity = <T extends { city: string }>(items: T[]): T[] => {
    if (isSuperAdmin(role)) return items;
    return items.filter(item => cities.includes(item.city));
  };

  const handleApproveSpot = async (spot: Spot) => {
    try {
      await updateDoc(doc(db, 'spots', spot.id), {
        status: 'approved',
        approvedBy: user!.uid,
        approvedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error approving spot:', error);
      Alert.alert('Error', 'Failed to approve spot');
    }
  };

  const handleRejectSpot = async (spot: Spot) => {
    Alert.alert(
      'Reject Spot',
      `Are you sure you want to reject "${spot.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'spots', spot.id));
            } catch (error) {
              console.error('Error rejecting spot:', error);
            }
          }
        }
      ]
    );
  };

  const handleDeleteReportedSpot = async (report: Report) => {
    Alert.alert(
      'Delete Spot',
      `Delete "${report.spotName}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'spots', report.spotId));
              await deleteDoc(doc(db, 'spotReports', report.id));
              Alert.alert('Deleted', 'Spot has been removed');
            } catch (error) {
              console.error('Error deleting spot:', error);
            }
          }
        }
      ]
    );
  };

  const handleDismissReport = async (report: Report) => {
    try {
      await deleteDoc(doc(db, 'spotReports', report.id));
    } catch (error) {
      console.error('Error dismissing report:', error);
    }
  };

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
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={60} color={Colors.text.secondary} />
          <ThemedText style={styles.errorText}>Access Denied</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Admin Panel</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Tab Bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'spots' && styles.tabActive]}
          onPress={() => setActiveTab('spots')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'spots' && styles.tabTextActive]}>
            Spots ({pendingSpots.length})
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

        <TouchableOpacity
          style={[styles.tab, activeTab === 'removals' && styles.tabActive]}
          onPress={() => setActiveTab('removals')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'removals' && styles.tabTextActive]}>
            Removals ({removalRequests.length})
          </ThemedText>
        </TouchableOpacity>

        {isSuperAdmin(role) && (
          <>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'cities' && styles.tabActive]}
              onPress={() => setActiveTab('cities')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'cities' && styles.tabTextActive]}>
                Cities ({allCities.length})
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'cityRequests' && styles.tabActive]}
              onPress={() => setActiveTab('cityRequests')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'cityRequests' && styles.tabTextActive]}>
                Requests ({cityRequests.length})
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'analytics' && styles.tabActive]}
              onPress={() => setActiveTab('analytics')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>
                Analytics
              </ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tab, activeTab === 'migration' && styles.tabActive]}
              onPress={() => setActiveTab('migration')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'migration' && styles.tabTextActive]}>
                Migration
              </ThemedText>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Content */}
      <View style={styles.content}>
        {/* Pending Spots Tab */}
        {activeTab === 'spots' && (
          <FlatList
            data={pendingSpots}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle}>{item.name}</ThemedText>
                  <ThemedText style={styles.cardMeta}>
                    {item.type} • {item.city}
                  </ThemedText>
                </View>
                <ThemedText style={styles.cardAddress}>{item.address}</ThemedText>
                <ThemedText style={styles.cardDescription} numberOfLines={2}>
                  {item.description}
                </ThemedText>
                <ThemedText style={styles.cardFooter}>
                  Added by {item.addedByName}
                </ThemedText>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApproveSpot(item)}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                    <ThemedText style={styles.actionButtonText}>Approve</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleRejectSpot(item)}
                  >
                    <Ionicons name="close" size={20} color={Colors.white} />
                    <ThemedText style={styles.actionButtonText}>Reject</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={60} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyText}>No pending spots</ThemedText>
              </View>
            }
          />
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <FlatList
            data={reports}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle}>{item.spotName}</ThemedText>
                  <ThemedText style={styles.cardMeta}>{item.city}</ThemedText>
                </View>
                <ThemedText style={styles.cardReason}>Reason: {item.reason}</ThemedText>
                <ThemedText style={styles.cardFooter}>
                  Reported by {item.reportedByEmail}
                </ThemedText>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteReportedSpot(item)}
                  >
                    <Ionicons name="trash" size={20} color={Colors.white} />
                    <ThemedText style={styles.actionButtonText}>Delete Spot</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.dismissButton]}
                    onPress={() => handleDismissReport(item)}
                  >
                    <ThemedText style={styles.actionButtonText}>Dismiss</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="shield-checkmark" size={60} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyText}>No reports</ThemedText>
              </View>
            }
          />
        )}

        {/* Cities Tab */}
        {activeTab === 'cities' && (
          <ScrollView style={styles.scrollContent}>
            {/* Add City Form */}
            <View style={styles.addCityForm}>
              <ThemedText style={styles.sectionTitle}>Add New City</ThemedText>
              <View style={styles.inputRow}>
                <TextInput
                  style={styles.input}
                  value={newAirportCode}
                  onChangeText={setNewAirportCode}
                  placeholder="Airport Code (e.g., CLT, DEN)"
                  placeholderTextColor={Colors.text.secondary}
                  autoCapitalize="characters"
                  maxLength={4}
                />
                <TouchableOpacity
                  style={[styles.addButton, addingCity && styles.addButtonDisabled]}
                  onPress={handleAddCityByCode}
                  disabled={addingCity}
                >
                  {addingCity ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <Ionicons name="add" size={24} color={Colors.white} />
                  )}
                </TouchableOpacity>
              </View>
              <ThemedText style={styles.hint}>
                Enter airport code - city data will be fetched automatically
              </ThemedText>
            </View>

            {/* Cities List */}
            <ThemedText style={styles.sectionTitle}>All Cities ({allCities.length})</ThemedText>
            {allCities.map((city) => (
              <View key={city.id} style={styles.cityCard}>
                <View style={styles.cityHeader}>
                  <View>
                    <ThemedText style={styles.cityName}>{city.name}</ThemedText>
                    <ThemedText style={styles.cityCode}>{city.code}</ThemedText>
                  </View>
                  <View style={styles.cityActions}>
                    <TouchableOpacity
                      style={styles.cityActionButton}
                      onPress={() => handleEditCity(city)}
                    >
                      <Ionicons name="pencil" size={20} color={Colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cityActionButton}
                      onPress={() => handleDeleteCity(city)}
                    >
                      <Ionicons name="trash" size={20} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>
                <ThemedText style={styles.cityCoords}>
                  📍 {city.lat.toFixed(4)}, {city.lng.toFixed(4)}
                </ThemedText>
                <ThemedText style={styles.cityAreas}>
                  Areas: {city.areas?.join(', ') || 'None'}
                </ThemedText>
              </View>
            ))}
          </ScrollView>
        )}

        {/* City Requests Tab */}
        {activeTab === 'cityRequests' && (
          <FlatList
            data={cityRequests}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle}>
                    Airport: {item.airportCode}
                  </ThemedText>
                </View>
                <ThemedText style={styles.cardFooter}>
                  Requested by {item.requestedByName} ({item.requestedByEmail})
                </ThemedText>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApproveCityRequest(item)}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                    <ThemedText style={styles.actionButtonText}>Approve & Add</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleRejectCityRequest(item)}
                  >
                    <Ionicons name="close" size={20} color={Colors.white} />
                    <ThemedText style={styles.actionButtonText}>Reject</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={60} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyText}>No city requests</ThemedText>
              </View>
            }
          />
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <ScrollView style={styles.scrollContent}>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="people" size={32} color={Colors.primary} />
                <ThemedText style={styles.statNumber}>{stats.totalUsers}</ThemedText>
                <ThemedText style={styles.statLabel}>Total Users</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="flash" size={32} color={Colors.accent} />
                <ThemedText style={styles.statNumber}>{stats.activeThisWeek}</ThemedText>
                <ThemedText style={styles.statLabel}>Active This Week</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="location" size={32} color={Colors.primary} />
                <ThemedText style={styles.statNumber}>{stats.totalSpots}</ThemedText>
                <ThemedText style={styles.statLabel}>Approved Spots</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="link" size={32} color={Colors.accent} />
                <ThemedText style={styles.statNumber}>{stats.totalConnections}</ThemedText>
                <ThemedText style={styles.statLabel}>Connections</ThemedText>
              </View>
            </View>
          </ScrollView>
        )}

        {/* Migration Tab */}
        {activeTab === 'migration' && (
          <ScrollView style={styles.scrollContent}>
            <View style={styles.migrationCard}>
              <Ionicons name="cloud-upload" size={48} color={Colors.primary} />
              <ThemedText style={styles.migrationTitle}>
                Migrate Cities to Firestore
              </ThemedText>
              <ThemedText style={styles.migrationText}>
                This will copy all 50 cities from your hardcoded cities.ts file into Firestore.
                {'\n\n'}
                Run this ONCE only. After migration, your app will read cities from Firestore,
                allowing you to add/edit cities without app updates.
                {'\n\n'}
                Current cities in Firestore: {allCities.length}
              </ThemedText>
              
              {migrationStatus && (
                <ThemedText style={styles.migrationStatus}>{migrationStatus}</ThemedText>
              )}

              <TouchableOpacity
                style={[styles.migrationButton, migrating && styles.migrationButtonDisabled]}
                onPress={handleMigrateCities}
                disabled={migrating}
              >
                {migrating ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <>
                    <Ionicons name="rocket" size={20} color={Colors.white} />
                    <ThemedText style={styles.migrationButtonText}>
                      Start Migration
                    </ThemedText>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        )}
      </View>

      {/* Edit City Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Edit City</ThemedText>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <ThemedText style={styles.inputLabel}>City Name</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editingCity?.name || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, name: text } : null)}
                placeholder="City Name"
                placeholderTextColor={Colors.text.secondary}
              />

              <ThemedText style={styles.inputLabel}>Airport Code</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editingCity?.code || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, code: text.toUpperCase() } : null)}
                placeholder="Code"
                placeholderTextColor={Colors.text.secondary}
                autoCapitalize="characters"
                maxLength={4}
              />

              <ThemedText style={styles.inputLabel}>Latitude</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editingCity?.lat?.toString() || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, lat: parseFloat(text) || 0 } : null)}
                placeholder="Latitude"
                placeholderTextColor={Colors.text.secondary}
                keyboardType="numeric"
              />

              <ThemedText style={styles.inputLabel}>Longitude</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editingCity?.lng?.toString() || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, lng: parseFloat(text) || 0 } : null)}
                placeholder="Longitude"
                placeholderTextColor={Colors.text.secondary}
                keyboardType="numeric"
              />

              <ThemedText style={styles.inputLabel}>
                Areas/Neighborhoods (comma-separated)
              </ThemedText>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editingCity?.areas?.join(', ') || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, areas: text.split(',').map(a => a.trim()) } : null)}
                placeholder="Downtown, Airport Area, Midtown"
                placeholderTextColor={Colors.text.secondary}
                multiline
                numberOfLines={4}
              />
            </ScrollView>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelButton}
                onPress={() => setEditModalVisible(false)}
              >
                <ThemedText style={styles.modalCancelButtonText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveButton}
                onPress={handleSaveCity}
              >
                <ThemedText style={styles.modalSaveButtonText}>Save</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  tabBar: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  tabTextActive: {
    color: Colors.primary,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: Colors.card,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardHeader: {
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  cardAddress: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  cardReason: {
    fontSize: 14,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  cardFooter: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  cardActions: {
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
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  approveButton: {
    backgroundColor: Colors.primary,
  },
  rejectButton: {
    backgroundColor: Colors.error,
  },
  deleteButton: {
    backgroundColor: Colors.error,
  },
  dismissButton: {
    backgroundColor: Colors.text.secondary,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginTop: 16,
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 18,
    marginTop: 16,
    color: Colors.text.secondary,
  },
  addCityForm: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
  },
  addButton: {
    backgroundColor: Colors.primary,
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: {
    opacity: 0.6,
  },
  hint: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 8,
  },
  cityCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  cityCode: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  cityActions: {
    flexDirection: 'row',
    gap: 12,
  },
  cityActionButton: {
    padding: 4,
  },
  cityCoords: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  cityAreas: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  migrationCard: {
    backgroundColor: Colors.card,
    padding: 24,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  migrationTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 12,
    textAlign: 'center',
  },
  migrationText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  migrationStatus: {
    fontSize: 12,
    color: Colors.primary,
    marginBottom: 16,
    textAlign: 'center',
  },
  migrationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  migrationButtonDisabled: {
    opacity: 0.6,
  },
  migrationButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
  },
  modalTextArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  modalSaveButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSaveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.white,
  },
});
