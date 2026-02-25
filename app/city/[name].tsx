import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useColors } from '@/hooks/use-theme-color';
import { useAdminRole } from '@/hooks/useAdminRole';
import { useAuth } from '@/contexts/AuthContext';
import {
  fetchWhatToBuy,
  addBuyItem,
  toggleUpvote,
  deleteBuyItem,
  BUY_CATEGORIES,
  getCategoryMeta,
  type BuyItem,
  type BuyCategory,
} from '@/utils/whatToBuy';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
  Dimensions,
} from 'react-native';

// Conditionally import maps - only on native platforms
let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
let PROVIDER_DEFAULT: any = null;
let MAPS_AVAILABLE = false;

if (Platform.OS !== 'web') {
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
type CityTab = 'spots' | 'whatToBuy';

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
  const { user } = useAuth();
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
  
  // City tab: spots vs what to buy
  const [cityTab, setCityTab] = useState<CityTab>('spots');
  
  // What to Buy state
  const [buyItems, setBuyItems] = useState<BuyItem[]>([]);
  const [buyLoading, setBuyLoading] = useState(false);
  const [buyCategory, setBuyCategory] = useState<BuyCategory | null>(null);
  const [showAddBuyModal, setShowAddBuyModal] = useState(false);
  const [newBuyItem, setNewBuyItem] = useState({
    itemName: '',
    category: 'groceries' as BuyCategory,
    storeName: '',
    tip: '',
  });
  const [addingBuyItem, setAddingBuyItem] = useState(false);  
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
    if (cityTab === 'whatToBuy') {
      loadBuyItems();
    }
  };

  // ─── What to Buy ────────────────────────────────────────────────────────

  useEffect(() => {
    if (cityTab === 'whatToBuy' && name) {
      loadBuyItems();
    }
  }, [cityTab, name]);

  const loadBuyItems = async () => {
    if (!name) return;
    setBuyLoading(true);
    try {
      const items = await fetchWhatToBuy(name);
      setBuyItems(items);
    } catch (error) {
      console.error('Error loading buy items:', error);
    } finally {
      setBuyLoading(false);
    }
  };

  const handleAddBuyItem = async () => {
    if (!user || !name) return;
    if (!newBuyItem.itemName.trim()) {
      Alert.alert('Missing Info', 'Please enter an item name');
      return;
    }
    if (!newBuyItem.tip.trim()) {
      Alert.alert('Missing Info', 'Please add a tip or description');
      return;
    }

    setAddingBuyItem(true);
    try {
      // Get user display name from auth
      const { doc: fDoc, getDoc } = await import('firebase/firestore');
      const userDoc = await getDoc(fDoc(db, 'users', user.uid));
      const displayName = userDoc.data()?.displayName || 'Crew Member';

      await addBuyItem({
        city: name,
        itemName: newBuyItem.itemName.trim(),
        category: newBuyItem.category,
        storeName: newBuyItem.storeName.trim() || undefined,
        tip: newBuyItem.tip.trim(),
        addedBy: user.uid,
        addedByName: displayName,
      });

      setShowAddBuyModal(false);
      setNewBuyItem({ itemName: '', category: 'groceries', storeName: '', tip: '' });
      loadBuyItems();
    } catch (error) {
      console.error('Error adding buy item:', error);
      Alert.alert('Error', 'Failed to add recommendation');
    } finally {
      setAddingBuyItem(false);
    }
  };

  const handleToggleUpvote = async (item: BuyItem) => {
    if (!user) return;
    const isUpvoted = item.upvotedBy?.includes(user.uid);
    
    // Optimistic update
    setBuyItems(prev => prev.map(i => {
      if (i.id !== item.id) return i;
      return {
        ...i,
        upvotes: isUpvoted ? i.upvotes - 1 : i.upvotes + 1,
        upvotedBy: isUpvoted
          ? i.upvotedBy.filter(id => id !== user.uid)
          : [...(i.upvotedBy || []), user.uid],
      };
    }));

    try {
      await toggleUpvote(item.id, user.uid, isUpvoted);
    } catch (error) {
      console.error('Error toggling upvote:', error);
      loadBuyItems(); // Revert on error
    }
  };

  const handleDeleteBuyItem = async (item: BuyItem) => {
    if (!user) return;
    if (item.addedBy !== user.uid && !isSuperAdmin) return;

    Alert.alert('Delete Item', `Remove "${item.itemName}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBuyItem(item.id);
            loadBuyItems();
          } catch (error) {
            Alert.alert('Error', 'Failed to delete item');
          }
        },
      },
    ]);
  };

  const filteredBuyItems = buyCategory
    ? buyItems.filter(i => i.category === buyCategory)
    : buyItems;

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

      {/* Tab Toggle: Spots / What to Buy */}
      <View style={styles.cityTabs}>
        <TouchableOpacity
          style={[styles.cityTab, cityTab === 'spots' && styles.cityTabActive]}
          onPress={() => setCityTab('spots')}
        >
          <Ionicons
            name="location"
            size={16}
            color={cityTab === 'spots' ? Colors.white : Colors.primary}
          />
          <ThemedText style={[
            styles.cityTabText,
            cityTab === 'spots' && styles.cityTabTextActive
          ]}>
            Spots ({spots.length})
          </ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.cityTab, cityTab === 'whatToBuy' && styles.cityTabActive]}
          onPress={() => setCityTab('whatToBuy')}
        >
          <Ionicons
            name="cart"
            size={16}
            color={cityTab === 'whatToBuy' ? Colors.white : Colors.primary}
          />
          <ThemedText style={[
            styles.cityTabText,
            cityTab === 'whatToBuy' && styles.cityTabTextActive
          ]}>
            What to Buy {buyItems.length > 0 ? `(${buyItems.length})` : ''}
          </ThemedText>
        </TouchableOpacity>
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

      {/* ─── SPOTS TAB ────────────────────────────────────────── */}
      {cityTab === 'spots' && (
        <>
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
        </>
      )}

      {/* ─── WHAT TO BUY TAB ──────────────────────────────────── */}
      {cityTab === 'whatToBuy' && (
        <>
          {/* Buy Category Filter */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryFilter}
            contentContainerStyle={styles.categoryFilterContent}
          >
            <TouchableOpacity
              style={[
                styles.categoryChip,
                !buyCategory && styles.categoryChipActive,
              ]}
              onPress={() => setBuyCategory(null)}
            >
              <ThemedText
                style={[
                  styles.categoryChipText,
                  !buyCategory && styles.categoryChipTextActive,
                ]}
              >
                All
              </ThemedText>
            </TouchableOpacity>
            {BUY_CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryChip,
                  buyCategory === cat.id && styles.categoryChipActive,
                  buyCategory === cat.id && { backgroundColor: cat.color },
                ]}
                onPress={() => setBuyCategory(buyCategory === cat.id ? null : cat.id)}
              >
                <ThemedText style={{ fontSize: 14, marginRight: 4 }}>{cat.emoji}</ThemedText>
                <ThemedText
                  style={[
                    styles.categoryChipText,
                    buyCategory === cat.id && styles.categoryChipTextActive,
                  ]}
                >
                  {cat.label}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Buy Items List */}
          {buyLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : filteredBuyItems.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="cart-outline" size={80} color={colors.text.secondary} />
              <ThemedText style={styles.emptyText}>
                {buyCategory ? `No ${getCategoryMeta(buyCategory).label} recommendations yet` : 'No recommendations yet'}
              </ThemedText>
              <ThemedText style={styles.emptySubtext}>
                Know what's worth buying here? Share it with the crew! ✈️
              </ThemedText>
            </View>
          ) : (
            <View style={styles.buyItemsList}>
              {filteredBuyItems.map((item) => {
                const catMeta = getCategoryMeta(item.category);
                const isUpvoted = user ? item.upvotedBy?.includes(user.uid) : false;
                const isOwner = user?.uid === item.addedBy;

                return (
                  <View
                    key={item.id}
                    style={[styles.buyItemCard, {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                    }]}
                  >
                    <View style={styles.buyItemHeader}>
                      <View style={[styles.buyItemEmoji, { backgroundColor: catMeta.color + '15' }]}>
                        <ThemedText style={{ fontSize: 20 }}>{catMeta.emoji}</ThemedText>
                      </View>
                      <View style={styles.buyItemInfo}>
                        <ThemedText style={styles.buyItemName}>{item.itemName}</ThemedText>
                        <View style={styles.buyItemMeta}>
                          <View style={[styles.buyItemCatPill, { backgroundColor: catMeta.color + '20' }]}>
                            <ThemedText style={[styles.buyItemCatText, { color: catMeta.color }]}>
                              {catMeta.label}
                            </ThemedText>
                          </View>
                          {item.storeName ? (
                            <ThemedText style={styles.buyItemStore} numberOfLines={1}>
                              📍 {item.storeName}
                            </ThemedText>
                          ) : null}
                        </View>
                      </View>
                    </View>

                    <ThemedText style={styles.buyItemTip}>{item.tip}</ThemedText>

                    <View style={styles.buyItemFooter}>
                      <ThemedText style={styles.buyItemAddedBy}>
                        by {item.addedByName}
                      </ThemedText>

                      <View style={styles.buyItemActions}>
                        {(isOwner || isSuperAdmin) && (
                          <TouchableOpacity
                            onPress={() => handleDeleteBuyItem(item)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <Ionicons name="trash-outline" size={16} color={Colors.text.disabled} />
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={[
                            styles.upvoteButton,
                            isUpvoted && styles.upvoteButtonActive,
                          ]}
                          onPress={() => handleToggleUpvote(item)}
                        >
                          <Ionicons
                            name={isUpvoted ? 'thumbs-up' : 'thumbs-up-outline'}
                            size={14}
                            color={isUpvoted ? Colors.white : Colors.primary}
                          />
                          <ThemedText
                            style={[
                              styles.upvoteText,
                              isUpvoted && styles.upvoteTextActive,
                            ]}
                          >
                            {item.upvotes}
                          </ThemedText>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {/* Add Recommendation Button */}
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => setShowAddBuyModal(true)}
          >
            <Ionicons name="add-circle-outline" size={22} color={Colors.white} />
            <ThemedText style={styles.addButtonText}>
              Add a Recommendation
            </ThemedText>
          </TouchableOpacity>

          <View style={styles.bottomSpacer} />
        </>
      )}

      </ScrollView>

      {/* ─── ADD BUY ITEM MODAL ───────────────────────────────── */}
      <Modal
        visible={showAddBuyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddBuyModal(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>What to Buy in {name}</ThemedText>
              <TouchableOpacity onPress={() => setShowAddBuyModal(false)}>
                <Ionicons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
              {/* Item Name */}
              <ThemedText style={styles.modalLabel}>Item Name *</ThemedText>
              <TextInput
                style={[styles.modalInput, { color: Colors.text.primary }]}
                placeholder="e.g. Olio Verde olive oil, La Roche-Posay..."
                placeholderTextColor={Colors.text.disabled}
                value={newBuyItem.itemName}
                onChangeText={(t) => setNewBuyItem(prev => ({ ...prev, itemName: t }))}
              />

              {/* Category */}
              <ThemedText style={[styles.modalLabel, { marginTop: 14 }]}>Category</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 4 }}
                contentContainerStyle={{ gap: 8 }}
              >
                {BUY_CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[
                      styles.modalCategoryChip,
                      newBuyItem.category === cat.id && {
                        backgroundColor: cat.color,
                      },
                    ]}
                    onPress={() => setNewBuyItem(prev => ({ ...prev, category: cat.id }))}
                  >
                    <ThemedText style={{ fontSize: 14 }}>{cat.emoji}</ThemedText>
                    <ThemedText
                      style={[
                        styles.modalCategoryText,
                        newBuyItem.category === cat.id && { color: Colors.white },
                      ]}
                    >
                      {cat.label}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Store Name (optional) */}
              <ThemedText style={[styles.modalLabel, { marginTop: 14 }]}>Store / Where to Find</ThemedText>
              <TextInput
                style={[styles.modalInput, { color: Colors.text.primary }]}
                placeholder="e.g. Monoprix, local pharmacy, duty free..."
                placeholderTextColor={Colors.text.disabled}
                value={newBuyItem.storeName}
                onChangeText={(t) => setNewBuyItem(prev => ({ ...prev, storeName: t }))}
              />

              {/* Tip */}
              <ThemedText style={[styles.modalLabel, { marginTop: 14 }]}>Crew Tip *</ThemedText>
              <TextInput
                style={[styles.modalInput, styles.modalTextArea, { color: Colors.text.primary }]}
                placeholder="Why should crew buy this? Any tips on getting the best deal?"
                placeholderTextColor={Colors.text.disabled}
                value={newBuyItem.tip}
                onChangeText={(t) => setNewBuyItem(prev => ({ ...prev, tip: t }))}
                multiline
                numberOfLines={3}
              />
            </ScrollView>

            {/* Modal Footer */}
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowAddBuyModal(false)}
              >
                <ThemedText style={styles.modalCancelText}>Cancel</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, addingBuyItem && { opacity: 0.6 }]}
                onPress={handleAddBuyItem}
                disabled={addingBuyItem}
              >
                {addingBuyItem ? (
                  <ActivityIndicator color={Colors.white} size="small" />
                ) : (
                  <ThemedText style={styles.modalSubmitText}>Add Recommendation</ThemedText>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  // ─── City Tab Toggle ──────────────────────────────────────────
  cityTabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 3,
  },
  cityTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  cityTabActive: {
    backgroundColor: Colors.primary,
  },
  cityTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  cityTabTextActive: {
    color: Colors.white,
  },
  // ─── What to Buy Items ────────────────────────────────────────
  buyItemsList: {
    paddingHorizontal: 16,
  },
  buyItemCard: {
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    padding: 14,
  },
  buyItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  buyItemEmoji: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buyItemInfo: {
    flex: 1,
  },
  buyItemName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  buyItemMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  buyItemCatPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  buyItemCatText: {
    fontSize: 11,
    fontWeight: '600',
  },
  buyItemStore: {
    fontSize: 12,
    color: Colors.text.secondary,
    flex: 1,
  },
  buyItemTip: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.secondary,
    marginBottom: 10,
  },
  buyItemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  buyItemAddedBy: {
    fontSize: 12,
    color: Colors.text.disabled,
  },
  buyItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  upvoteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
    backgroundColor: Colors.primary + '08',
  },
  upvoteButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  upvoteText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  upvoteTextActive: {
    color: Colors.white,
  },
  // ─── Add Buy Item Modal ──────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    padding: 20,
  },
  modalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  modalTextArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  modalCategoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#F5F5F5',
  },
  modalCategoryText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.background,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalSubmitBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  modalSubmitText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.white,
  },
});
