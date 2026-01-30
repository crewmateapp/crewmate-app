// app/profile/friend/[userId].tsx
import { LevelProgressBar } from '@/components/LevelProgressBar';
import { BadgeShowcase } from '@/components/BadgeShowcase';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { getSkylineForBase } from '@/constants/BaseSkylines';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import { 
  ActivityIndicator, 
  Image, 
  ScrollView, 
  StyleSheet, 
  Text, 
  TouchableOpacity, 
  View,
  RefreshControl 
} from 'react-native';

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
  
  // Engagement fields
  cms?: number;
  level?: string;
  badges?: string[];
  isFoundingCrew?: boolean;
  
  // Stats
  stats?: {
    totalCheckIns?: number;
    citiesVisitedCount?: number;
    citiesVisited?: string[];
    plansHosted?: number;
    plansAttended?: number;
    reviewsWritten?: number;
    photosUploaded?: number;
    connectionsCount?: number;
  };
};

type Activity = {
  id: string;
  type: 'spot_added' | 'review_left' | 'photo_posted' | 'layover_checkin';
  spotId?: string;
  spotName?: string;
  city?: string;
  rating?: number;
  createdAt: any;
};

type ConnectionStatus = 'none' | 'pending_sent' | 'pending_received' | 'connected';

export default function FriendProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [myProfile, setMyProfile] = useState<UserProfile | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ city: string; area: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('none');
  const [connectionId, setConnectionId] = useState<string | null>(null);

  // Mutual stats
  const [mutualBadges, setMutualBadges] = useState(0);
  const [mutualCities, setMutualCities] = useState(0);
  const [overlappingLayovers, setOverlappingLayovers] = useState<Array<{
    city: string;
    yourDates: string;
    theirDates: string;
    overlapping: boolean;
  }>>([]);

  const fetchProfile = async () => {
    if (!userId) return;
    
    try {
      // Fetch friend's profile
      const userDoc = await getDoc(doc(db, 'users', userId));
      if (userDoc.exists()) {
        setProfile(userDoc.data() as UserProfile);
      }

      // Fetch my profile for mutual comparison
      if (user?.uid) {
        const myDoc = await getDoc(doc(db, 'users', user.uid));
        if (myDoc.exists()) {
          const myData = myDoc.data() as UserProfile;
          setMyProfile(myData);

          // Calculate mutual badges
          const theirBadges = userDoc.data()?.badges || [];
          const myBadges = myData.badges || [];
          const mutual = theirBadges.filter((badge: string) => myBadges.includes(badge));
          setMutualBadges(mutual.length);

          // Calculate mutual cities (with better null checking)
          const theirCitiesData = userDoc.data()?.stats?.citiesVisited;
          const myCitiesData = myData.stats?.citiesVisited;
          
          // Only calculate if both are arrays
          if (Array.isArray(theirCitiesData) && Array.isArray(myCitiesData)) {
            const mutualCitiesArray = theirCitiesData.filter((city: string) => 
              myCitiesData.includes(city)
            );
            setMutualCities(mutualCitiesArray.length);
          } else {
            setMutualCities(0);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [userId, user]);

  // Listen to recent activities
  useEffect(() => {
    if (!userId) return;

    const activitiesQuery = query(
      collection(db, 'activities'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(8)
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

  // Find overlapping layovers
  useEffect(() => {
    const findOverlappingLayovers = async () => {
      if (!user?.uid || !userId) return;

      try {
        // Fetch my layovers
        const myLayoversQuery = query(
          collection(db, 'layovers'),
          where('userId', '==', user.uid),
          orderBy('startDate', 'desc')
        );
        const myLayoversSnapshot = await getDocs(myLayoversQuery);
        
        // Fetch their layovers
        const theirLayoversQuery = query(
          collection(db, 'layovers'),
          where('userId', '==', userId),
          orderBy('startDate', 'desc')
        );
        const theirLayoversSnapshot = await getDocs(theirLayoversQuery);
        
        // Build maps by city
        const myLayoversByCity: { [city: string]: any[] } = {};
        myLayoversSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!myLayoversByCity[data.city]) {
            myLayoversByCity[data.city] = [];
          }
          myLayoversByCity[data.city].push({
            startDate: data.startDate?.toDate(),
            endDate: data.endDate?.toDate(),
          });
        });
        
        const theirLayoversByCity: { [city: string]: any[] } = {};
        theirLayoversSnapshot.docs.forEach(doc => {
          const data = doc.data();
          if (!theirLayoversByCity[data.city]) {
            theirLayoversByCity[data.city] = [];
          }
          theirLayoversByCity[data.city].push({
            startDate: data.startDate?.toDate(),
            endDate: data.endDate?.toDate(),
          });
        });
        
        // Find overlapping cities and dates
        const overlaps: typeof overlappingLayovers = [];
        
        Object.keys(myLayoversByCity).forEach(city => {
          if (theirLayoversByCity[city]) {
            // Both have been to this city - check for date overlaps
            let hasOverlap = false;
            
            myLayoversByCity[city].forEach(myLayover => {
              theirLayoversByCity[city].forEach(theirLayover => {
                // Check if dates overlap
                if (myLayover.startDate && myLayover.endDate && 
                    theirLayover.startDate && theirLayover.endDate) {
                  const overlap = (
                    myLayover.startDate <= theirLayover.endDate &&
                    myLayover.endDate >= theirLayover.startDate
                  );
                  if (overlap) hasOverlap = true;
                }
              });
            });
            
            // Get most recent dates for display
            const myMostRecent = myLayoversByCity[city][0];
            const theirMostRecent = theirLayoversByCity[city][0];
            
            overlaps.push({
              city,
              yourDates: myMostRecent.startDate ? 
                myMostRecent.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 
                'Unknown',
              theirDates: theirMostRecent.startDate ?
                theirMostRecent.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) :
                'Unknown',
              overlapping: hasOverlap,
            });
          }
        });
        
        // Sort: overlapping first, then alphabetically
        overlaps.sort((a, b) => {
          if (a.overlapping && !b.overlapping) return -1;
          if (!a.overlapping && b.overlapping) return 1;
          return a.city.localeCompare(b.city);
        });
        
        setOverlappingLayovers(overlaps);
      } catch (error) {
        console.error('Error finding overlapping layovers:', error);
      }
    };

    findOverlappingLayovers();
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

  const handleMessage = async () => {
    if (!connectionId || !user?.uid || !profile) return;
    
    try {
      // Initialize lastMessage fields if they don't exist
      const connectionRef = doc(db, 'connections', connectionId);
      const connectionSnap = await getDoc(connectionRef);
      
      if (connectionSnap.exists()) {
        const data = connectionSnap.data();
        if (!data.lastMessage && data.lastMessage !== '') {
          await updateDoc(connectionRef, {
            lastMessage: '',
            lastMessageTime: serverTimestamp(),
            unreadCount: {
              [user.uid]: 0,
              [userId]: 0,
            },
          });
        }
      }
      
      // Navigate to chat using connection ID
      router.push({
        pathname: '/chat/[id]',
        params: { 
          id: connectionId, 
          name: profile.displayName,
        }
      });
    } catch (error) {
      console.error('Error opening chat:', error);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  // Get skyline image for user's base
  const skyline = getSkylineForBase(profile?.base);

  // Get action button based on connection status
  const renderActionButton = () => {
    if (connectionStatus === 'connected') {
      return (
        <TouchableOpacity 
          style={styles.messageButton}
          onPress={handleMessage}
        >
          <Ionicons name="chatbubble" size={16} color={Colors.white} />
          <Text style={styles.messageButtonText}>Message</Text>
        </TouchableOpacity>
      );
    } else if (connectionStatus === 'pending_sent') {
      return (
        <View style={styles.pendingButton}>
          <Ionicons name="time" size={16} color={Colors.text.secondary} />
          <Text style={styles.pendingButtonText}>Pending</Text>
        </View>
      );
    } else {
      return (
        <TouchableOpacity 
          style={styles.connectButton}
          onPress={handleSendRequest}
        >
          <Ionicons name="person-add" size={16} color={Colors.white} />
          <Text style={styles.connectButtonText}>Connect</Text>
        </TouchableOpacity>
      );
    }
  };

  // Render activity item
  const renderActivity = (activity: Activity, index: number) => {
    let iconName: any = 'pin';
    let iconColor = Colors.primary;
    let text = '';

    switch (activity.type) {
      case 'spot_added':
        iconName = 'location';
        iconColor = Colors.primary;
        text = `Added ${activity.spotName} in ${activity.city}`;
        break;
      case 'review_left':
        iconName = 'star';
        iconColor = Colors.accent;
        text = `${'⭐'.repeat(activity.rating || 0)} review on ${activity.spotName}`;
        break;
      case 'photo_posted':
        iconName = 'camera';
        iconColor = '#5856D6';
        text = `Posted photo at ${activity.spotName}`;
        break;
      case 'layover_checkin':
        iconName = 'airplane';
        iconColor = '#007AFF';
        text = `Checked into ${activity.city}`;
        break;
    }

    return (
      <TouchableOpacity
        key={activity.id}
        style={styles.activityCard}
        onPress={() => activity.spotId && handleSpotPress(activity.spotId)}
      >
        <View style={[styles.activityIcon, { backgroundColor: `${iconColor}20` }]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>
        <Text style={styles.activityText} numberOfLines={2}>
          {text}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <ScrollView 
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Cover Photo - Skyline Image */}
      <View style={styles.coverPhotoContainer}>
        <Image 
          source={{ uri: skyline.imageUrl }}
          style={styles.coverPhoto}
          resizeMode="cover"
        />
        {/* Dark overlay for text contrast */}
        <View style={styles.coverOverlay} />
        
        {/* Header Buttons on Cover */}
        <View style={styles.coverHeader}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.white} />
          </TouchableOpacity>
          
          <View style={styles.coverHeaderRight}>
            {currentLocation && (
              <View style={styles.locationBadge}>
                <View style={styles.activeIndicator} />
                <Text style={styles.locationText}>{currentLocation.city}</Text>
              </View>
            )}
            {renderActionButton()}
          </View>
        </View>

        {/* Profile Photo (overlaps cover) */}
        <View style={styles.avatarContainer}>
          {profile?.photoURL ? (
            <Image source={{ uri: profile.photoURL }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>
                {profile?.firstName?.[0]}{profile?.lastInitial}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* Profile Info Section */}
      <View style={styles.profileInfo}>
        {/* Name with inline Founding Badge */}
        <View style={styles.nameRow}>
          <Text style={styles.name}>{profile?.displayName}</Text>
          {profile?.isFoundingCrew && (
            <View style={styles.foundingBadgeInline}>
              <Ionicons name="star" size={16} color={Colors.accent} />
            </View>
          )}
        </View>

        {/* Founding Crew Label */}
        {profile?.isFoundingCrew && (
          <Text style={styles.foundingLabel}>Founding Crew</Text>
        )}

        {/* All job info on one line */}
        <Text style={styles.jobInfo}>
          {profile?.position} • {profile?.airline} • {profile?.base}
        </Text>

        {/* Bio */}
        {profile?.bio && (
          <Text style={styles.bio}>{profile.bio}</Text>
        )}
      </View>

      {/* Compact Level & CMS Bar */}
      <LevelProgressBar 
        cms={profile?.cms || 0} 
        level={profile?.level || 'rookie'} 
      />

      {/* You Both Have Section */}
      {(mutualBadges > 0 || mutualCities > 0) && (
        <View style={styles.mutualSection}>
          <View style={styles.mutualHeader}>
            <Ionicons name="people" size={20} color={Colors.primary} />
            <Text style={styles.mutualTitle}>You Both Have</Text>
          </View>
          <View style={styles.mutualStats}>
            {mutualBadges > 0 && (
              <View style={styles.mutualStat}>
                <Text style={styles.mutualStatValue}>{mutualBadges}</Text>
                <Text style={styles.mutualStatLabel}>badges in common 🏆</Text>
              </View>
            )}
            {mutualCities > 0 && (
              <View style={styles.mutualStat}>
                <Text style={styles.mutualStatValue}>{mutualCities}</Text>
                <Text style={styles.mutualStatLabel}>cities you've both visited 🌍</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Overlapping Layovers Section */}
      {overlappingLayovers.length > 0 && (
        <View style={styles.overlappingSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="map" size={20} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Layover History</Text>
          </View>
          <Text style={styles.overlappingSectionSubtitle}>
            Cities you've both visited
          </Text>
          {overlappingLayovers.slice(0, 5).map((overlap, index) => (
            <View key={index} style={styles.overlapCard}>
              <View style={styles.overlapHeader}>
                <View style={styles.overlapCityInfo}>
                  <Ionicons name="location" size={18} color={Colors.primary} />
                  <Text style={styles.overlapCity}>{overlap.city}</Text>
                  {overlap.overlapping && (
                    <View style={styles.overlapBadge}>
                      <Text style={styles.overlapBadgeText}>Same time!</Text>
                    </View>
                  )}
                </View>
              </View>
              <View style={styles.overlapDates}>
                <View style={styles.overlapDateRow}>
                  <Text style={styles.overlapDateLabel}>You:</Text>
                  <Text style={styles.overlapDateValue}>{overlap.yourDates}</Text>
                </View>
                <View style={styles.overlapDateRow}>
                  <Text style={styles.overlapDateLabel}>Them:</Text>
                  <Text style={styles.overlapDateValue}>{overlap.theirDates}</Text>
                </View>
              </View>
            </View>
          ))}
          {overlappingLayovers.length > 5 && (
            <TouchableOpacity 
              style={styles.viewMoreButton}
              onPress={() => router.push(`/check-ins?userId=${userId}`)}
            >
              <Text style={styles.viewMoreText}>
                View all {overlappingLayovers.length} shared cities
              </Text>
              <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Badges Section */}
      {profile?.badges && profile.badges.length > 0 && (
        <View style={styles.statsSection}>
          <BadgeShowcase 
            earnedBadges={profile.badges || []} 
            userStats={profile?.stats}
          />
        </View>
      )}

      {/* Stats Grid - Now Clickable! */}
      <View style={styles.statsSection}>
        <View style={styles.statsGrid}>
          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => router.push(`/check-ins?userId=${userId}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.statValue}>{profile?.stats?.totalCheckIns || 0}</Text>
            <Text style={styles.statLabel}>Check-ins</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.text.secondary} style={{ marginTop: 4 }} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => router.push(`/plans-history?userId=${userId}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.statValue}>{(profile?.stats?.plansHosted || 0) + (profile?.stats?.plansAttended || 0)}</Text>
            <Text style={styles.statLabel}>Plans</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.text.secondary} style={{ marginTop: 4 }} />
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.statCard}
            onPress={() => router.push(`/cities-visited?userId=${userId}`)}
            activeOpacity={0.7}
          >
            <Text style={styles.statValue}>{profile?.stats?.citiesVisitedCount || 0}</Text>
            <Text style={styles.statLabel}>Cities</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.text.secondary} style={{ marginTop: 4 }} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Recent Activity */}
      {recentActivities.length > 0 && (
        <View style={styles.activitySection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time" size={20} color={Colors.text.primary} />
            <Text style={styles.sectionTitle}>Recent Activity</Text>
          </View>
          <View style={styles.activityList}>
            {recentActivities.map((activity, index) => renderActivity(activity, index))}
          </View>
        </View>
      )}

      {/* Bottom Action Button */}
      <View style={styles.bottomAction}>
        {renderActionButton()}
      </View>

      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  coverPhotoContainer: {
    position: 'relative',
    height: 250, // TALLER to show more of the city skyline!
    marginBottom: -55, // Proper overlap
  },
  coverPhoto: {
    width: '100%',
    height: 250,
  },
  coverOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  coverHeader: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverHeaderRight: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
  },
  activeIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#34C759',
    marginRight: 5,
  },
  locationText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  messageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    gap: 4,
  },
  messageButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  connectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    gap: 4,
  },
  connectButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
  },
  pendingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  pendingButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  avatarContainer: {
    position: 'absolute',
    bottom: -55, // Half the avatar (55px) extends below
    alignSelf: 'center',
    zIndex: 10,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 4,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarFallback: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: Colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: Colors.white,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: {
    fontSize: 40,
    fontWeight: '700',
    color: Colors.primary,
  },
  profileInfo: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 115, // 55 (margin offset) + 55 (avatar) + 5 (gap) = 115px
    paddingBottom: 12,
    backgroundColor: Colors.background,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    letterSpacing: 0.3,
  },
  foundingBadgeInline: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.accent,
  },
  foundingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.accent,
    marginTop: 4,
  },
  jobInfo: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  bio: {
    fontSize: 14,
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 12,
    paddingHorizontal: 20,
  },
  compactSection: {
    paddingHorizontal: 20,
    marginTop: 12,
  },
  compactSectionLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  mutualSection: {
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  mutualHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  mutualTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.primary,
  },
  mutualStats: {
    gap: 8,
  },
  mutualStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mutualStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  mutualStatLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  activitySection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  activityList: {
    gap: 8,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  activityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.primary,
    lineHeight: 18,
  },
  bottomAction: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  overlappingSection: {
    marginTop: 24,
    paddingHorizontal: 20,
  },
  overlappingSectionSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 12,
    marginTop: -4,
  },
  overlapCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  overlapHeader: {
    marginBottom: 8,
  },
  overlapCityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  overlapCity: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  overlapBadge: {
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    marginLeft: 4,
  },
  overlapBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.success,
  },
  overlapDates: {
    gap: 4,
  },
  overlapDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  overlapDateLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    width: 50,
  },
  overlapDateValue: {
    fontSize: 13,
    color: Colors.text.primary,
  },
  viewMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 6,
  },
  viewMoreText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
