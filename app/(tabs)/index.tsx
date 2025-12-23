import { CrewCard } from '@/components/CrewCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { cities, type City } from '@/data/cities';
import { mockCrew, type CrewMember } from '@/data/mockCrew';

export default function MyLayoverScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [hasLocation, setHasLocation] = useState(false);
  const [currentCity, setCurrentCity] = useState('');
  const [currentArea, setCurrentArea] = useState('');

  // Modal state
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  // Load saved location on mount
  useEffect(() => {
    const loadLocation = async () => {
      if (!user) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.currentLocation?.city && data.currentLocation?.area) {
            const setAt = data.currentLocation.setAt?.toDate?.() || new Date(data.currentLocation.setAt);
            const hoursSinceSet = (Date.now() - setAt.getTime()) / (1000 * 60 * 60);
            
            if (hoursSinceSet < 24) {
              setCurrentCity(data.currentLocation.city);
              setCurrentArea(data.currentLocation.area);
              setHasLocation(true);
            } else {
              await clearLocationInFirestore();
            }
          }
        }
      } catch (error) {
        console.error('Error loading location:', error);
      } finally {
        setLoading(false);
      }
    };

    loadLocation();
  }, [user]);

  // Filter crew by current location
  const nearbyCrew = useMemo(() => {
    if (!currentCity || !currentArea) return [];
    
    // Same area = show them
    return mockCrew.filter(
      crew => crew.currentLocation.city === currentCity && 
              crew.currentLocation.area === currentArea
    );
  }, [currentCity, currentArea]);

  // Crew in same city but different area
  const cityWideCrew = useMemo(() => {
    if (!currentCity || !currentArea) return [];
    
    return mockCrew.filter(
      crew => crew.currentLocation.city === currentCity && 
              crew.currentLocation.area !== currentArea
    );
  }, [currentCity, currentArea]);

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 25);

    return cities
      .filter((c) => {
        const name = c.name.toLowerCase();
        const airportCode = (c.areas?.[0] ?? '').slice(0, 3).toLowerCase();
        return name.includes(q) || airportCode.startsWith(q);
      })
      .slice(0, 30);
  }, [searchQuery]);

  const saveLocationToFirestore = async (city: string, area: string) => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentLocation: {
          city: city,
          area: area,
          setAt: new Date().toISOString(),
        }
      });
    } catch (error) {
      console.error('Error saving location:', error);
    }
  };

  const clearLocationInFirestore = async () => {
    if (!user) return;

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        currentLocation: null
      });
    } catch (error) {
      console.error('Error clearing location:', error);
    }
  };

  const openCityPicker = () => {
    setSearchQuery('');
    setSelectedCity(null);
    setCityModalVisible(true);
  };

  const chooseCity = (city: City) => {
    setSelectedCity(city);
    setCityModalVisible(false);
    setAreaModalVisible(true);
  };

  const chooseArea = async (area: string) => {
    if (!selectedCity) return;
    
    await saveLocationToFirestore(selectedCity.name, area);
    
    setCurrentCity(selectedCity.name);
    setCurrentArea(area);
    setHasLocation(true);
    setAreaModalVisible(false);
    setSelectedCity(null);
  };

  const handleChangeLocation = async () => {
    await clearLocationInFirestore();
    setHasLocation(false);
    setCurrentCity('');
    setCurrentArea('');
  };

  const handleConnectPress = (crew: CrewMember) => {
  Alert.alert(
    `Connect with ${crew.displayName}?`,
    `Send a connection request to ${crew.firstName}?`,
    [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Send Request', 
        onPress: async () => {
          try {
            const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');
            
            await addDoc(collection(db, 'connectionRequests'), {
              fromUserId: user?.uid,
              fromUserName: user?.email?.split('@')[0] || 'Unknown',
              toUserId: crew.id,
              toUserName: crew.displayName,
              status: 'pending',
              createdAt: serverTimestamp(),
            });
            
            Alert.alert('Request Sent! ✈️', `${crew.firstName} will be notified.`);
          } catch (error) {
            console.error('Error sending request:', error);
            Alert.alert('Error', 'Failed to send request. Try again.');
          }
        }
      }
    ]
  );
};

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color="#2196F3" style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  if (!hasLocation) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="title" style={styles.title}>
          🗺️ My Layover
        </ThemedText>
        <ThemedText style={styles.subtitle}>
          Set your location to see nearby crew and spots
        </ThemedText>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={openCityPicker}
          >
            <ThemedText style={styles.buttonText}>
              📍 Set My Location
            </ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.privacyNotice}>
          <ThemedText style={styles.privacyText}>
            🔒 Your exact hotel is never shared. Only general areas are visible
            to other crew.
          </ThemedText>
        </View>

        {/* CITY SEARCH MODAL */}
        <Modal
          visible={cityModalVisible}
          animationType="slide"
          onRequestClose={() => setCityModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                Choose Your City
              </ThemedText>
              <Pressable onPress={() => setCityModalVisible(false)}>
                <ThemedText style={styles.modalClose}>Close</ThemedText>
              </Pressable>
            </View>

            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Type a city or airport code (e.g. San or SFO)"
              placeholderTextColor="#888"
              style={styles.searchInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <FlatList
              data={filteredCities}
              keyExtractor={(item, index) => `${item.name}-${index}`}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.listItem}
                  onPress={() => chooseCity(item)}
                >
                  <ThemedText style={styles.listItemTitle}>
                    {item.name}
                  </ThemedText>
                  <ThemedText style={styles.listItemSub}>
                    {item.areas[0]}
                  </ThemedText>
                </Pressable>
              )}
            />
          </View>
        </Modal>

        {/* AREA MODAL */}
        <Modal
          visible={areaModalVisible}
          animationType="slide"
          onRequestClose={() => setAreaModalVisible(false)}
        >
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={styles.modalTitle}>
                Choose Area in {selectedCity?.name}
              </ThemedText>
              <Pressable
                onPress={() => {
                  setAreaModalVisible(false);
                  setCityModalVisible(true);
                }}
              >
                <ThemedText style={styles.modalClose}>Back</ThemedText>
              </Pressable>
            </View>

            <FlatList
              data={selectedCity?.areas ?? []}
              keyExtractor={(item) => item}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.listItem}
                  onPress={() => chooseArea(item)}
                >
                  <ThemedText style={styles.listItemTitle}>
                    {item}
                  </ThemedText>
                </Pressable>
              )}
            />
          </View>
        </Modal>
      </ThemedView>
    );
  }

  // Has location - show crew
  return (
    <ScrollView style={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        <View style={styles.locationHeader}>
          <View>
            <ThemedText style={styles.currentlyIn}>Currently in</ThemedText>
            <ThemedText type="title" style={styles.cityName}>
              {currentCity}
            </ThemedText>
            <ThemedText style={styles.areaName}>{currentArea}</ThemedText>
          </View>

          <TouchableOpacity
            style={styles.changeButton}
            onPress={handleChangeLocation}
          >
            <ThemedText style={styles.changeButtonText}>Change</ThemedText>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{nearbyCrew.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Crew Nearby</ThemedText>
          </View>
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{cityWideCrew.length}</ThemedText>
            <ThemedText style={styles.statLabel}>In {currentCity}</ThemedText>
          </View>
        </View>

        {/* Nearby Crew Section */}
        {nearbyCrew.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              ✈️ Crew in {currentArea}
            </ThemedText>
            {nearbyCrew.map((crew) => (
              <CrewCard 
                key={crew.id} 
                crew={crew} 
                onPress={() => handleConnectPress(crew)} 
              />
            ))}
          </View>
        ) : (
          <View style={styles.emptySection}>
            <ThemedText style={styles.emptyText}>
              No crew in your area yet. Check back soon!
            </ThemedText>
          </View>
        )}

        {/* City-wide Crew Section */}
        {cityWideCrew.length > 0 ? (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>
              🌆 Others in {currentCity}
            </ThemedText>
            {cityWideCrew.map((crew) => (
              <CrewCard 
                key={crew.id} 
                crew={crew} 
                onPress={() => handleConnectPress(crew)} 
              />
            ))}
          </View>
        ) : null}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: { flex: 1 },
  container: { flex: 1, padding: 20, paddingBottom: 40 },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 60,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.7,
  },
  buttonContainer: { gap: 15 },
  primaryButton: {
    backgroundColor: '#2196F3',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  privacyNotice: {
    marginTop: 30,
    padding: 15,
    backgroundColor: 'rgba(33,150,243,0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  privacyText: { fontSize: 13, lineHeight: 20 },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
    marginBottom: 20,
    padding: 20,
    backgroundColor: '#2196F3',
    borderRadius: 16,
  },
  currentlyIn: { color: '#fff', opacity: 0.9 },
  cityName: { fontSize: 28, fontWeight: 'bold', color: '#fff' },
  areaName: { fontSize: 16, color: '#fff', opacity: 0.9 },
  changeButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  changeButtonText: { color: '#fff', fontWeight: '600' },
  statsContainer: { flexDirection: 'row', gap: 15, marginBottom: 20 },
  statBox: {
    flex: 1,
    padding: 20,
    paddingTop: 25,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: { fontSize: 28, fontWeight: 'bold', color: '#2196F3', lineHeight: 36,  },
  statLabel: { fontSize: 12, color: '#666' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
    color: '#fff',
  },
  emptySection: {
    padding: 30,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
     color: '#666',
    textAlign: 'center',
  },
  modalContainer: { flex: 1, padding: 20, paddingTop: 60, backgroundColor: '#fff' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  modalTitle: { fontSize: 22, fontWeight: 'bold' },
  modalClose: { color: '#2196F3', fontWeight: '600' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    color: '#000',
  },
  listItem: {
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    marginBottom: 10,
  },
  listItemTitle: { fontSize: 16, fontWeight: '700' },
  listItemSub: { fontSize: 12, opacity: 0.7 },
});