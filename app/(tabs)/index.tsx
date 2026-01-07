// app/(tabs)/index.tsx
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCities } from '@/hooks/useCities';
import { Plan } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
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

  // GPS verification state
  const [verifying, setVerifying] = useState(false);
  const [locationPermission, setLocationPermission] = useState<'granted' | 'denied' | 'undetermined'>('undetermined');

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
    if (!user || !myLayover) return;

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

  // Fetch user's layover
  useEffect(() => {
    if (!user) return;

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
    if (!user || !myLayover) {
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
    if (!user || !myLayover) {
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
    if (!user || !myLayover) {
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

  // Check for layover expiration
  useEffect(() => {
    if (!user || !myLayover || !myLayover.expiresAt) return;

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

    // Check on mount and every minute
    checkExpiration();
    const interval = setInterval(checkExpiration, 60000);

    return () => clearInterval(interval);
  }, [user, myLayover]);

  // Check for inactivity and require re-verification
  useEffect(() => {
    if (!user || !myLayover?.isLive) return;

    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // App came to foreground
        const lastActive = await AsyncStorage.getItem('lastActive');
        const now = Date.now();

        if (lastActive) {
          const inactiveTime = now - parseInt(lastActive);
          const oneHour = 60 * 60 * 1000;

          if (inactiveTime > oneHour) {
            // Inactive for > 1 hour - require re-verification
            await updateDoc(doc(db, 'users', user.uid), {
              'currentLayover.isLive': false,
              'currentLayover.discoverable': false,
            });

            Alert.alert(
              'Verify Location',
              'You\'ve been inactive for over an hour. Please verify your location to go live again.',
              [{ text: 'OK' }]
            );
          }
        }

        await AsyncStorage.setItem('lastActive', now.toString());
      } else if (nextAppState === 'background') {
        // App went to background
        await AsyncStorage.setItem('lastActive', Date.now().toString());
      }
    });

    return () => subscription.remove();
  }, [user, myLayover]);

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities;
    return cities.filter((c) => {
      const name = c.name.toLowerCase();
      const code = c.code.toLowerCase();
      return name.includes(q) || code.startsWith(q);
    });
  }, [searchQuery]);

  // Get areas for selected city
  const selectedCityData = cities.find((c) => c.name === selectedCity);
  const areas = selectedCityData?.areas || [];

  const openPicker = () => {
    setSelectedCity('');
    setSelectedArea('');
    setSearchQuery('');
    setPickerStep('city');
  };

  const selectCity = (cityName: string) => {
    setSelectedCity(cityName);
    setSearchQuery('');
    setPickerStep('area');
  };

  const selectArea = async (areaName: string) => {
    if (!user) return;

    try {
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      await updateDoc(doc(db, 'users', user.uid), {
        currentLayover: {
          city: selectedCity,
          area: areaName,
          discoverable: false,  // Start in planning mode
          isLive: false,         // Not live until GPS verified
          updatedAt: serverTimestamp(),
          expiresAt: expiresAt,
        },
      });
      setPickerStep('closed');
      setSelectedCity('');
      setSelectedArea('');
    } catch (error) {
      console.error('Error setting layover:', error);
      Alert.alert('Error', 'Failed to set layover. Please try again.');
    }
  };

  const handleClearLayover = async () => {
    if (!user) return;

    Alert.alert(
      'Clear Layover',
      'Are you sure you want to clear your current layover?',
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
              Alert.alert('Error', 'Failed to clear layover.');
            }
          }
        }
      ]
    );
  };

  const closePicker = () => {
    setPickerStep('closed');
    setSelectedCity('');
    setSelectedArea('');
    setSearchQuery('');
  };

  const goBackToCity = () => {
    setSelectedCity('');
    setSearchQuery('');
    setPickerStep('city');
  };

  const handleCrewPress = (filter: 'nearby' | 'live') => {
    if (!myLayover?.isLive) {
      Alert.alert(
        'Go Live First',
        'Verify your location to see and connect with crew nearby.',
        [{ text: 'OK' }]
      );
      return;
    }
    router.push({ pathname: '/crew', params: { filter } });
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {myLayover ? (
          <>
            {/* Layover Header */}
            <View style={styles.layoverCard}>
              <View style={styles.layoverHeader}>
                <View>
                  <ThemedText style={styles.layoverCity}>{myLayover.city}</ThemedText>
                  <ThemedText style={styles.layoverArea}>{myLayover.area}</ThemedText>
                </View>
                <TouchableOpacity onPress={handleClearLayover}>
                  <Ionicons name="close-circle" size={24} color={Colors.error} />
                </TouchableOpacity>
              </View>

              {/* Planning Mode - Not Live */}
              {!myLayover.isLive && (
                <>
                  {locationPermission === 'denied' && (
                    <View style={styles.banner}>
                      <Ionicons name="location-outline" size={20} color={Colors.warning} />
                      <ThemedText style={styles.bannerText}>
                        Enable location to connect with crew
                      </ThemedText>
                    </View>
                  )}

                  <TouchableOpacity 
                    style={styles.goLiveButton}
                    onPress={handleGoLive}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <ActivityIndicator color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons name="radio-outline" size={20} color={Colors.white} />
                        <ThemedText style={styles.goLiveText}>Go Live</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>

                  <ThemedText style={styles.planningNote}>
                    You're in planning mode. Tap "Go Live" to connect with crew.
                  </ThemedText>
                </>
              )}

              {/* Live Mode */}
              {myLayover.isLive && (
                <View style={styles.liveIndicator}>
                  <View style={styles.liveDot} />
                  <ThemedText style={styles.liveText}>You're Live</ThemedText>
                </View>
              )}
            </View>

            {/* Stats */}
            <View style={styles.stats}>
              <TouchableOpacity
                style={styles.statCard}
                onPress={() => handleCrewPress('nearby')}
              >
                <ThemedText style={styles.statNumber}>{crewNearbyCount}</ThemedText>
                <ThemedText style={styles.statLabel}>Crew in {myLayover.city}</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.statCard}
                onPress={() => handleCrewPress('live')}
              >
                <ThemedText style={styles.statNumber}>{crewLiveCount}</ThemedText>
                <ThemedText style={styles.statLabel}>In Your Area</ThemedText>
              </TouchableOpacity>
            </View>

            {/* My Plans Section */}
            {myPlans.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <ThemedText style={styles.sectionTitle}>📅 Your Plans</ThemedText>
                  <TouchableOpacity onPress={() => router.push('/plans')}>
                    <ThemedText style={styles.seeAll}>See All</ThemedText>
                  </TouchableOpacity>
                </View>
                {myPlans.map((plan) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    onPress={() => router.push({
                      pathname: '/plan/[id]',
                      params: { id: plan.id }
                    })}
                  />
                ))}
              </View>
            )}

            {/* Quick Actions */}
            <View style={styles.quickActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => router.push('/explore')}
              >
                <Ionicons name="compass" size={24} color={Colors.primary} />
                <ThemedText style={styles.actionText}>Explore Spots</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => router.push('/plans')}
              >
                <Ionicons name="calendar" size={24} color={Colors.primary} />
                <ThemedText style={styles.actionText}>View Plans</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => router.push('/qr-code?tab=scan')}
              >
                <Ionicons name="qr-code" size={24} color={Colors.primary} />
                <ThemedText style={styles.actionText}>Scan to Join Plan</ThemedText>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          // No layover set
          <View style={styles.emptyState}>
            <Ionicons name="map-outline" size={100} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>Set Your Layover</ThemedText>
            <ThemedText style={styles.emptyText}>
              Let crew know where you are and discover spots in your city
            </ThemedText>
            <TouchableOpacity style={styles.setLocationButton} onPress={openPicker}>
              <Ionicons name="location" size={20} color={Colors.white} />
              <ThemedText style={styles.setLocationText}>Set Location</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Location Picker Modal */}
      <Modal
        visible={pickerStep !== 'closed'}
        animationType="slide"
        transparent={false}
        onRequestClose={closePicker}
      >
        <SafeAreaView style={styles.pickerContainer}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            {pickerStep === 'area' && (
              <TouchableOpacity onPress={goBackToCity} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={Colors.primary} />
              </TouchableOpacity>
            )}
            <ThemedText style={styles.pickerTitle}>
              {pickerStep === 'city' ? 'Select City' : `Select Area in ${selectedCity}`}
            </ThemedText>
            <TouchableOpacity onPress={closePicker} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={Colors.primary} />
            </TouchableOpacity>
          </View>

          {/* Search (City step only) */}
          {pickerStep === 'city' && (
            <View style={styles.searchContainer}>
              <Ionicons name="search" size={20} color={Colors.text.secondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search by city or airport code..."
                placeholderTextColor={Colors.text.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          )}

          {/* City List */}
          {pickerStep === 'city' && (
            <FlatList
              data={filteredCities}
              keyExtractor={(item) => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  onPress={() => selectCity(item.name)}
                >
                  <View style={styles.pickerItemMain}>
                    <ThemedText style={styles.pickerItemTitle}>{item.name}</ThemedText>
                    <ThemedText style={styles.pickerItemCode}>{item.code}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                </TouchableOpacity>
              )}
              contentContainerStyle={styles.pickerList}
            />
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
  pickerItemMain: {
    flex: 1,
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
});
