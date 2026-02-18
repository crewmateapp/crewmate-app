// app/(tabs)/index.tsx - REDESIGNED: No Gates, Layover List First
import CreatePlanWizard from '@/components/CreatePlanWizard';
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/use-theme-color';
import { useCities } from '@/hooks/useCities';
import { Plan } from '@/types/plan';
import { AirportData, searchAirports } from '@/utils/airportData';
import { archiveExpiredPlans } from '@/utils/archiveExpiredPlans';
import { cleanExpiredLayovers } from '@/utils/cleanExpiredLayovers';
import { getCurrentLocation, verifyCityLocation } from '@/utils/locationVerification';
import { notifyAdminsNewCityRequest } from '@/utils/notifications';
import { updateCheckInStreak, updateStatsForLayoverCheckIn } from '@/utils/updateUserStats';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// Random welcome sayings when not checked in
const WELCOME_SAYINGS = [
  "Ready to turn that solo layover into a crew hangout? 👥",
  "Time to find crew who actually want to explore 🗺️",
  "Let's discover who's down for dinner tonight 🍽️",
  "Your next crew adventure is waiting ✈️",
  "Ready to meet crew who get the lifestyle? 🤝",
  "Time to turn strangers into layover buddies 🌟",
  "Let's find crew with the same vibe 😎",
  "Ready to make plans with people who understand? 💫",
  "Time to connect with crew in your city 📍",
  "Let's turn that 24-hour hold into a crew meetup ⏰",
  "Ready to find your layover crew? 🎉",
  "Time to discover who's here and ready to hang 🙌",
  "Let's make crew connections that actually stick 🤜🤛",
  "Ready to meet the crew everyone's talking about? 💬",
  "Time to find crew who are down for anything 🎊",
  "Let's turn layover time into friend time 👯",
  "Ready to build your crew network? 🌐",
  "Time to meet crew with the best recommendations 💡",
  "Let's find crew who know this city inside out 🏙️",
  "Ready to turn awkward solo dining into a crew dinner? 🍜",
  "Time to connect with crew on the same schedule 📅",
  "Let's discover who's checking in tonight 🌙",
  "Ready to meet crew who share your vibe? ✨",
  "Time to find your go-to crew in every city 🌍",
  "Let's make this layover less lonely 💙",
  "Ready to find spots other crew actually recommend? ⭐",
  "Time to discover where crew hang, not tourists 🎯",
  "Let's check out the places crew won't stop talking about 🗣️",
  "Ready to find the crew-approved gems? 💎",
  "Time to see what crew in this city are up to 👀",
  "Let's discover the spots with the best crew reviews 📱",
  "Ready to find where experienced crew go? 🧭",
  "Time to explore crew-tested, crew-approved spots ✅",
  "Let's find the places crew come back to 🔄",
  "Ready to discover what crew love about this city? ❤️",
  "Time to check out spots recommended by people who get it 🎓",
  "Let's find where crew make memories 📸",
  "Ready to see what the crew consensus is? 🏆",
  "Time to discover crew favorites in your city 🌟",
  "Let's find spots that crew actually vouch for 🤝",
  "Ready to join a crew plan tonight? 🎪",
  "Time to create plans other crew want to join 📝",
  "Let's see who's organizing something fun 🎡",
  "Ready to RSVP to the adventure? 🎢",
  "Time to turn 'what should I do?' into plans 🗓️",
  "Let's find crew hosting something tonight 🎭",
  "Ready to be the crew who makes it happen? 🚀",
  "Time to discover what plans are brewing 🍺",
  "Let's turn boring layovers into crew hangouts 🎉",
  "Ready to see what crew adventures await? 🧳",
];

type UserLayover = {
  city: string;
  area: string;
  discoverable: boolean;
  isLive: boolean;
  lastVerified?: any;
  updatedAt?: any;
  expiresAt?: any;
};

type UpcomingLayover = {
  id: string;
  city: string;
  area: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'upcoming' | 'active' | 'past';
  preDiscoverable?: boolean;
  autoCheckIn?: boolean;
  createdAt: any;
};

type PickerStep = 'closed' | 'city' | 'area' | 'dates';

type CityListItem = {
  type: 'city' | 'airport' | 'recommended';
  name: string;
  code: string;
  displayName: string;
  distance?: number;
  airportData?: AirportData;
};

// Calculate distance between coordinates
const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Check if a layover has expired (24 hours)
const isLayoverExpired = (expiresAt: any): boolean => {
  if (!expiresAt) return false;
  const expiryTime = expiresAt.toMillis ? expiresAt.toMillis() : expiresAt;
  return Date.now() > expiryTime;
};

// Get time remaining in hours
const getTimeRemaining = (expiresAt: any): number => {
  if (!expiresAt) return 0;
  const expiryTime = expiresAt.toMillis ? expiresAt.toMillis() : expiresAt;
  const remaining = expiryTime - Date.now();
  return Math.max(0, Math.floor(remaining / (1000 * 60 * 60))); // Hours
};

