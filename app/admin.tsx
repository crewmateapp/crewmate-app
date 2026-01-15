// app/admin.tsx - Enhanced Admin Portal with City Management
// Fixed: Uses local airport database instead of external API

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, functions } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { AirportData, getAirportByCode, searchAirports } from '@/utils/airportData';
import { notifyCityApproved, notifyCityRejected, notifySpotApproved, notifySpotRejected } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
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

type TabType = 'spots' | 'reports' | 'removals' | 'cities' | 'cityRequests' | 'analytics' | 'feedback' | 'migration';

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

type Feedback = {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userAirline: string;
  category: 'bug' | 'feature' | 'general' | 'other';
  title: string;
  description: string;
  status: 'new' | 'reviewed' | 'resolved' | 'archived';
  platform: string;
  appVersion: string;
  createdAt: any;
};

export default function AdminScreen() {
  const { user } = useAuth();
  const { role, cities, loading: roleLoading } = useAdminRole();
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [loading, setLoading] = useState(true);

  // Spot moderation data
  const [pendingSpots, setPendingSpots] = useState<Spot[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [removalRequests, setRemovalRequests] = useState<RemovalRequest[]>([]);

  // City management data
  const [allCities, setAllCities] = useState<City[]>([]);
  const [cityRequests, setCityRequests] = useState<CityRequest[]>([]);
  const [airportSearch, setAirportSearch] = useState('');
  const [searchResults, setSearchResults] = useState<AirportData[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedAirport, setSelectedAirport] = useState<AirportData | null>(null);
  const [addingCity, setAddingCity] = useState(false);
  
  // City edit modal
  const [editingCity, setEditingCity] = useState<City | null>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);

  // Feedback data
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);

  // Migration
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string>('');
  const [fixingOrphanedUsers, setFixingOrphanedUsers] = useState(false);
  const [orphanedUsersResult, setOrphanedUsersResult] = useState<any>(null);
  
  // City Name Migration
  const [fixingCityNames, setFixingCityNames] = useState(false);
  const [cityMigrationResult, setCityMigrationResult] = useState<any>(null);

  // Analytics data
  const [stats, setStats] = useState({
    // User stats
    totalUsers: 0,
    newUsersToday: 0,
    newUsersThisWeek: 0,
    newUsersThisMonth: 0,
    activeThisWeek: 0,
    usersByAirline: [] as { airline: string; count: number }[],
    usersByPosition: { flightAttendants: 0, pilots: 0, other: 0 },
    
    // Engagement stats
    layoversThisWeek: 0,
    plansThisWeek: 0,
    connectionsThisWeek: 0,
    messagesThisWeek: 0,
    totalConnections: 0,
    
    // Content stats
    totalSpots: 0,
    spotsByCity: [] as { city: string; count: number }[],
    reviewsThisWeek: 0,
    photosThisWeek: 0,
    topSavedSpots: [] as { name: string; city: string; saves: number }[],
    
    // Growth - signups per day for last 7 days
    signupsLast7Days: [] as { date: string; count: number }[],
    
    // City stats
    totalCities: 0,
    citiesWithSpots: 0,
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

  // Load ALL tab counts on mount (for accurate badge numbers)
  useEffect(() => {
    if (!user || !role) return;

    const unsubscribes: (() => void)[] = [];

    // Always load spots count
    unsubscribes.push(loadPendingSpots());

    // Always load reports count
    unsubscribes.push(loadReports());

    // Always load removals count
    unsubscribes.push(loadRemovalRequests());

    // Super admin: load city requests count and feedback
    if (isSuperAdmin(role)) {
      unsubscribes.push(loadCityRequests());
      unsubscribes.push(loadFeedback());
    }

    return () => {
      unsubscribes.forEach(unsub => unsub && unsub());
    };
  }, [user, role]);

  // Load full data for active tab (cities and analytics need full load)
  useEffect(() => {
    if (!user || !role) return;

    switch (activeTab) {
      case 'cities':
        loadCities();
        break;
      case 'analytics':
        loadAnalytics();
        break;
      case 'feedback':
        if (!isSuperAdmin(role)) return;
        loadFeedback();
        break;
    }
  }, [activeTab, user, role]);

  // Search airports when input changes - uses local database only
  useEffect(() => {
    if (airportSearch.trim().length >= 2) {
      setSearchLoading(true);
      const results = searchAirports(airportSearch);
      setSearchResults(results);
      setSearchLoading(false);
    } else {
      setSearchResults([]);
      setSearchLoading(false);
    }
  }, [airportSearch]);

  // Filter function for city admins
  const filterByCity = <T extends { city?: string }>(items: T[]): T[] => {
    if (isSuperAdmin(role)) return items;
    if (!cities || cities.length === 0) return [];
    return items.filter(item => cities.includes(item.city || ''));
  };

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

  // Load feedback (super admin only)
  const loadFeedback = () => {
    const q = query(collection(db, 'feedback'));
    return onSnapshot(q, (snapshot) => {
      const items: Feedback[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Feedback));
      // Sort by createdAt descending, new items first
      items.sort((a, b) => {
        const aTime = a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.createdAt?.toDate?.() || new Date(0);
        return bTime.getTime() - aTime.getTime();
      });
      setFeedbackList(items);
    });
  };

  // Update feedback status
  const handleUpdateFeedbackStatus = async (feedbackId: string, newStatus: Feedback['status']) => {
    try {
      await updateDoc(doc(db, 'feedback', feedbackId), {
        status: newStatus,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error updating feedback:', error);
      Alert.alert('Error', 'Failed to update feedback status.');
    }
  };

  // Delete feedback
  const handleDeleteFeedback = async (feedbackId: string) => {
    Alert.alert(
      'Delete Feedback',
      'Are you sure you want to delete this feedback?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'feedback', feedbackId));
            } catch (error) {
              console.error('Error deleting feedback:', error);
              Alert.alert('Error', 'Failed to delete feedback.');
            }
          }
        }
      ]
    );
  };

  // Add city from selected airport
  const handleAddCity = async () => {
    if (!selectedAirport) {
      Alert.alert('Error', 'Please select an airport from the search results');
      return;
    }

    // Check if city already exists
    const existingCity = allCities.find(c => c.code === selectedAirport.code);
    if (existingCity) {
      Alert.alert('Already Exists', `${selectedAirport.name} (${selectedAirport.code}) is already in the system.`);
      return;
    }

    setAddingCity(true);
    try {
      const newCity: Partial<City> = {
        name: selectedAirport.name,
        code: selectedAirport.code,
        lat: selectedAirport.lat,
        lng: selectedAirport.lng,
        areas: selectedAirport.areas,
        status: 'active',
        createdAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'cities', selectedAirport.code), newCity);

      Alert.alert('Success', `Added ${selectedAirport.name} (${selectedAirport.code})! You can edit to customize neighborhoods.`);
      setAirportSearch('');
      setSelectedAirport(null);
      setSearchResults([]);
      loadCities();
    } catch (error) {
      console.error('Error adding city:', error);
      Alert.alert('Error', 'Failed to add city. Please try again.');
    } finally {
      setAddingCity(false);
    }
  };

  // Add city manually (for airports not in database)
  const handleAddCityManually = () => {
    const code = airportSearch.toUpperCase().trim();
    if (code.length < 3 || code.length > 4) {
      Alert.alert('Invalid Code', 'Airport code must be 3-4 letters');
      return;
    }

    // Check if already exists
    const existingCity = allCities.find(c => c.code === code);
    if (existingCity) {
      Alert.alert('Already Exists', `${code} is already in the system.`);
      return;
    }

    // Set up for manual entry
    setEditingCity({
      id: code,
      name: '',
      code: code,
      lat: 0,
      lng: 0,
      areas: [`${code} Airport Area`, 'Downtown'],
      createdAt: null,
    });
    setEditModalVisible(true);
  };

  const handleEditCity = (city: City) => {
    setEditingCity({ ...city });
    setEditModalVisible(true);
  };

  const handleSaveCity = async () => {
    if (!editingCity) return;

    if (!editingCity.name.trim()) {
      Alert.alert('Error', 'City name is required');
      return;
    }

    try {
      const cityData = {
        name: editingCity.name,
        code: editingCity.code,
        lat: editingCity.lat,
        lng: editingCity.lng,
        areas: editingCity.areas,
        status: 'active',
      };

      // Check if this is a new city or edit
      const existingCity = allCities.find(c => c.id === editingCity.id);
      
      if (existingCity) {
        await updateDoc(doc(db, 'cities', editingCity.id), cityData);
        Alert.alert('Success', 'City updated!');
      } else {
        await setDoc(doc(db, 'cities', editingCity.code), {
          ...cityData,
          createdAt: serverTimestamp(),
        });
        Alert.alert('Success', `Added ${editingCity.name}!`);
      }

      setEditModalVisible(false);
      setEditingCity(null);
      setAirportSearch('');
      loadCities();
    } catch (error) {
      console.error('Error saving city:', error);
      Alert.alert('Error', 'Failed to save city');
    }
  };

  const handleDeleteCity = async (city: City) => {
    Alert.alert(
      'Delete City',
      `Are you sure you want to delete ${city.name}? This will affect all spots and users in this city.`,
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

  // Approve city request using local database
  const handleApproveCityRequest = async (request: CityRequest) => {
    try {
      const code = request.airportCode.toUpperCase().trim();
      
      // Try to find in local database
      const airport = getAirportByCode(code);
      
      if (airport) {
        // Found in database - use that data
        await setDoc(doc(db, 'cities', code), {
          name: airport.name,
          code: airport.code,
          lat: airport.lat,
          lng: airport.lng,
          areas: airport.areas,
          status: 'active',
          createdAt: serverTimestamp(),
          requestedBy: request.requestedBy,
        });
      } else {
        // Not in database - create with minimal data, admin can edit later
        await setDoc(doc(db, 'cities', code), {
          name: code, // Use code as placeholder name
          code: code,
          lat: 0,
          lng: 0,
          areas: [`${code} Airport Area`, 'Downtown'],
          status: 'active',
          createdAt: serverTimestamp(),
          requestedBy: request.requestedBy,
          needsReview: true, // Flag for admin to update
        });
      }

      // Update request status
      await updateDoc(doc(db, 'cityRequests', request.id), {
        status: 'approved',
        approvedBy: user!.uid,
        approvedAt: serverTimestamp(),
      });
      // Notify the user who requested the city
      const cityName = airport ? airport.name : code;
      await notifyCityApproved(request.requestedBy, code, cityName);


      if (airport) {
        Alert.alert('Success', `Added ${airport.name}! You can edit to customize neighborhoods.`);
      } else {
        Alert.alert('Success', `Added ${code}. Please edit to add city name and coordinates.`);
      }
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
              // Notify the user
              await notifyCityRejected(request.requestedBy, request.airportCode, request.airportCode);

            } catch (error) {
              console.error('Error rejecting request:', error);
            }
          }
        }
      ]
    );
  };
  // Spot moderation handlers
  const handleApproveSpot = async (spot: Spot) => {
    try {
      // Update spot status
      await updateDoc(doc(db, 'spots', spot.id), {
        status: 'approved',
        approvedBy: user!.uid,
        approvedAt: serverTimestamp(),
      });

      // Get user's photo
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', spot.addedBy)));
      const userPhoto = userDoc.docs[0]?.data()?.photoURL || null;

      // Create activity record for spot_added
      await addDoc(collection(db, 'activities'), {
        userId: spot.addedBy,
        userName: spot.addedByName,
        userPhoto: userPhoto,
        type: 'spot_added',
        spotId: spot.id,
        spotName: spot.name,
        city: spot.city,
        createdAt: spot.createdAt || serverTimestamp(),
      });

      // If spot has photos, create photo_posted activity
      const spotDoc = await getDocs(query(collection(db, 'spots'), where('__name__', '==', spot.id)));
      if (!spotDoc.empty) {
        const spotData = spotDoc.docs[0].data();
        const photos = spotData.photoURLs || spotData.photos || [];
        if (photos.length > 0) {
          await addDoc(collection(db, 'activities'), {
            userId: spot.addedBy,
            userName: spot.addedByName,
            userPhoto: userPhoto,
            type: 'photo_posted',
            spotId: spot.id,
            spotName: spot.name,
            city: spot.city,
            createdAt: spot.createdAt || serverTimestamp(),
          });
        }
      }

      // Notify the user who submitted the spot
      await notifySpotApproved(spot.addedBy, spot.id, spot.name);

      Alert.alert('Approved', `${spot.name} is now live!`);
    } catch (error) {
      console.error('Error approving spot:', error);
    }
  };

  const handleRejectSpot = async (spot: Spot) => {
    Alert.alert(
      'Reject Spot',
      'Reject "' + spot.name + '"? The submitter will be notified.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'spots', spot.id));
              // Notify the user
              await notifySpotRejected(spot.addedBy, spot.id, spot.name);

            } catch (error) {
              console.error('Error rejecting spot:', error);
            }
          }
        }
      ]
    );
  };

  const handleApproveRemoval = async (request: RemovalRequest) => {
    try {
      await deleteDoc(doc(db, 'spots', request.spotId));
      await deleteDoc(doc(db, 'deleteRequests', request.id));
      Alert.alert('Deleted', 'Spot has been removed');
    } catch (error) {
      console.error('Error approving removal:', error);
    }
  };

  const handleRejectRemoval = async (request: RemovalRequest) => {
    try {
      await updateDoc(doc(db, 'deleteRequests', request.id), {
        status: 'rejected',
        rejectedBy: user!.uid,
        rejectedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error('Error rejecting removal:', error);
    }
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

  // Analytics Functions
  const loadAnalytics = async () => {
    try {
      // Time boundaries
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const oneWeekAgo = new Date(now);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const oneMonthAgo = new Date(now);
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      // Fetch all data in parallel
      const [
        usersSnap,
        spotsSnap,
        connectionsSnap,
        plansSnap,
        reviewsSnap,
        activitiesSnap,
        citiesSnap,
        savedSpotsSnap,
      ] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'spots'), where('status', '==', 'approved'))),
        getDocs(collection(db, 'connections')),
        getDocs(collection(db, 'plans')),
        getDocs(collection(db, 'reviews')),
        getDocs(collection(db, 'activities')),
        getDocs(collection(db, 'cities')),
        getDocs(collection(db, 'savedSpots')),
      ]);

      // ===== USER ANALYTICS =====
      let newUsersToday = 0;
      let newUsersThisWeek = 0;
      let newUsersThisMonth = 0;
      let activeThisWeek = 0;
      const airlineCounts: Record<string, number> = {};
      const positionCounts = { flightAttendants: 0, pilots: 0, other: 0 };
      const signupsByDay: Record<string, number> = {};

      // Initialize last 7 days
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        signupsByDay[dateStr] = 0;
      }

      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        
        // Count by signup date
        if (data.createdAt) {
          const createdDate = data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
          
          if (createdDate >= todayStart) newUsersToday++;
          if (createdDate >= oneWeekAgo) newUsersThisWeek++;
          if (createdDate >= oneMonthAgo) newUsersThisMonth++;
          
          // Signups by day for chart
          const dateStr = createdDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          if (signupsByDay[dateStr] !== undefined) {
            signupsByDay[dateStr]++;
          }
        }
        
        // Active users (check lastActive or currentLayover)
        const lastActive = data.lastActive?.toDate ? data.lastActive.toDate() : null;
        const hasRecentLayover = data.currentLayover?.updatedAt?.toDate ? 
          data.currentLayover.updatedAt.toDate() > oneWeekAgo : false;
        
        if ((lastActive && lastActive > oneWeekAgo) || hasRecentLayover) {
          activeThisWeek++;
        }
        
        // Count by airline
        if (data.airline) {
          airlineCounts[data.airline] = (airlineCounts[data.airline] || 0) + 1;
        }
        
        // Count by position
        const position = (data.position || '').toLowerCase();
        if (position.includes('flight attendant') || position.includes('fa') || position.includes('cabin')) {
          positionCounts.flightAttendants++;
        } else if (position.includes('pilot') || position.includes('captain') || position.includes('first officer') || position.includes('fo')) {
          positionCounts.pilots++;
        } else if (position) {
          positionCounts.other++;
        }
      });

      // Sort airlines by count
      const usersByAirline = Object.entries(airlineCounts)
        .map(([airline, count]) => ({ airline, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Convert signups to array
      const signupsLast7Days = Object.entries(signupsByDay)
        .map(([date, count]) => ({ date, count }));

      // ===== ENGAGEMENT ANALYTICS =====
      let layoversThisWeek = 0;
      let plansThisWeek = 0;
      let connectionsThisWeek = 0;

      // Count layovers set this week (from activities)
      activitiesSnap.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        if (createdAt && createdAt >= oneWeekAgo) {
          if (data.type === 'layover_set') layoversThisWeek++;
        }
      });

      // Plans created this week
      plansSnap.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        if (createdAt && createdAt >= oneWeekAgo) {
          plansThisWeek++;
        }
      });

      // Connections made this week
      connectionsSnap.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        if (createdAt && createdAt >= oneWeekAgo) {
          connectionsThisWeek++;
        }
      });

      // ===== CONTENT ANALYTICS =====
      const cityCounts: Record<string, number> = {};
      let reviewsThisWeek = 0;
      let photosThisWeek = 0;

      // Spots by city
      spotsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.city) {
          cityCounts[data.city] = (cityCounts[data.city] || 0) + 1;
        }
      });

      const spotsByCity = Object.entries(cityCounts)
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // Reviews this week
      reviewsSnap.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        if (createdAt && createdAt >= oneWeekAgo) {
          reviewsThisWeek++;
        }
      });

      // Photos this week (from activities)
      activitiesSnap.docs.forEach(doc => {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        if (createdAt && createdAt >= oneWeekAgo && data.type === 'photo_posted') {
          photosThisWeek++;
        }
      });

      // Top saved spots
      const spotSaveCounts: Record<string, { name: string; city: string; saves: number }> = {};
      savedSpotsSnap.docs.forEach(doc => {
        const data = doc.data();
        if (data.spotId && data.spotName) {
          if (!spotSaveCounts[data.spotId]) {
            spotSaveCounts[data.spotId] = {
              name: data.spotName,
              city: data.city || 'Unknown',
              saves: 0
            };
          }
          spotSaveCounts[data.spotId].saves++;
        }
      });

      const topSavedSpots = Object.values(spotSaveCounts)
        .sort((a, b) => b.saves - a.saves)
        .slice(0, 5);

      // ===== CITY STATS =====
      const citiesWithSpots = new Set(spotsSnap.docs.map(doc => doc.data().city)).size;

      // Set all stats
      setStats({
        totalUsers: usersSnap.size,
        newUsersToday,
        newUsersThisWeek,
        newUsersThisMonth,
        activeThisWeek,
        usersByAirline,
        usersByPosition: positionCounts,
        
        layoversThisWeek,
        plansThisWeek,
        connectionsThisWeek,
        messagesThisWeek: 0, // Would need to count from messages collection
        totalConnections: connectionsSnap.size,
        
        totalSpots: spotsSnap.size,
        spotsByCity,
        reviewsThisWeek,
        photosThisWeek,
        topSavedSpots,
        
        signupsLast7Days,
        
        totalCities: citiesSnap.size,
        citiesWithSpots,
      });
    } catch (error) {
      console.error('Error loading analytics:', error);
    }
  };
  // Fix Orphaned Users (users in Auth but not in Firestore)
