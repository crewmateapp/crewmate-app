import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useColors } from '@/hooks/use-theme-color';
import { useAdminRole } from '@/hooks/useAdminRole';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';

// Conditionally import maps
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
  console.log('📍 Maps not available in Expo Go');
  MAPS_AVAILABLE = false;
}

type Spot = {
  id: string;
  name: string;
  category: 'coffee' | 'food' | 'bar' | 'activity' | 'gym' | 'shopping';
  description: string;
  city: string;
  address: string;
  area?: string;
  addedByName: string;
  recommended?: boolean;
  rating?: number;
  reviewCount?: number;
  latitude?: number;
  longitude?: number;
  photoURLs?: string[];
  photos?: string[];
};

type ViewMode = 'list' | 'map';
type SortOption = 'recommended' | 'rating' | 'reviews' | 'newest';

const categoryIcons: Record<string, string> = {
  coffee: 'cafe',
  food: 'restaurant',
  bar: 'wine',
  activity: 'tennisball',
  gym: 'barbell',
  shopping: 'bag',
};

const categoryLabels: Record<string, string> = {
  coffee: 'Coffee',
  food: 'Food',
  bar: 'Bar',
  activity: 'Activity',
  gym: 'Gym',
  shopping: 'Shopping',
};

const categoryColors: Record<string, string> = {
  coffee: '#FFD700',
  food: '#FF6B6B',
  bar: '#FFA500',
  activity: '#4169E1',
  gym: '#FF8C00',
  shopping: '#32CD32',
};

