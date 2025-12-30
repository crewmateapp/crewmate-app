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
import { Picker } from '@react-native-picker/picker';
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
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View
} from 'react-native';

type UserLayover = {
  city: string;
  area: string;
  discoverable: boolean;
};

export default function MyLayoverScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myLayover, setMyLayover] = useState<UserLayover | null>(null);
  const [crewLiveCount, setCrewLiveCount] = useState(0);
  const [crewNearbyCount, setCrewNearbyCount] = useState(0);
  const [myPlans, setMyPlans] = useState<Plan[]>([]);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedArea, setSelectedArea] = useState('');

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
      // Include self in count
      setCrewLiveCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user, myLayover]);

  // Count crew members nearby (same city, different area or any area)
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
      // Include self in count
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

  const handleSetLayover = async () => {
    if (!user || !selectedCity || !selectedArea) {
      Alert.alert('Missing Info', 'Please select both a city and area.');
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentLayover: {
          city: selectedCity,
          area: selectedArea,
          discoverable: true, // Default to discoverable
          updatedAt: serverTimestamp(),
        },
      });
      setShowLocationModal(false);
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

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  const selectedCityData = cities.find((c) => c.name === selectedCity);
  const areas = selectedCityData?.areas || [];

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
              onPress={() => setShowLocationModal(true)}
            >
              <View style={styles.locationContent}>
                <ThemedText style={styles.locationLabel}>Current Location</ThemedText>
                <View style={styles.locationRow}>
                  <Ionicons name="airplane" size={20} color={Colors.primary} />
                  <ThemedText style={styles.locationCity}>
                    {cities.find(c => c.name === myLayover.city)?.code || myLayover.city}
                  </ThemedText>
                </View>
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
                onPress={() => router.push('/explore')}
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
              onPress={() => setShowLocationModal(true)}
            >
              <Ionicons name="airplane" size={20} color={Colors.white} />
              <ThemedText style={styles.checkInButtonText}>Check In</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Location Selection Modal */}
      <Modal
        visible={showLocationModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLocationModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Set Layover Location</ThemedText>
              <TouchableOpacity onPress={() => setShowLocationModal(false)}>
                <Ionicons name="close" size={28} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.pickerContainer}>
                <ThemedText style={styles.pickerLabel}>City</ThemedText>
                <View style={styles.pickerWrapper}>
                  <Picker
                    selectedValue={selectedCity}
                    onValueChange={(val) => {
                      setSelectedCity(val);
                      setSelectedArea('');
                    }}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select a city..." value="" />
                    {cities.map((city) => (
                      <Picker.Item key={city.name} label={`${city.name} (${city.code})`} value={city.name} />
                    ))}
                  </Picker>
                </View>
              </View>

              {selectedCity && areas.length > 0 && (
                <View style={styles.pickerContainer}>
                  <ThemedText style={styles.pickerLabel}>Area</ThemedText>
                  <View style={styles.pickerWrapper}>
                    <Picker
                      selectedValue={selectedArea}
                      onValueChange={setSelectedArea}
                      style={styles.picker}
                    >
                      <Picker.Item label="Select an area..." value="" />
                      {areas.map((area) => (
                        <Picker.Item key={area} label={area} value={area} />
                      ))}
                    </Picker>
                  </View>
                </View>
              )}

              <TouchableOpacity
                style={[styles.modalButton, (!selectedCity || !selectedArea) && styles.modalButtonDisabled]}
                onPress={handleSetLayover}
                disabled={!selectedCity || !selectedArea}
              >
                <ThemedText style={styles.modalButtonText}>Set Layover</ThemedText>
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
    backgroundColor: '#14B8A6', // Teal
  },
  statCardLive: {
    backgroundColor: '#FF6B35', // Orange
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  modalBody: {
    padding: 20,
  },
  pickerContainer: {
    marginBottom: 20,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: Colors.text.primary,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    backgroundColor: Colors.white,
    overflow: 'hidden',
    minHeight: 50,
  },
  picker: {
    height: 50,
    width: '100%',
  },
  modalButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  modalButtonDisabled: {
    opacity: 0.5,
  },
  modalButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '600',
  },
});
