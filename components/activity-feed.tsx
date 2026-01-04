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
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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
  const [connectionIds, setConnectionIds] = useState<string[]>([]);
  const [hasConnections, setHasConnections] = useState(false);

  // Fetch user's connections first
  useEffect(() => {
    if (!user) return;

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(connectionsQuery, (snapshot) => {
      const ids: string[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        // Get the OTHER user's ID (not the current user)
        const otherUserId = data.userIds.find((id: string) => id !== user.uid);
        if (otherUserId) {
          ids.push(otherUserId);
        }
      });
      setConnectionIds(ids);
      setHasConnections(ids.length > 0);
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch activities from connections only
  useEffect(() => {
    if (!user || connectionIds.length === 0) {
      setActivities([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    // Firestore 'in' queries have a limit of 10 items
    // If user has more than 10 connections, we'll need to batch
    const batchSize = 10;
    const batches: string[][] = [];
    
    for (let i = 0; i < connectionIds.length; i += batchSize) {
      batches.push(connectionIds.slice(i, i + batchSize));
    }

    // If only one batch, use simple query
    if (batches.length === 1) {
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('userId', 'in', batches[0]),
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
    } else {
      // Multiple batches - need to fetch separately and combine
      const fetchActivities = async () => {
        const allActivities: Activity[] = [];
        
        for (const batch of batches) {
          const activitiesQuery = query(
            collection(db, 'activities'),
            where('userId', 'in', batch),
            orderBy('createdAt', 'desc'),
            limit(50)
          );
          
          const snapshot = await getDocs(activitiesQuery);
          snapshot.docs.forEach(doc => {
            allActivities.push({
              id: doc.id,
              ...doc.data(),
            } as Activity);
          });
        }
        
        // Sort combined results by createdAt
        allActivities.sort((a, b) => b.createdAt - a.createdAt);
        setActivities(allActivities.slice(0, 50)); // Keep only top 50
        setLoading(false);
        setRefreshing(false);
      };

      fetchActivities();
    }
  }, [user, connectionIds]);

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
        <TouchableOpacity onPress={() => handleUserPress(item.userId)}>
          {item.userPhoto ? (
            <Image source={{ uri: item.userPhoto }} style={styles.activityAvatar} />
          ) : (
            <View style={styles.activityAvatarFallback}>
              <ThemedText style={styles.activityAvatarText}>
                {item.userName.slice(0, 2).toUpperCase()}
              </ThemedText>
            </View>
          )}
        </TouchableOpacity>
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

  // Empty state when user has NO connections
  if (!hasConnections) {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="people-outline" size={80} color={Colors.text.secondary} />
        <ThemedText style={styles.emptyTitle}>Connect with Crew</ThemedText>
        <ThemedText style={styles.emptyText}>
          Activity from your connections will appear here. Start connecting with crew to see what they're up to!
        </ThemedText>
        <TouchableOpacity 
          style={styles.connectButton}
          onPress={() => router.push('/(tabs)/')}
        >
          <Ionicons name="people" size={20} color={Colors.white} />
          <ThemedText style={styles.connectButtonText}>Find Crew</ThemedText>
        </TouchableOpacity>
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
          <ThemedText style={styles.emptyTitle}>No Activity Yet</ThemedText>
          <ThemedText style={styles.emptyText}>
            Your connections haven't posted any activity yet. Check back later!
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
    gap: 12,
  },
  activityAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  activityAvatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: Colors.white,
  },
  activityContent: {
    flex: 1,
    justifyContent: 'center',
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
    color: Colors.text.primary,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 30,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  connectButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