export default function CityScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { role } = useAdminRole();
  const colors = useColors();
  const isSuperAdmin = role === 'super';
  
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [togglingSpot, setTogglingSpot] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [sortBy, setSortBy] = useState<SortOption>('recommended');
  const [searchQuery, setSearchQuery] = useState('');
  
  const mapRef = useRef<any>(null);

  // Load spots from Firestore
  useEffect(() => {
    if (!name) return;

    const spotsRef = collection(db, 'spots');
    const q = query(
      spotsRef,
      where('city', '==', name),
      where('status', '==', 'approved'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const loadedSpots: Spot[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Spot[];
        
        setSpots(loadedSpots);
        setLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error('Error loading spots:', error);
        setLoading(false);
        setRefreshing(false);
      }
    );

    return () => unsubscribe();
  }, [name]);

  // Auto-fit map when spots change
  useEffect(() => {
    if (MAPS_AVAILABLE && viewMode === 'map' && filteredSpots.length > 0 && mapRef.current) {
      fitMapToMarkers();
    }
  }, [spots, viewMode, selectedCategory, searchQuery]);

  const handleRefresh = () => {
    setRefreshing(true);
    // Firestore listener will update automatically
  };

  // Filter spots
  const getFilteredSpots = () => {
    let filtered = spots;

    // Category filter
    if (selectedCategory) {
      filtered = filtered.filter((spot) => spot.category === selectedCategory);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((spot) => 
        spot.name.toLowerCase().includes(query) ||
        spot.description.toLowerCase().includes(query) ||
        spot.address?.toLowerCase().includes(query) ||
        spot.area?.toLowerCase().includes(query)
      );
    }

    return filtered;
  };

  const filteredSpots = getFilteredSpots();

  // Sort spots
  const getSortedSpots = () => {
    const sorted = [...filteredSpots];

    switch (sortBy) {
      case 'recommended':
        return sorted.sort((a, b) => {
          if (a.recommended && !b.recommended) return -1;
          if (!a.recommended && b.recommended) return 1;
          return (b.rating || 0) - (a.rating || 0);
        });
      
      case 'rating':
        return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      
      case 'reviews':
        return sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
      
      case 'newest':
        return sorted; // Already sorted by createdAt desc
      
      default:
        return sorted;
    }
  };

  const displayedSpots = getSortedSpots();
  const recommendedSpots = displayedSpots.filter(s => s.recommended);
  const otherSpots = displayedSpots.filter(s => !s.recommended);

  const handleAddSpot = () => {
    router.push(`/add-spot?city=${encodeURIComponent(name || '')}`);
  };

  const handleSpotPress = (spotId: string) => {
    router.push(`/spot/${spotId}`);
  };

  const toggleRecommended = async (spotId: string, currentValue: boolean) => {
    if (!isSuperAdmin) return;
    
    setTogglingSpot(spotId);
    try {
      await updateDoc(doc(db, 'spots', spotId), {
        recommended: !currentValue
      });
    } catch (error) {
      console.error('Error toggling recommended:', error);
      Alert.alert('Error', 'Failed to update recommendation status');
    } finally {
      setTogglingSpot(null);
    }
  };

  const getMarkerColor = (category: string): string => {
    return categoryColors[category] || Colors.primary;
  };

  const fitMapToMarkers = () => {
    if (!mapRef.current || filteredSpots.length === 0) return;

    const spotsWithCoords = filteredSpots.filter(spot => spot.latitude && spot.longitude);
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

  const renderSpotCard = (spot: Spot) => {
    const hasPhoto = spot.photoURLs && spot.photoURLs.length > 0;
    
    return (
      <TouchableOpacity
        key={spot.id}
        style={[styles.spotCard, { 
          backgroundColor: colors.card,
          borderColor: colors.border
        }]}
        onPress={() => handleSpotPress(spot.id)}
        activeOpacity={0.7}
      >
        <View style={styles.spotCardContent}>
          {/* Photo */}
          {hasPhoto ? (
            <Image
              source={{ uri: spot.photoURLs![0] }}
              style={styles.spotPhoto}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.spotPhotoPlaceholder, { backgroundColor: categoryColors[spot.category] }]}>
              <Ionicons 
                name={categoryIcons[spot.category] as any}
                size={40} 
                color="#FFFFFF" 
              />
            </View>
          )}

          {/* Content */}
          <View style={styles.spotInfo}>
            <View style={styles.spotHeader}>
              <View style={styles.spotTitleRow}>
                <ThemedText style={styles.spotName} numberOfLines={1}>
                  {spot.name}
                </ThemedText>
                {spot.recommended && (
                  <Ionicons name="star" size={16} color="#FFD700" style={styles.recommendedIcon} />
                )}
              </View>
              
              {/* Rating */}
              {spot.rating !== undefined && (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color="#FFD700" />
                  <ThemedText style={styles.ratingText}>
                    {spot.rating.toFixed(1)}
                  </ThemedText>
                  {spot.reviewCount && (
                    <ThemedText style={styles.reviewCount}>
                      ({spot.reviewCount})
                    </ThemedText>
                  )}
                </View>
              )}
            </View>

            {/* Category & Area */}
            <View style={styles.metaRow}>
              <View style={[styles.categoryPill, { backgroundColor: categoryColors[spot.category] + '20' }]}>
                <Ionicons 
                  name={categoryIcons[spot.category] as any}
                  size={12} 
                  color={categoryColors[spot.category]} 
                />
                <ThemedText style={[styles.categoryText, { color: categoryColors[spot.category] }]}>
                  {categoryLabels[spot.category]}
                </ThemedText>
              </View>
              {spot.area && (
                <ThemedText style={styles.areaText} numberOfLines={1}>
                  • {spot.area}
                </ThemedText>
              )}
            </View>

            {/* Description */}
            <ThemedText style={styles.spotDescription} numberOfLines={2}>
              {spot.description}
            </ThemedText>

            {/* Footer */}
            <View style={styles.spotFooter}>
              <ThemedText style={styles.addedBy}>
                Added by {spot.addedByName}
              </ThemedText>
              
              {isSuperAdmin && (
                <TouchableOpacity
                  style={styles.adminStarButton}
                  onPress={(e) => {
                    e.stopPropagation();
                    toggleRecommended(spot.id, spot.recommended || false);
                  }}
                  disabled={togglingSpot === spot.id}
                >
                  {togglingSpot === spot.id ? (
                    <ActivityIndicator size="small" color="#FFD700" />
                  ) : (
                    <Ionicons
                      name={spot.recommended ? "star" : "star-outline"}
                      size={20}
                      color="#FFD700"
                    />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderMapView = () => {
    if (!MAPS_AVAILABLE) {
      return (
        <View style={styles.mapUnavailableContainer}>
          <Ionicons name="map" size={80} color={Colors.primary} />
          <ThemedText style={styles.mapUnavailableTitle}>Map View Coming Soon!</ThemedText>
          <ThemedText style={styles.mapUnavailableText}>
            Map view is available in production builds (TestFlight & Google Play).
          </ThemedText>
          <TouchableOpacity
            style={styles.switchToListButton}
            onPress={() => setViewMode('list')}
          >
            <Ionicons name="list" size={20} color={Colors.white} />
            <ThemedText style={styles.switchToListButtonText}>Switch to List View</ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    const spotsWithCoords = filteredSpots.filter(spot => spot.latitude && spot.longitude);

    if (spotsWithCoords.length === 0) {
      return (
        <View style={styles.mapEmptyContainer}>
          <Ionicons name="map-outline" size={60} color={colors.text.secondary} />
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
              onPress={() => handleSpotPress(spot.id)}
            >
              <Callout>
                <View style={styles.calloutContainer}>
                  <ThemedText style={styles.calloutTitle}>{spot.name}</ThemedText>
                  {spot.rating !== undefined && (
                    <View style={styles.calloutRating}>
                      <Ionicons name="star" size={14} color="#FFD700" />
                      <ThemedText style={styles.calloutRatingText}>
                        {spot.rating.toFixed(1)}
                      </ThemedText>
                      {spot.reviewCount && (
                        <ThemedText style={styles.calloutReviews}>
                          ({spot.reviewCount})
                        </ThemedText>
                      )}
                    </View>
                  )}
                  <ThemedText style={styles.calloutCategory}>
                    {categoryLabels[spot.category]}
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
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <ThemedText style={styles.cityName}>{name}</ThemedText>
          <ThemedText style={styles.spotCount}>
            {spots.length} spot{spots.length !== 1 ? 's' : ''}
          </ThemedText>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search spots..."
            placeholderTextColor={colors.text.secondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Category Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFilter}
          contentContainerStyle={styles.categoryFilterContent}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              !selectedCategory && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <ThemedText style={[
              styles.categoryChipText,
              !selectedCategory && styles.categoryChipTextActive
            ]}>All</ThemedText>
          </TouchableOpacity>
          {Object.entries(categoryLabels).map(([cat, label]) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                selectedCategory === cat && styles.categoryChipActive,
                selectedCategory === cat && { backgroundColor: categoryColors[cat] }
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <Ionicons 
                name={categoryIcons[cat] as any}
                size={16} 
                color={selectedCategory === cat ? Colors.white : categoryColors[cat]}
                style={styles.categoryIcon}
              />
              <ThemedText style={[
                styles.categoryChipText,
                selectedCategory === cat && styles.categoryChipTextActive
              ]}>{label}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* View Toggle & Sort */}
        <View style={styles.controlsRow}>
          {/* View Toggle */}
          <View style={styles.viewToggle}>
            <TouchableOpacity
              style={[
                styles.viewButton,
                viewMode === 'list' && styles.viewButtonActive
              ]}
              onPress={() => setViewMode('list')}
            >
              <Ionicons 
                name="list" 
                size={18} 
                color={viewMode === 'list' ? Colors.white : Colors.primary} 
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.viewButton,
                viewMode === 'map' && styles.viewButtonActive
              ]}
              onPress={() => setViewMode('map')}
            >
              <Ionicons 
                name="map" 
                size={18} 
                color={viewMode === 'map' ? Colors.white : Colors.primary} 
              />
            </TouchableOpacity>
          </View>

          {/* Sort Dropdown (only in list view) */}
          {viewMode === 'list' && (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.sortOptions}
            >
              <TouchableOpacity
                style={[styles.sortChip, sortBy === 'recommended' && styles.sortChipActive]}
                onPress={() => setSortBy('recommended')}
              >
                <Ionicons name="star" size={14} color={sortBy === 'recommended' ? Colors.white : Colors.primary} />
                <ThemedText style={[styles.sortText, sortBy === 'recommended' && styles.sortTextActive]}>
                  Featured
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortChip, sortBy === 'rating' && styles.sortChipActive]}
                onPress={() => setSortBy('rating')}
              >
                <ThemedText style={[styles.sortText, sortBy === 'rating' && styles.sortTextActive]}>
                  Highest Rated
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.sortChip, sortBy === 'reviews' && styles.sortChipActive]}
                onPress={() => setSortBy('reviews')}
              >
                <ThemedText style={[styles.sortText, sortBy === 'reviews' && styles.sortTextActive]}>
                  Most Reviews
                </ThemedText>
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>

        {/* Content - List or Map */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : viewMode === 'list' ? (
          <>
            {displayedSpots.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Ionicons name="location-outline" size={80} color={colors.text.secondary} />
                <ThemedText style={styles.emptyText}>
                  {searchQuery ? 'No matching spots found' : 
                   selectedCategory ? `No ${categoryLabels[selectedCategory]} spots yet` : 
                   'No spots yet'}
                </ThemedText>
                <ThemedText style={styles.emptySubtext}>
                  Be the first to add a recommendation! ✈️
                </ThemedText>
              </View>
            ) : (
              <View style={styles.spotsList}>
                {/* Recommended Section */}
                {recommendedSpots.length > 0 && sortBy === 'recommended' && (
                  <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                      <Ionicons name="star" size={20} color="#FFD700" />
                      <ThemedText style={styles.sectionTitle}>
                        Crew Favorites
                      </ThemedText>
                    </View>
                    {recommendedSpots.map(renderSpotCard)}
                  </View>
                )}

                {/* Other Spots */}
                {otherSpots.length > 0 && sortBy === 'recommended' && (
                  <View style={styles.section}>
                    <ThemedText style={styles.sectionTitle}>
                      All Spots
                    </ThemedText>
                    {otherSpots.map(renderSpotCard)}
                  </View>
                )}

                {/* No sections for other sort modes */}
                {sortBy !== 'recommended' && displayedSpots.map(renderSpotCard)}
              </View>
            )}
          </>
        ) : (
          renderMapView()
        )}

        {/* Add Spot Button */}
        <TouchableOpacity 
          style={styles.addButton} 
          onPress={handleAddSpot}
        >
          <Ionicons name="add-circle-outline" size={22} color={Colors.white} />
          <ThemedText style={styles.addButtonText}>
            Add a Spot
          </ThemedText>
        </TouchableOpacity>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
  },
  cityName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 2,
  },
  spotCount: {
    fontSize: 14,
    opacity: 0.6,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  categoryFilter: {
    marginBottom: 12,
  },
  categoryFilterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    gap: 6,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
  },
  categoryIcon: {
    marginRight: 2,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: Colors.white,
  },
  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 3,
  },
  viewButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  viewButtonActive: {
    backgroundColor: Colors.primary,
  },
  sortOptions: {
    flex: 1,
  },
  sortChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
    marginRight: 8,
    gap: 4,
  },
  sortChipActive: {
    backgroundColor: Colors.primary,
  },
  sortText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  sortTextActive: {
    color: Colors.white,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.6,
  },
  spotsList: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  spotCard: {
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  spotCardContent: {
    flexDirection: 'row',
  },
  spotPhoto: {
    width: 120,
    height: 120,
  },
  spotPhotoPlaceholder: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotInfo: {
    flex: 1,
    padding: 12,
  },
  spotHeader: {
    marginBottom: 8,
  },
  spotTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  spotName: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
  },
  recommendedIcon: {
    marginLeft: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ratingText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewCount: {
    fontSize: 13,
    opacity: 0.6,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 6,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  areaText: {
    fontSize: 12,
    opacity: 0.6,
    flex: 1,
  },
  spotDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
    opacity: 0.8,
  },
  spotFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  addedBy: {
    fontSize: 12,
    opacity: 0.5,
  },
  adminStarButton: {
    padding: 4,
  },
  mapContainer: {
    height: 500,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  mapEmptyContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mapEmptyText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 16,
  },
  mapUnavailableContainer: {
    paddingVertical: 60,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  mapUnavailableTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.primary,
    marginTop: 20,
    marginBottom: 12,
  },
  mapUnavailableText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  switchToListButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 24,
  },
  switchToListButtonText: {
    color: Colors.white,
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
  },
  calloutReviews: {
    fontSize: 13,
    opacity: 0.6,
  },
  calloutCategory: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 4,
  },
  calloutTap: {
    fontSize: 11,
    color: Colors.primary,
    fontWeight: '500',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    marginHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 16,
  },
  addButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: 40,
  },
});
