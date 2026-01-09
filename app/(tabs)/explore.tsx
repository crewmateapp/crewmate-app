import CategoryTabs from '@/components/CategoryTabs';
import CitySelector from '@/components/CitySelector';
import SortAndFilter from '@/components/SortAndFilter';
import SpotCard from '@/components/SpotCard';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { auth, db } from '@/config/firebase';
import { useCities } from '@/hooks/useCities';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, getDocs, limit, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
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
  const { cities, loading: citiesLoading } = useCities();
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [userLayoverCity, setUserLayoverCity] = useState<string | null>(null);
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

  // Load user's current layover city on mount
  useEffect(() => {
    loadUserLayoverCity();
    loadRecentCities();
  }, []);

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
      if (!user) return;

      // Query just by userId to avoid needing composite index
      const layoversQuery = query(
        collection(db, 'layovers'),
        where('userId', '==', user.uid)
      );

      const layoversSnapshot = await getDocs(layoversQuery);
      
      // Filter for active layover in code
      const activeLayover = layoversSnapshot.docs.find(
        doc => doc.data().status === 'active'
      );
      
      if (activeLayover) {
        const layover = activeLayover.data();
        setUserLayoverCity(layover.city);
        setSelectedCity(layover.city); // Auto-select user's layover city
        
        // Store user's location for distance calculations
        if (layover.latitude && layover.longitude) {
          setUserLocation({
            latitude: layover.latitude,
            longitude: layover.longitude,
          });
        }
      }
    } catch (error) {
      console.error('Error loading user layover:', error);
    }
  };

  const loadRecentCities = () => {
    // TODO: Load from AsyncStorage
    // For now, just use empty array
    setRecentCities([]);
  };

  const saveRecentCity = (cityName: string) => {
    setRecentCities(prev => {
      const filtered = prev.filter(c => c !== cityName);
      const updated = [cityName, ...filtered].slice(0, 3); // Keep last 3
      // TODO: Save to AsyncStorage
      return updated;
    });
  };

  const fetchSpots = async () => {
    if (!selectedCity) return;

    setLoading(true);
    try {
      let spotsQuery = query(
        collection(db, 'spots'),
        where('city', '==', selectedCity),
        where('status', '==', 'approved'),
        limit(50) // Load more initially, filter client-side
      );

      const spotsSnapshot = await getDocs(spotsQuery);
      let fetchedSpots: Spot[] = spotsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      } as Spot));

      // Calculate average rating and review count for each spot
      for (const spot of fetchedSpots) {
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('spotId', '==', spot.id)
        );
        const reviewsSnapshot = await getDocs(reviewsQuery);
        
        if (!reviewsSnapshot.empty) {
          const reviews = reviewsSnapshot.docs.map(doc => doc.data());
          const totalRating = reviews.reduce((sum, review) => sum + (review.rating || 0), 0);
          spot.rating = totalRating / reviews.length;
          spot.reviewCount = reviews.length;
        } else {
          spot.rating = 0;
          spot.reviewCount = 0;
        }
      }

      // Apply client-side filtering
      fetchedSpots = applyFilters(fetchedSpots);

      // Apply sorting
      fetchedSpots = applySorting(fetchedSpots);

      setSpots(fetchedSpots);
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

  const handleCreatePlan = (spotId: string) => {
    router.push({
      pathname: '/create-plan',
      params: { spotId },
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
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        {/* City Selector */}
        <CitySelector
          selectedCity={selectedCity}
          userLayoverCity={userLayoverCity}
          recentCities={recentCities}
          onSelectCity={setSelectedCity}
        />

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
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
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
                    onCreatePlan={() => handleCreatePlan(item.id)}
                    onPress={() => router.push(`/spot/${item.id}`)}
                  />
                )}
                contentContainerStyle={styles.spotsList}
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
      </View>
    </ThemedView>
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
    marginVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.darkGray,
  },
  clearButton: {
    padding: 4,
  },
  spotsList: {
    padding: 16,
    paddingBottom: 100, // Account for tab bar
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.darkGray,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  addSpotButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 24,
  },
  addSpotButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
