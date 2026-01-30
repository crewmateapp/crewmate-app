// app/(tabs)/feed.tsx - REVAMPED VERSION
import ActivityFeed from '@/components/activity-feed';
import CrewfiesFeed from '@/components/crewfies-feed';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { 
  collection, 
  doc, 
  getDoc, 
  onSnapshot, 
  orderBy, 
  query, 
  where,
  limit,
  Timestamp,
  getDocs
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type FeedTab = 'activity' | 'crewfies';

type CurrentLayover = {
  city: string;
  area: string;
  discoverable: boolean;
  isLive: boolean;
};

type CrewMember = {
  id: string;
  displayName: string;
  photoURL?: string;
  airline?: string;
  position?: string;
};

type AllConnection = {
  id: string;
  connectionId: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  airline?: string;
  position?: string;
};

export default function FeedScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<FeedTab>('activity');
  
  // User state
  const [currentLayover, setCurrentLayover] = useState<CurrentLayover | null>(null);
  const [userName, setUserName] = useState<string>('');
  
  // Who's Here Now state
  const [nearbyCrew, setNearbyCrew] = useState<CrewMember[]>([]);
  const [nearbyCrewLoading, setNearbyCrewLoading] = useState(true);
  const [nearbyCrewConnections, setNearbyCrewConnections] = useState<Set<string>>(new Set());
  
  // All Connections state
  const [allConnections, setAllConnections] = useState<AllConnection[]>([]);
  const [allConnectionsLoading, setAllConnectionsLoading] = useState(true);
  
  // Collapsible sections state
  const [statusExpanded, setStatusExpanded] = useState(true);
  const [nearbyExpanded, setNearbyExpanded] = useState(true);

  // Listen to user's current layover and level
  useEffect(() => {
    if (!user?.uid) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setCurrentLayover(data.currentLayover || null);
        setUserName(data.displayName || data.firstName || 'Crew');
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to nearby crew (Who's Here Now)
  // NOTE: This shows ALL crew in the city with active layovers, not just connections
  // This is intentional for discovery - helps users find and connect with new crew
  useEffect(() => {
    if (!user?.uid || !currentLayover?.city) {
      setNearbyCrew([]);
      setNearbyCrewLoading(false);
      setNearbyExpanded(false); // Auto-collapse if no layover
      return;
    }

    setNearbyCrewLoading(true);

    // Query for crew in same city with active layovers
    const now = Timestamp.now();
    const nearbyQuery = query(
      collection(db, 'users'),
      where('currentLayover.city', '==', currentLayover.city),
      where('currentLayover.discoverable', '==', true),
      where('currentLayover.isLive', '==', true),
      where('currentLayover.expiresAt', '>', now),
      limit(5) // Max 5 shown
    );

    const unsubscribe = onSnapshot(nearbyQuery, (snapshot) => {
      const crew: CrewMember[] = [];
      snapshot.docs.forEach((doc) => {
        if (doc.id !== user.uid) { // Exclude self
          const data = doc.data();
          crew.push({
            id: doc.id,
            displayName: data.displayName || 'Unknown',
            photoURL: data.photoURL,
            airline: data.airline,
            position: data.position,
          });
        }
      });
      setNearbyCrew(crew);
      setNearbyCrewLoading(false);
      // Auto-expand if there are crew, collapse if empty
      setNearbyExpanded(crew.length > 0);
    });

    return () => unsubscribe();
  }, [user, currentLayover]);

  // Listen to connections to know which nearby crew are already connected
  useEffect(() => {
    if (!user?.uid) {
      setNearbyCrewConnections(new Set());
      return;
    }

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(connectionsQuery, (snapshot) => {
      const connectionIds = new Set<string>();
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const otherUserId = data.userIds.find((id: string) => id !== user.uid);
        if (otherUserId) {
          connectionIds.add(otherUserId);
        }
      });
      setNearbyCrewConnections(connectionIds);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen to all connections
  useEffect(() => {
    if (!user?.uid) {
      setAllConnections([]);
      setAllConnectionsLoading(false);
      return;
    }

    setAllConnectionsLoading(true);

    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid),
      limit(8) // Show 8 connections
    );

    const unsubscribe = onSnapshot(connectionsQuery, async (snapshot) => {
      const connections: AllConnection[] = [];
      
      for (const connectionDoc of snapshot.docs) {
        const data = connectionDoc.data();
        const otherUserId = data.userIds.find((id: string) => id !== user.uid);
        
        if (otherUserId) {
          // Fetch other user's profile
          try {
            const userDoc = await getDoc(doc(db, 'users', otherUserId));
            if (userDoc.exists()) {
              const userData = userDoc.data();
              connections.push({
                id: connectionDoc.id,
                connectionId: connectionDoc.id,
                userId: otherUserId,
                displayName: userData.displayName || 'Unknown',
                photoURL: userData.photoURL,
                airline: userData.airline,
                position: userData.position,
              });
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
        }
      }
      
      setAllConnections(connections);
      setAllConnectionsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Get level emoji
  // Navigate to user profile
  const openProfile = (userId: string) => {
    router.push(`/profile/friend/${userId}`);
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        {/* My Status Card - Collapsible */}
        <View style={styles.statusCardContainer}>
          <TouchableOpacity 
            style={styles.statusCardHeader}
            onPress={() => setStatusExpanded(!statusExpanded)}
            activeOpacity={0.7}
          >
            <View style={styles.statusHeaderLeft}>
              <Text style={styles.statusHeaderTitle}>My Status</Text>
              {currentLayover && (
                <Text style={styles.statusHeaderSubtitle}>
                  {userName}
                </Text>
              )}
            </View>
            <Ionicons 
              name={statusExpanded ? "chevron-up" : "chevron-down"} 
              size={20} 
              color={Colors.text.secondary} 
            />
          </TouchableOpacity>
          
          {statusExpanded && (
            <TouchableOpacity 
              style={styles.statusCardContent}
              onPress={() => router.push('/(tabs)/')}
              activeOpacity={0.7}
            >
              {currentLayover ? (
                <View style={styles.statusLeft}>
                  <Ionicons name="airplane" size={20} color={Colors.primary} />
                  <Text style={styles.statusText}>
                    On layover in {currentLayover.city}
                  </Text>
                </View>
              ) : (
                <View style={styles.statusLeft}>
                  <Ionicons name="moon-outline" size={20} color={Colors.text.secondary} />
                  <Text style={styles.statusTextOffline}>
                    Not on layover
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Who's Here Now - Collapsible, only show if user has active layover */}
        {currentLayover && (
          <View style={styles.section}>
            <TouchableOpacity 
              style={styles.sectionHeader}
              onPress={() => setNearbyExpanded(!nearbyExpanded)}
              activeOpacity={0.7}
            >
              <View style={styles.sectionTitleRow}>
                <Text style={styles.sectionTitle}>🌍 Who's Here Now</Text>
                <Text style={styles.sectionCount}>
                  ({currentLayover.city}) · {nearbyCrew.length} crew
                </Text>
              </View>
              <Ionicons 
                name={nearbyExpanded ? "chevron-up" : "chevron-down"} 
                size={20} 
                color={Colors.text.secondary} 
              />
            </TouchableOpacity>

            {nearbyExpanded && (
              <>
                {nearbyCrewLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={Colors.primary} />
                  </View>
                ) : nearbyCrew.length > 0 ? (
                  <ScrollView 
                    horizontal 
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.crewScroll}
                  >
                    {nearbyCrew.map((crew) => {
                      const isConnection = nearbyCrewConnections.has(crew.id);
                      return (
                        <TouchableOpacity
                          key={crew.id}
                          style={styles.crewCard}
                          onPress={() => openProfile(crew.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.crewAvatarContainer}>
                            {crew.photoURL ? (
                              <Image 
                                source={{ uri: crew.photoURL }} 
                                style={[
                                  styles.crewAvatar,
                                  isConnection && styles.crewAvatarConnected
                                ]}
                              />
                            ) : (
                              <View style={[
                                styles.crewAvatarFallback,
                                isConnection && styles.crewAvatarConnected
                              ]}>
                                <Text style={styles.crewAvatarText}>
                                  {crew.displayName.charAt(0).toUpperCase()}
                                </Text>
                              </View>
                            )}
                            {isConnection && (
                              <View style={styles.connectionBadge}>
                                <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                              </View>
                            )}
                          </View>
                          <Text style={styles.crewName} numberOfLines={1}>
                            {crew.displayName.split(' ')[0]}
                          </Text>
                          {crew.airline && (
                            <Text style={styles.crewAirline} numberOfLines={1}>
                              {crew.airline}
                            </Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="people-outline" size={32} color={Colors.text.secondary} />
                    <Text style={styles.emptyText}>No crew nearby right now</Text>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* My Connections - Always show */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>👥 My Connections</Text>
              <Text style={styles.sectionCount}>
                · {allConnections.length} total
              </Text>
            </View>
            {allConnections.length > 0 && (
              <TouchableOpacity onPress={() => router.push('/connections')}>
                <Text style={styles.seeAllText}>View all</Text>
              </TouchableOpacity>
            )}
          </View>

          {allConnectionsLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          ) : allConnections.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.crewScroll}
            >
              {allConnections.map((connection) => (
                <TouchableOpacity
                  key={connection.id}
                  style={styles.crewCard}
                  onPress={() => openProfile(connection.userId)}
                  activeOpacity={0.7}
                >
                  {connection.photoURL ? (
                    <Image 
                      source={{ uri: connection.photoURL }} 
                      style={styles.crewAvatar}
                    />
                  ) : (
                    <View style={styles.crewAvatarFallback}>
                      <Text style={styles.crewAvatarText}>
                        {connection.displayName.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.crewName} numberOfLines={1}>
                    {connection.displayName.split(' ')[0]}
                  </Text>
                  {connection.airline && (
                    <Text style={styles.crewAirline} numberOfLines={1}>
                      {connection.airline}
                    </Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="people-outline" size={32} color={Colors.text.secondary} />
              <Text style={styles.emptyText}>No connections yet</Text>
              <TouchableOpacity 
                style={styles.exploreButton}
                onPress={() => router.push('/explore')}
              >
                <Text style={styles.exploreButtonText}>Find Crew</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Tab Selector */}
        <View style={styles.tabContainer}>
          <Pressable
            style={[styles.tab, activeTab === 'activity' && styles.tabActive]}
            onPress={() => setActiveTab('activity')}
          >
            <Ionicons 
              name="pulse" 
              size={20} 
              color={activeTab === 'activity' ? Colors.white : Colors.text.primary} 
            />
            <ThemedText style={[styles.tabText, activeTab === 'activity' && styles.tabTextActive]}>
              Activity
            </ThemedText>
          </Pressable>

          <Pressable
            style={[styles.tab, activeTab === 'crewfies' && styles.tabActive]}
            onPress={() => setActiveTab('crewfies')}
          >
            <Ionicons 
              name="camera" 
              size={20} 
              color={activeTab === 'crewfies' ? Colors.white : Colors.text.primary} 
            />
            <ThemedText style={[styles.tabText, activeTab === 'crewfies' && styles.tabTextActive]}>
              Crewfies
            </ThemedText>
          </Pressable>
        </View>

        {/* Feed Content */}
        {activeTab === 'activity' ? <ActivityFeed initialLimit={5} /> : <CrewfiesFeed initialLimit={3} />}

        {/* Bottom Padding */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Create Post Button (FAB - only show on Crewfies tab) */}
      {activeTab === 'crewfies' && (
        <TouchableOpacity 
          style={styles.fab}
          onPress={() => router.push('/create-post')}
        >
          <Ionicons name="add" size={28} color={Colors.white} />
        </TouchableOpacity>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 10,
  },
  scrollView: {
    flex: 1,
  },
  // Status Card Container
  statusCardContainer: {
    backgroundColor: Colors.card,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  statusCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.background,
  },
  statusHeaderLeft: {
    flex: 1,
  },
  statusHeaderTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statusHeaderSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 2,
  },
  statusCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  statusLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  statusText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  statusTextOffline: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  // Sections
  section: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  sectionCount: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Crew Cards (horizontal scroll)
  crewScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  crewCard: {
    alignItems: 'center',
    width: 80,
  },
  crewAvatarContainer: {
    position: 'relative',
    marginBottom: 8,
  },
  crewAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Colors.primary + '30',
  },
  crewAvatarConnected: {
    borderColor: Colors.success,
    borderWidth: 3,
  },
  crewAvatarFallback: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.primary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.primary + '30',
  },
  connectionBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  crewAvatarText: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  crewName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
  },
  crewAirline: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  // Loading & Empty States
  loadingContainer: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
  },
  exploreButton: {
    marginTop: 12,
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  exploreButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
  // Tabs
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 10,
    marginTop: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tabActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  // Floating Action Button
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
