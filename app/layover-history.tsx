// app/layover-history.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
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
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

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

  useEffect(() => {
    if (!user) return;
    fetchLayoverHistory();
  }, [user]);

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

      // Fetch connections count
      const connectionsQuery = query(
        collection(db, 'connections'),
        where('userIds', 'array-contains', user.uid)
      );
      const connectionsSnapshot = await getDocs(connectionsQuery);

      // Fetch reviews count
      const reviewsQuery = query(
        collection(db, 'reviews'),
        where('userId', '==', user.uid)
      );
      const reviewsSnapshot = await getDocs(reviewsQuery);

      // Fetch spots added count
      const spotsQuery = query(
        collection(db, 'spots'),
        where('addedBy', '==', user.uid)
      );
      const spotsSnapshot = await getDocs(spotsQuery);

      setLayovers(fetchedLayovers);
      setStats({
        totalLayovers: fetchedLayovers.length,
        uniqueCities: cityMap.size,
        totalConnections: connectionsSnapshot.size,
        totalReviews: reviewsSnapshot.size,
        totalSpots: spotsSnapshot.size,
        favoriteCities: topCities,
      });
    } catch (error) {
      console.error('Error fetching layover history:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric', 
      year: 'numeric' 
    });
  };

  const formatDateShort = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const getLayoverDuration = (start: any, end: any) => {
    if (!start || !end) return '';
    const hours = Math.abs(end.toMillis() - start.toMillis()) / (1000 * 60 * 60);
    if (hours < 24) {
      return `${Math.round(hours)}h`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Layover History</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Layover History</ThemedText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Overview */}
        <View style={styles.statsSection}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            YOUR CREW JOURNEY
          </ThemedText>

          <View style={styles.statsGrid}>
            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconCircle, { backgroundColor: colors.primary + '20' }]}>
                <Ionicons name="airplane" size={24} color={colors.primary} />
              </View>
              <ThemedText style={styles.statNumber}>{stats.totalLayovers}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>
                Total Layovers
              </ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconCircle, { backgroundColor: colors.accent + '20' }]}>
                <Ionicons name="location" size={24} color={colors.accent} />
              </View>
              <ThemedText style={styles.statNumber}>{stats.uniqueCities}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>
                Cities Visited
              </ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconCircle, { backgroundColor: colors.success + '20' }]}>
                <Ionicons name="people" size={24} color={colors.success} />
              </View>
              <ThemedText style={styles.statNumber}>{stats.totalConnections}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>
                Connections
              </ThemedText>
            </View>

            <View style={[styles.statCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statIconCircle, { backgroundColor: colors.error + '20' }]}>
                <Ionicons name="star" size={24} color={colors.error} />
              </View>
              <ThemedText style={styles.statNumber}>{stats.totalReviews}</ThemedText>
              <ThemedText style={[styles.statLabel, { color: colors.text.secondary }]}>
                Reviews Left
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Favorite Cities */}
        {stats.favoriteCities.length > 0 && (
          <View style={styles.favoriteCitiesSection}>
            <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
              TOP DESTINATIONS
            </ThemedText>

            {stats.favoriteCities.map((cityData, index) => (
              <View
                key={cityData.city}
                style={[styles.cityCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.cityLeft}>
                  <View style={[styles.rankBadge, { backgroundColor: colors.primary }]}>
                    <ThemedText style={styles.rankText}>#{index + 1}</ThemedText>
                  </View>
                  <View style={styles.cityInfo}>
                    <ThemedText style={styles.cityName}>{cityData.city}</ThemedText>
                    <ThemedText style={[styles.cityMeta, { color: colors.text.secondary }]}>
                      {cityData.visitCount} {cityData.visitCount === 1 ? 'visit' : 'visits'} • Last: {formatDateShort(cityData.lastVisit)}
                    </ThemedText>
                  </View>
                </View>
                <View style={[styles.visitCountBadge, { backgroundColor: colors.accent + '20' }]}>
                  <ThemedText style={[styles.visitCountText, { color: colors.accent }]}>
                    {cityData.visitCount}x
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Layover Timeline */}
        <View style={styles.timelineSection}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            LAYOVER TIMELINE
          </ThemedText>

          {layovers.length > 0 ? (
            layovers.map((layover, index) => (
              <View
                key={layover.id}
                style={[styles.timelineCard, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={styles.timelineLeft}>
                  <View style={[styles.timelineDot, { backgroundColor: colors.primary }]} />
                  {index < layovers.length - 1 && (
                    <View style={[styles.timelineLine, { backgroundColor: colors.border }]} />
                  )}
                </View>
                <View style={styles.timelineContent}>
                  <View style={styles.timelineHeader}>
                    <ThemedText style={styles.timelineCity}>{layover.city}</ThemedText>
                    {layover.status === 'active' && (
                      <View style={[styles.activeLayoverBadge, { backgroundColor: colors.success }]}>
                        <ThemedText style={styles.activeLayoverText}>Active</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={[styles.timelineDate, { color: colors.text.secondary }]}>
                    {formatDate(layover.startDate)}
                    {layover.endDate && ` - ${formatDate(layover.endDate)}`}
                  </ThemedText>
                  {layover.startDate && layover.endDate && (
                    <View style={styles.timelineDuration}>
                      <Ionicons name="time-outline" size={14} color={colors.text.secondary} />
                      <ThemedText style={[styles.durationText, { color: colors.text.secondary }]}>
                        {getLayoverDuration(layover.startDate, layover.endDate)}
                      </ThemedText>
                    </View>
                  )}
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="airplane-outline" size={64} color={colors.text.secondary} />
              <ThemedText style={styles.emptyTitle}>No Layover History</ThemedText>
              <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
                Your layover history will appear here once you start tracking your trips.
              </ThemedText>
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

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
  statsSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
  },
  statIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statNumber: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
  },
  favoriteCitiesSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  cityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  rankBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  cityMeta: {
    fontSize: 13,
  },
  visitCountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  visitCountText: {
    fontSize: 16,
    fontWeight: '700',
  },
  timelineSection: {
    paddingHorizontal: 20,
    paddingTop: 32,
  },
  timelineCard: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineLeft: {
    alignItems: 'center',
    marginRight: 16,
  },
  timelineDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
  },
  timelineContent: {
    flex: 1,
    paddingVertical: 4,
    paddingRight: 16,
    paddingBottom: 16,
  },
  timelineHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 4,
  },
  timelineCity: {
    fontSize: 18,
    fontWeight: '700',
  },
  activeLayoverBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeLayoverText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  timelineDate: {
    fontSize: 14,
    marginBottom: 8,
  },
  timelineDuration: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  durationText: {
    fontSize: 13,
  },
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
