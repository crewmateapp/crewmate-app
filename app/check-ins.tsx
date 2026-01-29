// app/check-ins.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { collection, query, where, getDocs, orderBy, getDoc, doc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

type CheckIn = {
  id: string;
  city: string;
  area: string;
  startDate: Date;
  endDate: Date;
  duration: number;
  coordinates?: {
    latitude: number;
    longitude: number;
  };
};

type CityStats = {
  city: string;
  count: number;
  lastVisit: Date;
};

// Native date formatting helper
function formatDate(date: Date, formatType: 'short' | 'full' = 'short'): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = months[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();
  
  if (formatType === 'short') {
    return `${month} ${day}`;
  }
  return `${month} ${day}, ${year}`;
}

// Native days difference helper
function getDaysDifference(startDate: Date, endDate: Date): number {
  const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

export default function CheckInsScreen() {
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const userId = (params.userId as string) || user?.uid;
  const isOwnProfile = userId === user?.uid;
  
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [cityStats, setCityStats] = useState<CityStats[]>([]);
  const [userName, setUserName] = useState('');

  useEffect(() => {
    fetchCheckIns();
  }, [userId]);

  const fetchCheckIns = async () => {
    if (!userId) return;

    try {
      // Fetch user name if not own profile
      if (!isOwnProfile) {
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData.displayName || userData.firstName || 'User');
        }
      }

      // Fetch all layovers for this user
      const layoversQuery = query(
        collection(db, 'layovers'),
        where('userId', '==', userId),
        orderBy('startDate', 'desc')
      );

      const snapshot = await getDocs(layoversQuery);
      
      const checkInsData: CheckIn[] = [];
      const cityCounts: { [key: string]: { count: number; lastVisit: Date } } = {};

      snapshot.forEach((doc) => {
        const data = doc.data();
        const startDate = data.startDate?.toDate() || new Date();
        const endDate = data.endDate?.toDate() || new Date();
        const duration = getDaysDifference(startDate, endDate);

        checkInsData.push({
          id: doc.id,
          city: data.city,
          area: data.area || '',
          startDate,
          endDate,
          duration,
          coordinates: data.coordinates,
        });

        // Track city visits
        if (!cityCounts[data.city]) {
          cityCounts[data.city] = { count: 0, lastVisit: startDate };
        }
        cityCounts[data.city].count += 1;
        if (startDate > cityCounts[data.city].lastVisit) {
          cityCounts[data.city].lastVisit = startDate;
        }
      });

      // Convert city stats to array and sort by count
      const stats: CityStats[] = Object.entries(cityCounts).map(([city, data]) => ({
        city,
        count: data.count,
        lastVisit: data.lastVisit,
      }));
      stats.sort((a, b) => b.count - a.count);

      setCheckIns(checkInsData);
      setCityStats(stats);
    } catch (error) {
      console.error('Error fetching check-ins:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderCheckInCard = (checkIn: CheckIn) => {
    const isMultiDay = checkIn.duration > 1;
    const isSameMonth = checkIn.startDate.getMonth() === checkIn.endDate.getMonth();
    
    let dateDisplay = '';
    if (checkIn.duration === 1) {
      dateDisplay = formatDate(checkIn.startDate, 'full');
    } else if (isSameMonth) {
      dateDisplay = `${formatDate(checkIn.startDate, 'short')}-${checkIn.endDate.getDate()}, ${checkIn.endDate.getFullYear()}`;
    } else {
      dateDisplay = `${formatDate(checkIn.startDate, 'short')} - ${formatDate(checkIn.endDate, 'full')}`;
    }

    return (
      <View key={checkIn.id} style={styles.checkInCard}>
        <View style={styles.timelineContainer}>
          <View style={styles.timelineDot} />
          <View style={styles.timelineLine} />
        </View>

        <View style={styles.checkInContent}>
          <View style={styles.cityHeader}>
            <Ionicons name="location" size={20} color={Colors.primary} />
            <Text style={styles.cityName}>{checkIn.city}</Text>
            {checkIn.area && (
              <Text style={styles.areaName}> • {checkIn.area}</Text>
            )}
          </View>

          <View style={styles.detailsRow}>
            <View style={styles.detailItem}>
              <Ionicons name="calendar-outline" size={14} color={Colors.text.secondary} />
              <Text style={styles.detailText}>{dateDisplay}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={14} color={Colors.text.secondary} />
              <Text style={styles.detailText}>
                {checkIn.duration} {checkIn.duration === 1 ? 'day' : 'days'}
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderCityStats = () => {
    if (cityStats.length === 0) return null;

    const topCities = cityStats.slice(0, 5);

    return (
      <View style={styles.statsSection}>
        <Text style={styles.statsTitle}>Top Cities</Text>
        <View style={styles.cityStatsContainer}>
          {topCities.map((stat, index) => (
            <View key={stat.city} style={styles.cityStatCard}>
              <View style={styles.cityStatRank}>
                <Text style={styles.rankNumber}>{index + 1}</Text>
              </View>
              <View style={styles.cityStatInfo}>
                <Text style={styles.cityStatName}>{stat.city}</Text>
                <Text style={styles.cityStatCount}>
                  {stat.count} {stat.count === 1 ? 'visit' : 'visits'}
                </Text>
              </View>
              <View style={styles.cityStatBadge}>
                {stat.count >= 10 && (
                  <Ionicons name="trophy" size={18} color={Colors.accent} />
                )}
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity 
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Check-ins</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </ThemedView>
    );
  }

  const totalCities = cityStats.length;
  const totalCheckIns = checkIns.length;

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          {isOwnProfile ? 'My Check-ins' : `${userName}'s Check-ins`}
        </Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{totalCheckIns}</Text>
            <Text style={styles.summaryLabel}>Check-ins</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryNumber}>{totalCities}</Text>
            <Text style={styles.summaryLabel}>Cities</Text>
          </View>
        </View>

        {renderCityStats()}

        {checkIns.length > 0 ? (
          <View style={styles.timelineSection}>
            <Text style={styles.sectionTitle}>Timeline</Text>
            {checkIns.map(renderCheckInCard)}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="airplane-outline" size={64} color={Colors.text.tertiary} />
            <Text style={styles.emptyTitle}>No check-ins yet</Text>
            <Text style={styles.emptyText}>
              {isOwnProfile 
                ? 'Start a layover to record your first check-in!'
                : 'This crew member hasn\'t checked in anywhere yet.'}
            </Text>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollView: { flex: 1 },
  summaryCard: { flexDirection: 'row', backgroundColor: Colors.card, marginHorizontal: 20, marginTop: 20, borderRadius: 16, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryNumber: { fontSize: 32, fontWeight: '700', color: Colors.primary },
  summaryLabel: { fontSize: 14, fontWeight: '500', color: Colors.text.secondary, marginTop: 4 },
  summaryDivider: { width: 1, backgroundColor: Colors.border, marginHorizontal: 20 },
  statsSection: { marginHorizontal: 20, marginTop: 24 },
  statsTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 12 },
  cityStatsContainer: { gap: 8 },
  cityStatCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.card, borderRadius: 12, padding: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cityStatRank: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  rankNumber: { fontSize: 14, fontWeight: '700', color: Colors.primary },
  cityStatInfo: { flex: 1 },
  cityStatName: { fontSize: 16, fontWeight: '600', color: Colors.text.primary },
  cityStatCount: { fontSize: 13, fontWeight: '500', color: Colors.text.secondary, marginTop: 2 },
  cityStatBadge: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  timelineSection: { marginTop: 32, marginHorizontal: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 16 },
  checkInCard: { flexDirection: 'row', marginBottom: 16 },
  timelineContainer: { width: 40, alignItems: 'center' },
  timelineDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: Colors.primary, borderWidth: 3, borderColor: Colors.background, shadowColor: Colors.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 2 },
  timelineLine: { flex: 1, width: 2, backgroundColor: Colors.border, marginTop: 4 },
  checkInContent: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  cityHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  cityName: { fontSize: 17, fontWeight: '700', color: Colors.text.primary, marginLeft: 8 },
  areaName: { fontSize: 15, fontWeight: '500', color: Colors.text.secondary },
  detailsRow: { flexDirection: 'row', gap: 16 },
  detailItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  detailText: { fontSize: 13, fontWeight: '500', color: Colors.text.secondary },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: Colors.text.primary, marginTop: 16, textAlign: 'center' },
  emptyText: { fontSize: 15, fontWeight: '500', color: Colors.text.secondary, marginTop: 8, textAlign: 'center', lineHeight: 22 },
});
