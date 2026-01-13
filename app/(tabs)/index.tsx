// app/(tabs)/index.tsx - REDESIGNED: No Gates, Layover List First
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useCities } from '@/hooks/useCities';
import { Plan } from '@/types/plan';
import { searchAirports, AirportData } from '@/utils/airportData';
import { notifyAdminsNewCityRequest } from '@/utils/notifications';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  collection,
  doc,
  addDoc,
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
  FlatList,
  Modal,
  Platform,
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

type UpcomingLayover = {
  id: string;
  city: string;
  area: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: 'upcoming' | 'active' | 'past';
  preDiscoverable?: boolean;
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

export default function MyLayoverScreen() {
  const { user } = useAuth();
  const { cities, loading: citiesLoading } = useCities();

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

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [crewLiveCount, setCrewLiveCount] = useState(0);
  const [crewNearbyCount, setCrewNearbyCount] = useState(0);
  const [upcomingPlans, setUpcomingPlans] = useState<Plan[]>([]);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Load user layovers
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Current layover
        setCurrentLayover(data.currentLayover || null);
        
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

  // Load crew counts if checked in
  useEffect(() => {
    if (!user?.uid || !currentLayover?.city) return;

    // Crew in same area
    const areaQuery = query(
      collection(db, 'users'),
      where('currentLayover.city', '==', currentLayover.city),
      where('currentLayover.area', '==', currentLayover.area),
      where('currentLayover.discoverable', '==', true),
      where('currentLayover.isLive', '==', true)
    );

    const unsubArea = onSnapshot(areaQuery, (snapshot) => {
      setCrewLiveCount(snapshot.docs.filter(doc => doc.id !== user.uid).length);
    });

    // Crew in same city
    const cityQuery = query(
      collection(db, 'users'),
      where('currentLayover.city', '==', currentLayover.city),
      where('currentLayover.discoverable', '==', true),
      where('currentLayover.isLive', '==', true)
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

    const q = query(
      collection(db, 'plans'),
      where('city', '==', currentLayover.city),
      where('status', '==', 'active'),
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
            name: airport.city,
            code: airport.code,
            displayName: `${airport.city} (${airport.code})`,
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
            name: airport.city,
            code: airport.code,
            displayName: `${airport.city} (${airport.code})`,
            airportData: airport,
          });
        }
      });
    }

    return results;
  }, [searchQuery, cities, userLocation]);

  // Check in to a layover
  const checkInToLayover = async (layover: UpcomingLayover) => {
    if (!user?.uid) return;

    try {
      setVerifying(true);

      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
      );

      await updateDoc(doc(db, 'users', user.uid), {
        currentLayover: {
          city: layover.city,
          area: layover.area,
          discoverable: false, // Start offline
          isLive: false,
          lastVerified: serverTimestamp(),
          updatedAt: serverTimestamp(),
          expiresAt: expiresAt,
        },
      });

      Alert.alert('Checked In!', `You're checked in to ${layover.city}. Tap "Go Live" when you're ready to connect with crew.`);
    } catch (error) {
      console.error('Error checking in:', error);
      Alert.alert('Error', 'Failed to check in. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  // Go live (make discoverable)
  const handleGoLive = async () => {
    if (!user?.uid || !currentLayover) return;

    try {
      setVerifying(true);

      const expiresAt = Timestamp.fromDate(
        new Date(Date.now() + 8 * 60 * 60 * 1000) // 8 hours
      );

      await updateDoc(doc(db, 'users', user.uid), {
        'currentLayover.isLive': true,
        'currentLayover.discoverable': true,
        'currentLayover.lastVerified': serverTimestamp(),
        'currentLayover.expiresAt': expiresAt,
      });
    } catch (error) {
      console.error('Error going live:', error);
      Alert.alert('Error', 'Failed to go live. Please try again.');
    } finally {
      setVerifying(false);
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
    setEditingLayoverId(null);
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
    setStartDate(layover.startDate.toDate());
    setEndDate(layover.endDate.toDate());
    setPickerStep('dates'); // Skip city/area selection, go straight to dates
  };

  // Select city from picker
  const selectCity = (item: CityListItem) => {
    setSelectedCity(item.name);
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
          createdAt: Timestamp.now(),
        };

        const layoverId = `layover_${Date.now()}`;
        const layoverWithId = { id: layoverId, ...newLayover };

        await updateDoc(doc(db, 'users', user.uid), {
          upcomingLayovers: [...upcomingLayovers, layoverWithId],
        });

        Alert.alert('Success', 'Layover added! You can check in when you arrive.');
      }

      setPickerStep('closed');
      setEditingLayoverId(null);
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
            await notifyAdminsNewCityRequest(user?.uid || '', searchQuery);
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
        
        {/* Current Layover (if checked in) */}
        {currentLayover && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Current Layover</ThemedText>
            
            <View style={[styles.layoverCard, styles.currentCard]}>
              <View style={styles.layoverHeader}>
                <View style={styles.layoverInfo}>
                  <ThemedText style={styles.layoverCity}>{currentLayover.city}</ThemedText>
                  <ThemedText style={styles.layoverArea}>{currentLayover.area}</ThemedText>
                </View>
                <TouchableOpacity onPress={endCheckIn}>
                  <Ionicons name="close-circle" size={24} color={Colors.text.secondary} />
                </TouchableOpacity>
              </View>

              {/* Live Status */}
              {currentLayover.isLive ? (
                <View style={styles.liveSection}>
                  <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <ThemedText style={styles.liveText}>You're Live!</ThemedText>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                      <ThemedText style={styles.statNumber}>{crewLiveCount}</ThemedText>
                      <ThemedText style={styles.statLabel}>in {currentLayover.area}</ThemedText>
                    </View>
                    <View style={styles.statItem}>
                      <ThemedText style={styles.statNumber}>{crewNearbyCount}</ThemedText>
                      <ThemedText style={styles.statLabel}>in {currentLayover.city}</ThemedText>
                    </View>
                  </View>

                  <TouchableOpacity style={styles.secondaryButton} onPress={handleGoOffline}>
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

                  <ThemedText style={styles.offlineNote}>
                    Or keep planning — you don't need to be live to make plans
                  </ThemedText>
                </View>
              )}

              {/* Quick Actions */}
              <View style={styles.quickActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/(tabs)/plans')}
                >
                  <Ionicons name="calendar-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.actionButtonText}>My Plans</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push(`/connections?filterCity=${currentLayover.city}`)}
                >
                  <Ionicons name="people-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.actionButtonText}>Find Crew</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => router.push('/(tabs)/explore')}
                >
                  <Ionicons name="compass-outline" size={20} color={Colors.primary} />
                  <ThemedText style={styles.actionButtonText}>Browse Spots</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Recent Plans */}
              {upcomingPlans.length > 0 && (
                <View style={styles.recentPlans}>
                  <ThemedText style={styles.recentPlansTitle}>Upcoming Plans</ThemedText>
                  {upcomingPlans.map(plan => (
                    <PlanCard key={plan.id} plan={plan} showHost={false} />
                  ))}
                </View>
              )}
            </View>
          </View>
        )}

        {/* Upcoming Layovers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>
              {currentLayover ? 'Upcoming Layovers' : 'My Layovers'} ({upcomingLayovers.length})
            </ThemedText>
          </View>

          {upcomingLayovers.length === 0 && !currentLayover ? (
            <View style={styles.emptyState}>
              <Ionicons name="airplane-outline" size={64} color={Colors.text.secondary} />
              <ThemedText style={styles.emptyTitle}>No Layovers Yet</ThemedText>
              <ThemedText style={styles.emptyText}>
                Add your upcoming layovers to start connecting with crew and making plans
              </ThemedText>
            </View>
          ) : (
            upcomingLayovers.map(layover => (
              <View key={layover.id} style={styles.layoverCard}>
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
                    <TouchableOpacity onPress={() => editLayover(layover)} style={styles.editButton}>
                      <Ionicons name="pencil-outline" size={22} color={Colors.text.secondary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteLayover(layover.id, layover.city)} style={styles.deleteButton}>
                      <Ionicons name="trash-outline" size={22} color={Colors.error} />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.layoverActions}>
                  <TouchableOpacity
                    style={styles.checkInButton}
                    onPress={() => checkInToLayover(layover)}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <ActivityIndicator size="small" color={Colors.white} />
                    ) : (
                      <>
                        <Ionicons name="location" size={18} color={Colors.white} />
                        <ThemedText style={styles.checkInButtonText}>Check In</ThemedText>
                      </>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.viewPlansButton}
                    onPress={() => router.push('/(tabs)/plans')}
                  >
                    <ThemedText style={styles.viewPlansButtonText}>View Plans</ThemedText>
                    <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* Add Layover Button */}
          <TouchableOpacity style={styles.addButton} onPress={openLayoverPicker}>
            <Ionicons name="add-circle" size={24} color={Colors.primary} />
            <ThemedText style={styles.addButtonText}>
              {upcomingLayovers.length === 0 && !currentLayover ? 'Add Your First Layover' : 'Add Another Layover'}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>

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
            <View style={styles.pickerContent}>
              <TextInput
                style={styles.searchInput}
                placeholder="Search cities or airport codes..."
                placeholderTextColor={Colors.text.secondary}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />

              <FlatList
                data={filteredCities}
                keyExtractor={(item, index) => `${item.code}-${index}`}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.cityItem}
                    onPress={() => selectCity(item)}
                  >
                    <View>
                      <ThemedText style={styles.cityName}>{item.displayName}</ThemedText>
                      {item.type === 'recommended' && item.distance && (
                        <ThemedText style={styles.cityDistance}>
                          {(item.distance / 1609).toFixed(1)} mi away
                        </ThemedText>
                      )}
                    </View>
                    {item.type === 'recommended' && (
                      <View style={styles.recommendedBadge}>
                        <ThemedText style={styles.recommendedText}>Near You</ThemedText>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.emptyPicker}>
                    <ThemedText style={styles.emptyPickerText}>No cities found</ThemedText>
                    <TouchableOpacity style={styles.requestButton} onPress={requestNewCity}>
                      <ThemedText style={styles.requestButtonText}>Request This City</ThemedText>
                    </TouchableOpacity>
                  </View>
                }
              />
            </View>
          )}

          {/* Area Picker */}
          {pickerStep === 'area' && selectedCityData && (
            <View style={styles.pickerContent}>
              <ThemedText style={styles.pickerSubtitle}>{selectedCity}</ThemedText>
              <FlatList
                data={selectedCityData.areas}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.areaItem}
                    onPress={() => selectArea(item)}
                  >
                    <ThemedText style={styles.areaName}>{item}</ThemedText>
                    <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                )}
              />
            </View>
          )}

          {/* Date Picker */}
          {pickerStep === 'dates' && (
            <View style={styles.pickerContent}>
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

                <TouchableOpacity style={styles.saveButton} onPress={saveLayover}>
                  <ThemedText style={styles.saveButtonText}>
                    {editingLayoverId ? 'Update Layover' : 'Add Layover'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ThemedView>
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
    padding: 20,
    paddingBottom: 40,
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
});
