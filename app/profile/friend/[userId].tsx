import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type UserProfile = {
  firstName: string;
  lastInitial: string;
  displayName: string;
  airline: string;
  base: string;
  bio: string;
  photoURL?: string;
};

type UserStats = {
  spotsAdded: number;
  photosPosted: number;
  reviewsLeft: number;
};

type Activity = {
  id: string;
  type: 'spot_added' | 'review_left' | 'photo_posted';
  spotId?: string;
  spotName?: string;
  city?: string;
  rating?: number;
  createdAt: any;
};

export default function FriendProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stats, setStats] = useState<UserStats>({ spotsAdded: 0, photosPosted: 0, reviewsLeft: 0 });
  const [loading, setLoading] = useState(true);
  const [connectionDocId, setConnectionDocId] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);

  useEffect(() => {
    const loadProfileAndStats = async () => {
      if (!userId) return;

      try {
        // Get user profile
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }

        // Get connection doc
        const connectionsQuery = query(
          collection(db, 'connections'),
          where('userIds', 'array-contains', user?.uid)
        );
        const connectionsSnapshot = await getDocs(connectionsQuery);
        
        const connection = connectionsSnapshot.docs.find(doc => {
          const data = doc.data();
          return data.userIds.includes(userId);
        });

        if (connection) {
          setConnectionDocId(connection.id);
        }

        // Get user stats
        const spotsQuery = query(
          collection(db, 'spots'),
          where('addedBy', '==', userId)
        );
        const spotsSnapshot = await getDocs(spotsQuery);
        
        const votesQuery = query(
          collection(db, 'votes'),
          where('userId', '==', userId)
        );
        const votesSnapshot = await getDocs(votesQuery);

        const spotsWithPhotos = spotsSnapshot.docs.filter(doc => {
          const data = doc.data();
          return data.photoURL || (data.photos && data.photos.length > 0);
        });

        setStats({
          spotsAdded: spotsSnapshot.size,
          photosPosted: spotsWithPhotos.length,
          reviewsLeft: votesSnapshot.size,
        });

        // Get recent activities
        const activitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(5)
        );
        const activitiesSnapshot = await getDocs(activitiesQuery);
        
        const activities: Activity[] = [];
        activitiesSnapshot.docs.forEach(doc => {
          activities.push({
            id: doc.id,
            ...doc.data(),
          } as Activity);
        });
        setRecentActivities(activities);

      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setLoading(false);
      }
    };

    loadProfileAndStats();
  }, [userId, user]);

  const handleMessage = () => {
    if (!connectionDocId) return;
    router.push({
      pathname: '/chat/[id]',
      params: { id: connectionDocId, name: profile?.displayName }
    });
  };

  const handleRemoveConnection = () => {
    if (!connectionDocId) return;

    Alert.alert(
      'Remove Connection',
      `Remove ${profile?.displayName} from your connections? You can always reconnect later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'connections', connectionDocId));
              Alert.alert('Removed', `${profile?.displayName} has been removed from your connections.`, [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('Error removing connection:', error);
              Alert.alert('Error', 'Failed to remove connection. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleBlockUser = () => {
    Alert.alert(
      'Block User',
      `Block ${profile?.displayName}? They won't be able to see you in searches or send you connection requests. This will also remove your connection.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            try {
              await addDoc(collection(db, 'blockedUsers'), {
                blockerId: user?.uid,
                blockedUserId: userId,
                blockedUserName: profile?.displayName,
                createdAt: serverTimestamp(),
              });

              if (connectionDocId) {
                await deleteDoc(doc(db, 'connections', connectionDocId));
              }

              Alert.alert('Blocked', `${profile?.displayName} has been blocked.`, [
                { text: 'OK', onPress: () => router.back() }
              ]);
            } catch (error) {
              console.error('Error blocking user:', error);
              Alert.alert('Error', 'Failed to block user. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSpotPress = (spotId: string) => {
    router.push({
      pathname: '/spot/[id]',
      params: { id: spotId }
    });
  };

  const renderStars = (rating: number) => {
    return '⭐'.repeat(rating);
  };

  const renderActivity = (activity: Activity) => {
    let activityText;
    let icon;
    let iconColor;

    switch (activity.type) {
      case 'spot_added':
        icon = 'add-circle';
        iconColor = Colors.success;
        activityText = (
          <Text style={styles.activityText}>
            {'Added '}
            <Text 
              style={styles.clickableText}
              onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
            >
              {activity.spotName}
            </Text>
            {' in '}
            <Text style={styles.clickableText}>{activity.city}</Text>
          </Text>
        );
        break;
      
      case 'review_left':
        icon = 'star';
        iconColor = Colors.accent;
        activityText = (
          <Text style={styles.activityText}>
            {'Left a '}
            <Text style={styles.stars}>{renderStars(activity.rating || 0)}</Text>
            {' review on '}
            <Text 
              style={styles.clickableText}
              onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
            >
              {activity.spotName}
            </Text>
          </Text>
        );
        break;
      
      case 'photo_posted':
        icon = 'camera';
        iconColor = Colors.primary;
        activityText = (
          <Text style={styles.activityText}>
            {'Posted a photo at '}
            <Text 
              style={styles.clickableText}
              onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
            >
              {activity.spotName}
            </Text>
          </Text>
        );
        break;
    }

    return (
      <View key={activity.id} style={styles.activityItem}>
        <Ionicons name={icon as any} size={18} color={iconColor} />
        <View style={styles.activityTextContainer}>
          {activityText}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  if (!profile) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={80} color={Colors.text.secondary} />
          <ThemedText style={styles.errorText}>User not found</ThemedText>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ThemedText style={styles.backButtonText}>Go Back</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer}>
      <ThemedView style={styles.container}>
        {/* Header */}
        <TouchableOpacity 
          style={styles.closeButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>

        {/* Profile Info */}
        <View style={styles.header}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <ThemedText style={styles.avatarText}>
                {profile.firstName?.[0]}{profile.lastInitial}
              </ThemedText>
            </View>
          )}

          <ThemedText type="title" style={styles.name}>
            {profile.displayName}
          </ThemedText>
          <ThemedText style={styles.airline}>
            {profile.airline}
          </ThemedText>
          <ThemedText style={styles.base}>
            📍 Based in {profile.base}
          </ThemedText>
        </View>

        {/* Bio */}
        {profile.bio ? (
          <View style={styles.bioContainer}>
            <ThemedText style={styles.bio}>"{profile.bio}"</ThemedText>
          </View>
        ) : null}

        {/* Stats Section */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{stats.spotsAdded}</ThemedText>
            <ThemedText style={styles.statLabel}>Spots Added</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{stats.photosPosted}</ThemedText>
            <ThemedText style={styles.statLabel}>Photos Posted</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{stats.reviewsLeft}</ThemedText>
            <ThemedText style={styles.statLabel}>Reviews Left</ThemedText>
          </View>
        </View>

        {/* Recent Activity Section */}
        {recentActivities.length > 0 && (
          <View style={styles.activitySection}>
            <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
            <View style={styles.activityContainer}>
              {recentActivities.map(activity => renderActivity(activity))}
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <TouchableOpacity style={styles.messageButton} onPress={handleMessage}>
          <Ionicons name="chatbubble" size={20} color={Colors.white} />
          <ThemedText style={styles.messageButtonText}>Send Message</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.removeButton} onPress={handleRemoveConnection}>
          <Ionicons name="person-remove" size={20} color={Colors.error} />
          <ThemedText style={styles.removeButtonText}>Remove Connection</ThemedText>
        </TouchableOpacity>

        <TouchableOpacity style={styles.blockButton} onPress={handleBlockUser}>
          <Ionicons name="ban" size={20} color={Colors.error} />
          <ThemedText style={styles.blockButtonText}>Block User</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingTop: 60,
    paddingBottom: 40,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    padding: 10,
    zIndex: 10,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: 15,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  avatarText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.white,
  },
  name: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  airline: {
    fontSize: 18,
    color: Colors.primary,
    marginBottom: 5,
  },
  base: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  bioContainer: {
    backgroundColor: Colors.background,
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bio: {
    fontSize: 16,
    fontStyle: 'italic',
    textAlign: 'center',
    color: Colors.text.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 10,
  },
  activitySection: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  activityContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 15,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
    gap: 10,
  },
  activityTextContainer: {
    flex: 1,
  },
  activityText: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.text.primary,
  },
  clickableText: {
    fontWeight: '700',
    color: Colors.primary,
  },
  stars: {
    fontSize: 12,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 10,
  },
  messageButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    paddingVertical: 15,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  removeButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  blockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.background,
    paddingVertical: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  blockButtonText: {
    color: Colors.error,
    fontSize: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  errorText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 30,
  },
  backButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 12,
  },
  backButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});