// app/(tabs)/index.tsx
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db, auth } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCities } from '@/hooks/useCities';
import { Plan } from '@/types/plan';
import { searchAirports, AirportData } from '@/utils/airportData';
import { notifyAdminsNewCityRequest } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

type UserLayover = {
  city: string;
  area: string;
  discoverable: boolean;
  isLive: boolean;
  lastVerified?: any;
  updatedAt?: any;
  expiresAt?: any;
};

type PickerStep = 'closed' | 'city' | 'area';

type CityListItem = {
  type: 'city' | 'airport' | 'recommended';
  name: string;
  code: string;
  displayName: string;
  distance?: number; // For GPS-recommended cities
  airportData?: AirportData;
};

// Calculate distance between two coordinates (Haversine formula)
const getDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth's radius in meters
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

export default function MyLayoverScreen() {
  const { user } = useAuth();
  const { cities, loading: citiesLoading } = useCities();
  const [loading, setLoading] = useState(true);
  const [myLayover, setMyLayover] = useState<UserLayover | null>(null);
  const [crewLiveCount, setCrewLiveCount] = useState(0);
  const [crewNearbyCount, setCrewNearbyCount] = useState(0);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  
  // Location selection state - single step-based picker
  const [pickerStep, setPickerStep] = useState<PickerStep>('closed');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // GPS recommendation state
  const [recommendedCity, setRecommendedCity] = useState<CityListItem | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // GPS verification state
  const [verifying, setVerifying] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

  // City request state
  const [requestingCity, setRequestingCity] = useState<string | null>(null);

  // Get existing city codes for comparison
  const existingCityCodes = useMemo(() => {
    return new Set(cities.map(city => city.code.toUpperCase()));
  }, [cities]);

  // Detect user's current location and recommend nearest city
  const detectNearestCity = async () => {
    try {
      setDetectingLocation(true);
      
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setDetectingLocation(false);
        return;
      }

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Find nearest city
      let nearestCity = null;
      let shortestDistance = Infinity;

      cities.forEach(city => {
        const distance = getDistance(latitude, longitude, city.lat, city.lng);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestCity = city;
        }
      });

      // Only recommend if within 50km
      if (nearestCity && shortestDistance < 50000) {
        setRecommendedCity({
          type: 'recommended',
          name: nearestCity.name,
          code: nearestCity.code,
          displayName: `${nearestCity.name} (${nearestCity.code})`,
          distance: Math.round(shortestDistance / 1000), // km
        });
      }
    } catch (error) {
      console.error('Error detecting location:', error);
    } finally {
      setDetectingLocation(false);
    }
  };

  // Combined search results: Firestore cities + airport database + recommended
  const searchResults = useMemo((): CityListItem[] => {
    const results: CityListItem[] = [];
    const query = searchQuery.trim().toLowerCase();

    // Add GPS-recommended city at top if no search query
    if (!query && recommendedCity) {
      results.push(recommendedCity);
    }

    // Add matching Firestore cities
    cities.forEach(city => {
      const matchesName = city.name.toLowerCase().includes(query);
      const matchesCode = city.code.toLowerCase().includes(query);
      
      if (!query || matchesName || matchesCode) {
        // Skip if it's the recommended city (already at top)
        if (recommendedCity?.code === city.code && !query) return;
        
        results.push({
          type: 'city',
          name: city.name,
          code: city.code,
          displayName: `${city.name} (${city.code})`,
        });
      }
    });

    // If there's a search query, also search the airport database
    if (query.length >= 2) {
      const airportMatches = searchAirports(searchQuery);
      
      airportMatches.forEach(airport => {
        // Only show airports NOT already in Firestore
        if (!existingCityCodes.has(airport.code.toUpperCase())) {
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
  }, [searchQuery, cities, existingCityCodes, recommendedCity]);

  // Check if we should show "request city" prompt
  const showRequestPrompt = useMemo(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return false;
    
    // Show if no matches in results
    return searchResults.length === 0;
  }, [searchQuery, searchResults]);

  // Verify user's location matches their layover city
  const verifyLocation = async (cityName: string): Promise<boolean> => {
    try {
      // Request permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Location Required',
          'Please enable location services to go live and connect with crew.',
          [{ text: 'OK' }]
        );
        setLocationPermission('denied');
        return false;
      }

      setLocationPermission('granted');

      // Get current location
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const { latitude, longitude } = location.coords;

      // Find city data
      const cityData = cities.find(c => c.name === cityName);
      if (!cityData) return false;

      // Calculate distance from city center
      const distance = getDistance(
        latitude,
        longitude,
        cityData.lat,
        cityData.lng
      );

      // Within 50km of city center = verified (covers airport suburbs)
      return distance < 50000;
    } catch (error) {
      console.error('Location verification error:', error);
      Alert.alert('Error', 'Could not verify your location. Please try again.');
      return false;
    }
  };

  const handleGoLive = async () => {
    if (!user?.uid || !myLayover?.city) return;

    setVerifying(true);
    const verified = await verifyLocation(myLayover.city);
    setVerifying(false);

    if (verified) {
      try {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24); // 24hr expiration

        // Get user's current layover history
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const userData = userDoc.data();
        const currentHistory = userData?.layoverHistory || [];

        // Add city to history if not already there
        const updatedHistory = currentHistory.includes(myLayover.city)
          ? currentHistory
          : [...currentHistory, myLayover.city];

        await updateDoc(doc(db, 'users', user.uid), {
          'currentLayover.isLive': true,
          'currentLayover.discoverable': true,
          'currentLayover.lastVerified': serverTimestamp(),
          'currentLayover.expiresAt': expiresAt,
          'layoverHistory': updatedHistory, // Track cities user has been to
        });

        // Set last active time
        await AsyncStorage.setItem('lastActive', Date.now().toString());

        Alert.alert('You\'re Live!', 'You can now see and connect with crew nearby.');
      } catch (error) {
        console.error('Error going live:', error);
        Alert.alert('Error', 'Failed to go live. Please try again.');
      }
    } else {
      Alert.alert(
        'Location Not Verified',
        `Your current location doesn't match ${myLayover.city}. You must be in the city to go live.`,
        [{ text: 'OK' }]
      );
    }
  };

  const handleRequestCity = async (item: CityListItem) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      Alert.alert('Sign In Required', 'Please sign in to request a city.');
      return;
    }

    const cityCode = item.type === 'airport' ? item.code : searchQuery.toUpperCase().trim();
    setRequestingCity(cityCode);

    try {
      // Check if already requested
      const existingQuery = query(
        collection(db, 'cityRequests'),
        where('airportCode', '==', cityCode),
        where('status', '==', 'pending')
      );
      const existing = await getDocs(existingQuery);
      
      if (!existing.empty) {
        Alert.alert(
          'Already Requested',
          `${item.type === 'airport' ? item.name : cityCode} has already been requested and is pending review.`
        );
        setRequestingCity(null);
        return;
      }

      // Submit the request
      if (item.type === 'airport' && item.airportData) {
        // Full airport data available
        const cityRequestDoc = await addDoc(collection(db, 'cityRequests'), {
          airportCode: item.airportData.code,
          cityName: item.airportData.name,
          fullName: item.airportData.fullName,
          lat: item.airportData.lat,
          lng: item.airportData.lng,
          suggestedAreas: item.airportData.areas,
          country: item.airportData.country,
          requestedBy: currentUser.uid,
          requestedByName: currentUser.displayName || 'Anonymous',
          requestedByEmail: currentUser.email || '',
          status: 'pending',
          createdAt: serverTimestamp(),
        });

        // Notify admins of new city request
        await notifyAdminsNewCityRequest(
          cityRequestDoc.id,
          item.airportData.code,
          currentUser.uid,
          currentUser.displayName || 'Anonymous'
        );
      } else {
        // Manual request without full data
        const cityRequestDoc = await addDoc(collection(db, 'cityRequests'), {
          airportCode: cityCode,
          cityName: cityCode,
          requestedBy: currentUser.uid,
          requestedByName: currentUser.displayName || 'Anonymous',
          requestedByEmail: currentUser.email || '',
          status: 'pending',
          needsData: true,
          createdAt: serverTimestamp(),
        });

        // Notify admins of new city request
        await notifyAdminsNewCityRequest(
          cityRequestDoc.id,
          cityCode,
          currentUser.uid,
          currentUser.displayName || 'Anonymous'
        );
      }

      Alert.alert(
        'Request Submitted! ✈️',
        `Thanks for requesting ${item.type === 'airport' ? item.name : cityCode}! Our team will review and add it soon.`,
        [{ text: 'OK', onPress: () => {
          setPickerStep('closed');
          setSearchQuery('');
        }}]
      );
    } catch (error) {
      console.error('Error requesting city:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setRequestingCity(null);
    }
  };

  const handleSelectCity = (item: CityListItem) => {
    if (item.type === 'city' || item.type === 'recommended') {
      // Existing city - select it
      setSelectedCity(item.name);
      setPickerStep('area');
      setSearchQuery('');
    } else if (item.type === 'airport') {
      // Airport not in system - ask to request it
      Alert.alert(
        'City Not Available Yet',
        `${item.name} (${item.code}) hasn't been added to CrewMate yet. Would you like to request it?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Request City',
            onPress: () => handleRequestCity(item),
          },
        ]
      );
    }
  };

  // Fetch user's layover
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const layover = data.currentLayover as UserLayover | undefined;
        setMyLayover(layover || null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Count crew members live (same area, discoverable)
  useEffect(() => {
    if (!user?.uid || !myLayover?.city) {
      setCrewLiveCount(0);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('currentLayover.city', '==', myLayover.city),
      where('currentLayover.area', '==', myLayover.area),
      where('currentLayover.discoverable', '==', true),
      where('currentLayover.isLive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCrewLiveCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user, myLayover]);

  // Count crew members nearby (same city)
  useEffect(() => {
    if (!user?.uid || !myLayover?.city) {
      setCrewNearbyCount(0);
      return;
    }

    const q = query(
      collection(db, 'users'),
      where('currentLayover.city', '==', myLayover.city),
      where('currentLayover.discoverable', '==', true),
      where('currentLayover.isLive', '==', true)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCrewNearbyCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user, myLayover]);

  // Fetch user's plans in current city
  useEffect(() => {
    if (!user?.uid || !myLayover?.city) {
      setMyPlans([]);
      return;
    }

    const q = query(
      collection(db, 'plans'),
      where('city', '==', myLayover.city),
      where('attendeeIds', 'array-contains', user.uid),
      where('status', '==', 'active'),
      orderBy('scheduledTime', 'asc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const plans: Plan[] = [];
      snapshot.forEach((doc) => {
        plans.push({
          id: doc.id,
          ...doc.data(),
        } as Plan);
      });
      setMyPlans(plans);
    });

    return () => unsubscribe();
  }, [user, myLayover]);

  // Check location permission on mount
  useEffect(() => {
    const checkPermission = async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setLocationPermission(
        status === 'granted' ? 'granted' : 
        status === 'denied' ? 'denied' : 
        'undetermined'
      );
    };
    checkPermission();
  }, []);

  // Detect nearest city when picker opens
  useEffect(() => {
    if (pickerStep === 'city' && !recommendedCity && !detectingLocation) {
      detectNearestCity();
    }
  }, [pickerStep]);

  // Check for layover expiration
  useEffect(() => {
    if (!user?.uid || !myLayover?.city || !myLayover.expiresAt) return;

    const checkExpiration = () => {
      const now = new Date();
      const expires = myLayover.expiresAt.toDate ? myLayover.expiresAt.toDate() : new Date(myLayover.expiresAt);

      if (now > expires) {
        // Layover expired - clear it
        updateDoc(doc(db, 'users', user.uid), {
          currentLayover: null,
        });
        Alert.alert('Layover Expired', 'Your layover has been automatically cleared after 24 hours.');
      }
    };

    checkExpiration();
    const interval = setInterval(checkExpiration, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user, myLayover]);

  // Auto-refresh when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && user?.uid && myLayover?.city) {
        // Refresh when app becomes active
      }
    });

    return () => {
      subscription.remove();
    };
  }, [user, myLayover]);

  const openCityPicker = () => {
    setPickerStep('city');
    setRecommendedCity(null); // Reset so it re-detects
  };

  const closePicker = () => {
    setPickerStep('closed');
    setSearchQuery('');
    setSelectedCity('');
    setSelectedArea('');
    setRecommendedCity(null);
  };

  const selectArea = async (area: string) => {
    if (!user?.uid) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentLayover: {
          city: selectedCity,
          area: area,
          discoverable: false,
          isLive: false,
          updatedAt: serverTimestamp(),
        },
      });

      closePicker();
    } catch (error) {
      console.error('Error setting layover:', error);
      Alert.alert('Error', 'Failed to set location. Please try again.');
    }
  };

  const clearLayover = async () => {
    if (!user?.uid) return;

    Alert.alert(
      'Clear Layover?',
      'This will remove your current location and hide you from other crew.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await updateDoc(doc(db, 'users', user.uid), {
                currentLayover: null,
              });
            } catch (error) {
              console.error('Error clearing layover:', error);
              Alert.alert('Error', 'Failed to clear location. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Get areas for selected city
  const areas = useMemo(() => {
    const city = cities.find(c => c.name === selectedCity);
    return city?.areas || [];
  }, [selectedCity, cities]);

  // Render city item in picker
  const renderCityItem = ({ item }: { item: CityListItem }) => {
    const isRecommended = item.type === 'recommended';
    const isAirport = item.type === 'airport';
    const isRequesting = requestingCity === item.code;

    return (
      <TouchableOpacity
        style={[
          styles.pickerItem,
          isRecommended && styles.recommendedItem,
          isAirport && styles.airportItem,
        ]}
        onPress={() => handleSelectCity(item)}
        disabled={isRequesting}
      >
        <View style={styles.pickerItemMain}>
          {isRecommended && (
            <View style={styles.recommendedBadge}>
              <Ionicons name="location" size={14} color={Colors.success} />
              <ThemedText style={styles.recommendedText}>
                Recommended • {item.distance}km away
              </ThemedText>
            </View>
          )}
          {isAirport && (
            <View style={styles.airportBadge}>
              <Ionicons name="add-circle" size={14} color={Colors.accent} />
              <ThemedText style={styles.airportBadgeText}>Request to add</ThemedText>
            </View>
          )}
          <ThemedText style={styles.pickerItemTitle}>{item.name}</ThemedText>
          <ThemedText style={styles.pickerItemCode}>{item.code}</ThemedText>
        </View>
        {isRequesting ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : (
          <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
        )}
      </TouchableOpacity>
    );
  };

  // Render empty/request state
  const renderEmptyOrRequest = () => {
    if (showRequestPrompt) {
      return (
        <View style={styles.requestContainer}>
          <View style={styles.requestCard}>
            <Ionicons name="airplane-outline" size={48} color={Colors.primary} />
            <ThemedText style={styles.requestTitle}>City Not Listed?</ThemedText>
            <ThemedText style={styles.requestSubtitle}>
              We don't have "{searchQuery}" yet. Request it and we'll add it soon!
            </ThemedText>
            <TouchableOpacity
              style={styles.requestButton}
              onPress={() => handleRequestCity({ 
                type: 'airport', 
                name: searchQuery, 
                code: searchQuery.toUpperCase(),
                displayName: searchQuery 
              })}
              disabled={requestingCity !== null}
            >
              {requestingCity ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color={Colors.white} />
                  <ThemedText style={styles.requestButtonText}>Request City</ThemedText>
                </>
              )}
            </TouchableOpacity>
            <ThemedText style={styles.requestNote}>
              Our team reviews requests daily
            </ThemedText>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Ionicons name="search-outline" size={48} color={Colors.text.secondary} />
        <ThemedText style={styles.emptyText}>No cities found</ThemedText>
      </View>
    );
  };

  if (loading || citiesLoading) {
    return (
      <ThemedView style={styles.container}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {!myLayover ? (
          // No layover set
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={80} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>Set Your Layover</ThemedText>
            <ThemedText style={styles.emptyText}>
              Let crew know where you are so you can connect during your layover.
            </ThemedText>
            <TouchableOpacity style={styles.setLocationButton} onPress={openCityPicker}>
              <Ionicons name="add" size={24} color={Colors.white} />
              <ThemedText style={styles.setLocationText}>Set Location</ThemedText>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Current Layover Card */}
            <View style={styles.layoverCard}>
              <View style={styles.layoverHeader}>
                <View>
                  <ThemedText style={styles.layoverCity}>{myLayover.city}</ThemedText>
                  <ThemedText style={styles.layoverArea}>{myLayover.area}</ThemedText>
                </View>
                <TouchableOpacity onPress={clearLayover}>
                  <Ionicons name="close-circle" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {!myLayover.isLive && (
                <>
                  <View style={styles.banner}>
                    <Ionicons name="eye-off-outline" size={16} color={Colors.warning} />
                    <ThemedText style={styles.bannerText}>
                      You're offline. Go live to see crew nearby!
                    </ThemedText>
                  </View>

                  <TouchableOpacity
                    style={styles.goLiveButton}
                    onPress={handleGoLive}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons name="radio-outline" size={20} color={Colors.white} />
                        <ThemedText style={styles.goLiveText}>Go Live</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>
                  <ThemedText style={styles.planningNote}>
                    Or keep planning — you don't need to be live to make plans
                  </ThemedText>
                </>
              )}

              {myLayover.isLive && (
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <ThemedText style={styles.liveText}>You're Live!</ThemedText>
                </View>
              )}
            </View>

            {/* Stats */}
            {myLayover.isLive && (
              <View style={styles.stats}>
                <View style={styles.statCard}>
                  <ThemedText style={styles.statNumber}>{crewLiveCount}</ThemedText>
                  <ThemedText style={styles.statLabel}>Crew in {myLayover.area}</ThemedText>
                </View>
                <View style={styles.statCard}>
                  <ThemedText style={styles.statNumber}>{crewNearbyCount}</ThemedText>
                  <ThemedText style={styles.statLabel}>Crew in {myLayover.city}</ThemedText>
                </View>
              </View>
            )}

            {/* Quick Actions */}
            <View style={styles.section}>
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/connections')}
                >
                  <Ionicons name="people-outline" size={32} color={Colors.primary} />
                  <ThemedText style={styles.actionText}>Find Crew</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/explore')}
                >
                  <Ionicons name="compass-outline" size={32} color={Colors.primary} />
                  <ThemedText style={styles.actionText}>Explore Spots</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/plans')}
                >
                  <Ionicons name="calendar-outline" size={32} color={Colors.primary} />
                  <ThemedText style={styles.actionText}>Make Plans</ThemedText>
                </TouchableOpacity>
              </View>
            </View>

            {/* My Plans */}
            {myPlans.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>My Plans</ThemedText>
                  <TouchableOpacity onPress={() => router.push('/plans')}>
                    <ThemedText style={styles.seeAll}>See All</ThemedText>
                  </TouchableOpacity>
                </View>
                {myPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* City/Area Picker Modal */}
      <Modal
        visible={pickerStep !== 'closed'}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closePicker}
      >
        <SafeAreaView style={styles.pickerContainer}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            {pickerStep === 'area' && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setPickerStep('city')}
              >
                <Ionicons name="chevron-back" size={24} color={Colors.primary} />
              </TouchableOpacity>
            )}
            <ThemedText style={styles.pickerTitle}>
              {pickerStep === 'city' ? 'Select City' : `Select Area in ${selectedCity}`}
            </ThemedText>
            <TouchableOpacity style={styles.closeButton} onPress={closePicker}>
              <Ionicons name="close" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Search Bar (City step only) */}
          {pickerStep === 'city' && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Colors.text.secondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search cities or airport codes..."
                placeholderTextColor={Colors.text.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')}>
                  <Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* GPS Detection Indicator */}
          {pickerStep === 'city' && detectingLocation && (
            <View style={styles.detectingLocation}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <ThemedText style={styles.detectingText}>Detecting your location...</ThemedText>
            </View>
          )}

          {/* City List */}
          {pickerStep === 'city' && (
            searchResults.length > 0 ? (
              <FlatList
                data={searchResults}
                keyExtractor={(item, index) => `${item.type}-${item.code}-${index}`}
                renderItem={renderCityItem}
                contentContainerStyle={styles.pickerList}
              />
            ) : (
              renderEmptyOrRequest()
            )
          )}

          {/* Area List */}
          {pickerStep === 'area' && (
            <FlatList
              data={areas}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectArea(item)}
                >
                  <ThemedText style={styles.pickerItemTitle}>{item}</ThemedText>
                  <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.pickerList}
            />
          )}
        </SafeAreaView>
      </Modal>
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
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  layoverCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  layoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  layoverCity: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  layoverArea: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.warning + '20',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  bannerText: {
    flex: 1,
    fontSize: 13,
    color: Colors.warning,
    fontWeight: '500',
  },
  goLiveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success,
    paddingVertical: 14,
    borderRadius: 12,
  },
  goLiveText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  planningNote: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success + '20',
    paddingVertical: 10,
    borderRadius: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  liveText: {
    color: Colors.success,
    fontSize: 14,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: {
    fontSize: 25,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  seeAll: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionText: {
    fontSize: 12,
    color: Colors.text.primary,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 20,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 24,
  },
  setLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  setLocationText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  pickerContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    padding: 4,
    width: 32,
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: 4,
    width: 32,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text.primary,
  },
  detectingLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
    backgroundColor: Colors.primary + '10',
    marginHorizontal: 20,
    marginBottom: 8,
    borderRadius: 8,
  },
  detectingText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  pickerList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  recommendedItem: {
    backgroundColor: Colors.success + '10',
    borderColor: Colors.success + '30',
    borderWidth: 2,
  },
  airportItem: {
    backgroundColor: Colors.accent + '10',
    borderColor: Colors.accent + '30',
  },
  pickerItemMain: {
    flex: 1,
  },
  recommendedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  recommendedText: {
    fontSize: 12,
    color: Colors.success,
    fontWeight: '600',
  },
  airportBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 6,
  },
  airportBadgeText: {
    fontSize: 12,
    color: Colors.accent,
    fontWeight: '600',
  },
  pickerItemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  pickerItemCode: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  requestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  requestCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  requestSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  requestButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  requestNote: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 16,
    textAlign: 'center',
  },
});
