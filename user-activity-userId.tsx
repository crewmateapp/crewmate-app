// app/user-activity/[userId].tsx
// Modal showing user's spots, photos, or reviews
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

type SpotItem = {
  id: string;
  name: string;
  city: string;
  area?: string;
  category: string;
  photoURLs?: string[];
  addedAt: Date;
};

type ReviewItem = {
  spotId: string;
  spotName: string;
  city: string;
  vote: number;
  createdAt: Date;
};

type ActivityType = 'spots' | 'photos' | 'reviews';

export default function UserActivityModal() {
  const { userId, type, userName } = useLocalSearchParams<{
    userId: string;
    type: string;
    userName?: string;
  }>();
  
  const [loading, setLoading] = useState(true);
  const [spots, setSpots] = useState<SpotItem[]>([]);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const activityType = type as ActivityType;

  useEffect(() => {
    loadData();
  }, [userId, type]);

  const loadData = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      if (activityType === 'spots') {
        await loadSpots(false);
      } else if (activityType === 'photos') {
        await loadSpots(true);
      } else if (activityType === 'reviews') {
        await loadReviews();
      }
    } catch (error) {
      console.error('Error loading activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpots = async (photosOnly: boolean) => {
    const spotsQuery = query(
      collection(db, 'spots'),
      where('addedBy', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const spotsSnapshot = await getDocs(spotsQuery);

    const spotsList: SpotItem[] = [];
    spotsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      
      // If photos only, filter for spots with photos
      if (photosOnly) {
        const hasPhotos = data.photoURL || 
          (data.photoURLs && data.photoURLs.length > 0) || 
          (data.photos && data.photos.length > 0);
        if (!hasPhotos) return;
      }

      spotsList.push({
        id: doc.id,
        name: data.name,
        city: data.city,
        area: data.area,
        category: data.category,
        photoURLs: data.photoURLs || (data.photoURL ? [data.photoURL] : []),
        addedAt: data.createdAt?.toDate() || new Date(),
      });
    });

    setSpots(spotsList);
  };

  const loadReviews = async () => {
    const votesQuery = query(
      collection(db, 'votes'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );
    const votesSnapshot = await getDocs(votesQuery);

    const reviewsList: ReviewItem[] = [];
    
    // Get spot details for each vote
    for (const voteDoc of votesSnapshot.docs) {
      const voteData = voteDoc.data();
      
      try {
        const spotDoc = await getDoc(doc(db, 'spots', voteData.spotId));
        if (spotDoc.exists()) {
          const spotData = spotDoc.data();
          reviewsList.push({
            spotId: voteData.spotId,
            spotName: spotData.name,
            city: spotData.city,
            vote: voteData.vote,
            createdAt: voteData.createdAt?.toDate() || new Date(),
          });
        }
      } catch (error) {
        console.error('Error loading spot for review:', error);
      }
    }

    setReviews(reviewsList);
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'food': return 'restaurant';
      case 'coffee': return 'cafe';
      case 'bar': return 'beer';
      case 'activities': return 'bicycle';
      case 'shopping': return 'cart';
      case 'services': return 'construct';
      default: return 'location';
    }
  };

  const getTitle = () => {
    const name = userName || 'User';
    switch (activityType) {
      case 'spots': return `${name}'s Spots`;
      case 'photos': return `${name}'s Photos`;
      case 'reviews': return `${name}'s Reviews`;
      default: return 'Activity';
    }
  };

  const renderSpotItem = ({ item }: { item: SpotItem }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => {
        router.back();
        router.push({ pathname: '/spot/[id]', params: { id: item.id } });
      }}
    >
      {item.photoURLs && item.photoURLs.length > 0 ? (
        <Image source={{ uri: item.photoURLs[0] }} style={styles.itemImage} />
      ) : (
        <View style={[styles.itemImage, styles.itemImagePlaceholder]}>
          <Ionicons name={getCategoryIcon(item.category)} size={32} color={Colors.text.secondary} />
        </View>
      )}
      
      <View style={styles.itemInfo}>
        <ThemedText style={styles.itemName} numberOfLines={1}>
          {item.name}
        </ThemedText>
        <View style={styles.itemLocation}>
          <Ionicons name="location-outline" size={14} color={Colors.text.secondary} />
          <ThemedText style={styles.itemLocationText} numberOfLines={1}>
            {item.area ? `${item.area}, ${item.city}` : item.city}
          </ThemedText>
        </View>
        {activityType === 'photos' && item.photoURLs && (
          <View style={styles.photoCount}>
            <Ionicons name="images" size={14} color={Colors.primary} />
            <ThemedText style={styles.photoCountText}>
              {item.photoURLs.length} {item.photoURLs.length === 1 ? 'photo' : 'photos'}
            </ThemedText>
          </View>
        )}
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
    </TouchableOpacity>
  );

  const renderReviewItem = ({ item }: { item: ReviewItem }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => {
        router.back();
        router.push({ pathname: '/spot/[id]', params: { id: item.spotId } });
      }}
    >
      <View style={styles.reviewRating}>
        <ThemedText style={styles.reviewRatingText}>{item.vote}</ThemedText>
        <Ionicons name="star" size={16} color={Colors.warning} />
      </View>
      
      <View style={styles.itemInfo}>
        <ThemedText style={styles.itemName} numberOfLines={1}>
          {item.spotName}
        </ThemedText>
        <View style={styles.itemLocation}>
          <Ionicons name="location-outline" size={14} color={Colors.text.secondary} />
          <ThemedText style={styles.itemLocationText} numberOfLines={1}>
            {item.city}
          </ThemedText>
        </View>
        <ThemedText style={styles.reviewDate}>
          {item.createdAt.toLocaleDateString()}
        </ThemedText>
      </View>
      
      <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
            <Ionicons name="close" size={28} color={Colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>{getTitle()}</ThemedText>
          <View style={{ width: 28 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </ThemedView>
    );
  }

  const data = activityType === 'reviews' ? reviews : spots;
  const isEmpty = data.length === 0;

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{getTitle()}</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      {/* Content */}
      {isEmpty ? (
        <View style={styles.emptyState}>
          <Ionicons 
            name={activityType === 'reviews' ? 'star-outline' : 'location-outline'} 
            size={64} 
            color={Colors.text.secondary} 
          />
          <ThemedText style={styles.emptyTitle}>
            No {activityType === 'reviews' ? 'reviews' : activityType} yet
          </ThemedText>
          <ThemedText style={styles.emptyText}>
            {activityType === 'reviews' 
              ? "They haven't reviewed any spots yet"
              : activityType === 'photos'
              ? "They haven't added photos to any spots yet"
              : "They haven't added any spots yet"}
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item, index) => `${activityType}-${index}`}
          renderItem={activityType === 'reviews' ? renderReviewItem : renderSpotItem}
          contentContainerStyle={styles.listContent}
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
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 20,
    paddingBottom: 40,
  },
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  itemImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  itemImagePlaceholder: {
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
    gap: 4,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
  },
  itemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  itemLocationText: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  photoCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  photoCountText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  reviewRating: {
    width: 60,
    height: 60,
    borderRadius: 8,
    backgroundColor: Colors.warning + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    gap: 2,
  },
  reviewRatingText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.warning,
  },
  reviewDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
