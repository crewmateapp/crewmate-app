// app/profile/friend/[userId].tsx
// Same design as regular user profile - consolidated to one design
// Expo Router requires each route to have its own component, so this is a copy

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert } from 'react-native';

type UserProfile = {
  firstName: string;
  lastInitial: string;
  displayName: string;
  airline: string;
  position: string;
  base: string;
  bio: string;
  email: string;
  photoURL?: string;
  favoriteCities?: string[];
  interests?: string[];
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

type UserStats = {
  spotsAdded: number;
  photosPosted: number;
  reviewsLeft: number;
};

type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected';

export default function FriendProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ city: string; area: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendCount, setFriendCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<UserStats>({ spotsAdded: 0, photosPosted: 0, reviewsLeft: 0 });
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Navigate to filtered activity feed
  const handleStatClick = (filterType: 'spot_added' | 'photo_posted' | 'review_left') => {
    router.push({
      pathname: '/profile/user-activities',
      params: { 
        userId: userId,
        filter: filterType,
        userName: profile?.displayName || 'User'
      }
    });
  };

  // Fetch user profile
  useEffect(() => {
    const fetchProfile = async () => {
      if (!userId) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          setProfile(userDoc.data() as UserProfile);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  // Listen to friend count
  useEffect(() => {
    if (!userId) return;

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', userId)
    );

    const unsubscribe = onSnapshot(connectionsQuery, (snapshot) => {
      setFriendCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [userId]);

  // Listen to recent activities and calculate stats
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

  // Listen to current layover location
  useEffect(() => {
    if (!userId) return;

    const userDoc = doc(db, 'users', userId);
    const unsubscribe = onSnapshot(userDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data.currentLayover?.city && data.currentLayover?.area) {
          setCurrentLocation({
            city: data.currentLayover.city,
            area: data.currentLayover.area
          });
        } else {
          setCurrentLocation(null);
        }
      }
    });

    return () => unsubscribe();
  }, [userId]);

  // Check connection status
  useEffect(() => {
    const checkConnectionStatus = async () => {
      if (!user?.uid || !userId) return;

      try {
        // Check if connected
        const connectionsQuery = query(
          collection(db, 'connections'),
          where('userIds', 'array-contains', user.uid)
        );
        const connectionsSnapshot = await getDocs(connectionsQuery);
        
        for (const doc of connectionsSnapshot.docs) {
          const data = doc.data();
          if (data.userIds.includes(userId)) {
            setConnectionStatus('connected');
            setConnectionId(doc.id);
            return;
          }
        }

        // Check for pending requests
        const requestsQuery = query(
          collection(db, 'connectionRequests'),
          where('status', '==', 'pending')
        );
        const requestsSnapshot = await getDocs(requestsQuery);

        for (const doc of requestsSnapshot.docs) {
          const data = doc.data();
          if (data.fromUserId === user.uid && data.toUserId === userId) {
            setConnectionStatus('pending_sent');
            return;
          }
          if (data.fromUserId === userId && data.toUserId === user.uid) {
            setConnectionStatus('pending_received');
            return;
          }
        }

        setConnectionStatus('none');
      } catch (error) {
        console.error('Error checking connection status:', error);
      }
    };

    checkConnectionStatus();
  }, [user, userId]);

  const handleSpotPress = (spotId: string) => {
    router.push({
      pathname: '/spot/[id]',
      params: { id: spotId }
    });
  };

  const handleSendRequest = () => {
    router.push({
      pathname: '/send-connection-request',
      params: { userId }
    });
  };

  const handleMessage = () => {
    if (connectionId) {
      router.push({
        pathname: '/chat/[id]',
        params: { 
          id: connectionId,
          name: profile?.displayName || 'User'
        }
      });
    }
  };

  const handleBlockUser = () => {
    Alert.alert(
      'Block User',
      `Are you sure you want to block ${profile?.firstName}? They won't be able to see your profile or contact you.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            // Implement blocking logic
            Alert.alert('Coming Soon', 'User blocking will be available soon.');
          }
        }
      ]
    );
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

  const renderActionButton = () => {
    switch (connectionStatus) {
      case 'connected':
        return (
          <TouchableOpacity style={styles.primaryButton} onPress={handleMessage}>
            <Ionicons name="chatbubble" size={20} color={Colors.white} />
            <ThemedText style={styles.primaryButtonText}>Message</ThemedText>
          </TouchableOpacity>
        );
      
      case 'pending_sent':
        return (
          <View style={styles.pendingButton}>
            <Ionicons name="time" size={20} color={Colors.text.secondary} />
            <ThemedText style={styles.pendingButtonText}>Request Sent</ThemedText>
          </View>
        );
      
      case 'pending_received':
        return (
          <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => router.push('/(tabs)/connections')}
          >
            <Ionicons name="person-add" size={20} color={Colors.white} />
            <ThemedText style={styles.primaryButtonText}>View Request</ThemedText>
          </TouchableOpacity>
        );
      
      case 'none':
      default:
        return (
          <TouchableOpacity style={styles.primaryButton} onPress={handleSendRequest}>
            <Ionicons name="person-add" size={20} color={Colors.white} />
            <ThemedText style={styles.primaryButtonText}>Connect</ThemedText>
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
        <ThemedText style={styles.errorText}>User not found</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ScrollView style={styles.scrollContainer} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.container}>
        {/* Header Section */}
        <View style={styles.topSection}>
          {/* Currently In */}
          <View style={styles.currentlyInContainer}>
            {currentLocation ? (
              <>
                <View style={styles.activeIndicator} />
                <View style={styles.locationInfo}>
                  <ThemedText style={styles.currentlyInLabel}>Currently in</ThemedText>
                  <ThemedText style={styles.currentlyInCity}>{currentLocation.city}</ThemedText>
                </View>
              </>
            ) : (
              <>
                <ThemedText style={styles.offlineEmoji}>💤</ThemedText>
                <View style={styles.locationInfo}>
                  <ThemedText style={styles.offlineText}>Off duty</ThemedText>
                </View>
              </>
            )}
          </View>

          {/* Action Buttons */}
          <View style={styles.headerButtons}>
            <TouchableOpacity 
              style={styles.iconButton}
              onPress={() => router.back()}
            >
              <Ionicons name="chevron-back" size={22} color={Colors.primary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.iconButton}
              onPress={handleBlockUser}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Info */}
        <View style={styles.profileSection}>
          {profile.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <ThemedText style={styles.avatarText}>
                {profile.firstName.charAt(0).toUpperCase()}
              </ThemedText>
            </View>
          )}

          <ThemedText style={styles.name}>{profile.displayName}</ThemedText>
          <ThemedText style={styles.position}>{profile.position} • {profile.airline}</ThemedText>
          <ThemedText style={styles.base}>Based in {profile.base}</ThemedText>
          {profile.bio && <ThemedText style={styles.bio}>{profile.bio}</ThemedText>}

          {/* Favorite Cities */}
          {profile.favoriteCities && profile.favoriteCities.length > 0 && (
            <View style={styles.favoriteCitiesContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="airplane" size={16} color={Colors.primary} />
                <ThemedText style={styles.sectionHeaderText}>Favorite Cities</ThemedText>
              </View>
              <View style={styles.tagsContainer}>
                {profile.favoriteCities.map((city, index) => (
                  <View key={index} style={styles.cityTag}>
                    <ThemedText style={styles.cityTagText}>{city}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Interests */}
          {profile.interests && profile.interests.length > 0 && (
            <View style={styles.interestsContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="heart" size={16} color={Colors.accent} />
                <ThemedText style={styles.sectionHeaderText}>Interests</ThemedText>
              </View>
              <View style={styles.tagsContainer}>
                {profile.interests.map((interest, index) => (
                  <View key={index} style={styles.interestTag}>
                    <ThemedText style={styles.interestTagText}>{interest}</ThemedText>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Action Button */}
        <View style={styles.actionButtonContainer}>
          {renderActionButton()}
        </View>

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => handleStatClick('spot_added')}
          >
            <ThemedText style={styles.statNumber}>{stats.spotsAdded}</ThemedText>
            <ThemedText style={styles.statLabel}>Spots Added</ThemedText>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => handleStatClick('photo_posted')}
          >
            <ThemedText style={styles.statNumber}>{stats.photosPosted}</ThemedText>
            <ThemedText style={styles.statLabel}>Photos Posted</ThemedText>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => handleStatClick('review_left')}
          >
            <ThemedText style={styles.statNumber}>{stats.reviewsLeft}</ThemedText>
            <ThemedText style={styles.statLabel}>Reviews Left</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Friends Count */}
        <View style={styles.friendsCard}>
          <View style={styles.friendsLeft}>
            <Ionicons name="people" size={20} color={Colors.primary} />
            <ThemedText style={styles.friendsTitle}>Connections</ThemedText>
          </View>
          <View style={styles.friendsRight}>
            <View style={styles.friendsBadge}>
              <ThemedText style={styles.friendsCount}>{friendCount}</ThemedText>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        {recentActivities.length > 0 && (
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
            </View>
            <View style={styles.activityContainer}>
              {recentActivities.map(activity => renderActivity(activity))}
            </View>
          </View>
        )}
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingBottom: 30,
  },
  topSection: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  currentlyInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.success,
  },
  locationInfo: {
    gap: 2,
  },
  currentlyInLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  currentlyInCity: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  offlineEmoji: {
    fontSize: 20,
  },
  offlineText: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 16,
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
    marginBottom: 16,
    borderWidth: 3,
    borderColor: Colors.primary,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: 'bold',
    color: Colors.white,
  },
  name: {
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
    color: Colors.text.primary,
  },
  position: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  base: {
    fontSize: 15,
    color: Colors.text.secondary,
    marginBottom: 12,
  },
  bio: {
    fontSize: 15,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  actionButtonContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pendingButtonText: {
    color: Colors.text.secondary,
    fontSize: 16,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  statLabel: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  friendsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  friendsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  friendsRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  friendsBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  friendsCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.white,
  },
  activitySection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
  errorText: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 100,
  },
  favoriteCitiesContainer: {
    marginTop: 20,
    width: '100%',
  },
  interestsContainer: {
    marginTop: 16,
    width: '100%',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityTag: {
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  cityTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  interestTag: {
    backgroundColor: Colors.accent + '15',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '30',
  },
  interestTagText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
  },
});
