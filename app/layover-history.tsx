// app/layover-history.tsx - ENHANCED: Crew Journey with searchable trip memories
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StatsGrid } from '@/components/StatsGrid';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// ─── Types ────────────────────────────────────────────────────────────────────

type LayoverRecord = {
  id: string;
  city: string;
  startDate: any;
  endDate: any;
  status: string;
};

type CityStats = {
  city: string;
  visitCount: number;
  lastVisit: any;
};

type OverallStats = {
  totalLayovers: number;
  uniqueCities: number;
  totalConnections: number;
  totalReviews: number;
  totalSpots: number;
  favoriteCities: CityStats[];
};

type TripPlan = {
  id: string;
  title: string;
  city: string;
  scheduledTime: any;
  hostUserId: string;
  hostName: string;
  attendeeIds: string[];
  stops?: Array<{ spotName?: string; name?: string }>;
  isMultiStop?: boolean;
  wasHost: boolean;
};

type TripSpot = {
  id: string;
  spotId: string;
  spotName: string;
  category: string;
  city: string;
  rating: number;
  comment: string;
  createdAt: any;
  photoURLs?: string[];
};

type ExpandedData = {
  plans: TripPlan[];
  spots: TripSpot[];
  loading: boolean;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function LayoverHistoryScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [layovers, setLayovers] = useState<LayoverRecord[]>([]);
  const [stats, setStats] = useState<OverallStats>({
    totalLayovers: 0,
    uniqueCities: 0,
    totalConnections: 0,
    totalReviews: 0,
    totalSpots: 0,
    favoriteCities: [],
  });
  const [expandedLayoverId, setExpandedLayoverId] = useState<string | null>(null);
  const [expandedData, setExpandedData] = useState<Record<string, ExpandedData>>({});
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchLayoverHistory();
  }, [user]);

  // ─── Data Fetching ────────────────────────────────────────────────────────

  const fetchLayoverHistory = async () => {
    if (!user) return;

    try {
      // Fetch all layovers
      const layoversQuery = query(
        collection(db, 'layovers'),
        where('userId', '==', user.uid)
      );
      const layoversSnapshot = await getDocs(layoversQuery);
      
      const fetchedLayovers: LayoverRecord[] = [];
      const cityMap = new Map<string, CityStats>();

      layoversSnapshot.docs.forEach(doc => {
        const data = doc.data();
        fetchedLayovers.push({
          id: doc.id,
          city: data.city,
          startDate: data.startDate,
          endDate: data.endDate,
          status: data.status,
        });

        // Track city visits
        if (cityMap.has(data.city)) {
          const cityData = cityMap.get(data.city)!;
          cityData.visitCount++;
          if (data.startDate && (!cityData.lastVisit || data.startDate > cityData.lastVisit)) {
            cityData.lastVisit = data.startDate;
          }
        } else {
          cityMap.set(data.city, {
            city: data.city,
            visitCount: 1,
            lastVisit: data.startDate,
          });
        }
      });

      // Sort layovers by date (newest first)
      fetchedLayovers.sort((a, b) => {
        if (!a.startDate || !b.startDate) return 0;
        return b.startDate.toMillis() - a.startDate.toMillis();
      });

      // Get top cities
      const topCities = Array.from(cityMap.values())
        .sort((a, b) => b.visitCount - a.visitCount)
        .slice(0, 5);

      // Fetch counts in parallel
      const [connectionsSnap, reviewsSnap, spotsSnap] = await Promise.all([
        getDocs(query(collection(db, 'connections'), where('userIds', 'array-contains', user.uid))),
        getDocs(query(collection(db, 'reviews'), where('userId', '==', user.uid))),
        getDocs(query(collection(db, 'spots'), where('addedBy', '==', user.uid))),
      ]);

      setLayovers(fetchedLayovers);
      setStats({
        totalLayovers: fetchedLayovers.length,
        uniqueCities: cityMap.size,
        totalConnections: connectionsSnap.size,
        totalReviews: reviewsSnap.size,
        totalSpots: spotsSnap.size,
        favoriteCities: topCities,
      });
    } catch (error) {
      console.error('Error fetching layover history:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch plans + spots for a specific layover when expanded
  const fetchTripDetails = async (layover: LayoverRecord) => {
    if (!user?.uid) return;
    if (expandedData[layover.id]?.plans) return; // Already fetched

    setExpandedData(prev => ({
      ...prev,
      [layover.id]: { plans: [], spots: [], loading: true },
    }));

    try {
      const startDate = layover.startDate?.toDate ? layover.startDate.toDate() : new Date(layover.startDate);
      const endDate = layover.endDate?.toDate ? layover.endDate.toDate() : new Date(layover.endDate);
      // Add buffer for plans that span the layover
      endDate.setHours(23, 59, 59, 999);

      // Fetch plans (hosted + attended) in parallel
      const [hostedSnap, attendedSnap, reviewsSnap] = await Promise.all([
        getDocs(query(
          collection(db, 'plans'),
          where('hostUserId', '==', user.uid),
          where('city', '==', layover.city),
        )),
        getDocs(query(
          collection(db, 'plans'),
          where('attendeeIds', 'array-contains', user.uid),
          where('city', '==', layover.city),
        )),
        getDocs(query(
          collection(db, 'reviews'),
          where('userId', '==', user.uid),
          where('city', '==', layover.city),
        )),
      ]);

      // Process plans - filter to layover date range and deduplicate
      const planMap = new Map<string, TripPlan>();

      const addPlans = (snap: any, wasHost: boolean) => {
        snap.docs.forEach((d: any) => {
          if (planMap.has(d.id)) return;
          const data = d.data();
          const planTime = data.scheduledTime?.toDate ? data.scheduledTime.toDate() : new Date(data.scheduledTime);
          // Check if plan falls within layover date range
          if (planTime >= startDate && planTime <= endDate) {
            planMap.set(d.id, {
              id: d.id,
              title: data.title,
              city: data.city,
              scheduledTime: data.scheduledTime,
              hostUserId: data.hostUserId,
              hostName: data.hostName || 'Unknown',
              attendeeIds: data.attendeeIds || [],
              stops: data.stops,
              isMultiStop: data.isMultiStop,
              wasHost: wasHost || data.hostUserId === user.uid,
            });
          }
        });
      };

      addPlans(hostedSnap, true);
      addPlans(attendedSnap, false);

      // Process spot reviews - filter to layover date range
      const spots: TripSpot[] = [];
      reviewsSnap.docs.forEach((d: any) => {
        const data = d.data();
        const reviewDate = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt);
        if (reviewDate >= startDate && reviewDate <= endDate) {
          spots.push({
            id: d.id,
            spotId: data.spotId,
            spotName: data.spotName || data.name || 'Unknown Spot',
            category: data.category || 'other',
            city: data.city,
            rating: data.rating || 0,
            comment: data.comment || data.text || '',
            createdAt: data.createdAt,
            photoURLs: data.photoURLs,
          });
        }
      });

      // Sort plans by time, spots by date
      const plans = Array.from(planMap.values()).sort((a, b) => {
        const aTime = a.scheduledTime?.toDate ? a.scheduledTime.toDate().getTime() : 0;
        const bTime = b.scheduledTime?.toDate ? b.scheduledTime.toDate().getTime() : 0;
        return aTime - bTime;
      });

      spots.sort((a, b) => {
        const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return aTime - bTime;
      });

      setExpandedData(prev => ({
        ...prev,
        [layover.id]: { plans, spots, loading: false },
      }));
    } catch (error) {
      console.error('Error fetching trip details:', error);
      setExpandedData(prev => ({
        ...prev,
        [layover.id]: { plans: [], spots: [], loading: false },
      }));
    }
  };

  // ─── Search ─────────────────────────────────────────────────────────────────

  const filteredLayovers = useMemo(() => {
    if (!searchQuery.trim()) return layovers;
    const q = searchQuery.toLowerCase().trim();
    
    // Filter layovers by city name match
    const cityMatches = layovers.filter(l =>
      l.city.toLowerCase().includes(q)
    );

    // Also check if any expanded data matches (plans/spots)
    const dataMatches = layovers.filter(l => {
      const data = expandedData[l.id];
      if (!data) return false;
      return (
        data.plans.some(p =>
          p.title.toLowerCase().includes(q) ||
          (p.stops || []).some(s => (s.spotName || s.name || '').toLowerCase().includes(q))
        ) ||
        data.spots.some(s =>
          s.spotName.toLowerCase().includes(q) ||
          s.comment.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
        )
      );
    });

    // Combine and deduplicate
    const ids = new Set<string>();
    const result: LayoverRecord[] = [];
    [...cityMatches, ...dataMatches].forEach(l => {
      if (!ids.has(l.id)) {
        ids.add(l.id);
        result.push(l);
      }
    });

    return result;
  }, [layovers, searchQuery, expandedData]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleToggleLayover = (layover: LayoverRecord) => {
    if (expandedLayoverId === layover.id) {
      setExpandedLayoverId(null);
    } else {
      setExpandedLayoverId(layover.id);
      fetchTripDetails(layover);
    }
  };

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateShort = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const getLayoverDuration = (start: any, end: any) => {
    if (!start || !end) return '';
    const startMs = start.toMillis ? start.toMillis() : new Date(start).getTime();
    const endMs = end.toMillis ? end.toMillis() : new Date(end).getTime();
    const hours = Math.abs(endMs - startMs) / (1000 * 60 * 60);
    if (hours < 24) return `${Math.round(hours)}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'food': return 'restaurant';
      case 'coffee': return 'cafe';
      case 'bar': return 'beer';
      case 'activity': return 'fitness';
      case 'shopping': return 'cart';
      default: return 'location';
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : 'star-outline'}
          size={12}
          color={i <= rating ? Colors.accent : colors.text.secondary}
        />
      );
    }
    return stars;
  };

  // ─── Loading State ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Your Crew Journey</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={Colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Your Crew Journey</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Overview - Clickable */}
        <View style={styles.statsSection}>
          <ThemedText style={[styles.sectionLabel, { color: colors.text.secondary }]}>
            YOUR CREW JOURNEY
          </ThemedText>
        </View>
        <StatsGrid stats={[
          {
            icon: 'airplane',
            label: 'Layovers',
            value: stats.totalLayovers,
            color: Colors.primary,
          },
          {
            icon: 'location',
            label: 'Cities',
            value: stats.uniqueCities,
            color: '#FF9500',
            onPress: () => router.push('/cities-visited'),
          },
          {
            icon: 'people',
            label: 'Connections',
            value: stats.totalConnections,
            color: '#34C759',
            onPress: () => router.push('/connections'),
          },
          {
            icon: 'star',
            label: 'Reviews',
            value: stats.totalReviews,
            color: Colors.accent,
            onPress: () => router.push('/my-reviews'),
          },
        ]} />

        {/* Favorite Cities */}
        {stats.favoriteCities.length > 0 && (
          <View style={styles.favoriteCitiesSection}>
            <ThemedText style={[styles.sectionLabel, { color: colors.text.secondary }]}>
              TOP DESTINATIONS
            </ThemedText>

            {stats.favoriteCities.map((cityData, index) => (
              <View
                key={cityData.city}
                style={[styles.cityCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cityLeft}>
                  <View style={[styles.rankBadge, { backgroundColor: Colors.primary }]}>
                    <ThemedText style={styles.rankText}>#{index + 1}</ThemedText>
                  </View>
                  <View style={styles.cityInfo}>
                    <ThemedText style={styles.cityName}>{cityData.city}</ThemedText>
                    <ThemedText style={[styles.cityMeta, { color: colors.text.secondary }]}>
                      {cityData.visitCount} {cityData.visitCount === 1 ? 'visit' : 'visits'} • Last: {formatDateShort(cityData.lastVisit)}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.visitCountBadge, { backgroundColor: Colors.accent + '20' }]}>
                  <ThemedText style={[styles.visitCountText, { color: Colors.accent }]}>
                    {cityData.visitCount}x
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <ThemedText style={[styles.sectionLabel, { color: colors.text.secondary }]}>
            LAYOVER TIMELINE
          </ThemedText>
          <View style={[styles.searchBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="search" size={18} color={colors.text.secondary} />
            <TextInput
              style={[styles.searchInput, { color: colors.text.primary }]}
              placeholder="Search cities, spots, or plans..."
              placeholderTextColor={colors.text.secondary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color={colors.text.secondary} />
              </TouchableOpacity>
            )}
          </View>
          {searchQuery.length > 0 && (
            <ThemedText style={[styles.searchHint, { color: colors.text.secondary }]}>
              Tip: Tap a layover to load its plans & spots, then search again to find specific trips
            </ThemedText>
          )}
        </View>

        {/* Layover Timeline */}
        <View style={styles.timelineSection}>
          {filteredLayovers.length > 0 ? (
            filteredLayovers.map((layover, index) => {
              const isExpanded = expandedLayoverId === layover.id;
              const tripData = expandedData[layover.id];

              return (
                <View key={layover.id}>
                  {/* Layover Card - Tappable */}
                  <TouchableOpacity
                    style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: isExpanded ? Colors.primary : colors.border }]}
                    onPress={() => handleToggleLayover(layover)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.timelineLeft}>
                      <View style={[styles.timelineDot, { backgroundColor: layover.status === 'active' ? colors.success : Colors.primary }]} />
                      {index < filteredLayovers.length - 1 && !isExpanded && (
                        <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                      )}
                    </View>
                    <View style={styles.timelineContent}>
                      <View style={styles.timelineHeader}>
                        <ThemedText style={styles.timelineCity}>{layover.city}</ThemedText>
                        {layover.status === 'active' && (
                          <View style={[styles.activeBadge, { backgroundColor: colors.success }]}>
                            <ThemedText style={styles.activeBadgeText}>Active</ThemedText>
                          </View>
                        )}
                        <Ionicons 
                          name={isExpanded ? 'chevron-up' : 'chevron-down'} 
                          size={18} 
                          color={colors.text.secondary} 
                          style={{ marginLeft: 'auto' }}
                        />
                      </View>
                      <ThemedText style={[styles.timelineDate, { color: colors.text.secondary }]}>
                        {formatDate(layover.startDate)}
                        {layover.endDate && ` – ${formatDate(layover.endDate)}`}
                      </ThemedText>
                      {layover.startDate && layover.endDate && (
                        <View style={styles.timelineDuration}>
                          <Ionicons name="time-outline" size={13} color={colors.text.secondary} />
                          <ThemedText style={[styles.durationText, { color: colors.text.secondary }]}>
                            {getLayoverDuration(layover.startDate, layover.endDate)}
                          </ThemedText>
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>

                  {/* Expanded Trip Details */}
                  {isExpanded && (
                    <View style={[styles.expandedSection, { borderColor: Colors.primary }]}>
                      {tripData?.loading ? (
                        <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: 20 }} />
                      ) : (
                        <>
                          {/* Plans from this trip */}
                          {tripData && tripData.plans.length > 0 && (
                            <View style={styles.tripSubSection}>
                              <View style={styles.tripSubHeader}>
                                <Ionicons name="calendar" size={16} color={Colors.primary} />
                                <ThemedText style={styles.tripSubTitle}>
                                  Plans ({tripData.plans.length})
                                </ThemedText>
                              </View>
                              {tripData.plans.map(plan => (
                                <TouchableOpacity
                                  key={plan.id}
                                  style={[styles.tripPlanCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                                  onPress={() => router.push(`/plan/${plan.id}`)}
                                  activeOpacity={0.7}
                                >
                                  <View style={styles.tripPlanInfo}>
                                    <ThemedText style={styles.tripPlanTitle}>{plan.title}</ThemedText>
                                    <ThemedText style={[styles.tripPlanMeta, { color: colors.text.secondary }]}>
                                      {formatDate(plan.scheduledTime)} • {formatTime(plan.scheduledTime)}
                                    </ThemedText>
                                    <View style={styles.tripPlanBadges}>
                                      <View style={[styles.roleBadge, { backgroundColor: plan.wasHost ? Colors.primary + '15' : Colors.accent + '15' }]}>
                                        <ThemedText style={[styles.roleBadgeText, { color: plan.wasHost ? Colors.primary : Colors.accent }]}>
                                          {plan.wasHost ? 'Hosted' : 'Attended'}
                                        </ThemedText>
                                      </View>
                                      {plan.attendeeIds.length > 0 && (
                                        <ThemedText style={[styles.tripPlanAttendees, { color: colors.text.secondary }]}>
                                          {plan.attendeeIds.length} crew
                                        </ThemedText>
                                      )}
                                    </View>
                                  </View>
                                  <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}

                          {/* Spots reviewed during this trip */}
                          {tripData && tripData.spots.length > 0 && (
                            <View style={styles.tripSubSection}>
                              <View style={styles.tripSubHeader}>
                                <Ionicons name="star" size={16} color={Colors.accent} />
                                <ThemedText style={styles.tripSubTitle}>
                                  Spots Reviewed ({tripData.spots.length})
                                </ThemedText>
                              </View>
                              {tripData.spots.map(spot => (
                                <TouchableOpacity
                                  key={spot.id}
                                  style={[styles.tripSpotCard, { backgroundColor: colors.background, borderColor: colors.border }]}
                                  onPress={() => router.push(`/spot/${spot.spotId}`)}
                                  activeOpacity={0.7}
                                >
                                  <View style={[styles.spotCategoryIcon, { backgroundColor: Colors.primary + '15' }]}>
                                    <Ionicons name={getCategoryIcon(spot.category) as any} size={18} color={Colors.primary} />
                                  </View>
                                  <View style={styles.tripSpotInfo}>
                                    <ThemedText style={styles.tripSpotName}>{spot.spotName}</ThemedText>
                                    <View style={styles.tripSpotStars}>
                                      {renderStars(spot.rating)}
                                    </View>
                                    {spot.comment ? (
                                      <ThemedText style={[styles.tripSpotComment, { color: colors.text.secondary }]} numberOfLines={2}>
                                        "{spot.comment}"
                                      </ThemedText>
                                    ) : null}
                                  </View>
                                  <Ionicons name="chevron-forward" size={18} color={colors.text.secondary} />
                                </TouchableOpacity>
                              ))}
                            </View>
                          )}

                          {/* Empty state for expanded layover */}
                          {tripData && tripData.plans.length === 0 && tripData.spots.length === 0 && (
                            <View style={styles.tripEmptyState}>
                              <Ionicons name="document-text-outline" size={32} color={colors.text.secondary} />
                              <ThemedText style={[styles.tripEmptyText, { color: colors.text.secondary }]}>
                                No plans or spot reviews found for this trip
                              </ThemedText>
                            </View>
                          )}

                          {/* Quick Action: Explore this city again */}
                          <TouchableOpacity
                            style={[styles.exploreAgainButton, { borderColor: Colors.primary }]}
                            onPress={() => router.push(`/(tabs)/explore?city=${layover.city}`)}
                          >
                            <Ionicons name="compass-outline" size={18} color={Colors.primary} />
                            <ThemedText style={[styles.exploreAgainText, { color: Colors.primary }]}>
                              Explore {layover.city} Spots
                            </ThemedText>
                          </TouchableOpacity>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })
          ) : (
            <View style={styles.emptyState}>
              {searchQuery.length > 0 ? (
                <>
                  <Ionicons name="search-outline" size={64} color={colors.text.secondary} />
                  <ThemedText style={styles.emptyTitle}>No Results</ThemedText>
                  <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
                    No layovers match "{searchQuery}". Try expanding layovers first to search their plans and spots.
                  </ThemedText>
                </>
              ) : (
                <>
                  <Ionicons name="airplane-outline" size={64} color={colors.text.secondary} />
                  <ThemedText style={styles.emptyTitle}>No Layover History</ThemedText>
                  <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
                    Your layover history will appear here once you start tracking your trips.
                  </ThemedText>
                </>
              )}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  // ─── Stats ──────────────────────────────────────────────
  statsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  // ─── Favorite Cities ────────────────────────────────────
  favoriteCitiesSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  cityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  cityMeta: {
    fontSize: 12,
  },
  visitCountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  visitCountText: {
    fontSize: 15,
    fontWeight: '700',
  },
  // ─── Search ─────────────────────────────────────────────
  searchSection: {
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },
  searchHint: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  // ─── Timeline ───────────────────────────────────────────
  timelineSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  timelineCard: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 14,
  },
  timelineDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 3,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 6,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  timelineCity: {
    fontSize: 17,
    fontWeight: '700',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  activeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineDate: {
    fontSize: 13,
    marginBottom: 6,
  },
  timelineDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  durationText: {
    fontSize: 12,
  },
  // ─── Expanded Trip Details ──────────────────────────────
  expandedSection: {
    marginTop: -8,
    marginBottom: 16,
    marginLeft: 28,
    paddingLeft: 16,
    paddingVertical: 12,
    borderLeftWidth: 2,
  },
  tripSubSection: {
    marginBottom: 16,
  },
  tripSubHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  tripSubTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  // Plan cards within expanded trip
  tripPlanCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
  },
  tripPlanInfo: {
    flex: 1,
  },
  tripPlanTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  tripPlanMeta: {
    fontSize: 12,
    marginBottom: 6,
  },
  tripPlanBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  tripPlanAttendees: {
    fontSize: 12,
  },
  // Spot cards within expanded trip
  tripSpotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  spotCategoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tripSpotInfo: {
    flex: 1,
  },
  tripSpotName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  tripSpotStars: {
    flexDirection: 'row',
    gap: 2,
    marginBottom: 4,
  },
  tripSpotComment: {
    fontSize: 12,
    fontStyle: 'italic',
    lineHeight: 16,
  },
  // Empty state for expanded trip
  tripEmptyState: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  tripEmptyText: {
    fontSize: 13,
    textAlign: 'center',
  },
  // Explore again quick action
  exploreAgainButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
  },
  exploreAgainText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // ─── Empty State ────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
});
