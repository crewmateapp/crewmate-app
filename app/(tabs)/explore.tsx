import CategoryTabs from '@/components/CategoryTabs';
import CitySelector from '@/components/CitySelector';
import SortAndFilter from '@/components/SortAndFilter';
import SpotCard from '@/components/SpotCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '@/config/firebase';
import { useCities } from '@/hooks/useCities';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View
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

const CATEGORIES = ['All', 'Food', 'Bar', 'Coffee', 'Activity', 'Shopping'];

type Spot = {
  id: string;
  name: string;
  category: string; // This is the actual field name in Firebase
  type?: string; // Keep for backwards compatibility
  address: string;
  city: string;
  description: string;
  status: string;
  addedBy: string;
  addedByName: string;
  photos?: string[];
  photoURLs?: string[];
  website?: string;
  tips?: string;
  phone?: string;
  rating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
};

type SortOption = 'rating' | 'distance' | 'reviews' | 'newest';

type FilterSettings = {
  minRating: number;
  maxDistance: number;
  openNow: boolean;
};

export default function ExploreScreen() {
  const { 
    city: urlCity, 
    layoverId,
    selectionMode: selectionModeParam,
    returnTo 
  } = useLocalSearchParams<{ 
    city?: string; 
    layoverId?: string;
    selectionMode?: string;
    returnTo?: string;
  }>();
  
  const selectionMode = selectionModeParam === 'true';
  
  const { cities, loading: citiesLoading } = useCities();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [userLayoverCity, setUserLayoverCity] = useState<string | null>(null);
  const [currentLayoverId, setCurrentLayoverId] = useState<string | null>(null);
  const [recentCities, setRecentCities] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('All');
  const [sortBy, setSortBy] = useState<SortOption>('rating');
  const [filters, setFilters] = useState<FilterSettings>({
    minRating: 0,
    maxDistance: 50,
    openNow: false,
  });
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Load user's current layover city on mount, or use URL parameter
  useEffect(() => {
    // Store the layoverId from URL if provided
    if (layoverId) {
      setCurrentLayoverId(layoverId);
    }
    
    // If city is provided in URL, use that instead of fetching user's layover
    if (urlCity) {
      setSelectedCity(urlCity);
    } else {
      loadUserLayoverCity();
    }
    
    loadRecentCities();
  }, [urlCity, layoverId]);

  // Fetch spots when city or filters change
  useEffect(() => {
    if (selectedCity) {
      fetchSpots();
      saveRecentCity(selectedCity);
    }
  }, [selectedCity, category, sortBy, filters, searchQuery]);

  const loadUserLayoverCity = async () => {
    try {
      const user = auth.currentUser;
      if (!user?.uid) return;

      const userDoc = await getDocs(query(
        collection(db, 'users'),
        where('__name__', '==', user.uid),
        limit(1)
      ));

      if (!userDoc.empty) {
        const userData = userDoc.docs[0].data();
        const layover = userData.currentLayover;
        if (layover?.city) {
          setUserLayoverCity(layover.city);
          setSelectedCity(layover.city);
        }
      }
    } catch (error) {
      console.error('Error loading user layover city:', error);
    }
  };

  const loadRecentCities = () => {
    // In a real app, load from AsyncStorage
    // For now, just empty array
    setRecentCities([]);
  };

  const saveRecentCity = (cityName: string) => {
    // In a real app, save to AsyncStorage
    // For now, just update state
    if (!recentCities.includes(cityName)) {
      setRecentCities([cityName, ...recentCities.slice(0, 4)]);
    }
  };

  const fetchSpots = async () => {
    if (!selectedCity) return;

    setLoading(true);
    try {
      // Query spots for selected city with 'approved' status
      const spotsQuery = query(
        collection(db, 'spots'),
        where('city', '==', selectedCity),
        where('status', '==', 'approved')
      );

      const snapshot = await getDocs(spotsQuery);
      const spotsList: Spot[] = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Spot));

      // Apply filters and sorting
      const filtered = applyFilters(spotsList);
      const sorted = applySorting(filtered);

      setSpots(sorted);
    } catch (error) {
      console.error('Error fetching spots:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = (spotsList: Spot[]): Spot[] => {
    let filtered = spotsList;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(spot => {
        const nameMatch = spot.name.toLowerCase().includes(query);
        const descMatch = (spot.description || '').toLowerCase().includes(query);
        const addressMatch = (spot.address || '').toLowerCase().includes(query);
        return nameMatch || descMatch || addressMatch;
      });
    }

    // Filter by category
    if (category !== 'All') {
      filtered = filtered.filter(spot => {
        // Use 'category' field from Firebase (lowercase: "bar", "food", etc.)
        const spotCategory = (spot.category || '').toLowerCase().trim();
        const selectedCategory = category.toLowerCase().trim();
        return spotCategory === selectedCategory;
      });
    }

    // Filter by minimum rating
    if (filters.minRating > 0) {
      filtered = filtered.filter(spot => (spot.rating || 0) >= filters.minRating);
    }

    // Filter by distance if user location available
    if (userLocation && filters.maxDistance < 50) {
      filtered = filtered.filter(spot => {
        if (!spot.latitude || !spot.longitude) return true;
        const distance = calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          spot.latitude,
          spot.longitude
        );
        return distance <= filters.maxDistance;
      });
    }

    return filtered;
  };

  const applySorting = (spotsList: Spot[]): Spot[] => {
    const sorted = [...spotsList];

    switch (sortBy) {
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      
      case 'reviews':
        return sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      
      case 'distance':
        if (userLocation) {
          return sorted.sort((a, b) => {
            if (!a.latitude || !a.longitude) return 1;
            if (!b.latitude || !b.longitude) return -1;
            
            const distA = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              a.latitude,
              a.longitude
            );
            const distB = calculateDistance(
              userLocation.latitude,
              userLocation.longitude,
              b.latitude,
              b.longitude
            );
            return distA - distB;
          });
        }
        return sorted;
      
      case 'newest':
        // Would need createdAt field - for now, return as-is
        return sorted;
      
      default:
        return sorted;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSpots();
    setRefreshing(false);
  };

  const handleCreatePlan = (spotId: string, spotName: string) => {
    router.push({
      pathname: '/create-plan',
      params: { 
        spotId,
        spotName,
        ...(currentLayoverId && { layoverId: currentLayoverId }), // Include layoverId if available
      },
    });
  };

  const renderEmptyState = () => {
    if (!selectedCity) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="search" size={64} color={COLORS.mediumGray} />
          <ThemedText style={styles.emptyTitle}>Discover Crew Spots</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            Search for a city to find crew-recommended spots
          </ThemedText>
        </View>
      );
    }

    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <ThemedText style={styles.emptySubtitle}>Loading spots...</ThemedText>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="location-outline" size={64} color={COLORS.mediumGray} />
        <ThemedText style={styles.emptyTitle}>No Spots Found</ThemedText>
        <ThemedText style={styles.emptySubtitle}>
          Try adjusting your filters or be the first to add a spot in {selectedCity}!
        </ThemedText>
        <TouchableOpacity
          style={styles.addSpotButton}
          onPress={() => router.push('/add-spot')}
        >
          <Ionicons name="add-circle" size={20} color={COLORS.white} />
          <ThemedText style={styles.addSpotButtonText}>Add a Spot</ThemedText>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          {/* City Selector */}
          <CitySelector
            selectedCity={selectedCity}
            userLayoverCity={userLayoverCity}
            recentCities={recentCities}
            onSelectCity={setSelectedCity}
          />

          {/* Selection Mode Banner */}
          {selectionMode && (
            <View style={styles.selectionModeBanner}>
              <Ionicons name="checkmark-circle" size={24} color={COLORS.primary} />
              <View style={styles.selectionModeText}>
                <ThemedText style={styles.selectionModeTitle}>Select a Spot</ThemedText>
                <ThemedText style={styles.selectionModeSubtitle}>
                  Tap any spot to add it to your plan
                </ThemedText>
              </View>
              <TouchableOpacity onPress={() => router.back()}>
                <Ionicons name="close" size={24} color={COLORS.mediumGray} />
              </TouchableOpacity>
            </View>
          )}

          {selectedCity && (
            <>
              {/* Search Bar */}
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color={COLORS.mediumGray} style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search spots..."
                  placeholderTextColor={COLORS.mediumGray}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  returnKeyType="search"
                  onSubmitEditing={Keyboard.dismiss}
                  blurOnSubmit={true}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity 
                    onPress={() => {
                      setSearchQuery('');
                      Keyboard.dismiss();
                    }} 
                    style={styles.clearButton}
                  >
                    <Ionicons name="close-circle" size={20} color={COLORS.mediumGray} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Category Tabs */}
              <CategoryTabs
                categories={CATEGORIES}
                selectedCategory={category}
                onSelectCategory={setCategory}
              />

              {/* Sort and Filter */}
              <SortAndFilter
                sortBy={sortBy}
                onSortChange={setSortBy}
                filters={filters}
                onFiltersChange={setFilters}
              />

              {/* Spots List */}
              {spots.length > 0 ? (
                <FlatList
                  data={spots}
                  keyExtractor={item => item.id}
                  renderItem={({ item }) => (
                    <SpotCard
                      spot={item}
                      userLocation={userLocation}
                      onCreatePlan={() => handleCreatePlan(item.id, item.name)}
                      onPress={() => {
                        if (selectionMode) {
                          // Return to create-plan with selected spot
                          router.back();
                          router.setParams({ 
                            selectedSpotId: item.id, 
                            selectedSpotName: item.name 
                          });
                        } else {
                          // Normal behavior - view spot detail
                          const params = currentLayoverId ? `?layoverId=${currentLayoverId}` : '';
                          router.push(`/spot/${item.id}${params}`);
                        }
                      }}
                    />
                  )}
                  contentContainerStyle={styles.spotsList}
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="on-drag"
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={handleRefresh}
                      tintColor={COLORS.primary}
                    />
                  }
                />
              ) : (
                renderEmptyState()
              )}
            </>
          )}

          {!selectedCity && renderEmptyState()}

          {/* Floating Add Spot Button - always visible when city is selected */}
          {selectedCity && spots.length > 0 && (
            <TouchableOpacity
              style={styles.floatingAddButton}
              onPress={() => router.push('/add-spot')}
            >
              <Ionicons name="add-circle-outline" size={22} color={COLORS.white} />
              <ThemedText style={styles.floatingAddButtonText}>Add Spot</ThemedText>
            </TouchableOpacity>
          )}
        </View>
      </ThemedView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.lightGray,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.darkGray,
  },
  clearButton: {
    padding: 4,
  },
  spotsList: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.darkGray,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 22,
  },
  addSpotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 20,
  },
  addSpotButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  floatingAddButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  floatingAddButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  selectionModeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.primary + '15',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary + '30',
  },
  selectionModeText: {
    flex: 1,
  },
  selectionModeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  selectionModeSubtitle: {
    fontSize: 13,
    color: COLORS.mediumGray,
  },
});
