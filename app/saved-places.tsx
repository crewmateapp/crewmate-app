// app/saved-places.tsx
import { SaveButton } from '@/components/SaveButton';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/contexts/ThemeContext';
import { useSavedSpots } from '@/hooks/useSavedSpots';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, useMemo } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

export default function SavedPlacesScreen() {
  const { colors } = useTheme();
  const { savedSpots, loading } = useSavedSpots();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Get unique cities and categories from saved spots
  const uniqueCities = useMemo(() => {
    const cities = new Set(savedSpots.map(spot => spot.city));
    return ['All', ...Array.from(cities).sort()];
  }, [savedSpots]);

  const uniqueCategories = useMemo(() => {
    const categories = new Set(savedSpots.map(spot => spot.category));
    return ['All', ...Array.from(categories).sort()];
  }, [savedSpots]);

  // Filter spots based on search query, city, and category
  const filteredSpots = useMemo(() => {
    let filtered = savedSpots;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(spot =>
        spot.spotName.toLowerCase().includes(query) ||
        spot.city.toLowerCase().includes(query)
      );
    }

    // Filter by city
    if (selectedCity !== 'All') {
      filtered = filtered.filter(spot => spot.city === selectedCity);
    }

    // Filter by category
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(spot => spot.category === selectedCategory);
    }

    return filtered;
  }, [savedSpots, searchQuery, selectedCity, selectedCategory]);

  const getCategoryIcon = (category: string) => {
    const icons: { [key: string]: any } = {
      food: 'restaurant',
      bar: 'beer',
      coffee: 'cafe',
      activity: 'bicycle',
      shopping: 'cart',
      hotel: 'bed',
      other: 'location',
    };
    return icons[category.toLowerCase()] || 'location';
  };

  const renderSpotCard = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={[styles.spotCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => router.push({ pathname: '/spot/[id]', params: { id: item.spotId } })}
        activeOpacity={0.7}
      >
        {/* Spot Image */}
        {item.photoURL ? (
          <Image source={{ uri: item.photoURL }} style={styles.spotImage} />
        ) : (
          <View style={[styles.spotImagePlaceholder, { backgroundColor: colors.border }]}>
            <Ionicons name={getCategoryIcon(item.category)} size={32} color={colors.text.secondary} />
          </View>
        )}

        {/* Spot Info */}
        <View style={styles.spotInfo}>
          <View style={styles.spotHeader}>
            <View style={styles.spotTitleContainer}>
              <ThemedText style={styles.spotName} numberOfLines={1}>
                {item.spotName}
              </ThemedText>
              <View style={styles.spotMeta}>
                <Ionicons name="location" size={14} color={colors.text.secondary} />
                <ThemedText style={[styles.spotCity, { color: colors.text.secondary }]}>
                  {item.city}
                </ThemedText>
              </View>
            </View>

            {/* Save Button */}
            <SaveButton
              spot={{
                spotId: item.spotId,
                spotName: item.spotName,
                city: item.city,
                category: item.category,
                photoURL: item.photoURL,
              }}
              size={22}
            />
          </View>

          {/* Category Badge */}
          <View style={[styles.categoryBadge, { backgroundColor: colors.background }]}>
            <Ionicons name={getCategoryIcon(item.category)} size={12} color={colors.primary} />
            <ThemedText style={[styles.categoryText, { color: colors.primary }]}>
              {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
            </ThemedText>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="bookmark-outline" size={80} color={colors.text.secondary} />
      <ThemedText style={styles.emptyTitle}>
        {searchQuery || selectedCity !== 'All' || selectedCategory !== 'All'
          ? 'No Matching Spots'
          : 'No Saved Places'}
      </ThemedText>
      <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
        {searchQuery || selectedCity !== 'All' || selectedCategory !== 'All'
          ? 'Try adjusting your filters or search query.'
          : 'Start saving spots to see them here! Tap the bookmark icon on any spot card.'}
      </ThemedText>
      {(searchQuery || selectedCity !== 'All' || selectedCategory !== 'All') && (
        <TouchableOpacity
          style={[styles.clearFiltersButton, { backgroundColor: colors.primary }]}
          onPress={() => {
            setSearchQuery('');
            setSelectedCity('All');
            setSelectedCategory('All');
          }}
        >
          <ThemedText style={styles.clearFiltersText}>Clear Filters</ThemedText>
        </TouchableOpacity>
      )}
      {!searchQuery && selectedCity === 'All' && selectedCategory === 'All' && (
        <TouchableOpacity
          style={[styles.exploreButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)/explore')}
        >
          <Ionicons name="compass" size={20} color="#FFFFFF" />
          <ThemedText style={styles.exploreButtonText}>Explore Spots</ThemedText>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Saved Places</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
        <TextInput
          style={[styles.searchInput, { color: colors.text.primary }]}
          placeholder="Search saved spots..."
          placeholderTextColor={colors.text.secondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          returnKeyType="search"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
            <Ionicons name="close-circle" size={20} color={colors.text.secondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filters */}
      {savedSpots.length > 0 && (
        <View style={styles.filtersContainer}>
          {/* City Filter */}
          <View style={styles.filterRow}>
            <ThemedText style={[styles.filterLabel, { color: colors.text.secondary }]}>City:</ThemedText>
            <View style={styles.filterOptions}>
              {uniqueCities.map(city => (
                <TouchableOpacity
                  key={city}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedCity === city ? colors.primary : colors.card,
                      borderColor: selectedCity === city ? colors.primary : colors.border,
                    }
                  ]}
                  onPress={() => setSelectedCity(city)}
                >
                  <ThemedText
                    style={[
                      styles.filterChipText,
                      { color: selectedCity === city ? '#FFFFFF' : colors.text.primary }
                    ]}
                  >
                    {city}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Category Filter */}
          <View style={styles.filterRow}>
            <ThemedText style={[styles.filterLabel, { color: colors.text.secondary }]}>Type:</ThemedText>
            <View style={styles.filterOptions}>
              {uniqueCategories.map(category => (
                <TouchableOpacity
                  key={category}
                  style={[
                    styles.filterChip,
                    {
                      backgroundColor: selectedCategory === category ? colors.accent : colors.card,
                      borderColor: selectedCategory === category ? colors.accent : colors.border,
                    }
                  ]}
                  onPress={() => setSelectedCategory(category)}
                >
                  <ThemedText
                    style={[
                      styles.filterChipText,
                      { color: selectedCategory === category ? '#FFFFFF' : colors.text.primary }
                    ]}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      )}

      {/* Count */}
      {savedSpots.length > 0 && (
        <View style={styles.countContainer}>
          <ThemedText style={[styles.countText, { color: colors.text.secondary }]}>
            Showing {filteredSpots.length} of {savedSpots.length} {savedSpots.length === 1 ? 'spot' : 'spots'}
          </ThemedText>
        </View>
      )}

      {/* Spots List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredSpots}
          renderItem={renderSpotCard}
          keyExtractor={(item) => item.spotId}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmptyState}
          showsVerticalScrollIndicator={false}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    marginTop: 16,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  clearButton: {
    padding: 4,
  },
  filtersContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    gap: 12,
  },
  filterRow: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1.5,
  },
  filterChipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  spotCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    overflow: 'hidden',
  },
  spotImage: {
    width: 100,
    height: 100,
  },
  spotImagePlaceholder: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spotInfo: {
    flex: 1,
    padding: 12,
  },
  spotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  spotTitleContainer: {
    flex: 1,
    marginRight: 8,
  },
  spotName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  spotMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  spotCity: {
    fontSize: 13,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  clearFiltersButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    marginBottom: 12,
  },
  clearFiltersText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  exploreButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
