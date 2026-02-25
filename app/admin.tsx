// app/admin.tsx - Enhanced Admin Portal with City Management
// Fixed: Uses local airport database instead of external API

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, functions, storage } from '@/config/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { isSuperAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { AirportData, getAirportByCode, searchAirports } from '@/utils/airportData';
import { runFullMigration } from '@/utils/migration_resetPlanStats';
import { notifyCityApproved, notifyCityRejected, notifySpotApproved, notifySpotRejected } from '@/utils/notifications';
import { seedInitialSkylines } from '@/utils/dynamicBaseSkylines';
import { analyzeCitySkylineCoverage, formatCityCoverageReport, getCityCoverageSummary, getPriorityCities, type CityCoverageReport } from '@/utils/citySkylineCoverageAnalyzer';
import { migrateUserBases, previewUserBaseMigration, type UserBaseMigrationResult } from '@/utils/migrateUserBases';
import { migrateSkylinesCityNames } from '@/utils/migrateSkylinesCityNames';
import { migrateCityData, type CityMigrationResult } from '@/utils/migrateCityData';
import { migrateAirlineData } from '@/utils/migrateAirlineData';
import { migrateUserNames } from '@/utils/migrateUserNames';
import { migratePositionData } from '@/utils/migratePositionData';
import { migrateCitiesVisited } from '@/utils/migrateCitiesVisited';
import { migrateUserStats } from '@/utils/migrateUserStats';
import { cleanupStuckLayovers } from '@/utils/cleanupStuckLayovers';
import { backfillReferrals, recountReferrals, type BackfillResult, type RecountResult } from '@/utils/backfillReferrals';
import { sendProfileNudgeCampaign, scanIncompleteProfiles, type NudgeCampaignResult, type IncompleteUser } from '@/utils/sendProfileNudges';
import { seedWhatToBuy, type SeedResult } from '@/utils/seedWhatToBuy';
import { SkylineManager } from '@/components/SkylineManager';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  increment,
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

  // Google Photos Backfill
  const [backfillingPhotos, setBackfillingPhotos] = useState(false);
  const [photoBackfillResult, setPhotoBackfillResult] = useState<any>(null);

  // Badge System Migration
  const [runningBadgeMigration, setRunningBadgeMigration] = useState(false);
  const [badgeMigrationResult, setBadgeMigrationResult] = useState<any>(null);
  
  // Beta Badge Migration
  const [awardingBetaBadges, setAwardingBetaBadges] = useState(false);
  const [betaBadgeResult, setBetaBadgeResult] = useState<any>(null);

  // Skyline Seeding
  const [seedingSkylines, setSeedingSkylines] = useState(false);
  const [skylineSeeded, setSkylineSeeded] = useState(false);

  // Skyline Coverage Analysis
  const [analyzingCoverage, setAnalyzingCoverage] = useState(false);
  const [coverageReport, setCoverageReport] = useState<CityCoverageReport | null>(null);

  // User Base Migration
  const [previewingBaseMigration, setPreviewingBaseMigration] = useState(false);
  const [runningBaseMigration, setRunningBaseMigration] = useState(false);
  const [baseMigrationPreview, setBaseMigrationPreview] = useState<UserBaseMigrationResult | null>(null);
  const [baseMigrationResult, setBaseMigrationResult] = useState<UserBaseMigrationResult | null>(null);

  // Referral Backfill
  const [runningReferralBackfill, setRunningReferralBackfill] = useState(false);
  const [referralBackfillResult, setReferralBackfillResult] = useState<BackfillResult | null>(null);
  const [runningRecount, setRunningRecount] = useState(false);
  const [recountResult, setRecountResult] = useState<RecountResult | null>(null);

  // Skyline City Names Migration
  const [migratingSkylineCityNames, setMigratingSkylineCityNames] = useState(false);
  const [skylineCityNameResult, setSkylineCityNameResult] = useState<any>(null);

  // City Data Migration (lat/lng, names, etc.)
  const [migratingCityData, setMigratingCityData] = useState(false);
  const [cityDataMigrationResult, setCityDataMigrationResult] = useState<CityMigrationResult | null>(null);

  // Cities Visited Migration
  const [migratingCitiesVisited, setMigratingCitiesVisited] = useState(false);
  const [citiesVisitedResult, setCitiesVisitedResult] = useState<any>(null);

  // User Stats Migration (spots, reviews, photos)
  const [migratingUserStats, setMigratingUserStats] = useState(false);
  const [userStatsResult, setUserStatsResult] = useState<any>(null);

  // Stuck Layover Cleanup
  const [cleaningLayovers, setCleaningLayovers] = useState(false);
  const [layoverCleanupResult, setLayoverCleanupResult] = useState<any>(null);

  // Profile Nudge Campaign
  const [sendingNudges, setSendingNudges] = useState(false);
  const [nudgeCampaignResult, setNudgeCampaignResult] = useState<NudgeCampaignResult | null>(null);

  // What to Buy Seeding
  const [seedingBuyItems, setSeedingBuyItems] = useState(false);
  const [seedBuyResult, setSeedBuyResult] = useState<SeedResult | null>(null);

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
      // Sort by name, but handle cities without names (incomplete entries)
      setAllCities(citiesList.sort((a, b) => {
        const nameA = a.name || a.code || '';
        const nameB = b.name || b.code || '';
        return nameA.localeCompare(nameB);
      }));
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
          
          // Increment user's photosUploaded stat
          await updateDoc(doc(db, 'users', spot.addedBy), {
            'stats.photosUploaded': increment(photos.length)
          });
        }
      }

      // Increment user's spotsAdded stat
      await updateDoc(doc(db, 'users', spot.addedBy), {
        'stats.spotsAdded': increment(1)
      });

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

  const handleBackfillGooglePhotos = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this operation.');
      return;
    }

    Alert.alert(
      'Backfill Google Photos',
      'This will fetch photos from Google Places for all spots that:\n• Have a placeId (from Google Places)\n• Don\'t have any photos yet\n\nThis may take a few minutes depending on how many spots need photos.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Start Backfill',
          onPress: async () => {
            try {
              setBackfillingPhotos(true);
              setPhotoBackfillResult(null);

              const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY;
              
              if (!GOOGLE_PLACES_API_KEY) {
                Alert.alert('Error', 'Google Places API key not found in environment variables');
                return;
              }

              // Fetch all approved spots
              const spotsSnapshot = await getDocs(
                query(collection(db, 'spots'), where('status', '==', 'approved'))
              );

              const spotsNeedingPhotos: any[] = [];
              const spotsWithPhotos: any[] = [];
              const spotsWithoutPlaceId: any[] = [];

              // Categorize spots
              spotsSnapshot.docs.forEach((doc) => {
                const spot = doc.data();
                
                if (!spot.placeId) {
                  spotsWithoutPlaceId.push({ id: doc.id, name: spot.name });
                } else if (!spot.photoURLs || spot.photoURLs.length === 0) {
                  spotsNeedingPhotos.push({ id: doc.id, name: spot.name, placeId: spot.placeId });
                } else {
                  spotsWithPhotos.push({ id: doc.id, name: spot.name });
                }
              });

              console.log(`📊 Found ${spotsNeedingPhotos.length} spots needing photos`);

              let successCount = 0;
              let noPhotosAvailable = 0;
              let errorCount = 0;
              const errors: any[] = [];

              // Process each spot that needs photos
              for (let i = 0; i < spotsNeedingPhotos.length; i++) {
                const spot = spotsNeedingPhotos[i];
                
                try {
                  // Fetch place details with photos
                  const detailsResponse = await fetch(
                    `https://maps.googleapis.com/maps/api/place/details/json?place_id=${spot.placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`
                  );

                  const detailsData = await detailsResponse.json();

                  if (detailsData.status === 'OK' && detailsData.result?.photos && detailsData.result.photos.length > 0) {
                    // FIX: Upload photos to Firebase Storage instead of storing
                    // raw Google API URLs. This means photo renders in the app
                    // will load from Firebase (free) instead of hitting the
                    // Google Places Photo API ($7/1,000 requests) every time.
                    const firebasePhotoUrls: string[] = [];
                    const photosToProcess = detailsData.result.photos.slice(0, 3);

                    for (let j = 0; j < photosToProcess.length; j++) {
                      const photo = photosToProcess[j];
                      try {
                        const photoApiUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photo.photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
                        const photoResponse = await fetch(photoApiUrl);

                        if (!photoResponse.ok) {
                          console.warn(`   ⚠️ Failed to fetch photo ${j + 1} for ${spot.name}`);
                          continue;
                        }

                        // Upload to Firebase Storage
                        const blob = await photoResponse.blob();
                        const timestamp = Date.now();
                        const storageRef = ref(
                          storage,
                          `spots/backfill/${spot.id}_${j}_${timestamp}.jpg`
                        );
                        await uploadBytes(storageRef, blob);
                        const downloadUrl = await getDownloadURL(storageRef);
                        firebasePhotoUrls.push(downloadUrl);
                      } catch (photoError) {
                        console.warn(`   ⚠️ Error uploading photo ${j + 1}:`, photoError);
                      }
                    }

                    if (firebasePhotoUrls.length > 0) {
                      // Update spot with Firebase Storage URLs (NOT Google API URLs)
                      await updateDoc(doc(db, 'spots', spot.id), {
                        photoURLs: firebasePhotoUrls
                      });
                      successCount++;
                      console.log(`✅ ${i + 1}/${spotsNeedingPhotos.length} - Added ${firebasePhotoUrls.length} photos to ${spot.name}`);
                    } else {
                      noPhotosAvailable++;
                      console.log(`⚠️ ${i + 1}/${spotsNeedingPhotos.length} - Photos found but upload failed for ${spot.name}`);
                    }
                  } else {
                    noPhotosAvailable++;
                    console.log(`⚠️ ${i + 1}/${spotsNeedingPhotos.length} - No photos available for ${spot.name}`);
                  }

                  // Rate limit delay (increased from 100ms to 500ms)
                  await new Promise(resolve => setTimeout(resolve, 500));

                } catch (error: any) {
                  errorCount++;
                  errors.push({ name: spot.name, error: error.message });
                  console.error(`❌ Error processing ${spot.name}:`, error);
                }
              }

              // Show results
              setPhotoBackfillResult({
                totalSpots: spotsSnapshot.docs.length,
                spotsNeedingPhotos: spotsNeedingPhotos.length,
                spotsWithPhotos: spotsWithPhotos.length,
                spotsWithoutPlaceId: spotsWithoutPlaceId.length,
                successCount,
                noPhotosAvailable,
                errorCount,
                errors
              });

              Alert.alert(
                'Backfill Complete!',
                `Successfully added photos to ${successCount} spots!\n\n` +
                `• Total spots: ${spotsSnapshot.docs.length}\n` +
                `• Already had photos: ${spotsWithPhotos.length}\n` +
                `• Photos added: ${successCount}\n` +
                `• No photos available: ${noPhotosAvailable}\n` +
                `• Errors: ${errorCount}\n` +
                `• No Place ID: ${spotsWithoutPlaceId.length}`
              );

            } catch (error: any) {
              console.error('Error backfilling photos:', error);
              Alert.alert('Error', error.message || 'Failed to backfill photos');
            } finally {
              setBackfillingPhotos(false);
            }
          }
        }
      ]
    );
  };

  // Badge System Migration
  const handleRunBadgeMigration = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this operation.');
      return;
    }

    Alert.alert(
      '⚠️ Badge System Migration',
      'This will:\n• Reset all plan stats for new badge system\n• Set plansCompleted = 0 for all users\n• Copy plansHosted → plansCreated\n• Reset all plans to allow re-check-in\n\nThis is a ONE-TIME operation for alpha testing.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Migration',
          style: 'destructive',
          onPress: async () => {
            try {
              setRunningBadgeMigration(true);
              setBadgeMigrationResult(null);

              console.log('🚀 Starting badge system migration...');
              const result = await runFullMigration();

              console.log('✅ Badge migration complete!', result);
              setBadgeMigrationResult(result);

              Alert.alert(
                '✅ Migration Complete!',
                `Users migrated: ${result.userResults.successCount}\n` +
                `Plans reset: ${result.planResults.count}\n` +
                `Errors: ${result.userResults.errorCount}`
              );

            } catch (error: any) {
              console.error('❌ Badge migration failed:', error);
              Alert.alert('Migration Failed', error.message || 'An error occurred during migration');
              setBadgeMigrationResult({ error: error.message });
            } finally {
              setRunningBadgeMigration(false);
            }
          }
        }
      ]
    );
  };

  // Award Beta Pioneer Badge to all eligible users
  const handleAwardBetaBadges = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this operation.');
      return;
    }

    Alert.alert(
      '🚀 Award Beta Pioneer Badge',
      'This will award the Beta Pioneer badge to all users who signed up before June 2026.\n\nThis gives:\n• Beta Pioneer badge\n• +250 CMS\n\nSafe to run multiple times - skips users who already have it.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Award Badges',
          onPress: async () => {
            try {
              setAwardingBetaBadges(true);
              setBetaBadgeResult(null);

              console.log('🚀 Starting Beta Pioneer badge migration...');

              // Get all users
              const usersSnapshot = await getDocs(collection(db, 'users'));
              const betaLaunchDate = new Date('2026-06-01'); // June 2026

              let awarded = 0;
              let skipped = 0;
              let errors = 0;
              const errorDetails: string[] = [];

              for (const userDoc of usersSnapshot.docs) {
                const userId = userDoc.id;
                const userData = userDoc.data();
                const displayName = userData.displayName || 'Unknown User';

                try {
                  // Check if user already has the badge
                  const badges = userData.badges || [];
                  if (badges.includes('beta_pioneer')) {
                    console.log(`⏭️  ${displayName}: Already has Beta Pioneer badge`);
                    skipped++;
                    continue;
                  }

                  // Award badge to all alpha users (they're all before June 2026)
                  // Award the badge and CMS
                  const updatedBadges = [...badges, 'beta_pioneer'];
                  const currentCMS = userData.cms || 0;

                  await updateDoc(doc(db, 'users', userId), {
                    badges: updatedBadges,
                    cms: currentCMS + 250, // Beta Pioneer CMS value
                  });

                  awarded++;
                  console.log(`✅ ${displayName}: Awarded Beta Pioneer badge (+250 CMS)`);
                } catch (error: any) {
                  errors++;
                  errorDetails.push(`${displayName}: ${error.message}`);
                  console.error(`❌ Error awarding badge to ${userId}:`, error);
                }
              }

              const result = {
                total: usersSnapshot.size,
                awarded,
                skipped,
                errors,
                errorDetails,
              };

              console.log('✅ Beta badge migration complete!', result);
              setBetaBadgeResult(result);

              Alert.alert(
                '✅ Migration Complete!',
                `Awarded Beta Pioneer badge to ${awarded} users!\n\nSkipped: ${skipped}\nErrors: ${errors}`
              );

            } catch (error: any) {
              console.error('❌ Beta badge migration failed:', error);
              Alert.alert('Migration Failed', error.message || 'An error occurred during migration');
              setBetaBadgeResult({ error: error.message });
            } finally {
              setAwardingBetaBadges(false);
            }
          }
        }
      ]
    );
  };

  // Seed Base Skylines (CLT and PHL)
  const handleSeedSkylines = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this operation.');
      return;
    }

    Alert.alert(
      '🌱 Seed Base Skylines',
      'This will add CLT (Charlotte) and PHL (Philadelphia) skylines to Firestore.\n\nRun this ONCE to set up the initial skylines. Safe to run multiple times.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Skylines',
          onPress: async () => {
            try {
              setSeedingSkylines(true);
              console.log('🌱 Seeding base skylines...');
              
              await seedInitialSkylines();
              
              setSkylineSeeded(true);
              console.log('✅ Skylines seeded successfully!');
              
              Alert.alert(
                '✅ Skylines Seeded!',
                'CLT and PHL skylines have been added to Firestore.\n\nYou can now see them in profile pages!'
              );
            } catch (error: any) {
              console.error('❌ Skyline seeding failed:', error);
              Alert.alert('Seeding Failed', error.message || 'An error occurred');
            } finally {
              setSeedingSkylines(false);
            }
          }
        }
      ]
    );
  };

  // Analyze Skyline Coverage
  // Analyze Skyline Coverage
  const handleAnalyzeCoverage = async () => {
    try {
      setAnalyzingCoverage(true);
      console.log('📊 Analyzing city skyline coverage...');
      
      const report = await analyzeCitySkylineCoverage();
      setCoverageReport(report);
      
      console.log('✅ Coverage analysis complete!');
      console.log(formatCityCoverageReport(report));
      
      Alert.alert(
        '🏙️ City Skyline Coverage',
        getCityCoverageSummary(report) + '\n\n' +
        `${report.citiesWithoutSkylines.length} cities need skylines.\n\n` +
        `Check the detailed report below.`
      );
    } catch (error: any) {
      console.error('❌ Coverage analysis failed:', error);
      Alert.alert('Analysis Failed', error.message || 'An error occurred');
    } finally {
      setAnalyzingCoverage(false);
    }
  };

  // Preview User Base Migration
  const handlePreviewBaseMigration = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can preview this migration.');
      return;
    }

    try {
      setPreviewingBaseMigration(true);
      console.log('👀 Previewing user base migration...');
      
      const preview = await previewUserBaseMigration();
      setBaseMigrationPreview(preview);
      
      console.log('✅ Preview complete!');
      
      Alert.alert(
        '👀 Migration Preview',
        `Will normalize ${preview.usersNormalized} user bases.\n\n` +
        `${preview.usersAlreadyCorrect} already correct.\n` +
        `${preview.usersUnmapped > 0 ? `⚠️ ${preview.usersUnmapped} cannot be mapped.\n\n` : ''}` +
        `Check the details below.`
      );
    } catch (error: any) {
      console.error('❌ Preview failed:', error);
      Alert.alert('Preview Failed', error.message || 'An error occurred');
    } finally {
      setPreviewingBaseMigration(false);
    }
  };

  // Run User Base Migration
  const handleRunBaseMigration = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this migration.');
      return;
    }

    if (!baseMigrationPreview) {
      Alert.alert('Preview Required', 'Please preview the migration first.');
      return;
    }

    Alert.alert(
      '🔄 Normalize User Bases',
      `This will update ${baseMigrationPreview.usersNormalized} user profiles.\n\n` +
      `${baseMigrationPreview.usersUnmapped > 0 ? `⚠️ ${baseMigrationPreview.usersUnmapped} bases cannot be mapped and will be skipped.\n\n` : ''}` +
      `Are you sure you want to proceed?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Migration',
          style: 'destructive',
          onPress: async () => {
            try {
              setRunningBaseMigration(true);
              console.log('🔄 Running user base migration...');
              
              const result = await migrateUserBases();
              setBaseMigrationResult(result);
              
              console.log('✅ Migration complete!');
              
              Alert.alert(
                '✅ Migration Complete!',
                `Normalized ${result.usersNormalized} user bases.\n\n` +
                `${result.errors > 0 ? `⚠️ ${result.errors} errors (check console)\n\n` : ''}` +
                `Run coverage analysis to see updated results!`
              );
            } catch (error: any) {
              console.error('❌ Migration failed:', error);
              Alert.alert('Migration Failed', error.message || 'An error occurred');
            } finally {
              setRunningBaseMigration(false);
            }
          }
        }
      ]
    );
  };

  // Backfill Referrals - Credit admin as referrer for all existing users
  const handleBackfillReferrals = async () => {
    if (!user?.uid) return;

    Alert.alert(
      '🔗 Backfill Referrals',
      'This will set you as the referrer for all existing users who don\'t already have one, and update your referral stats + badges.\n\nSafe to run multiple times — skips users who already have referredBy set.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Backfill',
          onPress: async () => {
            try {
              setRunningReferralBackfill(true);
              const result = await backfillReferrals(user.uid);
              setReferralBackfillResult(result);

              Alert.alert(
                '✅ Backfill Complete!',
                `Total users: ${result.totalUsers}\n` +
                `Updated: ${result.updated}\n` +
                `Successful referrals: ${result.successfulReferrals}\n` +
                `Already had referrer: ${result.alreadyReferred}\n` +
                `Badges awarded: ${result.badgesAwarded.length > 0 ? result.badgesAwarded.join(', ') : 'none (may already be earned)'}`
              );
            } catch (error: any) {
              console.error('❌ Backfill failed:', error);
              Alert.alert('Backfill Failed', error.message || 'An error occurred');
            } finally {
              setRunningReferralBackfill(false);
            }
          }
        }
      ]
    );
  };

  // Recount Referrals - Recalculate completions with current criteria
  const handleRecountReferrals = async () => {
    if (!user?.uid) return;

    Alert.alert(
      '🔄 Recount Referrals',
      'This will scan all users you referred and recount completions using current criteria (photo + airline + base). It will update your stats and award any new badges.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Recount',
          onPress: async () => {
            try {
              setRunningRecount(true);
              const result = await recountReferrals(user.uid);
              setRecountResult(result);

              Alert.alert(
                '✅ Recount Complete!',
                `Total referred: ${result.totalReferred}\n` +
                `Completed: ${result.completed}\n` +
                `Pending: ${result.pending}\n` +
                `Badges awarded: ${result.badgesAwarded.length > 0 ? result.badgesAwarded.join(', ') : 'none new'}`
              );
            } catch (error: any) {
              console.error('❌ Recount failed:', error);
              Alert.alert('Recount Failed', error.message || 'An error occurred');
            } finally {
              setRunningRecount(false);
            }
          }
        }
      ]
    );
  };

  // Send Profile Completion Nudge Campaign
  const handleSendProfileNudges = async () => {
    Alert.alert(
      '📣 Profile Completion Nudge',
      'This will send push notifications to all users missing a profile photo, airline, or base.\n\nUsers without push tokens will be skipped.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send Nudges',
          onPress: async () => {
            try {
              setSendingNudges(true);
              const result = await sendProfileNudgeCampaign();
              setNudgeCampaignResult(result);

              Alert.alert(
                '✅ Nudge Campaign Sent!',
                `Incomplete profiles: ${result.incompleteUsers}\n` +
                `Notifications sent: ${result.notificationsSent}\n` +
                `No push token: ${result.noPushToken}\n` +
                `Failed: ${result.notificationsFailed}`
              );
            } catch (error: any) {
              console.error('❌ Nudge campaign failed:', error);
              Alert.alert('Campaign Failed', error.message || 'An error occurred');
            } finally {
              setSendingNudges(false);
            }
          }
        }
      ]
    );
  };

  // Seed What to Buy data
  const handleSeedWhatToBuy = async () => {
    if (!user) return;
    Alert.alert(
      '🛒 Seed What to Buy',
      'This will add crew-recommended "What to Buy" items for San Francisco.\n\nSkips cities that already have 5+ items. Safe to run multiple times.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Seed Data',
          onPress: async () => {
            try {
              setSeedingBuyItems(true);
              const result = await seedWhatToBuy(user.uid, 'CrewMate Team');
              setSeedBuyResult(result);

              Alert.alert(
                '✅ Seeding Complete!',
                `Added: ${result.added}\nSkipped (existing): ${result.skipped}\nErrors: ${result.errors}`
              );
            } catch (error: any) {
              console.error('❌ Seed failed:', error);
              Alert.alert('Seed Failed', error.message || 'An error occurred');
            } finally {
              setSeedingBuyItems(false);
            }
          }
        }
      ]
    );
  };

  // Migrate Skyline City Names
  const handleMigrateSkylineCityNames = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this operation.');
      return;
    }

    Alert.alert(
      '🏙️ Add City Names to Skylines',
      'This will add a "cityName" field to all existing skylines in Firestore.\n\nExample: CLT → cityName: "Charlotte, NC"\n\nThis enables dynamic city skylines on layover pages.\n\nSafe to run multiple times.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Migration',
          onPress: async () => {
            try {
              setMigratingSkylineCityNames(true);
              console.log('🏙️ Migrating skyline city names...');
              
              const result = await migrateSkylinesCityNames();
              setSkylineCityNameResult(result);
              
              console.log('📋 Migration Results:');
              result.details.forEach(detail => console.log(detail));
              
              if (result.success) {
                Alert.alert(
                  '✅ Migration Complete!',
                  `Updated: ${result.updated} skylines\n` +
                  `Skipped: ${result.skipped} skylines\n` +
                  `Errors: ${result.errors}\n\n` +
                  `Check console for details.`
                );
              } else {
                Alert.alert(
                  '⚠️ Migration Completed with Errors',
                  `Updated: ${result.updated}\n` +
                  `Errors: ${result.errors}\n\n` +
                  `Check console for details.`
                );
              }
            } catch (error: any) {
              console.error('❌ Migration failed:', error);
              Alert.alert('Migration Failed', error.message || 'An error occurred');
            } finally {
              setMigratingSkylineCityNames(false);
            }
          }
        }
      ]
    );
  };

  // Migrate city data (add missing lat/lng, names, etc.)
  const handleMigrateCityData = async () => {
    if (!isSuperAdmin(role)) {
      Alert.alert('Permission Denied', 'Only super admins can run this operation.');
      return;
    }

    Alert.alert(
      '🌍 Fix Incomplete City Data',
      'This will automatically update all cities missing lat/lng coordinates, names, or other data by looking them up in the airport database.\n\n' +
      'Examples:\n' +
      '• GRU → São Paulo (lat: -23.5505, lng: -46.6333)\n' +
      '• EZE → Buenos Aires (lat: -34.8222, lng: -58.5358)\n\n' +
      'Cities not found in the database will be skipped and need manual entry.\n\n' +
      'Safe to run multiple times.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Migration',
          onPress: async () => {
            try {
              setMigratingCityData(true);
              console.log('🌍 Migrating city data...');
              
              const result = await migrateCityData();
              setCityDataMigrationResult(result);
              
              console.log('📋 Migration Results:');
              result.details.forEach(detail => {
                console.log(`${detail.code}: ${detail.action} - ${detail.reason}`);
              });
              
              if (result.success) {
                Alert.alert(
                  '✅ Migration Complete!',
                  `Total cities: ${result.totalCities}\n` +
                  `Updated: ${result.citiesUpdated}\n` +
                  `Skipped: ${result.citiesSkipped}\n` +
                  `Errors: ${result.errors.length}\n\n` +
                  `Check console for details.`
                );
                // Reload cities to show updated data
                loadCities();
              } else {
                Alert.alert(
                  '⚠️ Migration Failed',
                  `Errors: ${result.errors.length}\n\n` +
                  `Check console for details.`
                );
              }
            } catch (error: any) {
              console.error('❌ Migration failed:', error);
              Alert.alert('Migration Failed', error.message || 'An error occurred');
            } finally {
              setMigratingCityData(false);
            }
          }
        }
      ]
    );
  };

  // Migration function (kept from original)
  const handleMigrateCities = async () => {
    // This would migrate from hardcoded cities - keeping as placeholder
    Alert.alert('Info', 'Migration feature - use Add City to add new cities');
  };

  // Cities Visited Migration
  const handleMigrateCitiesVisited = async () => {
    Alert.alert(
      'Backfill Cities Visited',
      'This will calculate cities visited for all users based on their layover history. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Migration',
          onPress: async () => {
            setMigratingCitiesVisited(true);
            setCitiesVisitedResult(null);
            
            try {
              const result = await migrateCitiesVisited();
              setCitiesVisitedResult(result);
              
              if (result.success) {
                Alert.alert(
                  'Success! ✅',
                  `Updated ${result.updatedCount} users\nErrors: ${result.errorCount}\nTotal: ${result.totalUsers} users`
                );
              } else {
                Alert.alert('Error', 'Migration failed. Check console for details.');
              }
            } catch (error) {
              console.error('Migration error:', error);
              Alert.alert('Error', 'Migration failed. Check console for details.');
            } finally {
              setMigratingCitiesVisited(false);
            }
          }
        }
      ]
    );
  };

  // User Stats Migration (spots, reviews, photos)
  const handleMigrateUserStats = async () => {
    Alert.alert(
      'Backfill User Stats',
      'This will count spots, reviews, and photos for all users. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Run Migration',
          onPress: async () => {
            setMigratingUserStats(true);
            setUserStatsResult(null);
            
            try {
              const result = await migrateUserStats();
              setUserStatsResult(result);
              
              if (result.success) {
                Alert.alert(
                  'Success! ✅',
                  `Updated ${result.updatedCount} users\nErrors: ${result.errorCount}\nTotal: ${result.totalUsers} users`
                );
              } else {
                Alert.alert('Error', 'Migration failed. Check console for details.');
              }
            } catch (error) {
              console.error('Migration error:', error);
              Alert.alert('Error', 'Migration failed. Check console for details.');
            } finally {
              setMigratingUserStats(false);
            }
          }
        }
      ]
    );
  };

  // Stuck Layover Cleanup
  const handleCleanupStuckLayovers = async () => {
    Alert.alert(
      'Clean Up Stuck Layovers',
      'This will fix layovers that are marked as active but should be inactive. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clean Up',
          onPress: async () => {
            setCleaningLayovers(true);
            setLayoverCleanupResult(null);
            
            try {
              const result = await cleanupStuckLayovers();
              setLayoverCleanupResult(result);
              
              if (result.success) {
                Alert.alert(
                  'Success! ✅',
                  `Fixed ${result.fixedCount} stuck layovers\nStill active: ${result.stillActiveCount}\nErrors: ${result.errorCount}`
                );
              } else {
                Alert.alert('Error', 'Cleanup failed. Check console for details.');
              }
            } catch (error) {
              console.error('Cleanup error:', error);
              Alert.alert('Error', 'Cleanup failed. Check console for details.');
            } finally {
              setCleaningLayovers(false);
            }
          }
        }
      ]
    );
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
                      <ThemedText style={styles.cityName}>{city.name || city.code || 'Unnamed City'}</ThemedText>
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
                  📍 {typeof city.lat === 'number' ? city.lat.toFixed(4) : 'N/A'}, {typeof city.lng === 'number' ? city.lng.toFixed(4) : 'N/A'}
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
            
            {/* ===== SECTION 1: USER MANAGEMENT ===== */}
            <View style={styles.sectionHeader}>
              <ThemedText style={styles.sectionHeaderText}>👥 USER MANAGEMENT</ThemedText>
              <ThemedText style={styles.sectionSubtext}>
                User profiles, bases, and engagement
              </ThemedText>
            </View>
            
            {/* Engagement System Migration Card */}
            <View style={styles.card}>
              <ThemedText style={styles.cardTitle}>✨ Add Engagement Fields to All Users</ThemedText>
              <ThemedText style={styles.cardDescription}>
                Add CMS scores, badges, stats, and levels to all existing users. This will:{'\n'}
                • Award retroactive CMS for past check-ins and plans{'\n'}
                • Add all engagement tracking fields{'\n'}
                • Mark alpha testers as Founding Crew{'\n'}
                • Set appropriate levels based on activity{'\n'}
                {'\n'}
                Safe to run multiple times - skips already-migrated users.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF9500' }]}
                onPress={() => router.push('/admin/migrate-engagement')}
              >
                <ThemedText style={styles.buttonText}>🚀 Open Migration Tool</ThemedText>
              </TouchableOpacity>
            </View>
            
            {/* Normalize User Bases Card - NEW! */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#1B5E20' }]}>
                🔗 Backfill Referrals
              </ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#1B5E20' }]}>
                Credit yourself as the referrer for all existing alpha users.{'\n'}
                {'\n'}
                • Sets referredBy on all users to your UID{'\n'}
                • Counts users with photos as successful referrals{'\n'}
                • Awards any earned recruiter badges{'\n'}
                {'\n'}
                Safe to run multiple times — skips users already referred.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#2A4E9D' }, runningReferralBackfill && styles.buttonDisabled]}
                onPress={handleBackfillReferrals}
                disabled={runningReferralBackfill}
              >
                {runningReferralBackfill ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>🔗 Run Referral Backfill</ThemedText>
                )}
              </TouchableOpacity>
              
              {referralBackfillResult && (
                <View style={[styles.card, { marginTop: 12, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardDescription, { color: '#1B5E20' }]}>
                    ✅ Updated: {referralBackfillResult.updated}{'\n'}
                    📊 Successful referrals: {referralBackfillResult.successfulReferrals}{'\n'}
                    ⏭️ Already referred: {referralBackfillResult.alreadyReferred}{'\n'}
                    🎖 Badges: {referralBackfillResult.badgesAwarded.length > 0 
                      ? referralBackfillResult.badgesAwarded.join(', ') 
                      : 'none new'}
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* Recount Referrals Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#E3F2FD', borderColor: '#1976D2' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#0D47A1' }]}>
                🔄 Recount Referrals
              </ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#0D47A1' }]}>
                Rescans all users you referred and recounts completions using{'\n'}
                current criteria (photo + airline + base).{'\n'}
                {'\n'}
                Run this after changing completion criteria or if your{'\n'}
                leaderboard stats seem off.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#1976D2' }, runningRecount && styles.buttonDisabled]}
                onPress={handleRecountReferrals}
                disabled={runningRecount}
              >
                {runningRecount ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>🔄 Run Recount</ThemedText>
                )}
              </TouchableOpacity>
              
              {recountResult && (
                <View style={[styles.card, { marginTop: 12, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardDescription, { color: '#1B5E20' }]}>
                    ✅ Completed: {recountResult.completed}{'\n'}
                    ⏳ Pending: {recountResult.pending}{'\n'}
                    📊 Total referred: {recountResult.totalReferred}{'\n'}
                    🎖 Badges: {recountResult.badgesAwarded.length > 0 
                      ? recountResult.badgesAwarded.join(', ') 
                      : 'none new'}
                  </ThemedText>
                  {recountResult.pendingDetails.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <ThemedText style={[styles.cardDescription, { color: '#1B5E20', fontWeight: '600' }]}>
                        Missing profiles:
                      </ThemedText>
                      {recountResult.pendingDetails.slice(0, 10).map((p, i) => (
                        <ThemedText key={i} style={[styles.cardDescription, { color: '#1B5E20', fontSize: 12 }]}>
                          • {p.name} — needs: {p.missing.join(', ')}
                        </ThemedText>
                      ))}
                      {recountResult.pendingDetails.length > 10 && (
                        <ThemedText style={[styles.cardDescription, { color: '#1B5E20', fontSize: 12, fontStyle: 'italic' }]}>
                          ...and {recountResult.pendingDetails.length - 10} more (check console)
                        </ThemedText>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>
            
            {/* Profile Completion Nudge Campaign */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#E65100' }]}>
                📣 Profile Completion Nudges
              </ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#E65100' }]}>
                Send push notifications to users with incomplete profiles{'\n'}
                (missing photo, airline, or base).{'\n'}
                {'\n'}
                Users also see an in-app banner reminding them{'\n'}
                to complete their profile when they open the app.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF9800' }, sendingNudges && styles.buttonDisabled]}
                onPress={handleSendProfileNudges}
                disabled={sendingNudges}
              >
                {sendingNudges ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>📣 Send Nudge Campaign</ThemedText>
                )}
              </TouchableOpacity>
              
              {nudgeCampaignResult && (
                <View style={[styles.card, { marginTop: 12, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardDescription, { color: '#1B5E20' }]}>
                    📊 Total users: {nudgeCampaignResult.totalUsers}{'\n'}
                    ⚠️ Incomplete: {nudgeCampaignResult.incompleteUsers}{'\n'}
                    ✅ Notifications sent: {nudgeCampaignResult.notificationsSent}{'\n'}
                    📵 No push token: {nudgeCampaignResult.noPushToken}{'\n'}
                    ❌ Failed: {nudgeCampaignResult.notificationsFailed}
                  </ThemedText>
                  {nudgeCampaignResult.details.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      <ThemedText style={[styles.cardDescription, { color: '#1B5E20', fontWeight: '600' }]}>
                        Incomplete profiles:
                      </ThemedText>
                      {nudgeCampaignResult.details.slice(0, 10).map((u, i) => (
                        <ThemedText key={i} style={[styles.cardDescription, { color: '#1B5E20', fontSize: 12 }]}>
                          • {u.displayName} — needs: {u.missing.join(', ')} {!u.hasPushToken ? '(no token)' : ''}
                        </ThemedText>
                      ))}
                      {nudgeCampaignResult.details.length > 10 && (
                        <ThemedText style={[styles.cardDescription, { color: '#1B5E20', fontSize: 12, fontStyle: 'italic' }]}>
                          ...and {nudgeCampaignResult.details.length - 10} more
                        </ThemedText>
                      )}
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Seed What to Buy Data */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#0D47A1' }]}>
                🛒 Seed What to Buy
              </ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#0D47A1' }]}>
                Add crew-recommended items for San Francisco.{'\n'}
                Includes wine, skincare, groceries, snacks, drinks,{'\n'}
                souvenirs, fashion, and wellness picks.{'\n'}
                {'\n'}
                Skips cities that already have 5+ items.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#2196F3' }, seedingBuyItems && styles.buttonDisabled]}
                onPress={handleSeedWhatToBuy}
                disabled={seedingBuyItems}
              >
                {seedingBuyItems ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>🛒 Seed What to Buy</ThemedText>
                )}
              </TouchableOpacity>
              
              {seedBuyResult && (
                <View style={[styles.card, { marginTop: 12, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardDescription, { color: '#1B5E20' }]}>
                    ✅ Added: {seedBuyResult.added}{'\n'}
                    ⏭️ Skipped: {seedBuyResult.skipped}{'\n'}
                    ❌ Errors: {seedBuyResult.errors}
                  </ThemedText>
                  {seedBuyResult.details.slice(0, 10).map((d, i) => (
                    <ThemedText key={i} style={[styles.cardDescription, { color: '#1B5E20', fontSize: 12 }]}>
                      • {d.item} ({d.city}) — {d.status}
                    </ThemedText>
                  ))}
                  {seedBuyResult.details.length > 10 && (
                    <ThemedText style={[styles.cardDescription, { color: '#1B5E20', fontSize: 12, fontStyle: 'italic' }]}>
                      ...and {seedBuyResult.details.length - 10} more
                    </ThemedText>
                  )}
                </View>
              )}
            </View>

            {/* Normalize User Bases Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#1B5E20' }]}>
                🔄 Normalize User Bases
              </ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#1B5E20' }]}>
                Fix inconsistent base data by converting full city names to airport codes.{'\n'}
                {'\n'}
                Problem: Some users have "CHARLOTTE" while others have "CLT"{'\n'}
                Solution: Normalize all to airport codes (CLT, ORD, etc.){'\n'}
                {'\n'}
                📊 This will fix your skyline coverage report!
              </ThemedText>
              
              {/* Preview Button */}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#4CAF50', marginBottom: 12 }, previewingBaseMigration && styles.buttonDisabled]}
                onPress={handlePreviewBaseMigration}
                disabled={previewingBaseMigration}
              >
                {previewingBaseMigration ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>👀 Preview Migration</ThemedText>
                )}
              </TouchableOpacity>
              
              {/* Run Button */}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF5722' }, runningBaseMigration && styles.buttonDisabled]}
                onPress={handleRunBaseMigration}
                disabled={runningBaseMigration || !baseMigrationPreview}
              >
                {runningBaseMigration ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>
                    {baseMigrationPreview ? '🔄 Run Migration' : '👀 Preview First'}
                  </ThemedText>
                )}
              </TouchableOpacity>
              
              {/* Preview Results */}
              {baseMigrationPreview && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#FFF9C4', borderColor: '#FFC107' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#856404' }]}>
                    👀 Preview Results
                  </ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#856404' }]}>
                    Total users: {baseMigrationPreview.totalUsers}{'\n'}
                    ✅ Already correct: {baseMigrationPreview.usersAlreadyCorrect}{'\n'}
                    🔄 Will normalize: {baseMigrationPreview.usersNormalized}{'\n'}
                    ⚠️ Cannot map: {baseMigrationPreview.usersUnmapped}{'\n'}
                    {'\n'}
                    {baseMigrationPreview.usersUnmapped > 0 && baseMigrationPreview.details.unmapped.length > 0 && (
                      'Cannot map:\n' +
                      baseMigrationPreview.details.unmapped.slice(0, 5).map((u: any) => 
                        `• ${u.name}: "${u.base}"`
                      ).join('\n') +
                      (baseMigrationPreview.details.unmapped.length > 5 
                        ? `\n... and ${baseMigrationPreview.details.unmapped.length - 5} more` 
                        : '')
                    )}
                  </ThemedText>
                </View>
              )}
              
              {/* Migration Results */}
              {baseMigrationResult && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: baseMigrationResult.errors > 0 ? '#FFF3CD' : '#D4EDDA', borderColor: baseMigrationResult.errors > 0 ? '#FFC107' : '#28A745' }]}>
                  <ThemedText style={[styles.cardTitle, { color: baseMigrationResult.errors > 0 ? '#856404' : '#155724' }]}>
                    {baseMigrationResult.errors > 0 ? '⚠️ Migration Completed with Issues' : '✅ Migration Complete!'}
                  </ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: baseMigrationResult.errors > 0 ? '#856404' : '#155724' }]}>
                    Total users: {baseMigrationResult.totalUsers}{'\n'}
                    ✅ Already correct: {baseMigrationResult.usersAlreadyCorrect}{'\n'}
                    🔄 Normalized: {baseMigrationResult.usersNormalized}{'\n'}
                    ⚠️ Unmapped: {baseMigrationResult.usersUnmapped}{'\n'}
                    ❌ Errors: {baseMigrationResult.errors}{'\n'}
                    {'\n'}
                    {baseMigrationResult.details.normalized.length > 0 && (
                      'Examples:\n' +
                      baseMigrationResult.details.normalized.slice(0, 5).map((u: any) =>
                        `• ${u.name}: ${u.oldBase} → ${u.newBase}`
                      ).join('\n') +
                      (baseMigrationResult.details.normalized.length > 5 
                        ? `\n... and ${baseMigrationResult.details.normalized.length - 5} more`
                        : ''
                      )
                    )}
                  </ThemedText>
                  
                  {baseMigrationResult.usersNormalized > 0 && (
                    <TouchableOpacity
                      style={[styles.button, { backgroundColor: '#4CAF50', marginTop: 12 }]}
                      onPress={handleAnalyzeCoverage}
                    >
                      <ThemedText style={styles.buttonText}>
                        📊 Re-run Coverage Analysis
                      </ThemedText>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
            
            {/* Badge System Migration Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#FFF3CD', borderColor: '#FFC107' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#856404' }]}>🏆 Badge System Migration (ONE-TIME)</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#856404' }]}>
                Run ONCE to reset plan stats for the new badge integrity system. This will:{'\n'}
                • Copy plansHosted → plansCreated (preserve history){'\n'}
                • Set plansCompleted = 0 for all users (fresh start){'\n'}
                • Reset all plans to allow GPS check-in{'\n'}
                • Set layoversCompleted = totalCheckIns{'\n'}
                {'\n'}
                ⚠️ IMPORTANT: Only run once during alpha deployment!
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF5722' }, runningBadgeMigration && styles.buttonDisabled]}
                onPress={handleRunBadgeMigration}
                disabled={runningBadgeMigration}
              >
                {runningBadgeMigration ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>⚠️ Run Badge Migration</ThemedText>
                )}
              </TouchableOpacity>
              
              {badgeMigrationResult && !badgeMigrationResult.error && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#155724' }]}>✅ Migration Complete!</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#155724' }]}>
                    • Users migrated: {badgeMigrationResult.userResults.successCount}{'\n'}
                    • Plans reset: {badgeMigrationResult.planResults.count}{'\n'}
                    • Errors: {badgeMigrationResult.userResults.errorCount}
                  </ThemedText>
                </View>
              )}
              
              {badgeMigrationResult?.error && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#F8D7DA', borderColor: '#DC3545' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#721C24' }]}>❌ Migration Failed</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#721C24' }]}>
                    {badgeMigrationResult.error}
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* Beta Pioneer Badge Migration Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#0D47A1' }]}>🚀 Award Beta Pioneer Badges</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#0D47A1' }]}>
                Award the Beta Pioneer badge to all users who signed up before June 2026. This will:{'\n'}
                • Add "Beta Pioneer" badge to user profiles{'\n'}
                • Award +250 CMS to each user{'\n'}
                • Safe to run multiple times (skips users who already have it){'\n'}
                {'\n'}
                ℹ️ This should be run for all current alpha users!
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#2196F3' }, awardingBetaBadges && styles.buttonDisabled]}
                onPress={handleAwardBetaBadges}
                disabled={awardingBetaBadges}
              >
                {awardingBetaBadges ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>🚀 Award Beta Badges</ThemedText>
                )}
              </TouchableOpacity>
              
              {betaBadgeResult && !betaBadgeResult.error && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#155724' }]}>✅ Badges Awarded!</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#155724' }]}>
                    • Total users: {betaBadgeResult.total}{'\n'}
                    • Badges awarded: {betaBadgeResult.awarded}{'\n'}
                    • Skipped: {betaBadgeResult.skipped}{'\n'}
                    • Errors: {betaBadgeResult.errors}
                  </ThemedText>
                </View>
              )}
              
              {betaBadgeResult?.error && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#F8D7DA', borderColor: '#DC3545' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#721C24' }]}>❌ Migration Failed</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#721C24' }]}>
                    {betaBadgeResult.error}
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* Cities Visited Migration Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#1B5E20' }]}>📍 Backfill Cities Visited</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#1B5E20' }]}>
                Calculate cities visited count for all users based on their layover history. This will:{'\n'}
                • Count unique cities from all layovers{'\n'}
                • Update visitedCities array{'\n'}
                • Update stats.citiesVisitedCount{'\n'}
                • Enable the Cities stat on profile pages{'\n'}
                {'\n'}
                ✅ Safe to run multiple times - only updates missing data.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#4CAF50' }, migratingCitiesVisited && styles.buttonDisabled]}
                onPress={handleMigrateCitiesVisited}
                disabled={migratingCitiesVisited}
              >
                {migratingCitiesVisited ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>🗺️ Calculate Cities Visited</ThemedText>
                )}
              </TouchableOpacity>
              
              {citiesVisitedResult && citiesVisitedResult.success && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#155724' }]}>✅ Migration Complete!</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#155724' }]}>
                    • Users updated: {citiesVisitedResult.updatedCount}{'\n'}
                    • Total users: {citiesVisitedResult.totalUsers}{'\n'}
                    • Errors: {citiesVisitedResult.errorCount}
                  </ThemedText>
                </View>
              )}
              
              {citiesVisitedResult && !citiesVisitedResult.success && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#F8D7DA', borderColor: '#DC3545' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#721C24' }]}>❌ Migration Failed</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#721C24' }]}>
                    Check console for details.
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* User Stats Migration Card - Spots, Reviews, Photos */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#E65100' }]}>📊 Backfill Profile Stats</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#E65100' }]}>
                Count spots, reviews, and photos for all users to populate profile stats. This will:{'\n'}
                • Count approved spots added by each user{'\n'}
                • Count reviews written by each user{'\n'}
                • Count photos uploaded by each user{'\n'}
                • Update stats.spotsAdded, stats.reviewsWritten, stats.photosUploaded{'\n'}
                {'\n'}
                ✅ Safe to run multiple times - recalculates accurate counts.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF9800' }, migratingUserStats && styles.buttonDisabled]}
                onPress={handleMigrateUserStats}
                disabled={migratingUserStats}
              >
                {migratingUserStats ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>📈 Calculate Profile Stats</ThemedText>
                )}
              </TouchableOpacity>
              
              {userStatsResult && userStatsResult.success && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#155724' }]}>✅ Migration Complete!</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#155724' }]}>
                    • Users updated: {userStatsResult.updatedCount}{'\n'}
                    • Total users: {userStatsResult.totalUsers}{'\n'}
                    • Errors: {userStatsResult.errorCount}
                  </ThemedText>
                </View>
              )}
              
              {userStatsResult && !userStatsResult.success && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#F8D7DA', borderColor: '#DC3545' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#721C24' }]}>❌ Migration Failed</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#721C24' }]}>
                    Check console for details.
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* Stuck Layover Cleanup Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#FFF3E0', borderColor: '#FF5722' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#BF360C' }]}>🧹 Clean Up Stuck Layovers</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#BF360C' }]}>
                Fix layovers that are marked as active but should be inactive. This will:{'\n'}
                • Find all active layovers{'\n'}
                • Check if user is still checked in{'\n'}
                • Check if layover has expired{'\n'}
                • Set stuck layovers to isActive: false{'\n'}
                {'\n'}
                ✅ Safe to run anytime - only fixes stuck layovers.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF5722' }, cleaningLayovers && styles.buttonDisabled]}
                onPress={handleCleanupStuckLayovers}
                disabled={cleaningLayovers}
              >
                {cleaningLayovers ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>🧹 Clean Up Layovers</ThemedText>
                )}
              </TouchableOpacity>
              
              {layoverCleanupResult && layoverCleanupResult.success && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#155724' }]}>✅ Cleanup Complete!</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#155724' }]}>
                    • Fixed stuck layovers: {layoverCleanupResult.fixedCount}{'\n'}
                    • Still active (valid): {layoverCleanupResult.stillActiveCount}{'\n'}
                    • Errors: {layoverCleanupResult.errorCount}
                  </ThemedText>
                </View>
              )}
              
              {layoverCleanupResult && !layoverCleanupResult.success && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#F8D7DA', borderColor: '#DC3545' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#721C24' }]}>❌ Cleanup Failed</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#721C24' }]}>
                    Check console for details.
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* ===== SECTION 2: CITY & SKYLINE MANAGEMENT ===== */}
            <View style={[styles.sectionHeader, { marginTop: 40 }]}>
              <ThemedText style={styles.sectionHeaderText}>🏙️ CITY & SKYLINE MANAGEMENT</ThemedText>
              <ThemedText style={styles.sectionSubtext}>
                City data, coordinates, and skyline images
              </ThemedText>
            </View>
            
            {/* Seed Base Skylines Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#F3E5F5', borderColor: '#9C27B0' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#4A148C' }]}>🏙️ Seed Base Skylines</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#4A148C' }]}>
                Add Charlotte (CLT) and Philadelphia (PHL) skylines to Firestore. This will:{'\n'}
                • Create baseSkylines collection{'\n'}
                • Add CLT skyline image{'\n'}
                • Add PHL skyline image{'\n'}
                • Enable dynamic skyline system{'\n'}
                {'\n'}
                ℹ️ Run this ONCE to initialize the skyline system. Safe to run multiple times.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#9C27B0' }, (seedingSkylines || skylineSeeded) && styles.buttonDisabled]}
                onPress={handleSeedSkylines}
                disabled={seedingSkylines || skylineSeeded}
              >
                {seedingSkylines ? (
                  <ActivityIndicator color={Colors.white} />
                ) : skylineSeeded ? (
                  <ThemedText style={styles.buttonText}>✅ Skylines Seeded!</ThemedText>
                ) : (
                  <ThemedText style={styles.buttonText}>🌱 Seed Skylines</ThemedText>
                )}
              </TouchableOpacity>
              
              {skylineSeeded && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: '#D4EDDA', borderColor: '#28A745' }]}>
                  <ThemedText style={[styles.cardTitle, { color: '#155724' }]}>✅ Skylines Seeded!</ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: '#155724' }]}>
                    CLT and PHL skylines have been added to Firestore.{'\n'}
                    Profile pages will now show city skylines!
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* Migrate Skyline City Names Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#FFF3E0', borderColor: '#FF6B6B' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#E65100' }]}>🏙️ Add City Names to Skylines</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#E65100' }]}>
                Add "cityName" field to all existing skylines for dynamic layover pages. This will:{'\n'}
                • Add cityName to CLT → "Charlotte, NC"{'\n'}
                • Add cityName to PHL → "Philadelphia, PA"{'\n'}
                • Enable automatic skyline display on layover detail pages{'\n'}
                • Make future skylines work automatically with layovers{'\n'}
                {'\n'}
                ⚠️ Run this ONCE after seeding skylines. Safe to run multiple times.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF6B6B' }, migratingSkylineCityNames && styles.buttonDisabled]}
                onPress={handleMigrateSkylineCityNames}
                disabled={migratingSkylineCityNames}
              >
                {migratingSkylineCityNames ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>🏙️ Migrate City Names</ThemedText>
                )}
              </TouchableOpacity>
              
              {skylineCityNameResult && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: skylineCityNameResult.success ? '#D4EDDA' : '#F8D7DA', borderColor: skylineCityNameResult.success ? '#28A745' : '#DC3545' }]}>
                  <ThemedText style={[styles.cardTitle, { color: skylineCityNameResult.success ? '#155724' : '#721C24' }]}>
                    {skylineCityNameResult.success ? '✅ Migration Complete!' : '⚠️ Migration Completed with Issues'}
                  </ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: skylineCityNameResult.success ? '#155724' : '#721C24' }]}>
                    • Updated: {skylineCityNameResult.updated} skylines{'\n'}
                    • Skipped: {skylineCityNameResult.skipped} skylines{'\n'}
                    • Errors: {skylineCityNameResult.errors}{'\n'}
                    {'\n'}
                    Check console for detailed results.
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* City Data Migration Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#E3F2FD', borderColor: '#2196F3' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#0D47A1' }]}>🌍 Fix Incomplete City Data</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#0D47A1' }]}>
                Automatically fix cities with missing coordinates, names, or areas by looking them up in the airport database.{'\n'}
                {'\n'}
                This will:{'\n'}
                • Add lat/lng to cities with missing or zero coordinates{'\n'}
                • Update city names (e.g., GRU → "São Paulo"){'\n'}
                • Add proper area lists from airport database{'\n'}
                • Mark cities as no longer needing review{'\n'}
                {'\n'}
                Cities not found in the database will be skipped for manual entry.{'\n'}
                ⚠️ Safe to run multiple times.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#2196F3' }, migratingCityData && styles.buttonDisabled]}
                onPress={handleMigrateCityData}
                disabled={migratingCityData}
              >
                {migratingCityData ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>🌍 Fix City Data</ThemedText>
                )}
              </TouchableOpacity>
              
              {cityDataMigrationResult && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: cityDataMigrationResult.success ? '#D4EDDA' : '#F8D7DA', borderColor: cityDataMigrationResult.success ? '#28A745' : '#DC3545' }]}>
                  <ThemedText style={[styles.cardTitle, { color: cityDataMigrationResult.success ? '#155724' : '#721C24' }]}>
                    {cityDataMigrationResult.success ? '✅ Migration Complete!' : '⚠️ Migration Failed'}
                  </ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: cityDataMigrationResult.success ? '#155724' : '#721C24' }]}>
                    • Total cities: {cityDataMigrationResult.totalCities}{'\n'}
                    • Updated: {cityDataMigrationResult.citiesUpdated}{'\n'}
                    • Skipped: {cityDataMigrationResult.citiesSkipped}{'\n'}
                    • Errors: {cityDataMigrationResult.errors.length}{'\n'}
                    {'\n'}
                    Check console for detailed results.
                  </ThemedText>
                </View>
              )}
            </View>
            
            {/* Airline Data Migration Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#FFF3E0', borderColor: '#FF9800' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#E65100' }]}>✈️ Fix Airline Names</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#E65100' }]}>
                Normalizes the airline field for all users based on their email domain.{'\\n'}
                {'\\n'}
                This will fix:{'\\n'}
                • Users with no airline set{'\\n'}
                • Inconsistent names like "AA" → "American Airlines"{'\\n'}
                {'\\n'}
                ⚠️ Safe to run multiple times. Check console for results.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FF9800' }]}
                onPress={migrateAirlineData}
              >
                <ThemedText style={styles.buttonText}>✈️ Fix Airline Names</ThemedText>
              </TouchableOpacity>
            </View>

            {/* User Name Migration Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#F3E5F5', borderColor: '#9C27B0' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#4A148C' }]}>👤 Backfill User Names</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#4A148C' }]}>
                Derives firstName, lastInitial, and displayName from email for users who never completed profile setup.{'\\n'}
                {'\\n'}
                Currently parses AA emails (first.last@aa.com).{'\\n'}
                Only writes fields that are missing — won't overwrite existing names.{'\\n'}
                {'\\n'}
                ⚠️ Safe to run multiple times. Check console for results.
              </ThemedText>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#9C27B0' }]}
                onPress={migrateUserNames}
              >
                <ThemedText style={styles.buttonText}>👤 Backfill User Names</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Position Migration Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#FFF8E1', borderColor: '#FFC107' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#FF6F00' }]}>🎯 Fix Position Names</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#FF6F00' }]}>
                Normalizes the position field for all users. Fixes casing variants like "flight attendant" or "FLIGHT ATTENDANT" → "Flight Attendant".{'\\n'}
                {'\\n'}
                ⚠️ Safe to run multiple times. Check console for results.
              </ThemedText>

              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#FFC107' }]}
                onPress={migratePositionData}
              >
                <ThemedText style={[styles.buttonText, { color: '#000' }]}>🎯 Fix Position Names</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Skyline Coverage Report Card */}
            <View style={[styles.card, { marginTop: 20, backgroundColor: '#E8F5E9', borderColor: '#4CAF50' }]}>
              <ThemedText style={[styles.cardTitle, { color: '#1B5E20' }]}>📊 Skyline Coverage Report</ThemedText>
              <ThemedText style={[styles.cardDescription, { color: '#1B5E20' }]}>
                Analyze which of your current users have skylines and which don't.{'\n'}
                {'\n'}
                This will show you:{'\n'}
                • How many users have skylines{'\n'}
                • Which bases need skylines added{'\n'}
                • Priority order (by user count){'\n'}
                • List of users per base
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, { backgroundColor: '#4CAF50' }, analyzingCoverage && styles.buttonDisabled]}
                onPress={handleAnalyzeCoverage}
                disabled={analyzingCoverage}
              >
                {analyzingCoverage ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>📊 Generate Report</ThemedText>
                )}
              </TouchableOpacity>
              
              {coverageReport && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: Colors.card, borderColor: Colors.border }]}>
                  <ThemedText style={[styles.cardTitle, { color: Colors.text.primary }]}>📈 Coverage Summary</ThemedText>
                  
                  {/* Overall City Coverage */}
                  <ThemedText style={[styles.cardDescription, { color: Colors.text.primary }]}>
                    🏙️ CITIES:{'\n'}
                    Total: {coverageReport.totalCities}{'\n'}
                    ✅ With Skylines: {coverageReport.citiesWithSkylines} ({coverageReport.coveragePercent.toFixed(1)}%){'\n'}
                    ❌ Without Skylines: {coverageReport.citiesWithoutSkylines} ({(100 - coverageReport.coveragePercent).toFixed(1)}%){'\n'}
                    {'\n'}
                    👥 USERS:{'\n'}
                    Total: {coverageReport.totalUsers}{'\n'}
                    ✅ With Skylines: {coverageReport.usersWithSkylines} ({coverageReport.userCoveragePercent.toFixed(1)}%){'\n'}
                    ❌ Without Skylines: {coverageReport.usersWithoutSkylines}{'\n'}
                    {'\n'}
                    ✈️ LAYOVERS:{'\n'}
                    Total Active: {coverageReport.totalLayovers}{'\n'}
                    ✅ With Skylines: {coverageReport.layoversWithSkylines}
                  </ThemedText>
                  
                  {/* Cities with skylines */}
                  {coverageReport.citiesWithSkylines > 0 && (
                    <>
                      <ThemedText style={[styles.cardTitle, { marginTop: 16, color: Colors.text.primary }]}>
                        ✅ Cities with Skylines ({coverageReport.citiesWithSkylines})
                      </ThemedText>
                      <ThemedText style={[styles.cardDescription, { color: Colors.text.secondary }]}>
                        {coverageReport.cityDetails
                          .filter(c => c.hasSkyline && c.totalUsage > 0)
                          .slice(0, 15)
                          .map(c => {
                            const usage = [];
                            if (c.baseUsers > 0) usage.push(`${c.baseUsers} users`);
                            if (c.layoverCount > 0) usage.push(`${c.layoverCount} layovers`);
                            return `• ${c.city} - ${c.cityName} (${usage.join(', ')}, ${c.source})`;
                          })
                          .join('\n')}
                        {coverageReport.cityDetails.filter(c => c.hasSkyline && c.totalUsage > 0).length > 15 && 
                          `\n... and ${coverageReport.cityDetails.filter(c => c.hasSkyline && c.totalUsage > 0).length - 15} more`}
                      </ThemedText>
                    </>
                  )}
                  
                  {/* Cities needing skylines */}
                  {getPriorityCities(coverageReport).length > 0 && (
                    <>
                      <ThemedText style={[styles.cardTitle, { marginTop: 16, color: Colors.text.primary }]}>
                        ❌ Cities Needing Skylines ({getPriorityCities(coverageReport).length})
                      </ThemedText>
                      <ThemedText style={[styles.cardDescription, { color: Colors.text.secondary }]}>
                        {getPriorityCities(coverageReport)
                          .slice(0, 10)
                          .map(c => {
                            const usage = [];
                            if (c.baseUsers > 0) usage.push(`${c.baseUsers} users`);
                            if (c.layoverCount > 0) usage.push(`${c.layoverCount} layovers`);
                            const userNames = c.baseUserDetails.slice(0, 3).map(u => u.name).join(', ');
                            return `• ${c.city} - ${c.cityName} (${usage.join(', ')})\n  Users: ${userNames}${c.baseUserDetails.length > 3 ? ` +${c.baseUserDetails.length - 3} more` : ''}`;
                          })
                          .join('\n\n')}
                      </ThemedText>
                      
                      <ThemedText style={[styles.cardTitle, { marginTop: 16, color: Colors.warning }]}>
                        🎯 Top Priority (add these first)
                      </ThemedText>
                      <ThemedText style={[styles.cardDescription, { color: Colors.text.secondary }]}>
                        {getPriorityCities(coverageReport)
                          .slice(0, 5)
                          .map((c, i) => {
                            const usage = [];
                            if (c.baseUsers > 0) usage.push(`${c.baseUsers} users`);
                            if (c.layoverCount > 0) usage.push(`${c.layoverCount} layovers`);
                            return `${i + 1}. ${c.city} - ${c.cityName} (${usage.join(', ')})`;
                          })
                          .join('\n')}
                      </ThemedText>
                    </>
                  )}
                </View>
              )}
            </View>
            
            {/* Add Skylines Section - Shows after coverage report is generated */}
            {coverageReport && getPriorityCities(coverageReport).length > 0 && (
              <View style={{ marginTop: 32 }}>
                <ThemedText style={styles.sectionTitle}>
                  ➕ Add City Skylines ({getPriorityCities(coverageReport).length} cities)
                </ThemedText>
                
                <View style={[styles.card, { backgroundColor: Colors.primary + '10', borderColor: Colors.primary }]}>
                  <ThemedText style={[styles.cardTitle, { color: Colors.text.primary }]}>
                    🎨 Add Skylines Manually
                  </ThemedText>
                  <ThemedText style={[styles.cardDescription, { color: Colors.text.primary }]}>
                    Below are all the cities that need skylines, sorted by priority (usage score).{'\n'}
                    {'\n'}
                    Tap "Add Skyline" on any city to:{'\n'}
                    • Search Unsplash for a skyline photo{'\n'}
                    • Copy the image URL{'\n'}
                    • Add it directly from your app{'\n'}
                    • Users see it immediately!
                  </ThemedText>
                </View>
                
                {/* Render SkylineManager for each city needing a skyline */}
                {getPriorityCities(coverageReport)
                  .map((city) => (
                    <SkylineManager
                      key={city.city}
                      baseCode={city.city}
                      cityName={city.cityName}
                      userCount={city.baseUsers}
                      users={city.baseUserDetails}
                      layoverCount={city.layoverCount}
                      onComplete={handleAnalyzeCoverage}
                    />
                  ))}
              </View>
            )}
            
            <ThemedText style={[styles.sectionTitle, { marginTop: 32 }]}>🔧 User Management</ThemedText>
            
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

            {/* ===== SECTION 3: DATA CLEANUP ===== */}
            <View style={[styles.sectionHeader, { marginTop: 40 }]}>
              <ThemedText style={styles.sectionHeaderText}>🧹 DATA CLEANUP</ThemedText>
              <ThemedText style={styles.sectionSubtext}>
                Spot data and other cleanup tasks
              </ThemedText>
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

            {/* Google Photos Backfill Card */}
            <View style={[styles.card, { marginTop: 20 }]}>
              <ThemedText style={styles.cardTitle}>📸 Backfill Google Photos</ThemedText>
              <ThemedText style={styles.cardDescription}>
                Fetch photos from Google Places for all spots that:{'\n'}
                • Have a placeId (from Google Places){'\n'}
                • Don't have any photos yet{'\n'}
                {'\n'}
                This will automatically add up to 3 photos per spot. May take a few minutes depending on how many spots need photos.
              </ThemedText>
              
              <TouchableOpacity
                style={[styles.button, backfillingPhotos && styles.buttonDisabled]}
                onPress={handleBackfillGooglePhotos}
                disabled={backfillingPhotos}
              >
                {backfillingPhotos ? (
                  <ActivityIndicator color={Colors.white} />
                ) : (
                  <ThemedText style={styles.buttonText}>Backfill Google Photos</ThemedText>
                )}
              </TouchableOpacity>
              
              {photoBackfillResult && (
                <View style={[styles.card, { marginTop: 16, backgroundColor: Colors.success + '10' }]}>
                  <ThemedText style={styles.cardTitle}>✅ Backfill Complete</ThemedText>
                  <ThemedText style={styles.cardDescription}>
                    • Total Spots: {photoBackfillResult.totalSpots}{'\n'}
                    • Already had photos: {photoBackfillResult.spotsWithPhotos}{'\n'}
                    • Photos added: {photoBackfillResult.successCount}{'\n'}
                    • No photos available: {photoBackfillResult.noPhotosAvailable}{'\n'}
                    • Errors: {photoBackfillResult.errorCount}{'\n'}
                    • No Place ID: {photoBackfillResult.spotsWithoutPlaceId}
                  </ThemedText>
                  
                  {photoBackfillResult.errors && photoBackfillResult.errors.length > 0 && (
                    <>
                      <ThemedText style={[styles.cardTitle, { marginTop: 12, color: Colors.error }]}>Errors:</ThemedText>
                      <ScrollView style={{ maxHeight: 200 }}>
                        {photoBackfillResult.errors.slice(0, 10).map((error: any, index: number) => (
                          <ThemedText key={index} style={styles.cardDescription}>
                            • {error.name}: {error.error}
                          </ThemedText>
                        ))}
                        {photoBackfillResult.errors.length > 10 && (
                          <ThemedText style={[styles.cardDescription, { fontStyle: 'italic' }]}>
                            ... and {photoBackfillResult.errors.length - 10} more errors
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
  sectionHeader: {
    marginTop: 32,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  sectionHeaderText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  sectionSubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
});