// Format time remaining as string
const formatTimeRemaining = (expiresAt: any): string => {
  const hours = getTimeRemaining(expiresAt);
  if (hours === 0) return 'Expired';
  if (hours === 1) return '1 hour left';
  if (hours < 24) return `${hours} hours left`;
  return `${Math.floor(hours / 24)} days left`;
};
export default function MyLayoverScreen() {
  const { user } = useAuth();
  const { cities, loading: citiesLoading } = useCities();
  const colors = useColors();

  // Layover state
  const [currentLayover, setCurrentLayover] = useState<UserLayover | null>(null);
  const [upcomingLayovers, setUpcomingLayovers] = useState<UpcomingLayover[]>([]);
  const [loading, setLoading] = useState(true);

  // Picker state
  const [pickerStep, setPickerStep] = useState<PickerStep>('closed');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [editingLayoverId, setEditingLayoverId] = useState<string | null>(null);
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [autoCheckIn, setAutoCheckIn] = useState(false);
  const [selectedAirportData, setSelectedAirportData] = useState<AirportData | null>(null);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [crewLiveCount, setCrewLiveCount] = useState(0);
  const [crewNearbyCount, setCrewNearbyCount] = useState(0);
  const [upcomingPlans, setUpcomingPlans] = useState<Plan[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userFirstName, setUserFirstName] = useState<string>('');
  const [welcomeSaying, setWelcomeSaying] = useState<string>('');
  
  // Undo checkout state
  const [previousLayover, setPreviousLayover] = useState<UserLayover | null>(null);
  const [showUndoToast, setShowUndoToast] = useState(false);
  const [showCreateWizard, setShowCreateWizard] = useState(false);

  // ✅ Auto-archive expired plans + clean expired upcoming layovers on mount
  useEffect(() => {
    if (!user?.uid) return;
    archiveExpiredPlans(user.uid);
    cleanExpiredLayovers(user.uid);
  }, [user]);

  // Connections on layover state
  const [connectionsOnLayover, setConnectionsOnLayover] = useState<Array<{
    userId: string;
    connectionId: string;
    displayName: string;
    photoURL?: string;
    city: string;
    area: string;
    startDate: Date;
    endDate: Date;
    overlapType: 'current' | 'upcoming';
    daysUntil?: number;
  }>>([]);

  // Split into two lists for privacy
  const [crewLiveNow, setCrewLiveNow] = useState<Array<{
    userId: string;
    connectionId: string;
    displayName: string;
    photoURL?: string;
    city: string;
    area: string;
  }>>([]);

  const [upcomingOverlaps, setUpcomingOverlaps] = useState<Array<{
    userId: string;
    connectionId: string;
    displayName: string;
    photoURL?: string;
    city: string;
    area: string;
    startDate: Date;
    endDate: Date;
    daysUntil: number;
  }>>([]);

  // Pick a random welcome saying on mount
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * WELCOME_SAYINGS.length);
    setWelcomeSaying(WELCOME_SAYINGS[randomIndex]);
  }, []);

  // Load user layovers and auto-checkout if expired
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), async (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Load user's first name for welcome message
        if (data.firstName) {
          setUserFirstName(data.firstName);
        }
        
        // Current layover - check if expired
        const layover = data.currentLayover || null;
        
        if (layover && layover.expiresAt && isLayoverExpired(layover.expiresAt)) {
          console.log('🧹 Auto-checkout: Layover expired');
          
          // Clear expired layover and clean up any expired upcomingLayovers
          try {
            const now = new Date();
            const cleanedUpcomingLayovers = (data.upcomingLayovers || []).filter((l: UpcomingLayover) => {
              const endDate = l.endDate.toDate();
              return endDate >= now; // Keep only non-expired
            });
            
            // Update user document
            await updateDoc(doc(db, 'users', user.uid), {
              currentLayover: null,
              upcomingLayovers: cleanedUpcomingLayovers
            });
            
            // ALSO set the layover document to inactive
            const layoverQuery = query(
              collection(db, 'layovers'),
              where('userId', '==', user.uid),
              where('isActive', '==', true)
            );
            const layoverSnap = await getDocs(layoverQuery);
            
            for (const layoverDoc of layoverSnap.docs) {
              await updateDoc(doc(db, 'layovers', layoverDoc.id), {
                isActive: false
              });
            }
            
            Alert.alert(
              'Layover Expired',
              'Your 24-hour layover check-in has expired. Check in again when you\'re back in a city!',
              [{ text: 'OK' }]
            );
          } catch (error) {
            console.error('Error clearing expired layover:', error);
          }
          
          setCurrentLayover(null);
        } else {
          setCurrentLayover(layover);
        }
        
        // Upcoming layovers
        const upcoming = (data.upcomingLayovers || []).sort((a: UpcomingLayover, b: UpcomingLayover) => {
          return a.startDate.toMillis() - b.startDate.toMillis();
        });
        setUpcomingLayovers(upcoming);
        
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Auto check-in logic - check when app opens
  useEffect(() => {
    const handleAutoCheckIn = async () => {
      if (!user?.uid || currentLayover || upcomingLayovers.length === 0) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Find layovers that should auto check-in
      const layoverToCheckIn = upcomingLayovers.find(layover => {
        if (!layover.autoCheckIn) return false;
        
        const startDate = layover.startDate.toDate();
        startDate.setHours(0, 0, 0, 0);
        const endDate = layover.endDate.toDate();
        endDate.setHours(23, 59, 59, 999);

        // Check if today is within the layover dates
        return today >= startDate && today <= endDate;
      });

      if (!layoverToCheckIn) return;

      console.log('🤖 Auto check-in triggered for:', layoverToCheckIn.city);

      try {
        // Get GPS location
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('❌ Auto check-in failed: Location permission denied');
          return;
        }

        const location = await getCurrentLocation();
        if (!location.success) {
          console.log('❌ Auto check-in failed: Could not get location');
          return;
        }

        // Verify city location (50km radius check)
        const cityVerified = await verifyCityLocation(
          location.latitude!,
          location.longitude!,
          layoverToCheckIn.city
        );

        if (!cityVerified.verified) {
          console.log(`❌ Auto check-in failed: Not within 50km of ${layoverToCheckIn.city}`);
          Alert.alert(
            'Auto Check-In Failed',
            `You're not close enough to ${layoverToCheckIn.city} to check in automatically. You can check in manually when you arrive.`,
            [{ text: 'OK' }]
          );
          return;
        }

        console.log(`✅ Location verified for ${layoverToCheckIn.city}`);

        // Calculate expiration: end date + 2 hours
        const expirationDate = layoverToCheckIn.endDate.toDate();
        expirationDate.setHours(expirationDate.getHours() + 2);

        // Remove this layover from upcomingLayovers since we're checking in
        const updatedUpcomingLayovers = upcomingLayovers.filter(
          l => l.id !== layoverToCheckIn.id
        );

        // ===== TRACK CITY VISIT =====
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        const userData = userSnap.data();
        const visitedCities = userData?.visitedCities || [];
        const isNewCity = !visitedCities.includes(layoverToCheckIn.city);

        // Auto check-in!
        await updateDoc(userRef, {
          currentLayover: {
            city: layoverToCheckIn.city,
            area: layoverToCheckIn.area,
            discoverable: true,
            isLive: true,
            lastVerified: Timestamp.now(),
            expiresAt: Timestamp.fromDate(expirationDate),
            updatedAt: Timestamp.now(),
          },
          upcomingLayovers: updatedUpcomingLayovers, // Remove from upcoming
          // Add new city to visited cities if it's new
          ...(isNewCity && {
            visitedCities: arrayUnion(layoverToCheckIn.city),
            'stats.citiesVisitedCount': increment(1)
          })
        });

        // Update stats
        await updateStatsForLayoverCheckIn(user.uid, layoverToCheckIn.city);
        await updateCheckInStreak(user.uid);

        Alert.alert(
          '✅ Auto Check-In Success!',
          `You're now live in ${layoverToCheckIn.city}!`,
          [{ text: 'Great!' }]
        );

      } catch (error) {
        console.error('Error during auto check-in:', error);
      }
    };

    handleAutoCheckIn();
  }, [user, upcomingLayovers, currentLayover]);

  // Load crew counts if checked in - FILTER EXPIRED
  useEffect(() => {
    if (!user?.uid || !currentLayover?.city) return;

    // Only count crew with non-expired layovers
    const now = Timestamp.now();

    // Crew in same area (not expired)
    const areaQuery = query(
      collection(db, 'users'),
      where('currentLayover.city', '==', currentLayover.city),
      where('currentLayover.area', '==', currentLayover.area),
      where('currentLayover.discoverable', '==', true),
      where('currentLayover.isLive', '==', true),
      where('currentLayover.expiresAt', '>', now)
    );

    const unsubArea = onSnapshot(areaQuery, (snapshot) => {
      setCrewLiveCount(snapshot.docs.filter(doc => doc.id !== user.uid).length);
    });

    // Crew in same city (not expired)
    const cityQuery = query(
      collection(db, 'users'),
      where('currentLayover.city', '==', currentLayover.city),
      where('currentLayover.discoverable', '==', true),
      where('currentLayover.isLive', '==', true),
      where('currentLayover.expiresAt', '>', now)
    );

    const unsubCity = onSnapshot(cityQuery, (snapshot) => {
      setCrewNearbyCount(snapshot.docs.filter(doc => doc.id !== user.uid).length);
    });

    return () => {
      unsubArea();
      unsubCity();
    };
  }, [user, currentLayover]);

  // Load plans for current layover
  useEffect(() => {
    if (!user?.uid || !currentLayover?.city) {
      setUpcomingPlans([]);
      return;
    }

    // Only show plans that haven't passed yet (with 2-hour grace period)
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const cutoffTime = Timestamp.fromDate(twoHoursAgo);

    const q = query(
      collection(db, 'plans'),
      where('city', '==', currentLayover.city),
      where('status', '==', 'active'),
      where('scheduledTime', '>', cutoffTime), // Only show future plans (with grace period)
      orderBy('scheduledTime', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plans: Plan[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data() as Plan;
        if (data.hostUserId === user.uid || data.attendeeIds.includes(user.uid)) {
          plans.push({ id: doc.id, ...data });
        }
      });
      setUpcomingPlans(plans.slice(0, 3)); // Top 3
    });

    return () => unsubscribe();
  }, [user, currentLayover]);

  // Find connections on layover - SPLIT FOR PRIVACY
  useEffect(() => {
    const findConnectionsOnLayover = async () => {
      if (!user?.uid) {
        setConnectionsOnLayover([]);
        setCrewLiveNow([]);
        setUpcomingOverlaps([]);
        return;
      }

      try {
        // Get my connections
        const connectionsQuery = query(
          collection(db, 'connections'),
          where('userIds', 'array-contains', user.uid)
        );
        const connectionsSnapshot = await getDocs(connectionsQuery);
        
        const connectionUserIds: string[] = [];
        const userIdToConnectionId: { [userId: string]: string } = {};
        connectionsSnapshot.forEach(doc => {
          const data = doc.data();
          const otherUserId = data.userIds.find((id: string) => id !== user.uid);
          if (otherUserId) {
            connectionUserIds.push(otherUserId);
            userIdToConnectionId[otherUserId] = doc.id;
          }
        });

        if (connectionUserIds.length === 0) {
          setConnectionsOnLayover([]);
          setCrewLiveNow([]);
          setUpcomingOverlaps([]);
          return;
        }

        // Prepare for two separate lists
        const liveNow: typeof crewLiveNow = [];
        const upcoming: typeof upcomingOverlaps = [];
        const addedToLive = new Set<string>();
        const addedToUpcoming = new Set<string>();

        const now = new Date();
        const nowTimestamp = Timestamp.now();

        // Collect my valid upcoming layovers (not expired)
        const myUpcomingLayovers = upcomingLayovers.filter(layover => {
          const endDate = layover.endDate.toDate();
          return endDate >= now;
        });

        // Check each connection
        for (const connectionId of connectionUserIds) {
          const userDoc = await getDoc(doc(db, 'users', connectionId));
          if (!userDoc.exists()) continue;
          
          const userData = userDoc.data();

          // PRIVACY CHECK 1: Crew Live Now - ONLY if BOTH have currentLayover in same city
          if (currentLayover?.city && currentLayover?.isLive && currentLayover?.discoverable) {
            if (userData.currentLayover?.city && 
                userData.currentLayover?.isLive &&
                userData.currentLayover?.discoverable &&
                userData.currentLayover?.expiresAt &&
                userData.currentLayover.expiresAt > nowTimestamp &&
                userData.currentLayover.city === currentLayover.city) {
              
              // Both are LIVE in same city - add to liveNow
              if (!addedToLive.has(connectionId)) {
                liveNow.push({
                  userId: connectionId,
                  connectionId: userIdToConnectionId[connectionId],
                  displayName: userData.displayName || userData.firstName,
                  photoURL: userData.photoURL,
                  city: userData.currentLayover.city,
                  area: userData.currentLayover.area || '',
                });
                addedToLive.add(connectionId);
              }
            }
          }

          // PRIVACY CHECK 2: Upcoming Overlaps - ONLY upcomingLayover vs upcomingLayover
          // Do NOT match my upcoming against their currentLayover (privacy!)
          if (!addedToUpcoming.has(connectionId) && myUpcomingLayovers.length > 0) {
            const theirUpcomingLayovers = (userData.upcomingLayovers || []).filter((l: any) => {
              const endDate = l.endDate?.toDate();
              return endDate && endDate >= now; // Not expired
            });

            // Check for overlaps between MY upcoming and THEIR upcoming
            for (const myLayover of myUpcomingLayovers) {
              if (addedToUpcoming.has(connectionId)) break;

              for (const theirLayover of theirUpcomingLayovers) {
                const theirStart = theirLayover.startDate?.toDate();
                const theirEnd = theirLayover.endDate?.toDate();
                if (!theirStart || !theirEnd) continue;

                const myStart = myLayover.startDate.toDate();
                const myEnd = myLayover.endDate.toDate();

                // Same city AND dates overlap
                if (myLayover.city === theirLayover.city &&
                    myStart <= theirEnd &&
                    myEnd >= theirStart) {
                  
                  const overlapStart = Math.max(myStart.getTime(), theirStart.getTime());
                  const daysUntil = Math.ceil((overlapStart - now.getTime()) / (1000 * 60 * 60 * 24));
                  
                  upcoming.push({
                    userId: connectionId,
                    connectionId: userIdToConnectionId[connectionId],
                    displayName: userData.displayName || userData.firstName,
                    photoURL: userData.photoURL,
                    city: theirLayover.city,
                    area: theirLayover.area || '',
                    startDate: theirStart,
                    endDate: theirEnd,
                    daysUntil: Math.max(0, daysUntil),
                  });
                  addedToUpcoming.add(connectionId);
                  break; // Only add once per connection
                }
              }
            }
          }
        }

        // Sort upcoming by days until
        upcoming.sort((a, b) => a.daysUntil - b.daysUntil);

        // Update states
        setCrewLiveNow(liveNow);
        setUpcomingOverlaps(upcoming);

        // Also update legacy connectionsOnLayover for backward compatibility
        const combined = [
          ...liveNow.map(c => ({
            ...c,
            startDate: now,
            endDate: now,
            overlapType: 'current' as const,
            daysUntil: 0,
          })),
          ...upcoming.map(c => ({
            ...c,
            overlapType: 'upcoming' as const,
          })),
        ];
        setConnectionsOnLayover(combined);

      } catch (error) {
        console.error('Error finding connections on layover:', error);
      }
    };

    findConnectionsOnLayover();
  }, [user, currentLayover, upcomingLayovers]);

  // Get user location for recommendations
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const location = await Location.getCurrentPositionAsync({});
        setUserLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      }
    })();
  }, []);

  // Filter cities for picker
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) {
      const items: CityListItem[] = cities.map(city => ({
        type: 'city' as const,
        name: city.name,
        code: city.code,
        displayName: city.name,
      }));

      // Add GPS recommendations if available
      if (userLocation) {
        const nearby = searchAirports(userLocation.latitude, userLocation.longitude, '');
        nearby.slice(0, 3).forEach(airport => {
          const distance = getDistance(
            userLocation.latitude,
            userLocation.longitude,
            airport.lat,
            airport.lon
          );
          items.unshift({
            type: 'recommended',
            name: airport.name,
            code: airport.code,
            displayName: `${airport.name} (${airport.code})`,
            distance,
            airportData: airport,
          });
        });
      }

      return items;
    }

    // Search cities and airports
    const query = searchQuery.toLowerCase().trim();
    const results: CityListItem[] = [];

    cities.forEach(city => {
      if (city.name.toLowerCase().includes(query) || city.code.toLowerCase().includes(query)) {
        results.push({
          type: 'city',
          name: city.name,
          code: city.code,
          displayName: city.name,
        });
      }
    });

    // Search airports (only if query is not empty)
    if (query) {
      const airports = searchAirports(0, 0, query);
      airports.slice(0, 5).forEach(airport => {
        if (!results.some(r => r.code === airport.code)) {
          results.push({
            type: 'airport',
            name: airport.name,
            code: airport.code,
            displayName: `${airport.name} (${airport.code})`,
            airportData: airport,
          });
        }
      });
    }

    return results;
  }, [searchQuery, cities, userLocation]);

  // Check in to a layover with GPS verification
  const checkInToLayover = async (layover: UpcomingLayover) => {
    if (!user?.uid) return;

    try {
      setVerifying(true);

      // Step 0: Validate layover dates - must be active today
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      const startDate = layover.startDate.toDate();
      startDate.setHours(0, 0, 0, 0);
      const endDate = layover.endDate.toDate();
      endDate.setHours(23, 59, 59, 999); // End of day

      if (today < startDate) {
        // Layover hasn't started yet
        const daysUntil = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        Alert.alert(
          'Layover Not Started',
          `This layover starts in ${daysUntil} day${daysUntil === 1 ? '' : 's'}. You can check in on ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.`,
          [{ text: 'OK' }]
        );
        return;
      }

      if (today > endDate) {
        // Layover has already ended
        Alert.alert(
          'Layover Ended',
          'This layover has already ended. Please create a new layover to check in.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Step 1: Get current location
      const locationResult = await getCurrentLocation();
      
      if (!locationResult.success) {
        Alert.alert('Location Required', locationResult.error || 'Unable to verify your location.');
        return;
      }

      // Step 2: Verify user is in the city
      const verification = await verifyCityLocation(
        locationResult.latitude!,
        locationResult.longitude!,
        layover.city
      );

      if (!verification.verified) {
        Alert.alert(
          'Not in ' + layover.city,
          verification.message,
          [{ text: 'OK' }]
        );
        return;
      }

      // Step 3: Check for duplicate check-in today (prevent gaming)
      today.setHours(0, 0, 0, 0); // Reset to start of day
      const todayTimestamp = Timestamp.fromDate(today);

      const existingCheckInQuery = query(
        collection(db, 'layovers'),
        where('userId', '==', user.uid),
        where('city', '==', layover.city),
        where('checkedInAt', '>=', todayTimestamp)
      );

      const existingCheckIns = await getDocs(existingCheckInQuery);
      const isFirstCheckInToday = existingCheckIns.empty;

      // Step 4: Create permanent layover record ONLY if first check-in today
      if (isFirstCheckInToday) {
        const layoverData = {
          userId: user.uid,
          city: layover.city,
          area: layover.area,
          startDate: layover.startDate,
          endDate: layover.endDate,
          coordinates: {
            latitude: locationResult.latitude!,
            longitude: locationResult.longitude!,
          },
          checkedInAt: serverTimestamp(),
          isActive: true,
        };

        await addDoc(collection(db, 'layovers'), layoverData);
      }

      // Step 5: Update current layover (always, even if duplicate check-in)
      // Use end date + 2 hours as expiration (matching auto check-in logic)
      const expirationDate = layover.endDate.toDate();
      expirationDate.setHours(expirationDate.getHours() + 2);
      const expiresAt = Timestamp.fromDate(expirationDate);

      // Remove from upcoming layovers list (you've checked in!)
      const updatedUpcomingLayovers = upcomingLayovers.filter(l => l.id !== layover.id);

      // ===== TRACK CITY VISIT =====
      const userRef = doc(db, 'users', user.uid);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();
      const visitedCities = userData?.visitedCities || [];
      const isNewCity = !visitedCities.includes(layover.city);

      await updateDoc(userRef, {
        currentLayover: {
          city: layover.city,
          area: layover.area,
          discoverable: true, // Go live immediately after GPS verification
          isLive: true,
          lastVerified: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt: expiresAt,
        },
        upcomingLayovers: updatedUpcomingLayovers, // Remove this layover from upcoming
        // Add new city to visited cities if it's new
        ...(isNewCity && {
          visitedCities: arrayUnion(layover.city),
          'stats.citiesVisitedCount': increment(1)
        })
      });

      // ✨ ENGAGEMENT: Track check-in stats ONLY if first check-in today
      if (isFirstCheckInToday) {
        try {
          // isNewCity already calculated above
          await updateStatsForLayoverCheckIn(user.uid, layover.city, isNewCity);
          await updateCheckInStreak(user.uid);
        } catch (error) {
          console.error('Error tracking check-in stats:', error);
          // Don't fail the whole check-in if tracking fails
        }
      }

      Alert.alert(
        '✅ You\'re Live!',
        `You're checked in and visible to crew in ${layover.city}!${isFirstCheckInToday ? '' : '\n\n(Already checked in earlier today)'}`,
        [{ text: 'Great!' }]
      );
    } catch (error) {
      console.error('Error checking in:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Go live (make discoverable) - also requires GPS verification
  const handleGoLive = async () => {
    if (!user?.uid || !currentLayover) return;

    try {
      setVerifying(true);

      // Re-verify GPS location
      const locationResult = await getCurrentLocation();
      
      if (!locationResult.success) {
        Alert.alert('Location Required', locationResult.error || 'Unable to verify your location.');
        return;
      }

      const verification = await verifyCityLocation(
        locationResult.latitude!,
        locationResult.longitude!,
        currentLayover.city
      );

      if (!verification.verified) {
        Alert.alert(
          'Not in ' + currentLayover.city,
          verification.message + ' You need to be in the city to go live.',
          [{ text: 'OK' }]
        );
        return;
      }

      // GPS verified - go live!
      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      );

      await updateDoc(doc(db, 'users', user.uid), {
        'currentLayover.isLive': true,
        'currentLayover.discoverable': true,
        'currentLayover.lastVerified': serverTimestamp(),
        'currentLayover.expiresAt': expiresAt,
      });

      Alert.alert(
        '✅ You\'re Live!',
        `You're now visible to crew in ${currentLayover.city}!`,
        [{ text: 'Great!' }]
      );
    } catch (error) {
      console.error('Error going live:', error);
      Alert.alert('Error', 'Failed to go live. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Manual checkout
  const handleCheckout = async () => {
    if (!user?.uid || !currentLayover) return;

    Alert.alert(
      '✈️ Check Out?',
      `This will end your layover and make you invisible to crew in ${currentLayover.city}.\n\nYou can check back in anytime!`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Check Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Save current layover for undo
              setPreviousLayover(currentLayover);
              
              // Clean up upcomingLayovers - remove any that have already ended or match current city
              const now = new Date();
              const cleanedUpcomingLayovers = upcomingLayovers.filter(layover => {
                const endDate = layover.endDate.toDate();
                const hasEnded = endDate < now;
                const matchesCurrentCity = layover.city === currentLayover.city && 
                                          layover.endDate.toDate().getTime() === currentLayover.expiresAt?.toDate().getTime();
                // Keep layover if it hasn't ended AND doesn't match the current one we're checking out of
                return !hasEnded && !matchesCurrentCity;
              });
              
              // Clear current layover and clean up upcoming
              await updateDoc(doc(db, 'users', user.uid), {
                currentLayover: null,
                upcomingLayovers: cleanedUpcomingLayovers
              });
              
              // ALSO set the layover document to inactive
              const layoverQuery = query(
                collection(db, 'layovers'),
                where('userId', '==', user.uid),
                where('isActive', '==', true)
              );
              const layoverSnap = await getDocs(layoverQuery);
              
              for (const layoverDoc of layoverSnap.docs) {
                await updateDoc(doc(db, 'layovers', layoverDoc.id), {
                  isActive: false
                });
              }
              
              // Show undo toast
              setShowUndoToast(true);
              
              // Auto-dismiss toast after 5 seconds
              setTimeout(() => {
                setShowUndoToast(false);
                setPreviousLayover(null);
              }, 5000);
              
            } catch (error) {
              console.error('Error checking out:', error);
              Alert.alert('Error', 'Failed to check out. Please try again.');
            }
          }
        }
      ]
    );
  };

  // Undo checkout - restore previous layover
  const handleUndoCheckout = async () => {
    if (!user?.uid || !previousLayover) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentLayover: previousLayover
      });
      
      // Clear undo state
      setShowUndoToast(false);
      setPreviousLayover(null);
      
      Alert.alert('✅ Restored', 'Your layover has been restored!');
    } catch (error) {
      console.error('Error undoing checkout:', error);
      Alert.alert('Error', 'Failed to undo checkout. Please check in again.');
    }
  };

  // Go offline
  const handleGoOffline = async () => {
    if (!user?.uid) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        'currentLayover.isLive': false,
        'currentLayover.discoverable': false,
      });
    } catch (error) {
      console.error('Error going offline:', error);
      Alert.alert('Error', 'Failed to go offline. Please try again.');
    }
  };

  // End check-in
  const endCheckIn = () => {
    Alert.alert(
      'End Check-In?',
      "You'll stop being discoverable and lose access to live crew features.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Check-In',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) return;
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                currentLayover: null,
              });
            } catch (error) {
              console.error('Error ending check-in:', error);
              Alert.alert('Error', 'Failed to end check-in.');
            }
          },
        },
      ]
    );
  };

  // Delete upcoming layover
  const deleteLayover = (layoverId: string, layoverCity: string) => {
    Alert.alert(
      'Delete Layover?',
      `Remove ${layoverCity} from your upcoming layovers?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!user?.uid) return;
            try {
              const updatedLayovers = upcomingLayovers.filter(l => l.id !== layoverId);
              await updateDoc(doc(db, 'users', user.uid), {
                upcomingLayovers: updatedLayovers,
              });
            } catch (error) {
              console.error('Error deleting layover:', error);
              Alert.alert('Error', 'Failed to delete layover.');
            }
          },
        },
      ]
    );
  };

  // Add layover - open picker
  const openLayoverPicker = () => {
    setPickerStep('city');
    setSearchQuery('');
    setSelectedCity('');
    setSelectedArea('');
    setSelectedAirportData(null);
    setEditingLayoverId(null);
    setAutoCheckIn(false); // Reset checkbox
    // Set default dates: tomorrow and day after
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfter = new Date();
    dayAfter.setDate(dayAfter.getDate() + 2);
    setStartDate(tomorrow);
    setEndDate(dayAfter);
  };

  // Edit layover - open picker with existing data
  const editLayover = (layover: UpcomingLayover) => {
    setEditingLayoverId(layover.id);
    setSelectedCity(layover.city);
    setSelectedArea(layover.area);
    setSelectedAirportData(null); // Clear airport data when editing
    setStartDate(layover.startDate.toDate());
    setEndDate(layover.endDate.toDate());
    setAutoCheckIn(layover.autoCheckIn || false);
    setPickerStep('dates'); // Skip city/area selection, go straight to dates
  };

  // Select city from picker
  const selectCity = (item: CityListItem) => {
    setSelectedCity(item.name);
    setSelectedAirportData(item.airportData || null);
    setPickerStep('area');
    setSearchQuery('');
  };

  // Select area and move to dates
  const selectArea = (area: string) => {
    setSelectedArea(area);
    setPickerStep('dates');
  };

  // Save layover (create or edit)
  const saveLayover = async () => {
    if (!user?.uid || !selectedCity || !selectedArea) return;

    try {
      if (editingLayoverId) {
        // Edit existing layover
        const updatedLayovers = upcomingLayovers.map(l => {
          if (l.id === editingLayoverId) {
            return {
              ...l,
              city: selectedCity,
              area: selectedArea,
              startDate: Timestamp.fromDate(startDate),
              endDate: Timestamp.fromDate(endDate),
              autoCheckIn,
            };
          }
          return l;
        });

        await updateDoc(doc(db, 'users', user.uid), {
          upcomingLayovers: updatedLayovers,
        });

        Alert.alert('Success', 'Layover updated!');
      } else {
        // Create new layover
        const newLayover: Omit<UpcomingLayover, 'id'> = {
          city: selectedCity,
          area: selectedArea,
          startDate: Timestamp.fromDate(startDate),
          endDate: Timestamp.fromDate(endDate),
          status: 'upcoming',
          preDiscoverable: false,
          autoCheckIn,
          createdAt: Timestamp.now(),
        };

        const layoverId = `layover_${Date.now()}`;
        const layoverWithId = { id: layoverId, ...newLayover };

        await updateDoc(doc(db, 'users', user.uid), {
          upcomingLayovers: [...upcomingLayovers, layoverWithId],
        });

        const message = autoCheckIn 
          ? 'Layover added! We\'ll auto check you in when it starts.' 
          : 'Layover added! You can check in when you arrive.';
        Alert.alert('Success', message);
      }

      setPickerStep('closed');
      setEditingLayoverId(null);
      setAutoCheckIn(false); // Reset checkbox
    } catch (error) {
      console.error('Error saving layover:', error);
      Alert.alert('Error', 'Failed to save layover. Please try again.');
    }
  };

  // Request new city
  const requestNewCity = () => {
    Alert.alert(
      'Request New City',
      "Don't see your city? You can request it and we'll add it soon!",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request City',
          onPress: async () => {
            await notifyAdminsNewCityRequest(`cityreq_${Date.now()}`, searchQuery, user?.uid || '', userFirstName || 'A crew member');
            Alert.alert('Request Sent!', "We'll review your request and add the city soon.");
            setPickerStep('closed');
          },
        },
      ]
    );
  };

  const selectedCityData = cities.find(c => c.name === selectedCity);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        
        {/* Welcome Message */}
        {userFirstName && (
          <View style={styles.welcomeSection}>
            <ThemedText style={styles.welcomeText}>
              Welcome back, {userFirstName} ✈️
            </ThemedText>
            <ThemedText style={styles.welcomeSubtext}>
              {currentLayover 
                ? `You're checked in to ${currentLayover.city}`
                : welcomeSaying}
            </ThemedText>
          </View>
        )}
        
        {/* Current Layover (if checked in) */}
        {currentLayover && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Current Layover</ThemedText>
            
            {/* Make entire card clickable - navigate to layover detail */}
            <TouchableOpacity 
              style={[styles.layoverCard, styles.currentCard]}
              onPress={async () => {
                // Try to find existing layover
                let targetLayover = upcomingLayovers.find(l => 
                  l.city === currentLayover.city && 
                  l.area === currentLayover.area
                );
                
                // If no layover exists, create one automatically
                if (!targetLayover && user?.uid) {
                  try {
                    const now = new Date();
                    const endOfDay = new Date();
                    endOfDay.setHours(23, 59, 59);
                    
                    const newLayover = {
                      id: `layover_${Date.now()}`,
                      city: currentLayover.city,
                      area: currentLayover.area,
                      startDate: Timestamp.fromDate(now),
                      endDate: Timestamp.fromDate(endOfDay),
                      status: 'active' as const,
                      preDiscoverable: false,
                      createdAt: Timestamp.now(),
                    };
                    
                    await updateDoc(doc(db, 'users', user.uid), {
                      upcomingLayovers: [...upcomingLayovers, newLayover],
                    });
                    
                    // Navigate to the new layover
                    router.push(`/layover/${newLayover.id}`);
                  } catch (error) {
                    console.error('Error creating layover:', error);
                    Alert.alert('Error', 'Could not load layover details');
                  }
                } else if (targetLayover) {
                  // Navigate to existing layover
                  router.push(`/layover/${targetLayover.id}`);
                }
              }}
              activeOpacity={0.9}
            >
              <View style={styles.layoverHeader}>
                <View style={styles.layoverInfo}>
                  <ThemedText style={styles.layoverCity}>{currentLayover.city}</ThemedText>
                  <ThemedText style={styles.layoverArea}>{currentLayover.area}</ThemedText>
                </View>
                <TouchableOpacity 
                  onPress={(e) => {
                    e.stopPropagation();
                    endCheckIn();
                  }}
                >
                  <Ionicons name="close-circle" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Time Remaining Indicator - Move BEFORE live status */}
              {currentLayover.expiresAt && (
                <View style={styles.timeRemaining}>
                  <Ionicons 
                    name="time-outline" 
                    size={18} 
                    color={getTimeRemaining(currentLayover.expiresAt) <= 2 ? Colors.error : Colors.text.secondary} 
                  />
                  <ThemedText 
                    style={[
                      styles.timeRemainingText,
                      getTimeRemaining(currentLayover.expiresAt) <= 2 && styles.timeRemainingUrgent
                    ]}
                  >
                    {formatTimeRemaining(currentLayover.expiresAt)}
                  </ThemedText>
                </View>
              )}

              {/* Live Status */}
              {currentLayover.isLive ? (
                <View style={styles.liveSection}>
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <ThemedText style={styles.liveText}>You're Live!</ThemedText>
                  </View>

                  {/* Improved Stats - Only show when crew > 0 */}
                  <View style={styles.statsRow}>
                    {crewLiveCount > 0 && (
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statNumber}>{crewLiveCount}</ThemedText>
                        <ThemedText style={styles.statLabel}>
                          crew in {currentLayover.area}
                        </ThemedText>
                      </View>
                    )}
                    {crewNearbyCount > 0 && (
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statNumber}>{crewNearbyCount}</ThemedText>
                        <ThemedText style={styles.statLabel}>
                          crew in {currentLayover.city}
                        </ThemedText>
                      </View>
                    )}
                    {crewLiveCount === 0 && crewNearbyCount === 0 && (
                      <View style={styles.statItem}>
                        <ThemedText style={styles.statLabel}>
                          No crew currently live in {currentLayover.city}
                        </ThemedText>
                      </View>
                    )}
                  </View>

                  <TouchableOpacity 
                    style={styles.secondaryButton} 
                    onPress={(e) => {
                      e.stopPropagation();
                      handleGoOffline();
                    }}
                  >
                    <Ionicons name="eye-off-outline" size={18} color={Colors.text.primary} />
                    <ThemedText style={styles.secondaryButtonText}>Go Offline</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.offlineSection}>
                  <View style={styles.offlineBanner}>
                    <Ionicons name="eye-off-outline" size={16} color={Colors.warning} />
                    <ThemedText style={styles.offlineBannerText}>
                      You're offline. Go live to connect with crew!
                    </ThemedText>
                  </View>

                  <TouchableOpacity
                    style={styles.goLiveButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      handleGoLive();
                    }}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <>
                        <ActivityIndicator size="small" color={Colors.white} />
                        <ThemedText style={styles.goLiveText}>Verifying...</ThemedText>
                      </>
                    ) : (
                      <>
                        <Ionicons name="radio-outline" size={20} color={Colors.white} />
                        <ThemedText style={styles.goLiveText}>Go Live</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>

                  <ThemedText style={styles.offlineNote}>
                    Or keep planning — you don't need to be live to make plans
                  </ThemedText>
                </View>
              )}

              {/* Quick Actions - Add stopPropagation to all buttons */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    setShowCreateWizard(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.actionButtonText}>Create Plan</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push('/(tabs)/plans');
                  }}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.actionButtonText}>My Plans</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push(`/connections?filterCity=${currentLayover.city}`);
                  }}
                >
                  <Ionicons name="people-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.actionButtonText}>Find Crew</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    router.push('/(tabs)/explore');
                  }}
                >
                  <Ionicons name="compass-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.actionButtonText}>Browse Spots</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Manual Checkout Button */}
              <TouchableOpacity 
                style={styles.checkoutButton}
                onPress={(e) => {
                  e.stopPropagation();
                  handleCheckout();
                }}
              >
                <Ionicons name="exit-outline" size={18} color={Colors.error} />
                <ThemedText style={styles.checkoutButtonText}>Check Out</ThemedText>
              </TouchableOpacity>

              {/* Recent Plans */}
              {upcomingPlans.length > 0 && (
                <View style={styles.recentPlans}>
                  <ThemedText style={styles.recentPlansTitle}>Upcoming Plans</ThemedText>
                  {upcomingPlans.map(plan => (
                    <PlanCard key={plan.id} plan={plan} showHost={false} />
                  ))}
                </View>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Crew Live Here Now - PRIVACY: Only shows if you're BOTH checked in */}
        {currentLayover && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="radio-button-on" size={20} color={Colors.success} style={{ marginRight: 8 }} />
              <ThemedText style={styles.sectionTitle}>
                Crew Live Here Now {crewLiveNow.length > 0 && `(${crewLiveNow.length})`}
              </ThemedText>
            </View>
            <ThemedText style={styles.sectionSubtitle}>
              Connections checked in to {currentLayover?.city} right now
            </ThemedText>

            {crewLiveNow.length > 0 ? (
              <View style={styles.connectionsList}>
                {crewLiveNow.map((connection) => (
                <TouchableOpacity
                  key={connection.userId}
                  style={styles.connectionCard}
                  onPress={() => router.push(`/profile/${connection.userId}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.connectionLeft}>
                    <View style={styles.connectionAvatarWrapper}>
                      {connection.photoURL ? (
                        <Image 
                          source={{ uri: connection.photoURL }} 
                          style={styles.connectionAvatar}
                        />
                      ) : (
                        <View style={styles.connectionAvatarFallback}>
                          <ThemedText style={styles.connectionAvatarText}>
                            {connection.displayName?.[0] || '?'}
                          </ThemedText>
                        </View>
                      )}
                      {/* LIVE indicator */}
                      <View style={styles.statusLiveIndicator}>
                        <View style={styles.statusLiveIndicatorDot} />
                      </View>
                    </View>
                    <View style={styles.connectionInfo}>
                      <ThemedText style={styles.connectionName}>
                        {connection.displayName}
                      </ThemedText>
                      <View style={styles.connectionLocation}>
                        <Ionicons name="location" size={14} color={Colors.primary} />
                        <ThemedText style={styles.connectionCity}>
                          {connection.city}
                          {connection.area ? ` • ${connection.area}` : ''}
                        </ThemedText>
                      </View>
                      <View style={styles.overlapBadgeCurrent}>
                        <View style={styles.livePulseDot} />
                        <ThemedText style={styles.overlapBadgeText}>LIVE NOW</ThemedText>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={async (e) => {
                      e.stopPropagation();
                      try {
                        // Initialize lastMessage fields if they don't exist
                        const connectionRef = doc(db, 'connections', connection.connectionId);
                        const connectionSnap = await getDoc(connectionRef);
                        
                        if (connectionSnap.exists()) {
                          const data = connectionSnap.data();
                          if (!data.lastMessage && data.lastMessage !== '') {
                            await updateDoc(connectionRef, {
                              lastMessage: '',
                              lastMessageTime: serverTimestamp(),
                              unreadCount: {
                                [user.uid]: 0,
                                [connection.userId]: 0,
                              },
                            });
                          }
                        }
                        
                        // Navigate to chat
                        router.push({
                          pathname: '/chat/[id]',
                          params: { 
                            id: connection.connectionId, 
                            name: connection.displayName,
                          }
                        });
                      } catch (error) {
                        console.error('Error opening chat:', error);
                      }
                    }}
                  >
                    <Ionicons name="chatbubble" size={18} color={Colors.white} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
            ) : (
              <View style={styles.emptyConnectionsState}>
                <Ionicons name="people-outline" size={48} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyConnectionsTitle}>
                  No crew live here right now
                </ThemedText>
                <ThemedText style={styles.emptyConnectionsText}>
                  None of your connections are checked in to {currentLayover.city} at the moment
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Upcoming Overlaps - PRIVACY: Only shows future layover overlaps, not live locations */}
        {upcomingLayovers.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="calendar" size={20} color={Colors.primary} style={{ marginRight: 8 }} />
              <ThemedText style={styles.sectionTitle}>
                Upcoming Overlaps {upcomingOverlaps.length > 0 && `(${upcomingOverlaps.length})`}
              </ThemedText>
            </View>
            <ThemedText style={styles.sectionSubtitle}>
              Connections you'll overlap with on future layovers
            </ThemedText>

            {upcomingOverlaps.length > 0 ? (
              <View style={styles.connectionsList}>
                {upcomingOverlaps.map((connection) => (
                <TouchableOpacity
                  key={connection.userId}
                  style={styles.connectionCard}
                  onPress={() => router.push(`/profile/${connection.userId}`)}
                  activeOpacity={0.8}
                >
                  <View style={styles.connectionLeft}>
                    <View style={styles.connectionAvatarWrapper}>
                      {connection.photoURL ? (
                        <Image 
                          source={{ uri: connection.photoURL }} 
                          style={styles.connectionAvatar}
                        />
                      ) : (
                        <View style={styles.connectionAvatarFallback}>
                          <ThemedText style={styles.connectionAvatarText}>
                            {connection.displayName?.[0] || '?'}
                          </ThemedText>
                        </View>
                      )}
                      {/* Scheduled indicator */}
                      <View style={styles.statusScheduledIndicator}>
                        <Ionicons name="time" size={14} color={Colors.white} />
                      </View>
                    </View>
                    <View style={styles.connectionInfo}>
                      <ThemedText style={styles.connectionName}>
                        {connection.displayName}
                      </ThemedText>
                      <View style={styles.connectionLocation}>
                        <Ionicons name="location" size={14} color={Colors.primary} />
                        <ThemedText style={styles.connectionCity}>
                          {connection.city}
                          {connection.area ? ` • ${connection.area}` : ''}
                        </ThemedText>
                      </View>
                      <View style={styles.overlapBadgeUpcoming}>
                        <Ionicons name="calendar-outline" size={12} color={Colors.text.secondary} />
                        <ThemedText style={styles.overlapBadgeTextUpcoming}>
                          {connection.daysUntil === 0 
                            ? 'Starts today' 
                            : connection.daysUntil === 1 
                              ? 'Starts tomorrow'
                              : `Starts in ${connection.daysUntil} days`}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.messageButton}
                    onPress={async (e) => {
                      e.stopPropagation();
                      try {
                        // Initialize lastMessage fields if they don't exist
                        const connectionRef = doc(db, 'connections', connection.connectionId);
                        const connectionSnap = await getDoc(connectionRef);
                        
                        if (connectionSnap.exists()) {
                          const data = connectionSnap.data();
                          if (!data.lastMessage && data.lastMessage !== '') {
                            await updateDoc(connectionRef, {
                              lastMessage: '',
                              lastMessageTime: serverTimestamp(),
                              unreadCount: {
                                [user.uid]: 0,
                                [connection.userId]: 0,
                              },
                            });
                          }
                        }
                        
                        // Navigate to chat
                        router.push({
                          pathname: '/chat/[id]',
                          params: { 
                            id: connection.connectionId, 
                            name: connection.displayName,
                          }
                        });
                      } catch (error) {
                        console.error('Error opening chat:', error);
                      }
                    }}
                  >
                    <Ionicons name="chatbubble" size={18} color={Colors.white} />
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </View>
            ) : (
              <View style={styles.emptyConnectionsState}>
                <Ionicons name="calendar-outline" size={48} color={Colors.text.secondary} />
                <ThemedText style={styles.emptyConnectionsTitle}>
                  No upcoming overlaps
                </ThemedText>
                <ThemedText style={styles.emptyConnectionsText}>
                  None of your connections have layovers that overlap with yours yet
                </ThemedText>
              </View>
            )}
          </View>
        )}

        {/* Upcoming Layovers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              {currentLayover ? 'Upcoming Layovers' : 'My Layovers'} ({upcomingLayovers.filter(l => l.startDate.toDate() > new Date()).length})
            </ThemedText>
          </View>

          {upcomingLayovers.filter(l => {
            const endDate = l.endDate.toDate();
            endDate.setHours(23, 59, 59, 999);
            return endDate >= new Date(); // Show if not expired
          }).length === 0 && !currentLayover ? (
            <View style={styles.emptyState}>
              <Ionicons name="airplane-outline" size={64} color={Colors.text.secondary} />
              <ThemedText style={styles.emptyTitle}>No Layovers Yet</ThemedText>
              <ThemedText style={styles.emptyText}>
                Add your upcoming layovers to start connecting with crew and making plans
              </ThemedText>
            </View>
          ) : (
            upcomingLayovers
              .filter(layover => {
                const endDate = layover.endDate.toDate();
                endDate.setHours(23, 59, 59, 999);
                return endDate >= new Date(); // Show if not expired
              })
              .map(layover => {
                // Check if layover is active today (can check in)
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const startDate = layover.startDate.toDate();
                startDate.setHours(0, 0, 0, 0);
                const endDate = layover.endDate.toDate();
                endDate.setHours(23, 59, 59, 999);
                const isActiveToday = today >= startDate && today <= endDate;
                
                return (
              <TouchableOpacity 
                key={layover.id} 
                style={styles.layoverCard}
                onPress={() => router.push(`/layover/${layover.id}`)}
                activeOpacity={0.8}
              >
                <View style={styles.layoverHeader}>
                  <View style={styles.layoverInfo}>
                    <ThemedText style={styles.layoverCity}>{layover.city}</ThemedText>
                    <ThemedText style={styles.layoverArea}>{layover.area}</ThemedText>
                    <ThemedText style={styles.layoverDates}>
                      {layover.startDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {layover.endDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </ThemedText>
                  </View>
                  <View style={styles.layoverIcons}>
                    <Ionicons name="airplane" size={24} color={Colors.primary} />
                    <TouchableOpacity 
                      onPress={(e) => {
                        e.stopPropagation();
                        editLayover(layover);
                      }} 
                      style={styles.editButton}
                    >
                      <Ionicons name="pencil-outline" size={22} color={Colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity 
                      onPress={(e) => {
                        e.stopPropagation();
                        deleteLayover(layover.id, layover.city);
                      }} 
                      style={styles.deleteButton}
                    >
                      <Ionicons name="trash-outline" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.layoverActions}>
                  {isActiveToday ? (
                    <TouchableOpacity
                      style={styles.checkInButton}
                      onPress={(e) => {
                        e.stopPropagation();
                        checkInToLayover(layover);
                      }}
                      disabled={verifying}
                    >
                      {verifying ? (
                        <>
                          <ActivityIndicator size="small" color={Colors.white} />
                          <ThemedText style={styles.checkInButtonText}>Verifying...</ThemedText>
                        </>
                      ) : (
                        <>
                          <Ionicons name="location" size={18} color={Colors.white} />
                          <ThemedText style={styles.checkInButtonText}>Check In & Go Live</ThemedText>
                        </>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.checkInDisabled}>
                      <Ionicons name="time-outline" size={18} color={Colors.text.secondary} />
                      <ThemedText style={styles.checkInDisabledText}>
                        Starts {layover.startDate.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </ThemedText>
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.viewPlansButton}
                    onPress={(e) => {
                      e.stopPropagation();
                      router.push(`/(tabs)/plans?city=${layover.city}`);
                    }}
                  >
                    <ThemedText style={styles.viewPlansButtonText}>View Plans</ThemedText>
                    <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
                );
              })
          )}

          {/* Add Layover Button */}
          <TouchableOpacity style={styles.addButton} onPress={openLayoverPicker}>
            <Ionicons name="add-circle" size={24} color={Colors.primary} />
            <ThemedText style={styles.addButtonText}>
              {upcomingLayovers.filter(l => l.startDate.toDate() > new Date()).length === 0 && !currentLayover ? 'Add Your First Layover' : 'Add Another Layover'}
            </ThemedText>
          </TouchableOpacity>

          {/* ✅ View Layover History link */}
          <TouchableOpacity 
            style={styles.layoverHistoryLink}
            onPress={() => router.push('/layover-history')}
          >
            <View style={styles.layoverHistoryIcon}>
              <Ionicons name="airplane" size={20} color={Colors.white} />
            </View>
            <View style={styles.layoverHistoryContent}>
              <ThemedText style={styles.layoverHistoryTitle}>
                See Your Crew Journey
              </ThemedText>
              <ThemedText style={styles.layoverHistorySubtitle}>
                View past layovers, plans & spots you visited
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Create Plan Wizard */}
      {currentLayover && (
        <CreatePlanWizard
          isOpen={showCreateWizard}
          onClose={() => setShowCreateWizard(false)}
          layoverId="current"
          layoverCity={currentLayover.city}
        />
      )}

      {/* Layover Picker Modal */}
      <Modal
        visible={pickerStep !== 'closed'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setPickerStep('closed')}
      >
        <ThemedView style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setPickerStep('closed')}>
              <Ionicons name="close" size={28} color={Colors.text.primary} />
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>
              {editingLayoverId ? 'Edit Layover' : (
                pickerStep === 'city' ? 'Select City' :
                pickerStep === 'area' ? 'Select Area' :
                'Set Dates'
              )}
            </ThemedText>
            <View style={{ width: 28 }} />
          </View>

          {/* City Picker */}
          {pickerStep === 'city' && (
            <ScrollView 
              style={styles.pickerContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <TextInput
                style={styles.searchInput}
                placeholder="Search cities or airport codes..."
                placeholderTextColor={Colors.text.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />

              {filteredCities.length === 0 ? (
                <View style={styles.emptyPicker}>
                  <ThemedText style={styles.emptyPickerText}>No cities found</ThemedText>
                  <TouchableOpacity style={styles.requestButton} onPress={requestNewCity}>
                    <ThemedText style={styles.requestButtonText}>Request This City</ThemedText>
                  </TouchableOpacity>
                </View>
              ) : (
                filteredCities.map((item, index) => (
                  <TouchableOpacity
                    key={`${item.code}-${index}`}
                    style={styles.cityItem}
                    onPress={() => selectCity(item)}
                  >
                    <View>
                      <ThemedText style={styles.cityName}>{item.displayName}</ThemedText>
                      {item.type === 'recommended' && item.distance != null ? (
                        <ThemedText style={styles.cityDistance}>
                          {(item.distance / 1609).toFixed(1)} mi away
                        </ThemedText>
                      ) : null}
                    </View>
                    {item.type === 'recommended' ? (
                      <View style={styles.recommendedBadge}>
                        <ThemedText style={styles.recommendedText}>Near You</ThemedText>
                      </View>
                    ) : null}
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          )}

          {/* Area Picker */}
          {pickerStep === 'area' && (selectedCityData || selectedAirportData) && (
            <ScrollView 
              style={styles.pickerContent}
              showsVerticalScrollIndicator={false}
            >
              <ThemedText style={styles.pickerSubtitle}>{selectedCity}</ThemedText>
              {/* Simplified area options */}
              {(() => {
                const airportCode = selectedAirportData?.code;
                const areaOptions = [
                  airportCode ? `${airportCode} Airport Area` : 'Airport Area',
                  'City-wide'
                ];
                return areaOptions.map((item) => (
                  <TouchableOpacity
                    key={item}
                    style={styles.areaItem}
                    onPress={() => selectArea(item)}
                  >
                    <ThemedText style={styles.areaName}>{item}</ThemedText>
                    <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                ));
              })()}
            </ScrollView>
          )}

          {/* Date Picker */}
          {pickerStep === 'dates' && (
            <ScrollView 
              style={styles.pickerContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <ThemedText style={styles.pickerSubtitle}>
                {selectedCity} • {selectedArea}
              </ThemedText>

              <View style={styles.dateSection}>
                {/* Start Date */}
                <ThemedText style={styles.dateLabel}>Check-In Date</ThemedText>
                
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowStartDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.dateTimeText}>
                    {startDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </ThemedText>
                </TouchableOpacity>

                {showStartDatePicker && (
                  <DateTimePicker
                    value={startDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      setShowStartDatePicker(Platform.OS === 'ios');
                      if (date) setStartDate(date);
                    }}
                  />
                )}

                {/* End Date */}
                <ThemedText style={[styles.dateLabel, { marginTop: 20 }]}>Check-Out Date</ThemedText>
                
                <TouchableOpacity 
                  style={styles.dateTimeButton}
                  onPress={() => setShowEndDatePicker(true)}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.dateTimeText}>
                    {endDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                  </ThemedText>
                </TouchableOpacity>

                {showEndDatePicker && (
                  <DateTimePicker
                    value={endDate}
                    mode="date"
                    display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                    onChange={(event, date) => {
                      setShowEndDatePicker(Platform.OS === 'ios');
                      if (date) setEndDate(date);
                    }}
                  />
                )}

                {/* Auto Check-In Toggle */}
                <TouchableOpacity 
                  style={styles.autoCheckInToggle}
                  onPress={() => setAutoCheckIn(!autoCheckIn)}
                  activeOpacity={0.7}
                >
                  <View style={styles.autoCheckInLeft}>
                    <View style={[
                      styles.checkbox,
                      autoCheckIn && styles.checkboxChecked
                    ]}>
                      {autoCheckIn && (
                        <Ionicons name="checkmark" size={16} color={Colors.white} />
                      )}
                    </View>
                    <View style={styles.autoCheckInText}>
                      <ThemedText style={styles.autoCheckInLabel}>
                        Auto check-in on start date
                      </ThemedText>
                      <ThemedText style={styles.autoCheckInDescription}>
                        Requires GPS verification when you open the app
                      </ThemedText>
                    </View>
                  </View>
                </TouchableOpacity>

                <TouchableOpacity style={styles.saveButton} onPress={saveLayover}>
                  <ThemedText style={styles.saveButtonText}>
                    {editingLayoverId ? 'Update Layover' : 'Add Layover'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </ThemedView>
      </Modal>

      {/* Undo Checkout Toast */}
      {showUndoToast && previousLayover && (
        <View style={styles.undoToast}>
          <View style={styles.undoToastContent}>
            <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
            <ThemedText style={styles.undoToastText}>
              Checked out from {previousLayover.city}
            </ThemedText>
          </View>
          <TouchableOpacity 
            style={styles.undoButton}
            onPress={handleUndoCheckout}
          >
            <ThemedText style={styles.undoButtonText}>Undo</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.dismissButton}
            onPress={() => {
              setShowUndoToast(false);
              setPreviousLayover(null);
            }}
          >
            <Ionicons name="close" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  welcomeSection: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  welcomeText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  welcomeSubtext: {
    fontSize: 15,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: -8,
    marginBottom: 12,
    paddingHorizontal: 0,
  },
  layoverCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  currentCard: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  layoverHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  layoverInfo: {
    flex: 1,
  },
  layoverCity: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  layoverArea: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  layoverDates: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  layoverIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  editButton: {
    padding: 4,
  },
  deleteButton: {
    padding: 4,
  },
  liveSection: {
    gap: 12,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  liveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.success,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  offlineSection: {
    gap: 12,
  },
  offlineBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warning + '20',
    padding: 12,
    borderRadius: 8,
  },
  offlineBannerText: {
    fontSize: 14,
    color: Colors.warning,
    flex: 1,
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 14,
    borderRadius: 12,
  },
  goLiveText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  offlineNote: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  quickActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
  recentPlans: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  recentPlansTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginBottom: 12,
    textTransform: 'uppercase',
  },
  layoverActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  checkInButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    padding: 12,
    borderRadius: 12,
  },
  checkInButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  checkInDisabled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background.secondary,
    padding: 12,
    borderRadius: 12,
  },
  checkInDisabledText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  viewPlansButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
  },
  viewPlansButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  // ✅ Layover History link styles
  layoverHistoryLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginTop: 16,
    backgroundColor: Colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  layoverHistoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoverHistoryContent: {
    flex: 1,
  },
  layoverHistoryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  layoverHistorySubtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  pickerContent: {
    flex: 1,
    padding: 20,
  },
  pickerSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  searchInput: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: Colors.text.primary,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  cityDistance: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  recommendedBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  recommendedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  areaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  areaName: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  emptyPicker: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyPickerText: {
    fontSize: 16,
    color: Colors.text.secondary,
    marginBottom: 16,
  },
  requestButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  requestButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.white,
  },
  dateSection: {
    gap: 16,
  },
  dateLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  dateTimeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  dateTimeText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.primary,
    flex: 1,
  },
  datePickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  dateButton: {
    padding: 4,
  },
  dateDisplay: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  autoCheckInToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  autoCheckInLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  checkboxChecked: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  autoCheckInText: {
    flex: 1,
  },
  autoCheckInLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  autoCheckInDescription: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    lineHeight: 16,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  timeRemaining: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 12,
  },
  timeRemainingText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  timeRemainingUrgent: {
    color: Colors.error,
    fontWeight: '600',
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.background,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
    marginTop: 12,
  },
  checkoutButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },
  undoToast: {
    position: 'absolute',
    bottom: 100,
    left: 20,
    right: 20,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  undoToastContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  undoToastText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  undoButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginLeft: 12,
  },
  undoButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  dismissButton: {
    padding: 4,
    marginLeft: 8,
  },
  // Connections On Layover styles
  connectionsList: {
    gap: 12,
  },
  connectionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  connectionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  connectionAvatarWrapper: {
    position: 'relative',
  },
  connectionAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: Colors.primary + '20',
  },
  connectionAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '30',
  },
  statusLiveIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  statusLiveIndicatorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#10b981', // Green
  },
  statusScheduledIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.white,
  },
  connectionAvatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  connectionInfo: {
    flex: 1,
    gap: 4,
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  connectionLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  connectionCity: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  overlapBadgeCurrent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#10b981', // Green for LIVE
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.white,
  },
  overlapBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 0.5,
  },
  overlapBadgeUpcoming: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.background,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overlapBadgeTextUpcoming: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  messageButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  emptyConnectionsState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyConnectionsTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    textAlign: 'center',
  },
  emptyConnectionsText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 20,
  },
  findCrewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  findCrewButtonText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});