// components/CitySelector.tsx
// Updated to search airport database and allow requesting new cities

import { ThemedText } from '@/components/themed-text';
import { db, auth } from '@/config/firebase';
import { useCities } from '@/hooks/useCities';
import { searchAirports, AirportData } from '@/utils/airportData';
import { Ionicons } from '@expo/vector-icons';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const COLORS = {
  primary: '#114878',
  accent: '#F4C430',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  mediumGray: '#999999',
  darkGray: '#333333',
  border: '#E0E0E0',
  success: '#34C759',
};

type CitySelectorProps = {
  selectedCity: string | null;
  userLayoverCity: string | null;
  recentCities: string[];
  onSelectCity: (city: string) => void;
};

type CityListItem = {
  type: 'city' | 'airport' | 'request';
  name: string;
  code: string;
  displayName: string;
  airportData?: AirportData;
};

export default function CitySelector({
  selectedCity,
  userLayoverCity,
  recentCities,
  onSelectCity,
}: CitySelectorProps) {
  const { cities, loading: citiesLoading } = useCities();
  const [searchQuery, setSearchQuery] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [requestingCity, setRequestingCity] = useState<string | null>(null);

  // Get existing city codes for comparison
  const existingCityCodes = useMemo(() => {
    return new Set(cities.map(city => city.code.toUpperCase()));
  }, [cities]);

  // Combined search results: Firestore cities + airport database suggestions
  const searchResults = useMemo((): CityListItem[] => {
    const results: CityListItem[] = [];
    const query = searchQuery.trim().toLowerCase();

    // First, add matching Firestore cities
    cities.forEach(city => {
      const matchesName = city.name.toLowerCase().includes(query);
      const matchesCode = city.code.toLowerCase().includes(query);
      
      if (!query || matchesName || matchesCode) {
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
  }, [searchQuery, cities, existingCityCodes]);

  // Check if we should show "request city" prompt
  const showRequestPrompt = useMemo(() => {
    const query = searchQuery.trim();
    if (query.length < 2) return false;
    
    // Show if no exact matches in results
    const hasExactMatch = searchResults.some(
      r => r.type === 'city' && (
        r.name.toLowerCase() === query.toLowerCase() ||
        r.code.toLowerCase() === query.toLowerCase()
      )
    );
    
    return !hasExactMatch && searchResults.length === 0;
  }, [searchQuery, searchResults]);

  const handleSelectCity = (item: CityListItem) => {
    if (item.type === 'city') {
      // Existing city - just select it
      onSelectCity(item.name);
      setShowModal(false);
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
            onPress: () => handleRequestCity(item.airportData!),
          },
        ]
      );
    }
  };

  const handleRequestCity = async (airport: AirportData) => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to request a city.');
      return;
    }

    setRequestingCity(airport.code);

    try {
      // Check if already requested
      const existingQuery = query(
        collection(db, 'cityRequests'),
        where('airportCode', '==', airport.code),
        where('status', '==', 'pending')
      );
      const existing = await getDocs(existingQuery);
      
      if (!existing.empty) {
        Alert.alert(
          'Already Requested',
          `${airport.name} (${airport.code}) has already been requested and is pending review.`
        );
        setRequestingCity(null);
        return;
      }

      // Submit the request with full airport data
      await addDoc(collection(db, 'cityRequests'), {
        airportCode: airport.code,
        cityName: airport.name,
        fullName: airport.fullName,
        lat: airport.lat,
        lng: airport.lng,
        suggestedAreas: airport.areas,
        country: airport.country,
        requestedBy: user.uid,
        requestedByName: user.displayName || 'Anonymous',
        requestedByEmail: user.email || '',
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Request Submitted! ✈️',
        `Thanks for requesting ${airport.name}! Our team will review and add it soon.`,
        [{ text: 'OK', onPress: () => setShowModal(false) }]
      );
      setSearchQuery('');
    } catch (error) {
      console.error('Error requesting city:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setRequestingCity(null);
    }
  };

  const handleManualRequest = async () => {
    const user = auth.currentUser;
    if (!user) {
      Alert.alert('Sign In Required', 'Please sign in to request a city.');
      return;
    }

    const code = searchQuery.toUpperCase().trim();
    
    // Check if it looks like a valid airport code
    if (code.length < 3 || code.length > 4) {
      Alert.alert(
        'Enter Airport Code',
        'Please enter a valid 3 or 4 letter airport code (e.g., LAX, JFK, KJFK)'
      );
      return;
    }

    setRequestingCity(code);

    try {
      // Check if already requested or exists
      const existingQuery = query(
        collection(db, 'cityRequests'),
        where('airportCode', '==', code),
        where('status', '==', 'pending')
      );
      const existing = await getDocs(existingQuery);
      
      if (!existing.empty) {
        Alert.alert(
          'Already Requested',
          `${code} has already been requested and is pending review.`
        );
        setRequestingCity(null);
        return;
      }

      // Submit request without full data - admin will need to fill in
      await addDoc(collection(db, 'cityRequests'), {
        airportCode: code,
        cityName: code, // Placeholder
        requestedBy: user.uid,
        requestedByName: user.displayName || 'Anonymous',
        requestedByEmail: user.email || '',
        status: 'pending',
        needsData: true, // Flag that this needs manual data entry
        createdAt: serverTimestamp(),
      });

      Alert.alert(
        'Request Submitted! ✈️',
        `Thanks for requesting ${code}! Our team will review and add it soon.`,
        [{ text: 'OK', onPress: () => setShowModal(false) }]
      );
      setSearchQuery('');
    } catch (error) {
      console.error('Error requesting city:', error);
      Alert.alert('Error', 'Failed to submit request. Please try again.');
    } finally {
      setRequestingCity(null);
    }
  };

  const openSearch = () => {
    setShowModal(true);
  };

  const renderItem = ({ item }: { item: CityListItem }) => {
    const cityName = item.name;
    const isLayover = cityName === userLayoverCity;
    const isRecent = recentCities.includes(cityName);
    const isAirport = item.type === 'airport';
    const isRequesting = requestingCity === item.code;

    return (
      <TouchableOpacity
        style={[styles.cityItem, isAirport && styles.airportItem]}
        onPress={() => handleSelectCity(item)}
        disabled={isRequesting}
      >
        <View style={styles.cityItemLeft}>
          {isAirport ? (
            <View style={styles.requestBadge}>
              <Ionicons name="add-circle" size={18} color={COLORS.accent} />
            </View>
          ) : isLayover ? (
            <Ionicons
              name="airplane"
              size={18}
              color={COLORS.primary}
              style={styles.cityIcon}
            />
          ) : isRecent ? (
            <Ionicons
              name="time-outline"
              size={18}
              color={COLORS.mediumGray}
              style={styles.cityIcon}
            />
          ) : null}
          
          <View style={styles.cityTextContainer}>
            <ThemedText style={[styles.cityItemText, isAirport && styles.airportItemText]}>
              {item.displayName}
            </ThemedText>
            {isAirport && (
              <ThemedText style={styles.requestHint}>
                Tap to request this city
              </ThemedText>
            )}
          </View>
        </View>
        
        {isRequesting ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons 
            name={isAirport ? "add" : "chevron-forward"} 
            size={20} 
            color={isAirport ? COLORS.accent : COLORS.mediumGray} 
          />
        )}
      </TouchableOpacity>
    );
  };

  const renderEmptyOrRequest = () => {
    if (citiesLoading) {
      return (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <ThemedText style={styles.emptyText}>Loading cities...</ThemedText>
        </View>
      );
    }

    if (showRequestPrompt && searchQuery.length >= 3) {
      return (
        <View style={styles.requestContainer}>
          <View style={styles.requestCard}>
            <Ionicons name="airplane-outline" size={48} color={COLORS.primary} />
            <ThemedText style={styles.requestTitle}>City not found</ThemedText>
            <ThemedText style={styles.requestSubtitle}>
              Can't find "{searchQuery}"? Request it to be added!
            </ThemedText>
            <TouchableOpacity
              style={styles.requestButton}
              onPress={handleManualRequest}
              disabled={requestingCity !== null}
            >
              {requestingCity ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="add-circle" size={20} color={COLORS.white} />
                  <ThemedText style={styles.requestButtonText}>
                    Request "{searchQuery.toUpperCase()}"
                  </ThemedText>
                </>
              )}
            </TouchableOpacity>
            <ThemedText style={styles.requestNote}>
              Enter a 3-letter airport code (e.g., GSP, AVL)
            </ThemedText>
          </View>
        </View>
      );
    }

    if (searchResults.length === 0 && searchQuery.length > 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="search-outline" size={48} color={COLORS.mediumGray} />
          <ThemedText style={styles.emptyText}>
            Keep typing to search...
          </ThemedText>
        </View>
      );
    }

    if (searchResults.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="location-outline" size={48} color={COLORS.mediumGray} />
          <ThemedText style={styles.emptyText}>No cities available</ThemedText>
        </View>
      );
    }

    return null;
  };

  // Separate existing cities and requestable airports for display
  const existingCities = searchResults.filter(r => r.type === 'city');
  const requestableAirports = searchResults.filter(r => r.type === 'airport');

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <TouchableOpacity style={styles.searchBar} onPress={openSearch}>
        <Ionicons name="search" size={20} color={COLORS.mediumGray} />
        <ThemedText style={styles.searchPlaceholder}>
          {selectedCity || 'Search city or airport code...'}
        </ThemedText>
        {selectedCity && (
          <TouchableOpacity onPress={() => onSelectCity('')}>
            <Ionicons name="close-circle" size={20} color={COLORS.mediumGray} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      {/* Quick Access Cards */}
      {!selectedCity && (
        <View style={styles.quickAccess}>
          {/* User's Current Layover */}
          {userLayoverCity && (
            <TouchableOpacity
              style={[styles.quickCard, styles.layoverCard]}
              onPress={() => onSelectCity(userLayoverCity)}
            >
              <View style={styles.quickCardHeader}>
                <Ionicons name="airplane" size={20} color={COLORS.primary} />
                <ThemedText style={styles.quickCardLabel}>Your Layover</ThemedText>
              </View>
              <ThemedText style={styles.quickCardCity}>{userLayoverCity}</ThemedText>
            </TouchableOpacity>
          )}

          {/* Recent Cities */}
          {recentCities.length > 0 && (
            <View style={styles.recentSection}>
              <ThemedText style={styles.sectionLabel}>Recently Viewed</ThemedText>
              <View style={styles.recentChips}>
                {recentCities.map((city, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.recentChip}
                    onPress={() => onSelectCity(city)}
                  >
                    <Ionicons name="time-outline" size={16} color={COLORS.primary} />
                    <ThemedText style={styles.recentChipText}>{city}</ThemedText>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {/* Search Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalContainer}>
          {/* Modal Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowModal(false)}
            >
              <Ionicons name="close" size={28} color={COLORS.darkGray} />
            </TouchableOpacity>
            <ThemedText style={styles.modalTitle}>Select City</ThemedText>
            <View style={styles.closeButton} />
          </View>

          {/* Search Input */}
          <View style={styles.modalSearchBar}>
            <Ionicons name="search" size={20} color={COLORS.mediumGray} />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search city name or airport code..."
              placeholderTextColor={COLORS.mediumGray}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="characters"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>
            )}
          </View>

          {/* Results */}
          {searchResults.length > 0 ? (
            <FlatList
              data={searchResults}
              keyExtractor={(item, index) => `${item.type}-${item.code}-${index}`}
              renderItem={renderItem}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
              contentContainerStyle={styles.citiesList}
              ListHeaderComponent={
                requestableAirports.length > 0 && existingCities.length > 0 ? (
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionHeaderText}>
                      Available Cities
                    </ThemedText>
                  </View>
                ) : null
              }
              ListFooterComponent={
                requestableAirports.length > 0 ? (
                  <View>
                    <View style={styles.sectionHeader}>
                      <ThemedText style={styles.sectionHeaderText}>
                        Request New City
                      </ThemedText>
                      <ThemedText style={styles.sectionHeaderSubtext}>
                        These airports can be added to CrewMate
                      </ThemedText>
                    </View>
                  </View>
                ) : null
              }
              stickyHeaderIndices={existingCities.length > 0 && requestableAirports.length > 0 ? [0] : []}
            />
          ) : (
            renderEmptyOrRequest()
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    margin: 16,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.darkGray,
  },
  quickAccess: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  quickCard: {
    backgroundColor: COLORS.lightGray,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  layoverCard: {
    backgroundColor: COLORS.primary + '10',
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  quickCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickCardLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.primary,
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  quickCardCity: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.darkGray,
  },
  recentSection: {
    marginTop: 8,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.mediumGray,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  recentChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  recentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  recentChipText: {
    fontSize: 14,
    color: COLORS.darkGray,
    marginLeft: 6,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  closeButton: {
    padding: 4,
    width: 36,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.darkGray,
  },
  modalSearchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  modalSearchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: COLORS.darkGray,
  },
  citiesList: {
    paddingBottom: 32,
  },
  sectionHeader: {
    backgroundColor: COLORS.lightGray,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.darkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderSubtext: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 2,
  },
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  airportItem: {
    backgroundColor: COLORS.accent + '10',
  },
  cityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cityTextContainer: {
    flex: 1,
  },
  cityIcon: {
    marginRight: 12,
  },
  requestBadge: {
    marginRight: 12,
  },
  cityItemText: {
    fontSize: 16,
    color: COLORS.darkGray,
  },
  airportItemText: {
    fontWeight: '600',
  },
  requestHint: {
    fontSize: 12,
    color: COLORS.accent,
    marginTop: 2,
  },
  separator: {
    height: 1,
    backgroundColor: COLORS.border,
    marginLeft: 16,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: COLORS.mediumGray,
    marginTop: 12,
  },
  // Request city styles
  requestContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  requestCard: {
    backgroundColor: COLORS.lightGray,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.darkGray,
    marginTop: 16,
    marginBottom: 8,
  },
  requestSubtitle: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    width: '100%',
  },
  requestButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  requestNote: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginTop: 16,
    textAlign: 'center',
  },
});
