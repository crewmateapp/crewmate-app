// app/(tabs)/profile.tsx
import { BadgeShowcase } from '@/components/BadgeShowcase';
import { LevelProgressBar } from '@/components/LevelProgressBar';
import { SharingNudge } from '@/components/SharingNudge';
import { ProfileCompletionBanner } from '@/components/ProfileCompletionBanner';
import { StatsGrid } from '@/components/StatsGrid';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { getSkylineForBase } from '@/constants/BaseSkylines';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColors } from '@/hooks/use-theme-color';
import { isAdmin } from '@/hooks/useAdminRole';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import {
  notifyCrewfikeLike,
  notifyCrewfieComment,
  notifyPlanJoin,
  notifyPlanMessage,
  notifyPlanStarting,
  notifyPlanCancel,
  notifyNearbyCrewOnLayover,
  notifyBadgeEarned,
} from '@/utils/notifications';

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
  
  // Admin
  adminRole?: string;

  // Engagement fields
  cms?: number;
  level?: string;
  badges?: string[];
  isFoundingCrew?: boolean;
  
  // Stats
  stats?: {
    totalCheckIns?: number;
    citiesVisitedCount?: number;
    plansHosted?: number;
    plansAttended?: number;
    reviewsWritten?: number;
    photosUploaded?: number;
    connectionsCount?: number;
    spotsAdded?: number;
  };
};

type CurrentLocation = {
  city: string;
  area: string;
};