const handleFixOrphanedUsers = async () => {
  if (!isSuperAdmin(role)) {
    Alert.alert('Permission Denied', 'Only super admins can run this operation.');
    return;
  }

  Alert.alert(
    'Fix Orphaned Users',
    'This will create Firestore documents for users who exist in Authentication but are missing from the users collection. Continue?',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Fix Users',
        onPress: async () => {
          try {
            setFixingOrphanedUsers(true);
            setOrphanedUsersResult(null);
            const fixOrphanedUsers = httpsCallable(functions, 'fixOrphanedUsers');
            const response = await fixOrphanedUsers();
            setOrphanedUsersResult(response.data);
            Alert.alert(
              'Success!',
              `Fixed ${(response.data as any).fixed} orphaned users out of ${(response.data as any).processed} total users.`
            );
          } catch (error: any) {
            console.error('Error fixing orphaned users:', error);
            Alert.alert('Error', error.message || 'Failed to fix orphaned users');
          } finally {
            setFixingOrphanedUsers(false);
          }
        },
      },
    ]
  );
};

  // Fix City Names Migration
  const handleFixCityNames = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this operation.');
      return;
    }

    Alert.alert(
      'Fix City Names',
      'This will standardize city names in all spots (e.g., "Minneapolis" → "Minneapolis-St Paul"). Want to preview changes first?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Preview',
          onPress: async () => {
            try {
              setFixingCityNames(true);
              setCityMigrationResult(null);
              
              // Fetch all approved spots
              const spotsSnapshot = await getDocs(query(collection(db, 'spots'), where('status', '==', 'approved')));
              
              // Define city mappings
              const cityMappings: Record<string, string> = {
                'Minneapolis': 'Minneapolis-St Paul',
                'St Paul': 'Minneapolis-St Paul',
                'St. Paul': 'Minneapolis-St Paul',
                'Charleston': 'Charleston SC',
                'Greenville': 'Greenville SC',
                'Raleigh': 'Raleigh-Durham',
                'Durham': 'Raleigh-Durham',
                'Columbia': 'Columbia SC',
                'Fort Lauderdale': 'Fort Lauderdale',
                'Fort Myers': 'Fort Myers',
                'New York': 'New York JFK', // Could also be LGA, but we'll default to JFK
                'Los Angeles': 'Los Angeles',
                'San Francisco': 'San Francisco',
                'Chicago': 'Chicago',
                'Dallas': 'Dallas-Fort Worth',
                'Fort Worth': 'Dallas-Fort Worth',
                'Houston': 'Houston',
                'Phoenix': 'Phoenix',
                'Philadelphia': 'Philadelphia',
                'San Antonio': 'San Antonio',
                'San Diego': 'San Diego',
                'San Jose': 'San Jose',
                'Austin': 'Austin',
                'Jacksonville': 'Jacksonville',
                'Indianapolis': 'Indianapolis',
                'Columbus': 'Columbus',
                'Charlotte': 'Charlotte',
                'Seattle': 'Seattle',
                'Denver': 'Denver',
                'Boston': 'Boston',
                'Nashville': 'Nashville',
                'Baltimore': 'Baltimore',
                'Oklahoma City': 'Oklahoma City',
                'Portland': 'Portland',
                'Las Vegas': 'Las Vegas',
                'Detroit': 'Detroit',
                'Memphis': 'Memphis',
                'Louisville': 'Louisville',
                'Milwaukee': 'Milwaukee',
                'Albuquerque': 'Albuquerque',
                'Tucson': 'Tucson',
                'Fresno': 'Fresno',
                'Sacramento': 'Sacramento',
                'Kansas City': 'Kansas City',
                'Atlanta': 'Atlanta',
                'Miami': 'Miami',
                'Cleveland': 'Cleveland',
                'New Orleans': 'New Orleans',
                'Tampa': 'Tampa',
                'Honolulu': 'Honolulu',
                'Omaha': 'Omaha',
                'Oakland': 'Oakland',
                'Tulsa': 'Tulsa',
                'Minneapolis': 'Minneapolis-St Paul',
                'Wichita': 'Wichita',
                'Arlington': 'Dallas-Fort Worth',
              };
              
              const changes: any[] = [];
              let unchangedCount = 0;
              
              spotsSnapshot.docs.forEach((doc) => {
                const spot = doc.data();
                const currentCity = spot.city;
                const standardizedCity = cityMappings[currentCity];
                
                if (standardizedCity && standardizedCity !== currentCity) {
                  changes.push({
                    id: doc.id,
                    name: spot.name,
                    oldCity: currentCity,
                    newCity: standardizedCity,
                  });
                } else {
                  unchangedCount++;
                }
              });
              
              setCityMigrationResult({
                preview: true,
                changes,
                unchangedCount,
                totalProcessed: spotsSnapshot.docs.length,
              });
              
              if (changes.length === 0) {
                Alert.alert('No Changes Needed', `All ${spotsSnapshot.docs.length} spots already have standardized city names!`);
              } else {
                Alert.alert(
                  'Preview Complete',
                  `Found ${changes.length} spots to update out of ${spotsSnapshot.docs.length} total.\n\nReview the changes below, then click "Apply Changes" to update.`
                );
              }
            } catch (error: any) {
              console.error('Error previewing city name changes:', error);
              Alert.alert('Error', error.message || 'Failed to preview changes');
            } finally {
              setFixingCityNames(false);
            }
          },
        },
        {
          text: 'Apply Now',
          style: 'destructive',
          onPress: async () => {
            try {
              setFixingCityNames(true);
              setCityMigrationResult(null);
              
              // Fetch all approved spots
              const spotsSnapshot = await getDocs(query(collection(db, 'spots'), where('status', '==', 'approved')));
              
              // Define city mappings (same as above)
              const cityMappings: Record<string, string> = {
                'Minneapolis': 'Minneapolis-St Paul',
                'St Paul': 'Minneapolis-St Paul',
                'St. Paul': 'Minneapolis-St Paul',
                'Charleston': 'Charleston SC',
                'Greenville': 'Greenville SC',
                'Raleigh': 'Raleigh-Durham',
                'Durham': 'Raleigh-Durham',
                'Columbia': 'Columbia SC',
                'Fort Lauderdale': 'Fort Lauderdale',
                'Fort Myers': 'Fort Myers',
                'New York': 'New York JFK',
                'Los Angeles': 'Los Angeles',
                'San Francisco': 'San Francisco',
                'Chicago': 'Chicago',
                'Dallas': 'Dallas-Fort Worth',
                'Fort Worth': 'Dallas-Fort Worth',
                'Houston': 'Houston',
                'Phoenix': 'Phoenix',
                'Philadelphia': 'Philadelphia',
                'San Antonio': 'San Antonio',
                'San Diego': 'San Diego',
                'San Jose': 'San Jose',
                'Austin': 'Austin',
                'Jacksonville': 'Jacksonville',
                'Indianapolis': 'Indianapolis',
                'Columbus': 'Columbus',
                'Charlotte': 'Charlotte',
                'Seattle': 'Seattle',
                'Denver': 'Denver',
                'Boston': 'Boston',
                'Nashville': 'Nashville',
                'Baltimore': 'Baltimore',
                'Oklahoma City': 'Oklahoma City',
                'Portland': 'Portland',
                'Las Vegas': 'Las Vegas',
                'Detroit': 'Detroit',
                'Memphis': 'Memphis',
                'Louisville': 'Louisville',
                'Milwaukee': 'Milwaukee',
                'Albuquerque': 'Albuquerque',
                'Tucson': 'Tucson',
                'Fresno': 'Fresno',
                'Sacramento': 'Sacramento',
                'Kansas City': 'Kansas City',
                'Atlanta': 'Atlanta',
                'Miami': 'Miami',
                'Cleveland': 'Cleveland',
                'New Orleans': 'New Orleans',
                'Tampa': 'Tampa',
                'Honolulu': 'Honolulu',
                'Omaha': 'Omaha',
                'Oakland': 'Oakland',
                'Tulsa': 'Tulsa',
                'Wichita': 'Wichita',
                'Arlington': 'Dallas-Fort Worth',
              };
              
              const changes: any[] = [];
              let unchangedCount = 0;
              let errorCount = 0;
              
              // Update spots
              for (const docSnapshot of spotsSnapshot.docs) {
                const spot = docSnapshot.data();
                const currentCity = spot.city;
                const standardizedCity = cityMappings[currentCity];
                
                if (standardizedCity && standardizedCity !== currentCity) {
                  try {
                    await updateDoc(doc(db, 'spots', docSnapshot.id), {
                      city: standardizedCity,
                    });
                    changes.push({
                      id: docSnapshot.id,
                      name: spot.name,
                      oldCity: currentCity,
                      newCity: standardizedCity,
                    });
                  } catch (error) {
                    console.error(`Error updating spot ${docSnapshot.id}:`, error);
                    errorCount++;
                  }
                } else {
                  unchangedCount++;
                }
              }
              
              setCityMigrationResult({
                preview: false,
                changes,
                unchangedCount,
                errorCount,
                totalProcessed: spotsSnapshot.docs.length,
              });
              
              Alert.alert(
                'Migration Complete!',
                `✅ Updated: ${changes.length} spots\n📍 Unchanged: ${unchangedCount} spots\n${errorCount > 0 ? `❌ Errors: ${errorCount} spots\n` : ''}\n\nAll spots now have standardized city names!`
              );
            } catch (error: any) {
              console.error('Error fixing city names:', error);
              Alert.alert('Error', error.message || 'Failed to fix city names');
            } finally {
              setFixingCityNames(false);
            }
          },
        },
      ]
    );
  };

  // Migration function (kept from original)
  const handleMigrateCities = async () => {
    // This would migrate from hardcoded cities - keeping as placeholder
    Alert.alert('Info', 'Migration feature - use Add City to add new cities');
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
              style={[styles.tab, activeTab === 'feedback' && styles.tabActive]}
              onPress={() => setActiveTab('feedback')}
            >
              <ThemedText style={[styles.tabText, activeTab === 'feedback' && styles.tabTextActive]}>
                Feedback {feedbackList.filter(f => f.status === 'new').length > 0 && `(${feedbackList.filter(f => f.status === 'new').length})`}
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
                    <Ionicons name="close" size={20} color={Colors.white} />
                    <ThemedText style={styles.actionButtonText}>Dismiss</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={60} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyText}>No reports</ThemedText>
              </View>
            }
          />
        )}

        {/* Removals Tab */}
        {activeTab === 'removals' && (
          <FlatList
            data={removalRequests}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText style={styles.cardTitle}>{item.spotName}</ThemedText>
                  <ThemedText style={styles.cardMeta}>{item.city}</ThemedText>
                </View>
                <ThemedText style={styles.cardReason}>Reason: {item.reason}</ThemedText>
                <ThemedText style={styles.cardFooter}>
                  Requested by {item.requestedByName}
                </ThemedText>
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.approveButton]}
                    onPress={() => handleApproveRemoval(item)}
                  >
                    <Ionicons name="checkmark" size={20} color={Colors.white} />
                    <ThemedText style={styles.actionButtonText}>Approve</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.rejectButton]}
                    onPress={() => handleRejectRemoval(item)}
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
                <ThemedText style={styles.emptyText}>No removal requests</ThemedText>
              </View>
            }
          />
        )}

        {/* Cities Tab */}
        {activeTab === 'cities' && (
          <ScrollView style={styles.scrollContent}>
            {/* Add City Section */}
            <View style={styles.addCityForm}>
              <ThemedText style={styles.sectionTitle}>Add New City</ThemedText>
              
              {/* Search Input */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={Colors.text.secondary} />
                <TextInput
                  style={styles.searchInput}
                  value={airportSearch}
                  onChangeText={setAirportSearch}
                  placeholder="Search by code, city, or airport name..."
                  placeholderTextColor={Colors.text.secondary}
                  autoCapitalize="characters"
                />
                {airportSearch.length > 0 && (
                  <TouchableOpacity onPress={() => {
                    setAirportSearch('');
                    setSelectedAirport(null);
                    setSearchResults([]);
                  }}>
                    <Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Results */}
              {searchLoading && (
                <View style={styles.searchLoading}>
                  <ActivityIndicator size="small" color={Colors.primary} />
                  <ThemedText style={styles.searchLoadingText}>Searching airports...</ThemedText>
                </View>
              )}

              {!searchLoading && searchResults.length > 0 && (
                <View style={styles.searchResults}>
                  {searchResults.slice(0, 5).map((airport) => (
                    <TouchableOpacity
                      key={airport.code}
                      style={[
                        styles.searchResultItem,
                        selectedAirport?.code === airport.code && styles.searchResultItemSelected
                      ]}
                      onPress={() => setSelectedAirport(airport)}
                    >
                      <View style={styles.searchResultMain}>
                        <ThemedText style={styles.searchResultCode}>{airport.code}</ThemedText>
                        <View style={styles.searchResultInfo}>
                          <ThemedText style={styles.searchResultName}>{airport.name}</ThemedText>
                          <ThemedText style={styles.searchResultAirport} numberOfLines={1}>
                            {airport.fullName}
                          </ThemedText>
                        </View>
                      </View>
                      {selectedAirport?.code === airport.code && (
                        <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* No results message */}
              {!searchLoading && airportSearch.length >= 3 && searchResults.length === 0 && (
                <View style={styles.noResults}>
                  <Ionicons name="airplane-outline" size={24} color={Colors.text.secondary} />
                  <ThemedText style={styles.noResultsText}>
                    No airports found for "{airportSearch}"
                  </ThemedText>
                  <ThemedText style={styles.noResultsHint}>
                    Try the 3-letter IATA code or add manually below
                  </ThemedText>
                </View>
              )}

              {/* Selected Airport Preview */}
              {selectedAirport && (
                <View style={styles.selectedAirport}>
                  <ThemedText style={styles.selectedLabel}>Selected:</ThemedText>
                  <ThemedText style={styles.selectedName}>
                    {selectedAirport.name} ({selectedAirport.code})
                  </ThemedText>
                  <ThemedText style={styles.selectedDetails}>
                    📍 {selectedAirport.lat.toFixed(4)}, {selectedAirport.lng.toFixed(4)}
                  </ThemedText>
                  <ThemedText style={styles.selectedDetails}>
                    Areas: {selectedAirport.areas.join(', ')}
                  </ThemedText>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.addCityActions}>
                <TouchableOpacity
                  style={[
                    styles.addCityButton,
                    (!selectedAirport || addingCity) && styles.addCityButtonDisabled
                  ]}
                  onPress={handleAddCity}
                  disabled={!selectedAirport || addingCity}
                >
                  {addingCity ? (
                    <ActivityIndicator size="small" color={Colors.white} />
                  ) : (
                    <>
                      <Ionicons name="add" size={20} color={Colors.white} />
                      <ThemedText style={styles.addCityButtonText}>Add City</ThemedText>
                    </>
                  )}
                </TouchableOpacity>

                {airportSearch.length >= 3 && searchResults.length === 0 && (
                  <TouchableOpacity
                    style={styles.manualAddButton}
                    onPress={handleAddCityManually}
                  >
                    <Ionicons name="create-outline" size={20} color={Colors.primary} />
                    <ThemedText style={styles.manualAddButtonText}>
                      Add "{airportSearch.toUpperCase()}" Manually
                    </ThemedText>
                  </TouchableOpacity>
                )}
              </View>

              <ThemedText style={styles.hint}>
                Search for airports in our database, or add manually if not found
              </ThemedText>
            </View>

            {/* Cities List */}
            <ThemedText style={styles.sectionTitle}>All Cities ({allCities.length})</ThemedText>
            {allCities.map((city) => (
              <View key={city.id} style={[
                styles.cityCard,
                city.needsReview && styles.cityCardNeedsReview
              ]}>
                <View style={styles.cityHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.cityNameRow}>
                      <ThemedText style={styles.cityName}>{city.name}</ThemedText>
                      {city.needsReview && (
                        <View style={styles.needsReviewBadge}>
                          <ThemedText style={styles.needsReviewText}>Needs Review</ThemedText>
                        </View>
                      )}
                    </View>
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
                  📍 {city.lat?.toFixed(4) || '0'}, {city.lng?.toFixed(4) || '0'}
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
            renderItem={({ item }) => {
              const knownAirport = getAirportByCode(item.airportCode);
              return (
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <ThemedText style={styles.cardTitle}>
                      Airport: {item.airportCode}
                    </ThemedText>
                    {knownAirport && (
                      <ThemedText style={styles.cardMeta}>
                        {knownAirport.name} - Found in database ✓
                      </ThemedText>
                    )}
                    {!knownAirport && (
                      <ThemedText style={[styles.cardMeta, { color: Colors.warning }]}>
                        Not in database - will need manual entry
                      </ThemedText>
                    )}
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
              );
            }}
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
          <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Section: User Overview */}
            <ThemedText style={styles.analyticsSection}>👥 User Overview</ThemedText>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="people" size={28} color={Colors.primary} />
                <ThemedText style={styles.statNumber}>{stats.totalUsers}</ThemedText>
                <ThemedText style={styles.statLabel}>Total Users</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="flash" size={28} color={Colors.success} />
                <ThemedText style={styles.statNumber}>{stats.activeThisWeek}</ThemedText>
                <ThemedText style={styles.statLabel}>Active This Week</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="today" size={28} color={Colors.accent} />
                <ThemedText style={styles.statNumber}>{stats.newUsersToday}</ThemedText>
                <ThemedText style={styles.statLabel}>New Today</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="calendar" size={28} color={Colors.primary} />
                <ThemedText style={styles.statNumber}>{stats.newUsersThisWeek}</ThemedText>
                <ThemedText style={styles.statLabel}>New This Week</ThemedText>
              </View>
            </View>

            {/* Signups Chart */}
            <ThemedText style={styles.analyticsSection}>📈 Signups (Last 7 Days)</ThemedText>
            <View style={styles.chartContainer}>
              <View style={styles.barChart}>
                {stats.signupsLast7Days.map((day, index) => {
                  const maxCount = Math.max(...stats.signupsLast7Days.map(d => d.count), 1);
                  const barHeight = Math.max((day.count / maxCount) * 80, 4); // Max 80px height
                  return (
                    <View key={index} style={styles.barWrapper}>
                      <ThemedText style={styles.barValue}>{day.count}</ThemedText>
                      <View style={[styles.bar, { height: barHeight }]} />
                      <ThemedText style={styles.barLabel}>{day.date.split(' ')[1]}</ThemedText>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* Users by Position */}
            <ThemedText style={styles.analyticsSection}>✈️ Users by Position</ThemedText>
            <View style={styles.breakdownCard}>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownLabelRow}>
                  <View style={[styles.breakdownDot, { backgroundColor: Colors.primary }]} />
                  <ThemedText style={styles.breakdownLabel}>Flight Attendants</ThemedText>
                </View>
                <ThemedText style={styles.breakdownValue}>{stats.usersByPosition.flightAttendants}</ThemedText>
              </View>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownLabelRow}>
                  <View style={[styles.breakdownDot, { backgroundColor: Colors.accent }]} />
                  <ThemedText style={styles.breakdownLabel}>Pilots</ThemedText>
                </View>
                <ThemedText style={styles.breakdownValue}>{stats.usersByPosition.pilots}</ThemedText>
              </View>
              <View style={styles.breakdownRow}>
                <View style={styles.breakdownLabelRow}>
                  <View style={[styles.breakdownDot, { backgroundColor: Colors.text.secondary }]} />
                  <ThemedText style={styles.breakdownLabel}>Other</ThemedText>
                </View>
                <ThemedText style={styles.breakdownValue}>{stats.usersByPosition.other}</ThemedText>
              </View>
            </View>

            {/* Top Airlines */}
            {stats.usersByAirline.length > 0 && (
              <>
                <ThemedText style={styles.analyticsSection}>🏢 Top Airlines</ThemedText>
                <View style={styles.breakdownCard}>
                  {stats.usersByAirline.map((item, index) => (
                    <View key={index} style={styles.breakdownRow}>
                      <ThemedText style={styles.breakdownLabel}>
                        {index + 1}. {item.airline}
                      </ThemedText>
                      <ThemedText style={styles.breakdownValue}>{item.count}</ThemedText>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Section: Engagement */}
            <ThemedText style={styles.analyticsSection}>🔥 Engagement (This Week)</ThemedText>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="airplane" size={28} color={Colors.primary} />
                <ThemedText style={styles.statNumber}>{stats.layoversThisWeek}</ThemedText>
                <ThemedText style={styles.statLabel}>Layovers Set</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="calendar-outline" size={28} color={Colors.accent} />
                <ThemedText style={styles.statNumber}>{stats.plansThisWeek}</ThemedText>
                <ThemedText style={styles.statLabel}>Plans Created</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="link" size={28} color={Colors.success} />
                <ThemedText style={styles.statNumber}>{stats.connectionsThisWeek}</ThemedText>
                <ThemedText style={styles.statLabel}>New Connections</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="people-circle" size={28} color={Colors.primary} />
                <ThemedText style={styles.statNumber}>{stats.totalConnections}</ThemedText>
                <ThemedText style={styles.statLabel}>Total Connections</ThemedText>
              </View>
            </View>

            {/* Section: Content */}
            <ThemedText style={styles.analyticsSection}>📍 Content</ThemedText>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Ionicons name="location" size={28} color={Colors.primary} />
                <ThemedText style={styles.statNumber}>{stats.totalSpots}</ThemedText>
                <ThemedText style={styles.statLabel}>Approved Spots</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="globe" size={28} color={Colors.accent} />
                <ThemedText style={styles.statNumber}>{stats.citiesWithSpots}</ThemedText>
                <ThemedText style={styles.statLabel}>Cities with Spots</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="star" size={28} color={Colors.accent} />
                <ThemedText style={styles.statNumber}>{stats.reviewsThisWeek}</ThemedText>
                <ThemedText style={styles.statLabel}>Reviews This Week</ThemedText>
              </View>

              <View style={styles.statCard}>
                <Ionicons name="camera" size={28} color={Colors.primary} />
                <ThemedText style={styles.statNumber}>{stats.photosThisWeek}</ThemedText>
                <ThemedText style={styles.statLabel}>Photos This Week</ThemedText>
              </View>
            </View>

            {/* Top Cities by Spots */}
            {stats.spotsByCity.length > 0 && (
              <>
                <ThemedText style={styles.analyticsSection}>🏙️ Top Cities by Spots</ThemedText>
                <View style={styles.breakdownCard}>
                  {stats.spotsByCity.map((item, index) => (
                    <View key={index} style={styles.breakdownRow}>
                      <ThemedText style={styles.breakdownLabel}>
                        {index + 1}. {item.city}
                      </ThemedText>
                      <ThemedText style={styles.breakdownValue}>{item.count} spots</ThemedText>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Top Saved Spots */}
            {stats.topSavedSpots.length > 0 && (
              <>
                <ThemedText style={styles.analyticsSection}>❤️ Most Saved Spots</ThemedText>
                <View style={styles.breakdownCard}>
                  {stats.topSavedSpots.map((item, index) => (
                    <View key={index} style={styles.breakdownRow}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.breakdownLabel}>
                          {index + 1}. {item.name}
                        </ThemedText>
                        <ThemedText style={styles.breakdownSubLabel}>{item.city}</ThemedText>
                      </View>
                      <ThemedText style={styles.breakdownValue}>{item.saves} saves</ThemedText>
                    </View>
                  ))}
                </View>
              </>
            )}

            {/* Bottom Spacer */}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        {/* Feedback Tab */}
        {activeTab === 'feedback' && (
          <FlatList
            data={feedbackList}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.card, item.status === 'new' && styles.cardNew]}>
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.feedbackHeader}>
                      <View style={[
                        styles.feedbackCategoryBadge,
                        { backgroundColor: 
                          item.category === 'bug' ? Colors.error + '20' :
                          item.category === 'feature' ? Colors.accent + '20' :
                          item.category === 'general' ? Colors.primary + '20' :
                          Colors.text.secondary + '20'
                        }
                      ]}>
                        <Ionicons 
                          name={
                            item.category === 'bug' ? 'bug' :
                            item.category === 'feature' ? 'bulb' :
                            item.category === 'general' ? 'chatbubble' : 'ellipsis-horizontal'
                          } 
                          size={14} 
                          color={
                            item.category === 'bug' ? Colors.error :
                            item.category === 'feature' ? Colors.accent :
                            item.category === 'general' ? Colors.primary :
                            Colors.text.secondary
                          } 
                        />
                        <ThemedText style={[
                          styles.feedbackCategoryText,
                          { color: 
                            item.category === 'bug' ? Colors.error :
                            item.category === 'feature' ? Colors.accent :
                            item.category === 'general' ? Colors.primary :
                            Colors.text.secondary
                          }
                        ]}>
                          {item.category === 'bug' ? 'Bug' : 
                           item.category === 'feature' ? 'Feature' : 
                           item.category === 'general' ? 'General' : 'Other'}
                        </ThemedText>
                      </View>
                      <View style={[
                        styles.feedbackStatusBadge,
                        { backgroundColor: 
                          item.status === 'new' ? Colors.accent :
                          item.status === 'reviewed' ? Colors.primary :
                          item.status === 'resolved' ? Colors.success :
                          Colors.text.secondary
                        }
                      ]}>
                        <ThemedText style={styles.feedbackStatusText}>
                          {item.status.toUpperCase()}
                        </ThemedText>
                      </View>
                    </View>
                    <ThemedText style={styles.cardTitle}>{item.title}</ThemedText>
                  </View>
                </View>
                <ThemedText style={styles.cardDescription}>{item.description}</ThemedText>
                <View style={styles.feedbackMeta}>
                  <ThemedText style={styles.feedbackMetaText}>
                    👤 {item.userName} • {item.userAirline}
                  </ThemedText>
                  <ThemedText style={styles.feedbackMetaText}>
                    📧 {item.userEmail}
                  </ThemedText>
                  <ThemedText style={styles.feedbackMetaText}>
                    📱 {item.platform} • v{item.appVersion}
                  </ThemedText>
                  <ThemedText style={styles.feedbackMetaText}>
                    🕐 {item.createdAt?.toDate?.().toLocaleDateString() || 'Unknown'}
                  </ThemedText>
                </View>
                <View style={styles.feedbackActions}>
                  {item.status === 'new' && (
                    <TouchableOpacity
                      style={[styles.feedbackActionButton, { backgroundColor: Colors.primary }]}
                      onPress={() => handleUpdateFeedbackStatus(item.id, 'reviewed')}
                    >
                      <Ionicons name="eye" size={16} color={Colors.white} />
                      <ThemedText style={styles.feedbackActionText}>Mark Reviewed</ThemedText>
                    </TouchableOpacity>
                  )}
                  {item.status === 'reviewed' && (
                    <TouchableOpacity
                      style={[styles.feedbackActionButton, { backgroundColor: Colors.success }]}
                      onPress={() => handleUpdateFeedbackStatus(item.id, 'resolved')}
                    >
                      <Ionicons name="checkmark-circle" size={16} color={Colors.white} />
                      <ThemedText style={styles.feedbackActionText}>Mark Resolved</ThemedText>
                    </TouchableOpacity>
                  )}
                  {item.status !== 'archived' && (
                    <TouchableOpacity
                      style={[styles.feedbackActionButton, { backgroundColor: Colors.text.secondary }]}
                      onPress={() => handleUpdateFeedbackStatus(item.id, 'archived')}
                    >
                      <Ionicons name="archive" size={16} color={Colors.white} />
                      <ThemedText style={styles.feedbackActionText}>Archive</ThemedText>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.feedbackActionButton, { backgroundColor: Colors.error }]}
                    onPress={() => handleDeleteFeedback(item.id)}
                  >
                    <Ionicons name="trash" size={16} color={Colors.white} />
                  </TouchableOpacity>
                </View>
              </View>
            )}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="chatbubbles-outline" size={60} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyStateText}>No feedback yet</ThemedText>
                <ThemedText style={styles.emptyStateSubtext}>
                  Feedback from alpha testers will appear here
                </ThemedText>
              </View>
            }
          />
        )}

        {/* Migration Tab */}
        {activeTab === 'migration' && (
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            <ThemedText style={styles.sectionTitle}>🔧 User Management</ThemedText>
            
            <View style={styles.card}>
              <ThemedText style={styles.cardTitle}>Fix Orphaned Users</ThemedText>
              <ThemedText style={styles.cardDescription}>
                Find users who exist in Firebase Authentication but are missing from the Firestore users collection and create their documents.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, fixingOrphanedUsers && styles.buttonDisabled]}
                onPress={handleFixOrphanedUsers}
                disabled={fixingOrphanedUsers}
              >
                {fixingOrphanedUsers ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>Fix Orphaned Users</ThemedText>
                )}
              </TouchableOpacity>
              
              {orphanedUsersResult && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: Colors.success + '10' }]}>
                  <ThemedText style={styles.cardTitle}>✅ Results</ThemedText>
                  <ThemedText style={styles.cardDescription}>
                    • Processed: {orphanedUsersResult.processed} users{'\n'}
                    • Fixed: {orphanedUsersResult.fixed} orphaned users{'\n'}
                    • Already existed: {orphanedUsersResult.alreadyExisted} users
                  </ThemedText>
                  
                  {orphanedUsersResult.fixedUsers && orphanedUsersResult.fixedUsers.length > 0 && (
                    <>
                      <ThemedText style={[styles.cardTitle, { marginTop: 12 }]}>Fixed Users:</ThemedText>
                      {orphanedUsersResult.fixedUsers.map((user: any, index: number) => (
                        <ThemedText key={index} style={styles.cardDescription}>
                          • {user.email}
                        </ThemedText>
                      ))}
                    </>
                  )}
                </View>
              )}
            </View>

            {/* City Name Migration Card */}
            <View style={[styles.card, { marginTop: 20 }]}>
              <ThemedText style={styles.cardTitle}>Fix City Names in Spots</ThemedText>
              <ThemedText style={styles.cardDescription}>
                Standardize city names in all spots to match your cities database. For example:{'\n'}
                • "Minneapolis" → "Minneapolis-St Paul"{'\n'}
                • "Charleston" → "Charleston SC"{'\n'}
                • "Raleigh" → "Raleigh-Durham"{'\n'}
                {'\n'}
                Click "Preview" to see what will change, or "Apply Now" to fix immediately.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, fixingCityNames && styles.buttonDisabled]}
                onPress={handleFixCityNames}
                disabled={fixingCityNames}
              >
                {fixingCityNames ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>Fix City Names</ThemedText>
                )}
              </TouchableOpacity>
              
              {cityMigrationResult && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: cityMigrationResult.preview ? Colors.info + '10' : Colors.success + '10' }]}>
                  <ThemedText style={styles.cardTitle}>
                    {cityMigrationResult.preview ? '👀 Preview' : '✅ Complete'}
                  </ThemedText>
                  <ThemedText style={styles.cardDescription}>
                    • Total Spots: {cityMigrationResult.totalProcessed}{'\n'}
                    • To Update: {cityMigrationResult.changes.length}{'\n'}
                    • Already Correct: {cityMigrationResult.unchangedCount}
                    {cityMigrationResult.errorCount > 0 && `\n• Errors: ${cityMigrationResult.errorCount}`}
                  </ThemedText>
                  
                  {cityMigrationResult.changes && cityMigrationResult.changes.length > 0 && (
                    <>
                      <ThemedText style={[styles.cardTitle, { marginTop: 12 }]}>
                        {cityMigrationResult.preview ? 'Changes to Apply:' : 'Changes Applied:'}
                      </ThemedText>
                      <ScrollView style={{ maxHeight: 200 }}>
                        {cityMigrationResult.changes.slice(0, 20).map((change: any, index: number) => (
                          <ThemedText key={index} style={styles.cardDescription}>
                            • {change.name}: "{change.oldCity}" → "{change.newCity}"
                          </ThemedText>
                        ))}
                        {cityMigrationResult.changes.length > 20 && (
                          <ThemedText style={[styles.cardDescription, { fontStyle: 'italic' }]}>
                            ... and {cityMigrationResult.changes.length - 20} more
                          </ThemedText>
                        )}
                      </ScrollView>
                    </>
                  )}
                </View>
              )}
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
              <ThemedText style={styles.modalTitle}>
                {allCities.find(c => c.id === editingCity?.id) ? 'Edit City' : 'Add City Manually'}
              </ThemedText>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <ThemedText style={styles.inputLabel}>Airport Code</ThemedText>
              <TextInput
                style={[styles.modalInput, { backgroundColor: Colors.background + '50' }]}
                value={editingCity?.code || ''}
                editable={false}
              />

              <ThemedText style={styles.inputLabel}>City Name *</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editingCity?.name || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, name: text } : null)}
                placeholder="e.g., Charlotte"
                placeholderTextColor={Colors.text.secondary}
              />

              <ThemedText style={styles.inputLabel}>Latitude *</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editingCity?.lat?.toString() || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, lat: parseFloat(text) || 0 } : null)}
                placeholder="e.g., 35.2140"
                placeholderTextColor={Colors.text.secondary}
                keyboardType="numeric"
              />

              <ThemedText style={styles.inputLabel}>Longitude *</ThemedText>
              <TextInput
                style={styles.modalInput}
                value={editingCity?.lng?.toString() || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, lng: parseFloat(text) || 0 } : null)}
                placeholder="e.g., -80.9431"
                placeholderTextColor={Colors.text.secondary}
                keyboardType="numeric"
              />

              <ThemedText style={styles.inputLabel}>Areas (one per line)</ThemedText>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea]}
                value={editingCity?.areas?.join('\n') || ''}
                onChangeText={(text) => setEditingCity(prev => prev ? { ...prev, areas: text.split('\n').filter(a => a.trim()) } : null)}
                placeholder="CLT Airport Area&#10;Uptown Charlotte&#10;South End"
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
    flexGrow: 0,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
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
  // Add City Form
  addCityForm: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    fontSize: 16,
    color: Colors.text.primary,
  },
  searchLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  searchLoadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  noResults: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  noResultsText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  noResultsHint: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  searchResults: {
    marginTop: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: Colors.background,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  searchResultItemSelected: {
    backgroundColor: Colors.primary + '15',
    borderColor: Colors.primary,
  },
  searchResultMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  searchResultCode: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
    backgroundColor: Colors.primary + '20',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    marginRight: 12,
    minWidth: 50,
    textAlign: 'center',
  },
  searchResultInfo: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 15,
    fontWeight: '600',
  },
  searchResultAirport: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  selectedAirport: {
    marginTop: 16,
    padding: 12,
    backgroundColor: Colors.primary + '10',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  selectedLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  selectedName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  selectedDetails: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  addCityActions: {
    marginTop: 16,
    gap: 12,
  },
  addCityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 8,
  },
  addCityButtonDisabled: {
    opacity: 0.5,
  },
  addCityButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  manualAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  manualAddButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  hint: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 12,
    textAlign: 'center',
  },
  // City Card
  cityCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityCardNeedsReview: {
    borderColor: Colors.warning,
    backgroundColor: Colors.warning + '10',
  },
  cityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cityNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  needsReviewBadge: {
    backgroundColor: Colors.warning,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  needsReviewText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.white,
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
  // Stats
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    marginVertical: 6,
  },
  statLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  // Analytics Section
  analyticsSection: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
    marginTop: 8,
    color: Colors.text.primary,
  },
  // Chart styles
  chartContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  barChart: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 120,
    paddingTop: 20, // Room for the value labels
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: 24,
    backgroundColor: Colors.primary,
    borderRadius: 4,
    minHeight: 4,
  },
  barValue: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  barLabel: {
    fontSize: 10,
    color: Colors.text.secondary,
    marginTop: 6,
  },
  // Breakdown card styles
  breakdownCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  breakdownLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  breakdownDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  breakdownLabel: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  breakdownSubLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  breakdownValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  // Modal
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
  // Feedback styles
  cardNew: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.accent,
  },
  feedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  feedbackCategoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  feedbackCategoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  feedbackStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  feedbackStatusText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  feedbackMeta: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: 4,
  },
  feedbackMetaText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  feedbackActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  feedbackActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  feedbackActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
});
