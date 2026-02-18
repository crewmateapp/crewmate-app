// app/my-reviews.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    collection,
    deleteDoc,
    doc,
    getDocs,
    increment,
    onSnapshot,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    StyleSheet,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

type Review = {
  id: string;
  spotId: string;
  spotName: string;
  city: string;
  rating: number;
  reviewText: string;
  photos: string[];
  createdAt: any;
  updatedAt: any;
};

export default function MyReviewsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState<string>('');

  useEffect(() => {
    if (!user) return;

    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(reviewsQuery, async (snapshot) => {
      const fetchedReviews: Review[] = [];

      for (const reviewDoc of snapshot.docs) {
        const reviewData = reviewDoc.data();
        
        // Fetch spot name from spots collection
        let spotName = 'Unknown Spot';
        let spotCity = '';
        
        try {
          const spotDoc = await getDocs(
            query(collection(db, 'spots'), where('__name__', '==', reviewData.spotId))
          );
          
          if (!spotDoc.empty) {
            const spotData = spotDoc.docs[0].data();
            spotName = spotData.name || 'Unknown Spot';
            spotCity = spotData.city || '';
          }
        } catch (error) {
          console.error('Error fetching spot:', error);
        }

        fetchedReviews.push({
          id: reviewDoc.id,
          spotId: reviewData.spotId,
          spotName,
          city: spotCity,
          rating: reviewData.rating,
          reviewText: reviewData.reviewText,
          photos: reviewData.photos || [],
          createdAt: reviewData.createdAt,
          updatedAt: reviewData.updatedAt,
        });
      }

      // Sort by creation date (newest first)
      fetchedReviews.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setReviews(fetchedReviews);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleDeleteReview = (review: Review) => {
    Alert.alert(
      'Delete Review',
      `Delete your review of ${review.spotName}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'reviews', review.id));
              
              // Decrement user's reviewsWritten stat (and photos if applicable)
              await updateDoc(doc(db, 'users', user!.uid), {
                'stats.reviewsWritten': increment(-1),
                // Also decrement photosUploaded if the review had photos
                ...(review.photos.length > 0 && {
                  'stats.photosUploaded': increment(-review.photos.length)
                })
              });
              
              // Also delete the activity
              const activitiesQuery = query(
                collection(db, 'activities'),
                where('userId', '==', user!.uid),
                where('spotId', '==', review.spotId),
                where('type', '==', 'review_left')
              );
              
              const activitiesSnapshot = await getDocs(activitiesQuery);
              for (const activityDoc of activitiesSnapshot.docs) {
                await deleteDoc(doc(db, 'activities', activityDoc.id));
              }
              
              Alert.alert('Deleted', 'Your review has been deleted.');
            } catch (error) {
              console.error('Error deleting review:', error);
              Alert.alert('Error', 'Could not delete review. Please try again.');
            }
          }
        }
      ]
    );
  };

  const handleEditReview = (review: Review) => {
    // TODO: Navigate to edit review screen when it's built
    Alert.alert(
      'Edit Review',
      'Review editing feature coming soon! For now, you can delete and create a new review.',
      [{ text: 'OK' }]
    );
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter reviews based on search query
  const filteredReviews = reviews.filter(review => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase().trim();
    return (
      review.spotName.toLowerCase().includes(query) ||
      review.city.toLowerCase().includes(query) ||
      review.reviewText.toLowerCase().includes(query)
    );
  });

  const renderReview = ({ item }: { item: Review }) => (
    <View style={[styles.reviewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Review Header */}
      <TouchableOpacity
        style={styles.reviewHeader}
        onPress={() => router.push({ pathname: '/spot/[id]', params: { id: item.spotId } })}
        activeOpacity={0.7}
      >
        <View style={styles.reviewTitleContainer}>
          <ThemedText style={styles.spotName}>{item.spotName}</ThemedText>
          {item.city && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={colors.text.secondary} />
              <ThemedText style={[styles.cityText, { color: colors.text.secondary }]}>
                {item.city}
              </ThemedText>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
      </TouchableOpacity>

      {/* Rating */}
      <View style={styles.ratingContainer}>
        <ThemedText style={styles.stars}>{renderStars(item.rating)}</ThemedText>
        <ThemedText style={[styles.ratingText, { color: colors.accent }]}>
          {item.rating}/5
        </ThemedText>
      </View>

      {/* Review Text */}
      <ThemedText style={[styles.reviewText, { color: colors.text.primary }]}>
        {item.reviewText}
      </ThemedText>

      {/* Review Photos */}
      {item.photos && item.photos.length > 0 && (
        <View style={styles.photosContainer}>
          {item.photos.slice(0, 3).map((photo, index) => (
            <TouchableOpacity
              key={index}
              onPress={() => router.push({
                pathname: '/photo-viewer',
                params: {
                  photos: JSON.stringify(item.photos),
                  initialIndex: index
                }
              })}
              activeOpacity={0.8}
            >
              <Image source={{ uri: photo }} style={styles.reviewPhoto} />
            </TouchableOpacity>
          ))}
          {item.photos.length > 3 && (
            <TouchableOpacity
              onPress={() => router.push({
                pathname: '/photo-viewer',
                params: {
                  photos: JSON.stringify(item.photos),
                  initialIndex: 3
                }
              })}
              activeOpacity={0.8}
            >
              <View style={[styles.morePhotos, { backgroundColor: colors.border }]}>
                <ThemedText style={styles.morePhotosText}>+{item.photos.length - 3}</ThemedText>
              </View>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Review Date */}
      <ThemedText style={[styles.reviewDate, { color: colors.text.secondary }]}>
        {formatDate(item.createdAt)}
      </ThemedText>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.border }]}
          onPress={() => handleEditReview(item)}
        >
          <Ionicons name="pencil" size={16} color={colors.text.primary} />
          <ThemedText style={styles.actionButtonText}>Edit</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, { borderColor: colors.error }]}
          onPress={() => handleDeleteReview(item)}
        >
          <Ionicons name="trash" size={16} color={colors.error} />
          <ThemedText style={[styles.actionButtonText, { color: colors.error }]}>Delete</ThemedText>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>My Reviews</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.title}>My Reviews</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      {reviews.length > 0 && (
        <View style={[styles.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.text.secondary} style={styles.searchIcon} />
          <TextInput
            style={[styles.searchInput, { color: colors.text.primary }]}
            placeholder="Search reviews..."
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
      )}

      {/* Review Count */}
      {reviews.length > 0 && (
        <View style={styles.countContainer}>
          <ThemedText style={[styles.countText, { color: colors.text.secondary }]}>
            {searchQuery.trim() ? `${filteredReviews.length} of ${reviews.length}` : reviews.length} {reviews.length === 1 ? 'review' : 'reviews'}
          </ThemedText>
        </View>
      )}

      {/* Reviews List */}
      <FlatList
        data={filteredReviews}
        renderItem={renderReview}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="star-outline" size={80} color={colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>No reviews yet</ThemedText>
            <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
              Visit spots and leave reviews to help other crew members!
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
  title: {
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
  countContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  countText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  reviewCard: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
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
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityText: {
    fontSize: 14,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  stars: {
    fontSize: 20,
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
  },
  reviewText: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 12,
  },
  photosContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  reviewPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  morePhotos: {
    width: 80,
    height: 80,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  morePhotosText: {
    fontSize: 16,
    fontWeight: '700',
  },
  reviewDate: {
    fontSize: 13,
    marginBottom: 12,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  actionButtonText: {
    fontSize: 14,
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
  },
});
