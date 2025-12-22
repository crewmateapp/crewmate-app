import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { auth, db } from '../../config/firebase';
import { cities, type City } from '../../data/cities';

export default function MyLayoverScreen() {
  const [hasLocation, setHasLocation] = useState(false);
  const [currentCity, setCurrentCity] = useState('');
  const [currentArea, setCurrentArea] = useState('');

  // Modal state
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [areaModalVisible, setAreaModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<City | null>(null);

  console.log('Firebase Auth initialized:', !!auth);
  console.log('Firestore DB initialized:', !!db);

  const filteredCities = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return cities.slice(0, 25);

    return cities
      .filter((c) => {
        const name = c.name.toLowerCase();
        const airportCode = (c.areas?.[0] ?? '')
          .slice(0, 3)
          .toLowerCase();
        return name.includes(q) || airportCode.startsWith(q);
      })
      .slice(0, 30);
  }, [searchQuery]);

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

  const chooseArea = (area: string) => {
    if (!selectedCity) return;
    setCurrentCity(selectedCity.name);
    setCurrentArea(area);
    setHasLocation(true);
    setAreaModalVisible(false);
    setSelectedCity(null);
  };

  const handleChangeLocation = () => {
    setHasLocation(false);
    setCurrentCity('');
    setCurrentArea('');
  };

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

        <ThemedText style={styles.status}>
          ✅ Firebase Connected!
        </ThemedText>

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

  return (
    <ThemedView style={styles.container}>
      <View style={styles.locationHeader}>
        <View>
          <ThemedText style={styles.currentlyIn}>
            Currently in
          </ThemedText>
          <ThemedText type="title" style={styles.cityName}>
            {currentCity}
          </ThemedText>
          <ThemedText style={styles.areaName}>
            {currentArea}
          </ThemedText>
        </View>

        <TouchableOpacity
          style={styles.changeButton}
          onPress={handleChangeLocation}
        >
          <ThemedText style={styles.changeButtonText}>
            Change
          </ThemedText>
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statBox}>
          <ThemedText style={styles.statNumber}>0</ThemedText>
          <ThemedText style={styles.statLabel}>
            Crew Here
          </ThemedText>
        </View>
        <View style={styles.statBox}>
          <ThemedText style={styles.statNumber}>0</ThemedText>
          <ThemedText style={styles.statLabel}>
            Local Spots
          </ThemedText>
        </View>
      </View>

      <ThemedText style={styles.comingSoon}>
        👥 Nearby crew and 📍 local spots coming soon!
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
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
  status: {
    fontSize: 14,
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 20,
  },
  locationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 60,
    marginBottom: 30,
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
  },
  changeButtonText: { color: '#fff', fontWeight: '600' },
  statsContainer: { flexDirection: 'row', gap: 15 },
  statBox: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    alignItems: 'center',
  },
  statNumber: { fontSize: 32, fontWeight: 'bold', color: '#2196F3' },
  statLabel: { fontSize: 12, opacity: 0.7 },
  comingSoon: { textAlign: 'center', fontSize: 16, opacity: 0.6 },
  modalContainer: { flex: 1, padding: 20, paddingTop: 60 },
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
