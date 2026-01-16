// app/(tabs)/profile.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useColors } from '@/hooks/use-theme-color';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { router } from 'expo-router';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

export default function ProfileScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();
  const { role, cities, loading: adminLoading } = useAdminRole();
  const { counts: adminCounts } = useAdminNotifications();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ city: string; area: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [friendCount, setFriendCount] = useState(0);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [stats, setStats] = useState<UserStats>({ spotsAdded: 0, photosPosted: 0, reviewsLeft: 0 });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
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
  }, [user]);

  // Listen to friend count
  useEffect(() => {
    if (!user?.uid) return;

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(connectionsQuery, (snapshot) => {
      setFriendCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to recent activities and calculate stats
  useEffect(() => {
    if (!user?.uid) return;

    const activitiesQuery = query(
      collection(db, 'activities'),
      where('userId', '==', user.uid),
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
  }, [user]);

  // Calculate stats
  useEffect(() => {
    const fetchStats = async () => {
      if (!user?.uid) return;

      try {
        // Get all activities to calculate stats
        const activitiesSnapshot = await getDocs(
          query(collection(db, 'activities'), where('userId', '==', user.uid))
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
  }, [user]);

  // Listen to current layover location
  useEffect(() => {
    if (!user?.uid) return;

    const userDoc = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDoc, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        // Check for currentLayover object (new structure)
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
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      const refreshProfile = async () => {
        if (!user?.uid) return;
        
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            setProfile(userDoc.data() as UserProfile);
          }
        } catch (error) {
          console.error('Error refreshing profile:', error);
        }
      };

      refreshProfile();
    }, [user])
  );

  const handleSignOut = async () => {
    router.push('/auth/signin');
    await signOut();
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
          <Text style={[styles.activityText, { color: colors.text.primary }]}>
            {'Added '}
            <Text 
              style={[styles.clickableText, { color: colors.primary }]}
              onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
            >
              {activity.spotName}
            </Text>
            {' in '}
            <Text style={[styles.cityText, { color: colors.text.secondary }]}>{activity.city}</Text>
          </Text>
        );
        break;
      
      case 'review_left':
        icon = 'star';
        iconColor = Colors.accent;
        text = (
          <Text style={[styles.activityText, { color: colors.text.primary }]}>
            {'Left a '}
            <Text style={styles.stars}>{renderStars(activity.rating || 0)}</Text>
            {' review on '}
            <Text 
              style={[styles.clickableText, { color: colors.primary }]}
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
          <Text style={[styles.activityText, { color: colors.text.primary }]}>
            {'Posted a photo at '}
            <Text 
              style={[styles.clickableText, { color: colors.primary }]}
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

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ScrollView style={[styles.scrollContainer, { backgroundColor: colors.background }]} showsVerticalScrollIndicator={false}>
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
              style={[styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push('/qr-code')}
            >
              <Ionicons name="qr-code" size={22} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.editButtonHeader}
              onPress={() => router.push('/edit-profile-enhanced')}
            >
              <Ionicons name="pencil" size={18} color={Colors.white} />
              <ThemedText style={styles.editButtonText}>Edit</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {profile?.firstName?.[0]}{profile?.lastInitial}
              </Text>
            </View>
          )}
          
          <ThemedText style={[styles.name, { color: colors.text.primary }]}>{profile?.displayName}</ThemedText>
          <ThemedText style={styles.position}>{profile?.position}</ThemedText>
          <ThemedText style={[styles.base, { color: colors.text.secondary }]}>
            {profile?.airline} • {profile?.base}
          </ThemedText>
          
          {profile?.bio && (
            <ThemedText style={[styles.bio, { color: colors.text.primary }]}>{profile.bio}</ThemedText>
          )}

          {/* Favorite Cities */}
          {profile?.favoriteCities && profile.favoriteCities.length > 0 && (
            <View style={styles.favoriteCitiesContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="location" size={16} color={colors.primary} />
                <ThemedText style={[styles.sectionHeaderText, { color: colors.text.primary }]}>
                  Favorite Cities
                </ThemedText>
              </View>
              <View style={styles.tagsContainer}>
                {profile.favoriteCities.map((city, index) => (
                  <View key={index} style={[styles.cityTag, { 
                    backgroundColor: colors.primary + '15',
                    borderColor: colors.primary + '30'
                  }]}>
                    <Text style={[styles.cityTagText, { color: colors.primary }]}>{city}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Interests */}
          {profile?.interests && profile.interests.length > 0 && (
            <View style={styles.interestsContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="heart" size={16} color={Colors.accent} />
                <ThemedText style={[styles.sectionHeaderText, { color: colors.text.primary }]}>
                  Interests
                </ThemedText>
              </View>
              <View style={styles.tagsContainer}>
                {profile.interests.map((interest, index) => (
                  <View key={index} style={[styles.interestTag, {
                    backgroundColor: Colors.accent + '15',
                    borderColor: Colors.accent + '30'
                  }]}>
                    <Text style={[styles.interestTagText, { color: Colors.accent }]}>{interest}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </View>

        {/* Stats */}
        <View style={[styles.statsContainer, { 
          backgroundColor: colors.card,
          borderColor: colors.border
        }]}>
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{friendCount}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.text.primary }]}>Friends</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{stats.spotsAdded}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.text.primary }]}>Spots</ThemedText>
          </View>
          <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
          <View style={styles.statBox}>
            <ThemedText style={styles.statNumber}>{stats.reviewsLeft}</ThemedText>
            <ThemedText style={[styles.statLabel, { color: colors.text.primary }]}>Reviews</ThemedText>
          </View>
        </View>

        {/* Friends Card */}
        <TouchableOpacity 
          style={[styles.friendsCard, {
            backgroundColor: colors.card,
            borderColor: colors.border
          }]}
          onPress={() => router.push('/connections')}
          activeOpacity={0.7}
        >
          <View style={styles.friendsLeft}>
            <Ionicons name="people" size={24} color={Colors.primary} />
            <ThemedText style={[styles.friendsTitle, { color: colors.text.primary }]}>My Crew</ThemedText>
          </View>
          <View style={styles.friendsRight}>
            <View style={styles.friendsBadge}>
              <ThemedText style={styles.friendsCount}>{friendCount}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
          </View>
        </TouchableOpacity>

        {/* Admin Panel Card */}
        {isAdmin(role) && (
          <TouchableOpacity 
            style={styles.adminCard}
            onPress={() => router.push('/admin')}
            activeOpacity={0.7}
          >
            <View style={styles.adminLeft}>
              <View style={styles.adminIconContainer}>
                <Ionicons name="shield-checkmark" size={24} color="#9C27B0" />
                {adminCounts.total > 0 && (
                  <View style={styles.adminBadge}>
                    <Text style={styles.adminBadgeText}>
                      {adminCounts.total > 9 ? '9+' : adminCounts.total}
                    </Text>
                  </View>
                )}
              </View>
              <View>
                <Text style={styles.adminTitle}>Admin Panel</Text>
                <Text style={[styles.adminSubtitle, { color: colors.text.secondary }]}>
                  {role === 'super' ? 'Super Admin' : 'City Admin'}
                </Text>
              </View>
            </View>
            <View style={styles.adminRight}>
              {adminCounts.total > 0 && (
                <View style={styles.adminPendingBadge}>
                  <Text style={styles.adminPendingText}>
                    {adminCounts.total}
                  </Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={colors.text.secondary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Recent Activity */}
        {recentActivities.length > 0 && (
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Recent Activity</ThemedText>
              <TouchableOpacity onPress={() => router.push(`/user-activity/${user?.uid}`)}>
                <ThemedText style={styles.viewAllButton}>View All</ThemedText>
              </TouchableOpacity>
            </View>
            <View style={[styles.activityContainer, {
              backgroundColor: colors.card,
              borderColor: colors.border
            }]}>
              {recentActivities.map(renderActivity)}
            </View>
          </View>
        )}

        {/* Account Section */}
        <View style={styles.accountSection}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.primary }]}>Account</ThemedText>
          <View style={[styles.emailRow, {
            backgroundColor: colors.card,
            borderColor: colors.border
          }]}>
            <ThemedText style={[styles.emailLabel, { color: colors.text.secondary }]}>Email</ThemedText>
            <ThemedText style={[styles.emailValue, { color: colors.text.primary }]}>{user?.email}</ThemedText>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Ionicons name="log-out-outline" size={20} color={Colors.white} />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
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
  },
  topSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  currentlyInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
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
  },
  currentlyInCity: {
    fontSize: 15,
    fontWeight: '600',
  },
  offlineEmoji: {
    fontSize: 20,
  },
  offlineText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  editButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
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
  },
  position: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  base: {
    fontSize: 15,
    marginBottom: 12,
  },
  bio: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  statsContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
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
    fontWeight: '500',
  },
  statDivider: {
    width: 1,
  },
  friendsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  friendsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  friendsTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  // Admin Card with badge
  adminCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#9C27B0' + '15',
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#9C27B0' + '40',
  },
  adminLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminIconContainer: {
    position: 'relative',
  },
  adminBadge: {
    position: 'absolute',
    top: -6,
    right: -8,
    backgroundColor: Colors.error,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
  adminTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9C27B0',
  },
  adminSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  adminRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminPendingBadge: {
    backgroundColor: Colors.error,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  adminPendingText: {
    fontSize: 12,
    fontWeight: '600',
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
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  activityContainer: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
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
  },
  clickableText: {
    fontWeight: '700',
  },
  cityText: {
    fontWeight: '600',
  },
  stars: {
    fontSize: 12,
  },
  accountSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  emailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  emailLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  emailValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.error,
    marginHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
  },
  signOutText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
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
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  cityTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  cityTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
  interestTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  interestTagText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
