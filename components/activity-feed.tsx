import { ThemedText } from '@/components/themed-text';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View
} from 'react-native';

type Activity = {
  id: string;
  type: 'spot_added' | 'review_left' | 'photo_posted';
  userId: string;
  userName: string;
  userPhoto?: string;
  spotId?: string;
  spotName?: string;
  city?: string;
  rating?: number;
  photoURL?: string;
  createdAt: any;
};

export default function ActivityFeed() {
  const { user } = useAuth();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const activitiesQuery = query(
      collection(db, 'activities'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      const fetchedActivities: Activity[] = [];
      snapshot.docs.forEach(doc => {
        fetchedActivities.push({
          id: doc.id,
          ...doc.data(),
        } as Activity);
      });
      setActivities(fetchedActivities);
      setLoading(false);
      setRefreshing(false);
    });

    return () => unsubscribe();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
  };

  const handleUserPress = async (userId: string) => {
    if (!user) return;

    // If clicking own name, go to profile tab
    if (userId === user.uid) {
      router.push('/(tabs)/profile');
      return;
    }

    // Check if connected
    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );
    const connectionsSnapshot = await getDocs(connectionsQuery);
    const isConnected = connectionsSnapshot.docs.some(doc => {
      const data = doc.data();
      return data.userIds.includes(userId);
    });

    if (isConnected) {
      router.push({
        pathname: '/profile/friend/[userId]',
        params: { userId }
      });
    } else {
      router.push({
        pathname: '/profile/[userId]',
        params: { userId }
      });
    }
  };

  const handleSpotPress = (spotId: string) => {
    router.push({
      pathname: '/spot/[id]',
      params: { id: spotId }
    });
  };

  const handleCityPress = (city: string) => {
    router.push('/explore');
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  const renderActivity = ({ item }: { item: Activity }) => {
    let activityText;
    
    switch (item.type) {
      case 'spot_added':
        activityText = (
          <Text style={styles.activityText}>
            <Text 
              style={styles.clickableText}
              onPress={() => handleUserPress(item.userId)}
            >
              {item.userName}
            </Text>
            {' added '}
            <Text 
              style={styles.clickableText}
              onPress={() => item.spotId && handleSpotPress(item.spotId)}
            >
              {item.spotName}
            </Text>
            {' in '}
            <Text 
              style={styles.clickableText}
              onPress={() => item.city && handleCityPress(item.city)}
            >
              {item.city}
            </Text>
          </Text>
        );
        break;
      
      case 'review_left':
        activityText = (
          <Text style={styles.activityText}>
            <Text 
              style={styles.clickableText}
              onPress={() => handleUserPress(item.userId)}
            >
              {item.userName}
            </Text>
            {' left a '}
            <Text style={styles.stars}>{renderStars(item.rating || 0)}</Text>
            {' review on '}
            <Text 
              style={styles.clickableText}
              onPress={() => item.spotId && handleSpotPress(item.spotId)}
            >
              {item.spotName}
            </Text>
            {' in '}
            <Text 
              style={styles.clickableText}
              onPress={() => item.city && handleCityPress(item.city)}
            >
              {item.city}
            </Text>
          </Text>
        );
        break;
      
      case 'photo_posted':
        activityText = (
          <Text style={styles.activityText}>
            <Text 
              style={styles.clickableText}
              onPress={() => handleUserPress(item.userId)}
            >
              {item.userName}
            </Text>
            {' posted a photo at '}
            <Text 
              style={styles.clickableText}
              onPress={() => item.spotId && handleSpotPress(item.spotId)}
            >
              {item.spotName}
            </Text>
            {' in '}
            <Text 
              style={styles.clickableText}
              onPress={() => item.city && handleCityPress(item.city)}
            >
              {item.city}
            </Text>
          </Text>
        );
        break;
    }

    return (
      <View style={styles.activityCard}>
        <View style={styles.iconContainer}>
          {item.type === 'spot_added' && (
            <Ionicons name="add-circle" size={20} color={Colors.success} />
          )}
          {item.type === 'review_left' && (
            <Ionicons name="star" size={20} color={Colors.accent} />
          )}
          {item.type === 'photo_posted' && (
            <Ionicons name="camera" size={20} color={Colors.primary} />
          )}
        </View>
        <View style={styles.activityContent}>
          {activityText}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      renderItem={renderActivity}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
      ListEmptyComponent={
        <View style={styles.emptyState}>
          <Ionicons name="pulse-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyTitle}>No activity yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Activity from crew members will appear here
          </ThemedText>
        </View>
      }
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  activityCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    marginRight: 12,
    paddingTop: 2,
  },
  activityContent: {
    flex: 1,
  },
  activityText: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.text.primary,
  },
  clickableText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  stars: {
    fontSize: 14,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});