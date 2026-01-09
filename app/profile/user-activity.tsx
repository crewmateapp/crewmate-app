// app/profile/user-activity.tsx
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
  orderBy,
  query,
  where,
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type ActivityType = 'spots' | 'reviews' | 'photos';

type SpotItem = {
  id: string;
  spotId: string;
  spotName: string;
  city: string;
  createdAt: any;
};

type ReviewItem = {
  id: string;
  spotId: string;
  spotName: string;
  city: string;
  rating: number;
  reviewText?: string;
  createdAt: any;
};

type PhotoItem = {
  id: string;
  spotId: string;
  spotName: string;
  city: string;
  photoURL?: string;
  createdAt: any;
};

export default function UserActivityScreen() {
  const { userId, userName, type } = useLocalSearchParams<{ 
    userId: string; 
    userName: string;
    type: ActivityType;
  }>();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<(SpotItem | ReviewItem | PhotoItem)[]>([]);

  const getTitle = () => {
    switch (type) {
      case 'spots': return `${userName}'s Spots`;
      case 'reviews': return `${userName}'s Reviews`;
      case 'photos': return `${userName}'s Photos`;
      default: return 'Activity';
    }
  };

  const getEmptyMessage = () => {
    switch (type) {
      case 'spots': return "No spots added yet";
      case 'reviews': return "No reviews written yet";
      case 'photos': return "No photos posted yet";
      default: return "No activity yet";
    }
  };

  const getEmptyIcon = () => {
    switch (type) {
      case 'spots': return 'location-outline';
      case 'reviews': return 'star-outline';
      case 'photos': return 'camera-outline';
      default: return 'list-outline';
    }
  };

  useEffect(() => {
    if (!userId || !type) return;

    const loadData = async () => {
      try {
        let activityType: string;
        switch (type) {
          case 'spots': activityType = 'spot_added'; break;
          case 'reviews': activityType = 'review_left'; break;
          case 'photos': activityType = 'photo_posted'; break;
          default: return;
        }

        const activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', userId),
          where('type', '==', activityType),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(activitiesQuery);
        const loadedItems: (SpotItem | ReviewItem | PhotoItem)[] = [];

        for (const docSnap of snapshot.docs) {
          const data = docSnap.data();
          
          // For reviews, try to get the full review text
          if (type === 'reviews' && data.spotId) {
            const reviewQuery = query(
              collection(db, 'reviews'),
              where('spotId', '==', data.spotId),
              where('userId', '==', userId)
            );
            const reviewSnapshot = await getDocs(reviewQuery);
            const reviewData = reviewSnapshot.docs[0]?.data();
            
            loadedItems.push({
              id: docSnap.id,
              spotId: data.spotId,
              spotName: data.spotName || 'Unknown Spot',
              city: data.city || 'Unknown',
              rating: data.rating || reviewData?.rating || 0,
              reviewText: reviewData?.reviewText || '',
              createdAt: data.createdAt,
            } as ReviewItem);
          } else {
            loadedItems.push({
              id: docSnap.id,
              spotId: data.spotId,
              spotName: data.spotName || 'Unknown Spot',
              city: data.city || 'Unknown',
              photoURL: data.photoURL,
              createdAt: data.createdAt,
            });
          }
        }

        setItems(loadedItems);
      } catch (error) {
        console.error('Error loading activity:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId, type]);

  const handleSpotPress = (spotId: string) => {
    router.push({
      pathname: '/spot/[id]',
      params: { id: spotId },
    });
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderStars = (rating: number) => {
    return (
      <View style={styles.starsContainer}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Ionicons
            key={star}
            name={star <= rating ? 'star' : 'star-outline'}
            size={16}
            color={star <= rating ? Colors.accent : Colors.text.secondary}
          />
        ))}
      </View>
    );
  };

  const renderSpotItem = ({ item }: { item: SpotItem }) => (
    <TouchableOpacity 
      style={styles.itemCard}
      onPress={() => handleSpotPress(item.spotId)}
      activeOpacity={0.7}
    >
      <View style={styles.itemIcon}>
        <Ionicons name="location" size={24} color={Colors.primary} />
      </View>
      <View style={styles.itemContent}>
        <ThemedText style={styles.itemTitle}>{item.spotName}</ThemedText>
        <ThemedText style={styles.itemSubtitle}>{item.city}</ThemedText>
        <ThemedText style={styles.itemDate}>{formatDate(item.createdAt)}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
    </TouchableOpacity>
  );

  const renderReviewItem = ({ item }: { item: ReviewItem }) => (
    <TouchableOpacity 
      style={styles.itemCard}
      onPress={() => handleSpotPress(item.spotId)}
      activeOpacity={0.7}
    >
      <View style={[styles.itemIcon, { backgroundColor: Colors.accent + '20' }]}>
        <Ionicons name="star" size={24} color={Colors.accent} />
      </View>
      <View style={styles.itemContent}>
        <ThemedText style={styles.itemTitle}>{item.spotName}</ThemedText>
        <View style={styles.ratingRow}>
          {renderStars(item.rating)}
          <ThemedText style={styles.itemCity}>{item.city}</ThemedText>
        </View>
        {item.reviewText && (
          <ThemedText style={styles.reviewText} numberOfLines={2}>
            "{item.reviewText}"
          </ThemedText>
        )}
        <ThemedText style={styles.itemDate}>{formatDate(item.createdAt)}</ThemedText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
    </TouchableOpacity>
  );

  const renderPhotoItem = ({ item }: { item: PhotoItem }) => (
    <TouchableOpacity 
      style={styles.photoCard}
      onPress={() => handleSpotPress(item.spotId)}
      activeOpacity={0.7}
    >
      {item.photoURL ? (
        <Image source={{ uri: item.photoURL }} style={styles.photoImage} />
      ) : (
        <View style={styles.photoPlaceholder}>
          <Ionicons name="image-outline" size={40} color={Colors.text.secondary} />
        </View>
      )}
      <View style={styles.photoOverlay}>
        <ThemedText style={styles.photoTitle}>{item.spotName}</ThemedText>
        <ThemedText style={styles.photoCity}>{item.city}</ThemedText>
      </View>
    </TouchableOpacity>
  );

  const renderItem = ({ item }: { item: SpotItem | ReviewItem | PhotoItem }) => {
    switch (type) {
      case 'spots': return renderSpotItem({ item: item as SpotItem });
      case 'reviews': return renderReviewItem({ item: item as ReviewItem });
      case 'photos': return renderPhotoItem({ item: item as PhotoItem });
      default: return null;
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>{getTitle()}</ThemedText>
          <View style={styles.placeholder} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>{getTitle()}</ThemedText>
        <View style={styles.placeholder} />
      </View>

      {/* Content */}
      {items.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name={getEmptyIcon() as any} size={60} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyText}>{getEmptyMessage()}</ThemedText>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            type === 'photos' && styles.photoGrid
          ]}
          numColumns={type === 'photos' ? 2 : 1}
          key={type} // Force re-render when type changes
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.background,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  placeholder: {
    width: 32,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    gap: 16,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
  },
  // Spot and Review item styles
  itemCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  itemIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemContent: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  itemSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  itemCity: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  itemDate: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starsContainer: {
    flexDirection: 'row',
    gap: 2,
  },
  reviewText: {
    fontSize: 14,
    color: Colors.text.primary,
    fontStyle: 'italic',
    marginTop: 4,
    lineHeight: 20,
  },
  // Photo grid styles
  photoGrid: {
    paddingHorizontal: 12,
  },
  photoCard: {
    flex: 1,
    margin: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: Colors.card,
    aspectRatio: 1,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    padding: 8,
  },
  photoTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  photoCity: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
  },
});