export default function ProfileScreen() {
  const colors = useColors();
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connectionCount, setConnectionCount] = useState(0);

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
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [user]);

  // Listen to current location
  useEffect(() => {
    if (!user?.uid) return;

    const locationQuery = query(
      collection(db, 'layovers'),
      where('userId', '==', user.uid),
      where('isActive', '==', true)
    );

    const unsubscribe = onSnapshot(locationQuery, (snapshot) => {
      if (!snapshot.empty) {
        const layover = snapshot.docs[0].data();
        setCurrentLocation({
          city: layover.city,
          area: layover.area,
        });
      } else {
        setCurrentLocation(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to connection count
  useEffect(() => {
    if (!user?.uid) return;

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(connectionsQuery, (snapshot) => {
      setConnectionCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await signOut();
              router.replace('/');
            } catch (error) {
              console.error('Error signing out:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  // Get skyline image for user's base
  const skyline = getSkylineForBase(profile?.base);

  // Prepare stats for StatsGrid with onPress handlers
  const statsData = [
    {
      icon: 'location' as const,
      label: 'Cities',
      value: profile?.stats?.citiesVisitedCount || 0,
      color: Colors.primary,
      onPress: () => {
        router.push('/cities-visited');
      },
    },
    {
      icon: 'people' as const,
      label: 'Connections',
      value: connectionCount,
      color: '#34C759',
      onPress: () => {
        router.push('/connections');
      },
    },
    {
      icon: 'calendar' as const,
      label: 'Plans',
      value: (profile?.stats?.plansHosted || 0) + (profile?.stats?.plansAttended || 0),
      color: '#FF9500',
      onPress: () => {
        router.push('/plans-history');
      },
    },
    {
      icon: 'restaurant' as const,
      label: 'Spots Added',
      value: profile?.stats?.spotsAdded || 0,
      color: '#FF2D55',
      onPress: () => {
        router.push('/my-spots');
      },
    },
    {
      icon: 'star' as const,
      label: 'Reviews',
      value: profile?.stats?.reviewsWritten || 0,
      color: Colors.accent,
      onPress: () => {
        router.push('/my-reviews');
      },
    },
    {
      icon: 'camera' as const,
      label: 'Photos',
      value: profile?.stats?.photosUploaded || 0,
      color: '#5856D6',
      onPress: () => {
        router.push('/my-photos');
      },
    },
    {
      icon: 'airplane' as const,
      label: 'Check-ins',
      value: profile?.stats?.totalCheckIns || 0,
      color: '#007AFF',
      onPress: () => {
        router.push('/check-ins');
      },
    },
  ];

  return (
    <ScrollView 
      style={[styles.scrollContainer, { backgroundColor: colors.background }]} 
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
          <View style={styles.coverHeaderLeft}>
            {currentLocation ? (
              <View style={styles.locationBadge}>
                <View style={styles.activeIndicator} />
                <Text style={styles.locationText}>{currentLocation.city}</Text>
              </View>
            ) : (
              <View style={styles.locationBadge}>
                <Text style={styles.offlineText}>💤 Off duty</Text>
              </View>
            )}
          </View>
          
          <View style={styles.coverHeaderRight}>
            <TouchableOpacity 
              style={styles.coverIconButton}
              onPress={() => router.push('/qr-code')}
            >
              <Ionicons name="qr-code" size={20} color={Colors.white} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.coverEditButton}
              onPress={() => router.push('/edit-profile-enhanced')}
            >
              <Ionicons name="pencil" size={16} color={Colors.white} />
              <Text style={styles.coverEditText}>Edit</Text>
            </TouchableOpacity>
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

      {/* Favorite Cities */}
      {profile?.favoriteCities && profile.favoriteCities.length > 0 && (
        <View style={styles.compactSection}>
          <Text style={styles.compactSectionLabel}>
            <Ionicons name="location" size={14} color={Colors.text.secondary} />  {profile.favoriteCities.join(', ')}
          </Text>
        </View>
      )}

      {/* Interests */}
      {profile?.interests && profile.interests.length > 0 && (
        <View style={styles.compactSection}>
          <Text style={styles.compactSectionLabel}>
            <Ionicons name="heart" size={14} color={Colors.text.secondary} />  {profile.interests.join(', ')}
          </Text>
        </View>
      )}

      {/* Badge Showcase */}
      <BadgeShowcase 
        earnedBadges={profile?.badges || []} 
        userStats={profile?.stats}
      />

      {/* Stats Grid (Interactive) */}
      <StatsGrid stats={statsData} />

      {/* Sharing Nudge */}
      <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
        <SharingNudge context="profile" compact />
      </View>

      {/* Profile Completion Reminder */}
      <View style={{ paddingHorizontal: 20, marginTop: 4 }}>
        <ProfileCompletionBanner compact />
      </View>

      {/* Notification Test Panel — super admin only, TEMPORARY */}
      {profile?.adminRole === 'super' && (
        <View style={styles.testSection}>
          <View style={styles.testHeader}>
            <Ionicons name="bug" size={16} color="#FF9500" />
            <Text style={styles.testHeaderText}>Notification Tests</Text>
          </View>
          <View style={styles.testButtonGrid}>
            <TouchableOpacity
              style={styles.testButton}
              onPress={() => notifyCrewfikeLike(user!.uid, 'fake-liker-id', 'Johnny', 'fake-post-123', 'Sunset in CLT')}
            >
              <Ionicons name="heart" size={16} color="#FF3B30" />
              <Text style={styles.testButtonText}>Like</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => notifyCrewfieComment(user!.uid, 'fake-commenter-id', 'Johnny', 'fake-post-123', 'Great shot!')}
            >
              <Ionicons name="chat-bubble-sharp" size={16} color="#FF9500" />
              <Text style={styles.testButtonText}>Comment</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => notifyPlanJoin(user!.uid, 'fake-plan-123', 'Tacos Tonight', 'fake-joiner-id', 'Johnny')}
            >
              <Ionicons name="person-add" size={16} color="#8E44AD" />
              <Text style={styles.testButtonText}>Plan Join</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => notifyPlanMessage('fake-plan-123', 'Tacos Tonight', 'fake-sender-id', 'Johnny', 'On my way, be there in 10!', [user!.uid])}
            >
              <Ionicons name="chat-bubble" size={16} color="#8E44AD" />
              <Text style={styles.testButtonText}>Plan Msg</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => notifyPlanStarting('fake-plan-123', 'Tacos Tonight', 'Charlotte', 'fake-creator-id', [user!.uid])}
            >
              <Ionicons name="rocket" size={16} color="#8E44AD" />
              <Text style={styles.testButtonText}>Plan Start</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => notifyPlanCancel(user!.uid, 'fake-plan-123', 'Tacos Tonight', 'fake-canceler-id', 'Johnny')}
            >
              <Ionicons name="close-circle" size={16} color="#E74C3C" />
              <Text style={styles.testButtonText}>Plan Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => notifyNearbyCrewOnLayover(user!.uid, 'fake-nearby-id', 'Johnny', 'American Airlines', 'Charlotte')}
            >
              <Ionicons name="location" size={16} color="#4A90D9" />
              <Text style={styles.testButtonText}>Nearby</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.testButton}
              onPress={() => notifyBadgeEarned(user!.uid, 'badge-explorer', 'Explorer', 'Visited 5 cities')}
            >
              <Ionicons name="trophy" size={16} color="#F5A623" />
              <Text style={styles.testButtonText}>Badge</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.testNotifCenterButton}
            onPress={() => router.push('/notifications')}
          >
            <Ionicons name="notifications" size={16} color={Colors.primary} />
            <Text style={styles.testNotifCenterText}>Open Notification Center</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Admin Section */}
      {isAdmin(user?.email) && (
        <View style={styles.adminSection}>
          <TouchableOpacity 
            style={styles.adminButton}
            onPress={() => router.push('/admin')}
          >
            <Ionicons name="shield-checkmark" size={20} color={Colors.primary} />
            <Text style={styles.adminButtonText}>Admin Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Sign Out */}
      <View style={styles.signOutSection}>
        <TouchableOpacity 
          style={styles.signOutButton}
          onPress={handleSignOut}
        >
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom Padding */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flex: 1,
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
    top: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
  },
  coverHeaderLeft: {
    flex: 1,
  },
  coverHeaderRight: {
    flexDirection: 'row',
    gap: 8,
  },
  locationBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    alignSelf: 'flex-start',
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
  offlineText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  coverIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    gap: 4,
  },
  coverEditText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.white,
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
  section: {
    marginTop: 16,
    paddingHorizontal: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 6,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: Colors.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tagText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.primary,
  },
  adminSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  adminButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
  },
  adminButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  signOutSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  signOutButton: {
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.error,
  },

  // ── Notification Test Panel (super admin temp) ──
  testSection: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  testHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  testHeaderText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9500',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  testButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  testButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  testNotifCenterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.primary,
    backgroundColor: `${Colors.primary}0A`,
  },
  testNotifCenterText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
