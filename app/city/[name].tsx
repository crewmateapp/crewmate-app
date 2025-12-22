import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { router, useLocalSearchParams } from 'expo-router';
import {
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
  addedBy: string;
};

const getMockSpots = (cityName: string): Spot[] => [
  {
    id: '1',
    name: 'Blue Bottle Coffee',
    category: 'coffee',
    description: 'Amazing pour-over, great wifi for catching up on emails.',
    addedBy: 'Sarah M.',
  },
  {
    id: '2',
    name: 'The Local Bistro',
    category: 'food',
    description: 'Best brunch spot! Try the avocado toast.',
    addedBy: 'Mike R.',
  },
  {
    id: '3',
    name: 'Rooftop Bar',
    category: 'bar',
    description: 'Great views, perfect for crew meetups after a long flight.',
    addedBy: 'Amanda K.',
  },
  {
    id: '4',
    name: '24 Hour Fitness',
    category: 'gym',
    description: 'Clean gym, close to the main hotels. Day passes available.',
    addedBy: 'Chris B.',
  },
  {
    id: '5',
    name: 'City Walking Tour',
    category: 'activity',
    description: 'Free walking tour starts at 10am daily. Great for first-timers!',
    addedBy: 'Jessica T.',
  },
];

const categoryEmoji: Record<string, string> = {
  coffee: '☕',
  food: '🍽️',
  bar: '🍸',
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
  const spots = getMockSpots(name || '');

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ThemedText style={styles.backText}>← Back</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.title}>{name}</ThemedText>
        <ThemedText style={styles.subtitle}>
          {spots.length} crew-recommended spots
        </ThemedText>

        <View style={styles.categoryFilter}>
          {Object.entries(categoryEmoji).map(([cat, emoji]) => (
            <TouchableOpacity key={cat} style={styles.categoryChip}>
              <ThemedText style={styles.categoryChipText}>{emoji}</ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.spotsList}>
          {spots.map((spot) => (
            <View key={spot.id} style={styles.spotCard}>
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
                  </ThemedText>
                </View>
              </View>
              <ThemedText style={styles.spotDescription}>
                "{spot.description}"
              </ThemedText>
              <ThemedText style={styles.addedBy}>
                Added by {spot.addedBy}
              </ThemedText>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.addButton}>
          <ThemedText style={styles.addButtonText}>
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
  },
  backButton: {
    padding: 5,
  },
  backText: {
    color: '#2196F3',
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
    color: '#888',
    marginBottom: 20,
  },
  categoryFilter: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  categoryChip: {
    backgroundColor: '#333',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 20,
  },
  categoryChipText: {
    fontSize: 18,
  },
  spotsList: {
    gap: 15,
  },
  spotCard: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
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
  spotDescription: {
    fontSize: 15,
    fontStyle: 'italic',
    color: '#ccc',
    marginBottom: 10,
    lineHeight: 22,
  },
  addedBy: {
    fontSize: 12,
    color: '#2196F3',
  },
  addButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});