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
    Image,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

type Photo = {
  id: string;
  photoURL: string;
  spotId: string;
  spotName: string;
  city: string;
  createdAt: any;
};

export default function MyPhotosScreen() {
  const { user } = useAuth();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPhotos = async () => {
      if (!user) return;

      try {
        const allPhotos: Photo[] = [];

        // ===== 1. Get photos from user's REVIEWS =====
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('userId', '==', user.uid)
        );
        
        const reviewsSnapshot = await getDocs(reviewsQuery);
        
        for (const reviewDoc of reviewsSnapshot.docs) {
          const reviewData = reviewDoc.data();
          const reviewPhotos = reviewData.photos || [];
          
          // Get spot name and city
          let spotName = 'Unknown Spot';
          let spotCity = '';
          let spotId = reviewData.spotId;
          
          try {
            const spotDoc = await getDocs(
              query(collection(db, 'spots'), where('__name__', '==', reviewData.spotId))
            );
            if (!spotDoc.empty) {
              spotName = spotDoc.docs[0].data().name || 'Unknown Spot';
              spotCity = spotDoc.docs[0].data().city || '';
            }
          } catch (error) {
            console.error('Error fetching spot:', error);
          }
          
          // Add each photo from this review
          reviewPhotos.forEach((photoURL: string) => {
            allPhotos.push({
              id: `${reviewDoc.id}-${photoURL}`,
              photoURL: photoURL,
              spotId: spotId,
              spotName: spotName,
              city: spotCity,
              createdAt: reviewData.createdAt,
            });
          });
        }

        // ===== 2. Get photos from user's APPROVED SPOTS =====
        const spotsQuery = query(
          collection(db, 'spots'),
          where('addedBy', '==', user.uid),
          where('status', '==', 'approved')
        );
        
        const spotsSnapshot = await getDocs(spotsQuery);
        
        for (const spotDoc of spotsSnapshot.docs) {
          const spotData = spotDoc.data();
          const spotPhotos = spotData.photoURLs || spotData.photos || [];
          
          // Add each photo from this spot
          spotPhotos.forEach((photoURL: string) => {
            allPhotos.push({
              id: `${spotDoc.id}-${photoURL}`,
              photoURL: photoURL,
              spotId: spotDoc.id,
              spotName: spotData.name || 'Unknown Spot',
              city: spotData.city || '',
              createdAt: spotData.createdAt,
            });
          });
        }

        // Sort by date (newest first)
        allPhotos.sort((a, b) => {
          if (!a.createdAt || !b.createdAt) return 0;
          return b.createdAt.toMillis() - a.createdAt.toMillis();
        });

        setPhotos(allPhotos);
      } catch (error) {
        console.error('Error fetching photos:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [user]);

  const renderPhoto = ({ item }: { item: Photo }) => (
    <TouchableOpacity
      style={styles.photoCard}
      onPress={() => router.push({ pathname: '/spot/[id]', params: { id: item.spotId } })}
    >
      <Image source={{ uri: item.photoURL }} style={styles.photo} />
      <View style={styles.photoInfo}>
        <ThemedText style={styles.spotName} numberOfLines={1}>
          {item.spotName}
        </ThemedText>
        <View style={styles.locationRow}>
          <Ionicons name="location" size={14} color={Colors.text.secondary} />
          <ThemedText style={styles.cityText}>{item.city}</ThemedText>
        </View>
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
          <ThemedText style={styles.title}>My Photos</ThemedText>
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
        <ThemedText style={styles.title}>My Photos</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <FlatList
        data={photos}
        renderItem={renderPhoto}
        keyExtractor={(item) => item.id}
        numColumns={2}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={styles.row}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="camera-outline" size={80} color={Colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>No photos yet</ThemedText>
            <ThemedText style={styles.emptyText}>
              Photos you post to spots will appear here
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
  row: {
    gap: 12,
    marginBottom: 12,
  },
  photoCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  photo: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.background,
  },
  photoInfo: {
    padding: 12,
    gap: 4,
  },
  spotName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cityText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 100,
    paddingHorizontal: 40,
    width: '100%',
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