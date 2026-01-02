import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

type Review = {
  id: string;
  spotId: string;
  spotName: string;
  city: string;
  rating: number;
  createdAt: any;
};

export default function MyReviewsScreen() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReviews = async () => {
      if (!user) return;

      try {
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', user.uid),
          where('type', '==', 'review_left'),
          orderBy('createdAt', 'desc')
        );
        
        const activitiesSnapshot = await getDocs(activitiesQuery);
        const fetchedReviews: Review[] = [];

        activitiesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          fetchedReviews.push({
            id: doc.id,
            spotId: data.spotId,
            spotName: data.spotName,
            city: data.city,
            rating: data.rating,
            createdAt: data.createdAt,
          });
        });

        setReviews(fetchedReviews);
      } catch (error) {
        console.error('Error fetching reviews:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [user]);

  const renderStars = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  const renderReview = ({ item }: { item: Review }) => (
    <TouchableOpacity
      style={styles.reviewCard}
      onPress={() => router.push({ pathname: '/spot/[id]', params: { id: item.spotId } })}
    >
      <View style={styles.reviewHeader}>
        <View style={styles.reviewTitleContainer}>
          <ThemedText style={styles.spotName}>{item.spotName}</ThemedText>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color={Colors.text.secondary} />
            <ThemedText style={styles.cityText}>{item.city}</ThemedText>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
      </View>
      
      <View style={styles.ratingContainer}>
        <ThemedText style={styles.stars}>{renderStars(item.rating)}</ThemedText>
        <ThemedText style={styles.ratingText}>{item.rating}/5</ThemedText>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>My Reviews</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>My Reviews</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={reviews}
        renderItem={renderReview}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={80} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>No reviews yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Reviews you leave will appear here
            </ThemedText>
          </View>
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  reviewCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  reviewTitleContainer: {
    flex: 1,
    gap: 6,
  },
  spotName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  stars: {
    fontSize: 20,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.accent,
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
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});