// app/profile/friend/[userId]/activities.tsx
// Shows filtered activities for a specific user

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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
  createdAt: any;
};

export default function UserActivitiesScreen() {
  const { userId, filter, userName } = useLocalSearchParams<{ 
    userId: string; 
    filter: string;
    userName: string;
  }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!userId || !filter) return;

      try {
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', userId),
          where('type', '==', filter),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(activitiesQuery);
        const fetchedActivities: Activity[] = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        } as Activity));

        setActivities(fetchedActivities);
      } catch (error) {
        console.error('Error fetching activities:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchActivities();
  }, [userId, filter]);

  const getTitle = () => {
    switch (filter) {
      case 'spot_added':
        return 'Spots Added';
      case 'photo_posted':
        return 'Photos Posted';
      case 'review_left':
        return 'Reviews Left';
      default:
        return 'Activity';
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
    let iconName: any = 'pin';
    let iconColor = Colors.primary;

    switch (item.type) {
      case 'spot_added':
        iconName = 'location';
        iconColor = Colors.primary;
        activityText = (
          <Text style={styles.activityText}>
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
        iconName = 'star';
        iconColor = '#FFD700';
        activityText = (
          <Text style={styles.activityText}>
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
        iconName = 'camera';
        iconColor = '#FF6B6B';
        activityText = (
          <Text style={styles.activityText}>
            {'Photo at '}
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
        <View style={styles.activityIcon}>
          <Ionicons name={iconName} size={24} color={iconColor} />
        </View>
        <View style={styles.activityContent}>
          {activityText}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.title}>{getTitle()}</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <ThemedText style={styles.title}>{getTitle()}</ThemedText>
          <ThemedText style={styles.subtitle}>{userName}</ThemedText>
        </View>
        <View style={{ width: 24 }} />
      </View>

      {/* Activities List */}
      {activities.length > 0 ? (
        <FlatList
          data={activities}
          renderItem={renderActivity}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.emptyTitle}>No {getTitle()}</ThemedText>
          <ThemedText style={styles.emptyText}>
            This user hasn't added any activities of this type yet.
          </ThemedText>
        </View>
      )}
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  listContent: {
    paddingHorizontal: 20,
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
  activityIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  emptyText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 24,
  },
});
