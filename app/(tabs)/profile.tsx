// app/(tabs)/profile.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { isAdmin, useAdminRole } from '@/hooks/useAdminRole';
import { useAdminNotifications } from '@/hooks/useAdminNotifications';
import { backfillSpotActivities } from '@/utils/backfillActivities';
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

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
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

        {/* TEMPORARY: Backfill Test Button */}
        <TouchableOpacity 
          style={{ 
            backgroundColor: '#9C27B0', 
            padding: 16, 
            marginHorizontal: 20,
            marginTop: 20,
            borderRadius: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8
          }}
          onPress={async () => {
            Alert.alert(
              'Run Backfill?',
              'This will create activity records for all existing spots, photos, and reviews. Continue?',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Run',
                  onPress: async () => {
                    try {
                      console.log('Starting backfill...');
                      const result = await backfillSpotActivities();
                      Alert.alert(
                        'Backfill Complete! ✅',
                        `Created: ${result.created}\nAlready existed: ${result.alreadyExists}\nErrors: ${result.errors}`
                      );
                    } catch (error) {
                      console.error('Backfill error:', error);
                      Alert.alert('Error', 'Backfill failed. Check console.');
                    }
                  }
                }
              ]
            );
          }}
        >
          <Ionicons name="refresh" size={20} color="white" />
          <ThemedText style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>
            RUN BACKFILL (TEMP TEST)
          </ThemedText>
        </TouchableOpacity>

        {/* Profile Header */}
        <View style={styles.profileHeader}>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <ThemedText style={styles.avatarText}>
                {profile?.firstName?.charAt(0) || '?'}
              </ThemedText>
            </View>
          )}
          <ThemedText style={styles.name}>
            {profile?.firstName} {profile?.lastInitial}.
          </ThemedText>
          <ThemedText style={styles.position}>
            {profile?.position} • {profile?.airline}
          </ThemedText>
          <ThemedText style={styles.base}>Based in {profile?.base}</ThemedText>
          {profile?.bio && (
            <ThemedText style={styles.bio}>{profile.bio}</ThemedText>
          )}

          {/* Favorite Cities */}
          {profile?.favoriteCities && profile.favoriteCities.length > 0 && (
            <View style={styles.favoriteCitiesContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="heart" size={16} color={Colors.primary} />
                <ThemedText style={styles.sectionHeaderText}>Favorite Layovers</ThemedText>
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
          {profile?.interests && profile.interests.length > 0 && (
            <View style={styles.interestsContainer}>
              <View style={styles.sectionHeaderRow}>
                <Ionicons name="sparkles" size={16} color={Colors.accent} />
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

        {/* Stats */}
        <View style={styles.statsContainer}>
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => router.push({
              pathname: '/user-activity/[userId]',
              params: { 
                userId: user.uid,
                type: 'spots',
                userName: profile?.displayName
              }
            })}
          >
            <ThemedText style={styles.statNumber}>{stats.spotsAdded}</ThemedText>
            <ThemedText style={styles.statLabel}>Spots</ThemedText>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => router.push({
              pathname: '/user-activity/[userId]',
              params: { 
                userId: user.uid,
                type: 'photos',
                userName: profile?.displayName
              }
            })}
          >
            <ThemedText style={styles.statNumber}>{stats.photosPosted}</ThemedText>
            <ThemedText style={styles.statLabel}>Photos</ThemedText>
          </TouchableOpacity>
          <View style={styles.statDivider} />
          <TouchableOpacity 
            style={styles.statBox}
            onPress={() => router.push({
              pathname: '/user-activity/[userId]',
              params: { 
                userId: user.uid,
                type: 'reviews',
                userName: profile?.displayName
              }
            })}
          >
            <ThemedText style={styles.statNumber}>{stats.reviewsLeft}</ThemedText>
            <ThemedText style={styles.statLabel}>Reviews</ThemedText>
          </TouchableOpacity>
        </View>

        {/* Friends Section */}
        <TouchableOpacity 
          style={styles.friendsCard}
          onPress={() => router.push('/friends')}
        >
          <View style={styles.friendsLeft}>
            <Ionicons name="people" size={22} color={Colors.primary} />
            <ThemedText style={styles.friendsTitle}>Friends</ThemedText>
          </View>
          <View style={styles.friendsRight}>
            <View style={styles.friendsBadge}>
              <ThemedText style={styles.friendsCount}>{friendCount}</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
          </View>
        </TouchableOpacity>

        {/* Admin Panel - With notification badge */}
        {isAdmin(role) && (
          <TouchableOpacity
            style={styles.adminCard}
            onPress={() => router.push('/admin')}
          >
            <View style={styles.adminLeft}>
              <View style={styles.adminIconContainer}>
                <Ionicons name="shield-checkmark" size={22} color="#9C27B0" />
                {adminCounts.total > 0 && (
                  <View style={styles.adminBadge}>
                    <ThemedText style={styles.adminBadgeText}>
                      {adminCounts.total > 99 ? '99+' : adminCounts.total}
                    </ThemedText>
                  </View>
                )}
              </View>
              <View>
                <ThemedText style={styles.adminTitle}>Admin Panel</ThemedText>
                <ThemedText style={styles.adminSubtitle}>
                  {role === 'super' ? 'Super Admin' : `City Admin: ${cities.join(', ')}`}
                </ThemedText>
              </View>
            </View>
            <View style={styles.adminRight}>
              {adminCounts.total > 0 && (
                <View style={styles.adminPendingBadge}>
                  <ThemedText style={styles.adminPendingText}>
                    {adminCounts.total} pending
                  </ThemedText>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={Colors.text.secondary} />
            </View>
          </TouchableOpacity>
        )}

        {/* Recent Activity */}
        {recentActivities.length > 0 && (
          <View style={styles.activitySection}>
            <View style={styles.activityHeader}>
              <ThemedText style={styles.sectionTitle}>Recent Activity</ThemedText>
              {recentActivities.length >= 3 && (
                <TouchableOpacity onPress={() => router.push('/feed')}>
                  <ThemedText style={styles.viewAllButton}>View All</ThemedText>
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.activityContainer}>
              {recentActivities.map(activity => renderActivity(activity))}
            </View>
          </View>
        )}

        {/* Account Section */}
        <View style={styles.accountSection}>
          <ThemedText style={styles.sectionTitle}>Account</ThemedText>
          <View style={styles.emailRow}>
            <ThemedText style={styles.emailLabel}>Email</ThemedText>
            <ThemedText style={styles.emailValue}>{profile?.email}</ThemedText>
          </View>
        </View>

        {/* Sign Out Button */}
        <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color={Colors.white} />
          <ThemedText style={styles.signOutText}>Sign Out</ThemedText>
        </TouchableOpacity>

        {/* Bottom spacer */}
        <View style={{ height: 40 }} />
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
    paddingBottom: 20,
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  currentlyInContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  activeIndicator: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.success,
  },
  locationInfo: {
    flexDirection: 'column',
  },
  currentlyInLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  editButtonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 19,
  },
  editButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontWeight: '600',
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 25,
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
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  viewAllButton: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
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
  accountSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  emailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: 8,
  },
  emailLabel: {
    fontSize: 15,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  emailValue: {
    fontSize: 15,
    color: Colors.text.primary,
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
