import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useColors } from '@/hooks/use-theme-color';
import { useAdminRole } from '@/hooks/useAdminRole';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, onSnapshot, orderBy, query, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type Spot = {
  id: string;
  name: string;
  category: 'coffee' | 'food' | 'bar' | 'activity' | 'gym';
  description: string;
  city: string;
  area: string;
  addedByName: string;
  recommended?: boolean;
};

const categoryEmoji: Record<string, string> = {
  coffee: '☕',
  food: '🍽️',
  bar: '�',
  activity: '🎯',
  gym: '💪',
};

const categoryColors: Record<string, string> = {
  coffee: '#8B4513',
  food: '#FF6347',
  bar: '#9370DB',
  activity: '#20B2AA',
  gym: '#FF8C00',
};

export default function CityScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const { role } = useAdminRole();
  const colors = useColors();
  const isSuperAdmin = role === 'super';
  
  const [spots, setSpots] = useState<Spot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [togglingSpot, setTogglingSpot] = useState<string | null>(null);

  // Load spots from Firestore
  useEffect(() => {
    if (!name) return;

    const spotsRef = collection(db, 'spots');
    const q = query(
      spotsRef,
      where('city', '==', name),
      where('status', '==', 'approved'), // Only show approved spots
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
      },
      (error) => {
        console.error('Error loading spots:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [name]);

  const filteredSpots = selectedCategory
    ? spots.filter((spot) => spot.category === selectedCategory)
    : spots;

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
      
      // Optional: Show success feedback
      // Alert.alert('Success', `Spot ${!currentValue ? 'added to' : 'removed from'} recommendations`);
    } catch (error) {
      console.error('Error toggling recommended:', error);
      Alert.alert('Error', 'Failed to update recommendation status');
    } finally {
      setTogglingSpot(null);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
          <ThemedText style={[styles.backText, { color: Colors.primary }]}>Back</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.title}>{name}</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.text.secondary }]}>
          {spots.length} crew-recommended spot{spots.length !== 1 ? 's' : ''}
        </ThemedText>

        {/* Category Filter */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFilter}
        >
          <TouchableOpacity
            style={[
              styles.categoryChip,
              { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
              !selectedCategory && { backgroundColor: Colors.primary }
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <ThemedText style={[
              styles.categoryChipText,
              !selectedCategory && { color: Colors.white }
            ]}>All</ThemedText>
          </TouchableOpacity>
          {Object.entries(categoryEmoji).map(([cat, emoji]) => (
            <TouchableOpacity
              key={cat}
              style={[
                styles.categoryChip,
                { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 },
                selectedCategory === cat && { backgroundColor: Colors.primary }
              ]}
              onPress={() => setSelectedCategory(cat)}
            >
              <ThemedText style={styles.categoryChipText}>{emoji}</ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Loading State */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : filteredSpots.length === 0 ? (
          /* Empty State */
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>
              {selectedCategory
                ? `No ${selectedCategory} spots yet in ${name}`
                : `No spots yet in ${name}`}
            </ThemedText>
            <ThemedText style={styles.emptySubtext}>
              Be the first to add a recommendation! ✈️
            </ThemedText>
          </View>
        ) : (
          /* Spots List */
          <View style={styles.spotsList}>
            {filteredSpots.map((spot) => (
              <TouchableOpacity
                key={spot.id}
                style={[styles.spotCard, { 
                  backgroundColor: colors.card,
                  borderColor: colors.border
                }]}
                onPress={() => handleSpotPress(spot.id)}
                activeOpacity={0.7}
              >
                <View style={styles.spotHeader}>
                  <View
                    style={[
                      styles.categoryBadge,
                      { backgroundColor: categoryColors[spot.category] },
                    ]}
                  >
                    <ThemedText style={styles.categoryBadgeText}>
                      {categoryEmoji[spot.category]}
                    </ThemedText>
                  </View>
                  <View style={styles.spotInfo}>
                    <ThemedText style={styles.spotName}>{spot.name}</ThemedText>
                    <ThemedText style={styles.spotCategory}>
                      {spot.category.charAt(0).toUpperCase() + spot.category.slice(1)}
                      {spot.area && ` • ${spot.area}`}
                    </ThemedText>
                  </View>
                  
                  {/* Recommended Toggle - Super Admin Only */}
                  {isSuperAdmin && (
                    <TouchableOpacity
                      style={styles.starButton}
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
                          size={24}
                          color="#FFD700"
                        />
                      )}
                    </TouchableOpacity>
                  )}
                </View>
                <ThemedText style={[styles.spotDescription, { color: colors.text.secondary }]} numberOfLines={2}>
                  "{spot.description}"
                </ThemedText>
                <ThemedText style={[styles.addedBy, { color: Colors.primary }]}>
                  Added by {spot.addedByName}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Add Spot Button */}
        <TouchableOpacity style={[styles.addButton, { backgroundColor: Colors.primary }]} onPress={handleAddSpot}>
          <ThemedText style={[styles.addButtonText, { color: Colors.white }]}>
            ➕ Add a Spot
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    paddingTop: 40,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
  },
  categoryFilter: {
    marginBottom: 20,
  },
  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 10,
  },
  categoryChipText: {
    fontSize: 18,
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
    marginBottom: 10,
    opacity: 0.7,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    opacity: 0.5,
  },
  spotsList: {
    gap: 15,
  },
  spotCard: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },
  spotHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    width: 45,
    height: 45,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryBadgeText: {
    fontSize: 20,
  },
  spotInfo: {
    flex: 1,
  },
  spotName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  spotCategory: {
    fontSize: 13,
    color: '#888',
  },
  starButton: {
    padding: 8,
    marginLeft: 8,
  },
  spotDescription: {
    fontSize: 15,
    fontStyle: 'italic',
    marginBottom: 10,
    lineHeight: 22,
  },
  addedBy: {
    fontSize: 12,
  },
  addButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
