// app/profile/[userId].tsx
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
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where
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
  View
} from 'react-native';

type UserProfile = {
  id: string;
  firstName: string;
  lastInitial: string;
  displayName: string;
  airline: string;
  position: string;
  base: string;
  bio?: string;
  email: string;
  photoURL?: string;
  currentLayover?: {
    city: string;
    area: string;
    discoverable: boolean;
  };
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

type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected';

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState({ spotsAdded: 0, photosPosted: 0, reviewsLeft: 0 });

  // Fetch user profile
  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setProfile({
            id: userDoc.id,
            ...userDoc.data(),
          } as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  // Check connection status
  useEffect(() => {
    if (!user || !userId) return;

    const checkConnectionStatus = async () => {
      // Check if already connected
      const connectionsQuery = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', user.uid)
      );

      const connectionsSnapshot = await getDocs(connectionsQuery);
      let foundConnection = false;
      
      connectionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.userIds.includes(userId)) {
          foundConnection = true;
          setConnectionId(doc.id);
          setConnectionStatus('connected');
        }
      });

      if (foundConnection) return;

      // Check for pending requests
      const sentRequestQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', user.uid),
        where('toUserId', '==', userId),
        where('status', '==', 'pending')
      );

      const receivedRequestQuery = query(
        collection(db, 'connectionRequests'),
        where('fromUserId', '==', userId),
        where('toUserId', '==', user.uid),
        where('status', '==', 'pending')
      );

      const [sentSnapshot, receivedSnapshot] = await Promise.all([
        getDocs(sentRequestQuery),
        getDocs(receivedRequestQuery),
      ]);

      if (!sentSnapshot.empty) {
        setConnectionStatus('pending_sent');
      } else if (!receivedSnapshot.empty) {
        setConnectionStatus('pending_received');
      } else {
        setConnectionStatus('none');
      }
    };

    checkConnectionStatus();
  }, [user, userId]);

  // Fetch activities
  useEffect(() => {
    if (!userId) return;

    const activitiesQuery = query(
      collection(db, 'activities'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(3)
    );

    const unsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      const activities: Activity[] = [];
      snapshot.docs.forEach(doc => {
        activities.push({
          id: doc.id,
          ...doc.data(),
        } as Activity);
      });
      setRecentActivities(activities);
    });

    return () => unsubscribe();
  }, [userId]);

  // Calculate stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!userId) return;

      try {
        const activitiesSnapshot = await getDocs(
          query(collection(db, 'activities'), where('userId', '==', userId))
        );

        let spotsAdded = 0;
        let photosPosted = 0;
        let reviewsLeft = 0;

        activitiesSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (data.type === 'spot_added') spotsAdded++;
          if (data.type === 'photo_posted') photosPosted++;
          if (data.type === 'review_left') reviewsLeft++;
        });

        setStats({ spotsAdded, photosPosted, reviewsLeft });
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };

    fetchStats();
  }, [userId]);

  const handleConnectPress = async () => {
    if (!profile || !user) return;

    // Navigate to enhanced connection request screen
    router.push({
      pathname: '/send-connection-request',
      params: {
        userId: profile.id,
        userName: profile.displayName
      }
    });
  };

  const handleMessagePress = () => {
    if (!connectionId || !profile) return;

    router.push({
      pathname: '/chat/[id]',
      params: {
        id: connectionId,
        name: profile.displayName,
      },
    });
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
    let icon;
    let iconColor;
    let text;

    switch (activity.type) {
      case 'spot_added':
        icon = 'add-circle';
        iconColor = Colors.success;
        text = (
          <Text style={styles.activityText}>
            {'Added '}
            <Text
              style={styles.clickableText}
              onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
            >
              {activity.spotName}
            </Text>
            {' in '}
            <Text style={styles.cityText}>{activity.city}</Text>
          </Text>
        );
        break;

      case 'review_left':
        icon = 'star';
        iconColor = Colors.accent;
        text = (
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
        text = (
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
        <Ionicons name={icon as any} size={16} color={iconColor} />
        <View style={styles.activityTextContainer}>
          {text}
        </View>
      </View>
    );
  };

  const getConnectionButton = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <View style={styles.connectedActions}>
            {/* Connected Badge */}
            <View style={styles.connectedButton}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <ThemedText style={styles.connectedButtonText}>Connected</ThemedText>
            </View>
            
            {/* Message Button */}
            <TouchableOpacity
              style={styles.messageButton}
              onPress={handleMessagePress}
            >
              <Ionicons name="chatbubble" size={20} color={Colors.white} />
              <ThemedText style={styles.messageButtonText}>Message</ThemedText>
            </TouchableOpacity>
          </View>
        );

      case 'pending_sent':
        return (
          <View style={styles.pendingButton}>
            <Ionicons name="time-outline" size={20} color={Colors.text.secondary} />
            <ThemedText style={styles.pendingButtonText}>Request Sent</ThemedText>
          </View>
        );

      case 'pending_received':
        return (
          <TouchableOpacity
            style={styles.acceptButton}
            onPress={() => router.push('/(tabs)/connections')}
          >
            <Ionicons name="mail-unread" size={20} color={Colors.white} />
            <ThemedText style={styles.acceptButtonText}>View Request</ThemedText>
          </TouchableOpacity>
        );

      case 'none':
      default:
        return (
          <TouchableOpacity
            style={styles.connectButton}
            onPress={handleConnectPress}
          >
            <Ionicons name="person-add" size={20} color={Colors.white} />
            <ThemedText style={styles.connectButtonText}>Connect</ThemedText>
          </TouchableOpacity>
        );
    }
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
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            <ThemedText style={styles.backText}>Back</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.errorContainer}>
          <Ionicons name="person-outline" size={64} color={Colors.text.secondary} />
          <ThemedText style={styles.errorText}>User not found</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.container}>
        {/* Header with back button */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={Colors.primary} />
            <ThemedText style={styles.backText}>Back</ThemedText>
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Profile</ThemedText>
          <View style={styles.placeholder} />
        </View>

        {/* Currently In Badge */}
        {profile.currentLayover && profile.currentLayover.discoverable && (
          <View style={styles.currentlyInBadge}>
            <View style={styles.liveIndicator} />
            <ThemedText style={styles.currentlyInText}>
              Currently in {profile.currentLayover.city}
            </ThemedText>
          </View>
        )}

        {/* Profile Photo */}
        <View style={styles.photoSection}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <ThemedText style={styles.avatarText}>
                {profile.firstName[0]}{profile.lastInitial}
              </ThemedText>
            </View>
          )}
        </View>

        {/* User Info */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.name}>{profile.displayName}</ThemedText>
          <ThemedText style={styles.position}>{profile.position}</ThemedText>
          <ThemedText style={styles.airline}>{profile.airline}</ThemedText>
          <ThemedText style={styles.base}>📍 Based in {profile.base}</ThemedText>

          {profile.bio && (
            <View style={styles.bioContainer}>
              <ThemedText style={styles.bio}>"{profile.bio}"</ThemedText>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => stats.spotsAdded > 0 && router.push({
              pathname: '/profile/user-activity',
              params: { userId: profile.id, userName: profile.displayName, type: 'spots' }
            })}
            activeOpacity={stats.spotsAdded > 0 ? 0.7 : 1}
          >
            <ThemedText style={[styles.statNumber, stats.spotsAdded > 0 && styles.statClickable]}>
              {stats.spotsAdded}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Spots</ThemedText>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => stats.reviewsLeft > 0 && router.push({
              pathname: '/profile/user-activity',
              params: { userId: profile.id, userName: profile.displayName, type: 'reviews' }
            })}
            activeOpacity={stats.reviewsLeft > 0 ? 0.7 : 1}
          >
            <ThemedText style={[styles.statNumber, stats.reviewsLeft > 0 && styles.statClickable]}>
              {stats.reviewsLeft}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Reviews</ThemedText>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => stats.photosPosted > 0 && router.push({
              pathname: '/profile/user-activity',
              params: { userId: profile.id, userName: profile.displayName, type: 'photos' }
            })}
            activeOpacity={stats.photosPosted > 0 ? 0.7 : 1}
          >
            <ThemedText style={[styles.statNumber, stats.photosPosted > 0 && styles.statClickable]}>
              {stats.photosPosted}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Photos</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Recent Activity */}
        {recentActivities.length > 0 && (
          <View style={styles.activitySection}>
            <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
            <View style={styles.activityContainer}>
              {recentActivities.map(renderActivity)}
            </View>
          </View>
        )}

        {/* Action Button */}
        <View style={styles.actionButtonContainer}>
          {getConnectionButton()}
        </View>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    marginBottom: 10,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  backText: {
    fontSize: 16,
    color: Colors.primary,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  placeholder: {
    width: 60,
  },
  currentlyInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: Colors.success + '40',
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.success,
  },
  currentlyInText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.success,
  },
  photoSection: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: Colors.white,
  },
  infoSection: {
    paddingHorizontal: 20,
    alignItems: 'center',
    marginBottom: 20,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
    color: Colors.text.primary,
  },
  position: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  airline: {
    fontSize: 16,
    color: Colors.text.secondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  base: {
    fontSize: 15,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  bioContainer: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    width: '100%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bio: {
    fontSize: 15,
    fontStyle: 'italic',
    textAlign: 'center',
    color: Colors.text.primary,
    lineHeight: 22,
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    borderRadius: 16,
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
    marginBottom: 4,
  },
  statClickable: {
    textDecorationLine: 'underline',
  },
  statLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  activitySection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  activityContainer: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
  cityText: {
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  stars: {
    fontSize: 12,
  },
  actionButtonContainer: {
    paddingHorizontal: 20,
  },
  connectedActions: {
    gap: 12,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  connectButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  connectedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.success + '20',
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.success,
  },
  connectedButtonText: {
    color: Colors.success,
    fontSize: 17,
    fontWeight: '700',
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  messageButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  pendingButtonText: {
    color: Colors.text.secondary,
    fontSize: 17,
    fontWeight: '700',
  },
  acceptButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  acceptButtonText: {
    color: Colors.white,
    fontSize: 17,
    fontWeight: '700',
  },
  errorContainer: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  errorText: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
    color: Colors.text.secondary,
  },
});
