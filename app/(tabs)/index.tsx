// app/(tabs)/index.tsx
import { PlanCard } from '@/components/PlanCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { cities } from '@/data/cities';
import { Plan } from '@/types/plan';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection,
  doc,
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
};

type PickerStep = 'closed' | 'city' | 'area';

export default function MyLayoverScreen() {
  const { user } = useAuth();
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
      where('currentLayover.discoverable', '==', true)
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
      where('currentLayover.discoverable', '==', true)
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
      await updateDoc(doc(db, 'users', user.uid), {
        currentLayover: {
          city: selectedCity,
          area: areaName,
          discoverable: true,
          updatedAt: serverTimestamp(),
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
            {/* Current Location Card */}
            <TouchableOpacity 
              style={styles.locationCard}
              onPress={openPicker}
            >
              <View style={styles.locationContent}>
                <ThemedText style={styles.locationLabel}>Current Location</ThemedText>
                <View style={styles.locationRow}>
                  <Ionicons name="airplane" size={20} color={Colors.primary} />
                  <ThemedText style={styles.locationCity}>
                    {cities.find(c => c.name === myLayover.city)?.code || myLayover.city}
                  </ThemedText>
                </View>
                <ThemedText style={styles.locationArea}>{myLayover.area}</ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={24} color={Colors.text.secondary} />
            </TouchableOpacity>

            {/* Crew Stats Cards */}
            <View style={styles.statsRow}>
              <TouchableOpacity 
                style={[styles.statCard, styles.statCardNearby]}
                onPress={() => router.push({ pathname: '/crew', params: { filter: 'nearby' } })}
              >
                <Ionicons name="people" size={32} color={Colors.white} />
                <ThemedText style={styles.statLabel}>Crew Nearby</ThemedText>
                <ThemedText style={styles.statValue}>{crewNearbyCount} members</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.statCard, styles.statCardLive]}
                onPress={() => router.push({ pathname: '/crew', params: { filter: 'live' } })}
              >
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <ThemedText style={styles.liveText}>LIVE</ThemedText>
                </View>
                <ThemedText style={styles.statLabel}>Crew Members</ThemedText>
                <ThemedText style={styles.statValue}>{crewLiveCount} active now</ThemedText>
              </TouchableOpacity>
            </View>

            {/* Plans Section */}
            <View style={styles.plansSection}>
              <View style={styles.plansSectionHeader}>
                <ThemedText style={styles.plansTitle}>Plans</ThemedText>
                <TouchableOpacity onPress={() => router.push('/plans')}>
                  <ThemedText style={styles.viewAllText}>View All</ThemedText>
                </TouchableOpacity>
              </View>

              {myPlans.length > 0 ? (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.plansScroll}
                >
                  {myPlans.map((plan) => (
                    <PlanCard key={plan.id} plan={plan} compact showHost={false} />
                  ))}
                </ScrollView>
              ) : (
                <View style={styles.noPlansCard}>
                  <Ionicons name="calendar-outline" size={40} color={Colors.text.secondary} />
                  <ThemedText style={styles.noPlansText}>No plans yet</ThemedText>
                  <ThemedText style={styles.noPlansHint}>
                    Explore and create meetups
                  </ThemedText>
                </View>
              )}
            </View>

            {/* Quick Actions */}
            <View style={styles.actionsSection}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => router.push({
                  pathname: '/explore',
                  params: { city: myLayover.city }
                })}
              >
                <Ionicons name="compass" size={24} color={Colors.white} />
                <ThemedText style={styles.actionButtonText}>
                  Explore {myLayover.city}
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => router.push('/create-plan')}
              >
                <Ionicons name="add-circle-outline" size={24} color={Colors.primary} />
                <ThemedText style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                  Create Plan
                </ThemedText>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.actionButton, styles.actionButtonSecondary]}
                onPress={() => router.push('/qr-code?tab=scan')}
              >
                <Ionicons name="qr-code-outline" size={24} color={Colors.primary} />
                <ThemedText style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
                  Scan to Join Plan
                </ThemedText>
              </TouchableOpacity>
            </View>

            {/* Clear Layover Link */}
            <TouchableOpacity 
              style={styles.clearLink}
              onPress={handleClearLayover}
            >
              <ThemedText style={styles.clearLinkText}>Clear Layover</ThemedText>
            </TouchableOpacity>
          </>
        ) : (
          /* No Layover - Check In View */
          <View style={styles.checkInContainer}>
            <View style={styles.checkInIcon}>
              <Ionicons name="map-outline" size={60} color={Colors.primary} />
            </View>
            <ThemedText style={styles.checkInTitle}>Set Your Layover</ThemedText>
            <ThemedText style={styles.checkInSubtitle}>
              Let other crew know where you are and discover plans in your area
            </ThemedText>
            <TouchableOpacity 
              style={styles.checkInButton}
              onPress={openPicker}
            >
              <Ionicons name="airplane" size={20} color={Colors.white} />
              <ThemedText style={styles.checkInButtonText}>Check In</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Single Full-Screen Picker Modal */}
      <Modal
        visible={pickerStep !== 'closed'}
        animationType="slide"
      >
        <SafeAreaView style={styles.pickerModal}>
          {/* Header */}
          <View style={styles.pickerHeader}>
            {pickerStep === 'area' ? (
              <TouchableOpacity onPress={goBackToCity} style={styles.backButton}>
                <Ionicons name="arrow-back" size={24} color={Colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={styles.backButton} />
            )}
            
            <ThemedText style={styles.pickerTitle}>
              {pickerStep === 'city' ? 'Select City' : `${selectedCity}`}
            </ThemedText>
            
            <TouchableOpacity onPress={closePicker} style={styles.closeButton}>
              <ThemedText style={styles.closeButtonText}>Cancel</ThemedText>
            </TouchableOpacity>
          </View>

          {/* City Step */}
          {pickerStep === 'city' && (
            <>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={Colors.text.secondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search cities or airport codes..."
                  placeholderTextColor={Colors.text.secondary}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery('')}>
                    <Ionicons name="close-circle" size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                )}
              </View>
              
              <FlatList
                data={filteredCities}
                keyExtractor={(item) => item.code}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.listItem}
                    onPress={() => selectCity(item.name)}
                  >
                    <View style={styles.listItemContent}>
                      <ThemedText style={styles.listItemTitle}>{item.name}</ThemedText>
                      <ThemedText style={styles.listItemCode}>{item.code}</ThemedText>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              />
            </>
          )}

          {/* Area Step */}
          {pickerStep === 'area' && (
            <>
              <View style={styles.areaHeader}>
                <ThemedText style={styles.areaHeaderText}>Select your area in {selectedCity}</ThemedText>
              </View>
              
              <FlatList
                data={areas}
                keyExtractor={(item) => item}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    style={styles.listItem}
                    onPress={() => selectArea(item)}
                  >
                    <ThemedText style={styles.listItemTitle}>{item}</ThemedText>
                    <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            </>
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
  locationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  locationContent: {
    flex: 1,
  },
  locationLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationCity: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  locationArea: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 20,
    minHeight: 140,
  },
  statCardNearby: {
    backgroundColor: '#14B8A6',
  },
  statCardLive: {
    backgroundColor: '#FF6B35',
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  liveText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 1,
  },
  statLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
    marginTop: 12,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  plansSection: {
    marginBottom: 24,
  },
  plansSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  plansTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  viewAllText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  plansScroll: {
    paddingRight: 20,
  },
  noPlansCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noPlansText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 12,
    marginBottom: 4,
  },
  noPlansHint: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  actionsSection: {
    gap: 12,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.white,
  },
  actionButtonTextSecondary: {
    color: Colors.primary,
  },
  clearLink: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  clearLinkText: {
    fontSize: 14,
    color: Colors.error,
    fontWeight: '500',
  },
  checkInContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
  },
  checkInIcon: {
    marginBottom: 20,
  },
  checkInTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 8,
    textAlign: 'center',
  },
  checkInSubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 30,
  },
  checkInButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  checkInButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.white,
  },
  // Picker Modal Styles
  pickerModal: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 60,
    alignItems: 'flex-start',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    width: 60,
    alignItems: 'flex-end',
  },
  closeButtonText: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 16,
    color: Colors.text.primary,
  },
  areaHeader: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  areaHeaderText: {
    fontSize: 15,
    color: Colors.text.secondary,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  listItemContent: {
    flex: 1,
  },
  listItemTitle: {
    fontSize: 17,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  listItemCode: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
});
