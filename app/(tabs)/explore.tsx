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
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  RefreshControl,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Platform,
} from 'react-native';

// Conditionally import maps - gracefully handles if not available
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
let PROVIDER_DEFAULT: any = null;
let MAPS_AVAILABLE = false;

try {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
  PROVIDER_DEFAULT = maps.PROVIDER_DEFAULT;
  MAPS_AVAILABLE = true;
} catch (e) {
  console.log('📍 Maps not available in this environment (Expo Go). Will work in production builds.');
  MAPS_AVAILABLE = false;
}

const COLORS = {
  primary: '#114878',
  accent: '#F4C430',
  white: '#FFFFFF',
  lightGray: '#F5F5F5',
  mediumGray: '#999999',
  darkGray: '#333333',
  border: '#E0E0E0',
  // Category colors for map pins
  food: '#FF6B6B',      // Red
  bar: '#FFA500',       // Orange
  coffee: '#FFD700',    // Gold
  activity: '#4169E1',  // Blue
  shopping: '#32CD32',  // Green
};

const CATEGORIES = ['All', 'Food', 'Bar', 'Coffee', 'Activity', 'Shopping'];

type Spot = {
  id: string;
  name: string;
  category: string;
  type?: string;
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

type ViewMode = 'list' | 'map';

export default function ExploreScreen() {
  const { 
    city: urlCity, 
    layoverId,
    selectionMode: selectionModeParam,
    returnTo,
    planId,
    isMultiStop,
    stops: stopsParam,
  } = useLocalSearchParams<{ 
    city?: string; 
    layoverId?: string;
    selectionMode?: string;
    returnTo?: string;
    planId?: string;
    isMultiStop?: string;
    stops?: string;
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
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (layoverId) {
      setCurrentLayoverId(layoverId);
    }
    
    if (urlCity) {
      setSelectedCity(urlCity);
    } else {
      loadUserLayoverCity();
    }
    
    loadRecentCities();
  }, [urlCity, layoverId]);

  useEffect(() => {
    if (selectedCity) {
      fetchSpots();
      saveRecentCity(selectedCity);
    }
  }, [selectedCity, category, sortBy, filters, searchQuery]);

  // Auto-fit map to show all markers when spots change (only if maps available)
  useEffect(() => {
    if (MAPS_AVAILABLE && viewMode === 'map' && spots.length > 0 && mapRef.current) {
      fitMapToMarkers();
    }
  }, [spots, viewMode]);

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
    setRecentCities([]);
  };

  const saveRecentCity = (cityName: string) => {
    if (!recentCities.includes(cityName)) {
      setRecentCities([cityName, ...recentCities.slice(0, 4)]);
    }
  };

  const handleCitySelect = (cityName: string) => {
    if (selectionMode) {
      setSelectedCity(cityName);
      saveRecentCity(cityName);
    } else {
      router.push(`/city/${encodeURIComponent(cityName)}`);
    }
  };

  const fetchSpots = async () => {
    if (!selectedCity) return;

    setLoading(true);
    try {
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

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(spot => {
        const nameMatch = spot.name.toLowerCase().includes(query);
        const descMatch = (spot.description || '').toLowerCase().includes(query);
        const addressMatch = (spot.address || '').toLowerCase().includes(query);
        return nameMatch || descMatch || addressMatch;
      });
    }

    if (category !== 'All') {
      filtered = filtered.filter(spot => {
        const spotCategory = (spot.category || '').toLowerCase().trim();
        const selectedCategory = category.toLowerCase().trim();
        return spotCategory === selectedCategory;
      });
    }

    if (filters.minRating > 0) {
      filtered = filtered.filter(spot => (spot.rating || 0) >= filters.minRating);
    }

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
            const distA = (a.latitude && a.longitude) 
              ? calculateDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude)
              : 999;
            const distB = (b.latitude && b.longitude)
              ? calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
              : 999;
            return distA - distB;
          });
        }
        return sorted;
      
      case 'newest':
        return sorted;
      
      default:
        return sorted;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 3959;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchSpots();
    setRefreshing(false);
  };

  const handleCreatePlan = (spotId: string, spotName: string) => {
    const params = currentLayoverId
      ? `?layoverId=${currentLayoverId}&selectedSpotId=${spotId}&selectedSpotName=${encodeURIComponent(spotName)}`
      : `?selectedSpotId=${spotId}&selectedSpotName=${encodeURIComponent(spotName)}`;
    router.push(`/create-plan${params}`);
  };

  const getMarkerColor = (category: string): string => {
    const cat = category.toLowerCase();
    switch (cat) {
      case 'food':
        return COLORS.food;
      case 'bar':
        return COLORS.bar;
      case 'coffee':
        return COLORS.coffee;
      case 'activity':
        return COLORS.activity;
      case 'shopping':
        return COLORS.shopping;
      default:
        return COLORS.primary;
    }
  };

  const fitMapToMarkers = () => {
    if (!mapRef.current || spots.length === 0) return;

    const spotsWithCoords = spots.filter(spot => spot.latitude && spot.longitude);
    if (spotsWithCoords.length === 0) return;

    const coordinates = spotsWithCoords.map(spot => ({
      latitude: spot.latitude!,
      longitude: spot.longitude!,
    }));

    mapRef.current.fitToCoordinates(coordinates, {
      edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
      animated: true,
    });
  };

  const handleMarkerPress = (spot: Spot) => {
    if (selectionMode) {
      const params = new URLSearchParams({
        selectedSpotId: spot.id,
        selectedSpotName: spot.name,
      });
      
      if (layoverId) {
        params.append('layoverId', layoverId);
      }
      
      if (isMultiStop) {
        params.append('isMultiStop', isMultiStop);
      }
      if (stopsParam) {
        params.append('stops', stopsParam);
      }
      
      if (returnTo === 'edit-plan' && planId) {
        params.append('id', planId);
        router.push(`/edit-plan?${params.toString()}`);
      } else {
        router.push(`/create-plan?${params.toString()}`);
      }
    } else {
      const params = currentLayoverId ? `?layoverId=${currentLayoverId}` : '';
      router.push(`/spot/${spot.id}${params}`);
    }
  };

  const renderEmptyState = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="location-outline" size={80} color={COLORS.mediumGray} />
        <ThemedText style={styles.emptyTitle}>
          {selectedCity ? 'No spots found' : 'Select a City'}
        </ThemedText>
        <ThemedText style={styles.emptySubtitle}>
          {selectedCity 
            ? 'Try adjusting your filters or be the first to add a spot!'
            : 'Choose a city from the dropdown to explore crew-recommended spots'}
        </ThemedText>
        {selectedCity && (
          <TouchableOpacity
            style={styles.addSpotButton}
            onPress={() => router.push('/add-spot')}
          >
            <Ionicons name="add" size={20} color={COLORS.white} />
            <ThemedText style={styles.addSpotButtonText}>Add a Spot</ThemedText>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // Render map view - with fallback for Expo Go
  const renderMapView = () => {
    // If maps not available, show helpful message
    if (!MAPS_AVAILABLE) {
      return (
        <View style={styles.mapUnavailableContainer}>
          <Ionicons name="map" size={80} color={COLORS.primary} />
          <ThemedText style={styles.mapUnavailableTitle}>Map View Coming Soon!</ThemedText>
          <ThemedText style={styles.mapUnavailableText}>
            Map view is available in production builds (TestFlight & Google Play).
          </ThemedText>
          <ThemedText style={styles.mapUnavailableSubtext}>
            Switch to List view to explore spots, or test maps in your next build! 🗺️
          </ThemedText>
          <TouchableOpacity
            style={styles.switchToListButton}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color={COLORS.white} />
            <ThemedText style={styles.switchToListButtonText}>Switch to List View</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    const spotsWithCoords = spots.filter(spot => spot.latitude && spot.longitude);

    if (spotsWithCoords.length === 0) {
      return (
        <View style={styles.mapEmptyContainer}>
          <Ionicons name="map-outline" size={60} color={COLORS.mediumGray} />
          <ThemedText style={styles.mapEmptyText}>
            No spots with locations to show on map
          </ThemedText>
        </View>
      );
    }

    const firstSpot = spotsWithCoords[0];
    const initialRegion = {
      latitude: firstSpot.latitude!,
      longitude: firstSpot.longitude!,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    };

    return (
      <View style={styles.mapContainer}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={initialRegion}
          provider={PROVIDER_DEFAULT}
          showsUserLocation={true}
          showsMyLocationButton={true}
        >
          {spotsWithCoords.map(spot => (
            <Marker
              key={spot.id}
              coordinate={{
                latitude: spot.latitude!,
                longitude: spot.longitude!,
              }}
              pinColor={getMarkerColor(spot.category)}
              onPress={() => handleMarkerPress(spot)}
            >
              <Callout>
                <View style={styles.calloutContainer}>
                  <ThemedText style={styles.calloutTitle}>{spot.name}</ThemedText>
                  <View style={styles.calloutRating}>
                    <Ionicons name="star" size={14} color={COLORS.accent} />
                    <ThemedText style={styles.calloutRatingText}>
                      {spot.rating?.toFixed(1) || 'New'}
                    </ThemedText>
                    {spot.reviewCount ? (
                      <ThemedText style={styles.calloutReviews}>
                        ({spot.reviewCount})
                      </ThemedText>
                    ) : null}
                  </View>
                  <ThemedText style={styles.calloutCategory}>
                    {spot.category.charAt(0).toUpperCase() + spot.category.slice(1)}
                  </ThemedText>
                  <ThemedText style={styles.calloutTap}>Tap for details →</ThemedText>
                </View>
              </Callout>
            </Marker>
          ))}
        </MapView>
      </View>
    );
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ThemedView style={styles.container}>
        <View style={styles.content}>
          <CitySelector
            cities={cities}
            loading={citiesLoading}
            selectedCity={selectedCity}
            userLayoverCity={userLayoverCity}
            recentCities={recentCities}
            onSelectCity={handleCitySelect}
          />

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

              <CategoryTabs
                categories={CATEGORIES}
                selectedCategory={category}
                onSelectCategory={setCategory}
              />

              {/* View Toggle - Only show if maps are available OR user tries to access */}
              <View style={styles.viewToggleContainer}>
                <TouchableOpacity
                  style={[
                    styles.viewToggleButton,
                    viewMode === 'list' && styles.viewToggleButtonActive,
                  ]}
                  onPress={() => setViewMode('list')}
                >
                  <Ionicons 
                    name="list" 
                    size={20} 
                    color={viewMode === 'list' ? COLORS.white : COLORS.primary} 
                  />
                  <ThemedText style={[
                    styles.viewToggleText,
                    viewMode === 'list' && styles.viewToggleTextActive,
                  ]}>
                    List
                  </ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.viewToggleButton,
                    viewMode === 'map' && styles.viewToggleButtonActive,
                  ]}
                  onPress={() => setViewMode('map')}
                >
                  <Ionicons 
                    name="map" 
                    size={20} 
                    color={viewMode === 'map' ? COLORS.white : COLORS.primary} 
                  />
                  <ThemedText style={[
                    styles.viewToggleText,
                    viewMode === 'map' && styles.viewToggleTextActive,
                  ]}>
                    Map {!MAPS_AVAILABLE && '(Build)'}
                  </ThemedText>
                </TouchableOpacity>
              </View>

              {viewMode === 'list' && (
                <SortAndFilter
                  sortBy={sortBy}
                  onSortChange={setSortBy}
                  filters={filters}
                  onFiltersChange={setFilters}
                />
              )}

              {viewMode === 'list' ? (
                <>
                  {spots.length > 0 ? (
                    <FlatList
                      data={spots}
                      keyExtractor={item => item.id}
                      renderItem={({ item }) => (
                        <SpotCard
                          spot={item}
                          userLocation={userLocation}
                          selectionMode={selectionMode}
                          onCreatePlan={() => handleCreatePlan(item.id, item.name)}
                          onPress={() => {
                            if (selectionMode) {
                              const params = new URLSearchParams({
                                selectedSpotId: item.id,
                                selectedSpotName: item.name,
                              });
                              
                              if (layoverId) {
                                params.append('layoverId', layoverId);
                              }
                              
                              if (isMultiStop) {
                                params.append('isMultiStop', isMultiStop);
                              }
                              if (stopsParam) {
                                params.append('stops', stopsParam);
                              }
                              
                              if (returnTo === 'edit-plan' && planId) {
                                params.append('id', planId);
                                router.push(`/edit-plan?${params.toString()}`);
                              } else {
                                router.push(`/create-plan?${params.toString()}`);
                              }
                            } else {
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
              ) : (
                renderMapView()
              )}
            </>
          )}

          {!selectedCity && renderEmptyState()}

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
  viewToggleContainer: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.lightGray,
    borderRadius: 10,
    padding: 4,
  },
  viewToggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  viewToggleButtonActive: {
    backgroundColor: COLORS.primary,
  },
  viewToggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.primary,
  },
  viewToggleTextActive: {
    color: COLORS.white,
  },
  spotsList: {
    padding: 16,
    paddingBottom: 100,
  },
  mapContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapEmptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mapEmptyText: {
    fontSize: 16,
    color: COLORS.mediumGray,
    textAlign: 'center',
    marginTop: 16,
  },
  mapUnavailableContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  mapUnavailableTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginTop: 20,
    marginBottom: 12,
  },
  mapUnavailableText: {
    fontSize: 16,
    color: COLORS.darkGray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
  },
  mapUnavailableSubtext: {
    fontSize: 14,
    color: COLORS.mediumGray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  switchToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 12,
  },
  switchToListButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  calloutContainer: {
    width: 200,
    padding: 8,
  },
  calloutTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.darkGray,
    marginBottom: 4,
  },
  calloutRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  calloutRatingText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.darkGray,
  },
  calloutReviews: {
    fontSize: 13,
    color: COLORS.mediumGray,
  },
  calloutCategory: {
    fontSize: 12,
    color: COLORS.mediumGray,
    marginBottom: 4,
  },
  calloutTap: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: '500',
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
