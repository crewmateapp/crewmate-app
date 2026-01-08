import { ThemedText } from '@/components/themed-text';
import { useCities } from '@/hooks/useCities';
import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
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
};

type CitySelectorProps = {
  selectedCity: string | null;
  userLayoverCity: string | null;
  recentCities: string[];
  onSelectCity: (city: string) => void;
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

  // Get all city names for searching
  const allCityNames = useMemo(() => {
    return cities.map(city => `${city.name} (${city.code})`);
  }, [cities]);

  // Filter cities based on search query
  const filteredCities = useMemo(() => {
    if (!searchQuery.trim()) {
      return allCityNames;
    }
    const query = searchQuery.toLowerCase();
    return allCityNames.filter(cityName =>
      cityName.toLowerCase().includes(query)
    );
  }, [searchQuery, allCityNames]);

  const handleSelectCity = (cityFullName: string) => {
    // Extract just the city name (before the parenthesis)
    // Format: "San Diego (SAN)" -> "San Diego"
    const cityName = cityFullName.split('(')[0].trim();
    onSelectCity(cityName);
    setShowModal(false);
    setSearchQuery('');
  };

  const openSearch = () => {
    setShowModal(true);
  };

  return (
    <View style={styles.container}>
      {/* Search Bar */}
      <TouchableOpacity style={styles.searchBar} onPress={openSearch}>
        <Ionicons name="search" size={20} color={COLORS.mediumGray} />
        <ThemedText style={styles.searchPlaceholder}>
          {selectedCity || 'Search city or area...'}
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
              placeholder="Search cities..."
              placeholderTextColor={COLORS.mediumGray}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              autoCapitalize="words"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={COLORS.mediumGray} />
              </TouchableOpacity>
            )}
          </View>

          {/* Cities List */}
          <FlatList
            data={filteredCities}
            keyExtractor={(item, index) => `${item}-${index}`}
            renderItem={({ item }) => {
              const cityName = item.split(',')[0].trim();
              const isLayover = cityName === userLayoverCity;
              const isRecent = recentCities.includes(cityName);

              return (
                <TouchableOpacity
                  style={styles.cityItem}
                  onPress={() => handleSelectCity(item)}
                >
                  <View style={styles.cityItemLeft}>
                    {isLayover && (
                      <Ionicons
                        name="airplane"
                        size={18}
                        color={COLORS.primary}
                        style={styles.cityIcon}
                      />
                    )}
                    {!isLayover && isRecent && (
                      <Ionicons
                        name="time-outline"
                        size={18}
                        color={COLORS.mediumGray}
                        style={styles.cityIcon}
                      />
                    )}
                    <ThemedText style={styles.cityItemText}>{item}</ThemedText>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.mediumGray} />
                </TouchableOpacity>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="location-outline" size={48} color={COLORS.mediumGray} />
                <ThemedText style={styles.emptyText}>No cities found</ThemedText>
              </View>
            }
            contentContainerStyle={styles.citiesList}
          />
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
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  cityItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  cityIcon: {
    marginRight: 12,
  },
  cityItemText: {
    fontSize: 16,
    color: COLORS.darkGray,
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
});
