import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db, auth } from '../config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/Colors';

interface CityData {
  cityName: string;
  state: string;
  visitCount: number;
  lastVisit: Date | null;
}

export default function CitiesVisitedScreen() {
  const { userId } = useLocalSearchParams();
  const router = useRouter();
  
  const [loading, setLoading] = useState(true);
  const [viewingUser, setViewingUser] = useState<any>(null);
  const [cities, setCities] = useState<CityData[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);

  useEffect(() => {
    loadCities();
  }, [userId]);

  const loadCities = async () => {
    try {
      setLoading(true);
      const currentUser = auth.currentUser;
      if (!currentUser) return;

      const targetUserId = userId ? String(userId) : currentUser.uid;
      setIsOwnProfile(targetUserId === currentUser.uid);

      // Get user info and stats
      const userDoc = await getDoc(doc(db, 'users', targetUserId));
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      setViewingUser({ id: userDoc.id, ...userData });

      // ===== UPDATED: Read from visitedCities array =====
      const visitedCities = userData.visitedCities || [];
      
      if (visitedCities.length === 0) {
        setCities([]);
        setLoading(false);
        return;
      }

      // For each city, get layover data to calculate visit counts
      const citiesArray: CityData[] = [];
      
      for (const cityName of visitedCities) {
        // Get all layovers for this city
        const layoversQuery = query(
          collection(db, 'layovers'),
          where('userId', '==', targetUserId),
          where('city', '==', cityName)
        );
        
        const layoversSnap = await getDocs(layoversQuery);
        const visitCount = layoversSnap.size;
        
        // Find most recent visit
        let lastVisit: Date | null = null;
        layoversSnap.docs.forEach(doc => {
          const checkedInAt = doc.data().checkedInAt?.toDate();
          if (checkedInAt && (!lastVisit || checkedInAt > lastVisit)) {
            lastVisit = checkedInAt;
          }
        });
        
        citiesArray.push({
          cityName: cityName,
          state: '', // Can parse from city name if it has ", ST" format
          visitCount,
          lastVisit,
        });
      }
      
      // Sort by visit count
      citiesArray.sort((a, b) => b.visitCount - a.visitCount);

      setCities(citiesArray);
    } catch (error) {
      console.error('Error loading cities:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatLastVisit = (date: Date | null) => {
    if (!date) return '';
    
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
    return `${Math.floor(diffDays / 365)}y ago`;
  };

  const getCityEmoji = (visitCount: number) => {
    if (visitCount >= 50) return '🏆'; // Trophy
    if (visitCount >= 25) return '⭐'; // Star
    if (visitCount >= 10) return '✈️'; // Airplane
    return '📍'; // Pin
  };

  const getBadgeColor = (visitCount: number) => {
    if (visitCount >= 50) return '#FFD700'; // Gold
    if (visitCount >= 25) return '#C0C0C0'; // Silver
    if (visitCount >= 10) return '#CD7F32'; // Bronze
    return '#1e88e5'; // Default blue
  };

  const renderCityCard = (city: CityData) => {
    const emoji = getCityEmoji(city.visitCount);
    const badgeColor = getBadgeColor(city.visitCount);
    const showBadge = city.visitCount >= 10;

    return (
      <TouchableOpacity
        key={`${city.cityName}-${city.state}`}
        style={styles.cityCard}
        onPress={() => {
          // Navigate to check-ins screen filtered by this city
          router.push({
            pathname: '/check-ins',
            params: {
              userId: userId ? String(userId) : auth.currentUser?.uid,
              city: `${city.cityName}, ${city.state}`,
            },
          });
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cityContent}>
          {/* Emoji Badge */}
          <View style={[styles.emojiBadge, showBadge && { backgroundColor: badgeColor }]}>
            <Text style={styles.emojiText}>{emoji}</Text>
          </View>

          {/* City Info */}
          <View style={styles.cityInfo}>
            <Text style={styles.cityName} numberOfLines={1}>
              {city.cityName}
            </Text>
            {city.state && (
              <Text style={styles.stateName} numberOfLines={1}>
                {city.state}
              </Text>
            )}
          </View>

          {/* Visit Count + Last Visit - Stacked vertically */}
          <View style={styles.visitInfoContainer}>
            <View style={styles.visitBadge}>
              <Text style={styles.visitCount}>{city.visitCount}</Text>
              <Text style={styles.visitLabel}>
                {city.visitCount === 1 ? 'visit' : 'visits'}
              </Text>
            </View>
            {city.lastVisit && (
              <Text style={styles.lastVisit}>{formatLastVisit(city.lastVisit)}</Text>
            )}
          </View>
        </View>

        {/* Chevron */}
        <Ionicons name="chevron-forward" size={20} color="#ccc" />
      </TouchableOpacity>
    );
  };

  const renderStats = () => {
    const totalCities = cities.length;
    const totalVisits = cities.reduce((sum, city) => sum + city.visitCount, 0);
    const topCity = cities[0];
    const trophyCities = cities.filter((c) => c.visitCount >= 50).length;
    const starCities = cities.filter((c) => c.visitCount >= 25 && c.visitCount < 50).length;
    const frequentCities = cities.filter((c) => c.visitCount >= 10 && c.visitCount < 25).length;

    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsGrid}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalCities}</Text>
            <Text style={styles.statLabel}>Cities</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{totalVisits}</Text>
            <Text style={styles.statLabel}>Total Visits</Text>
          </View>
        </View>

        {topCity && (
          <View style={styles.topCityContainer}>
            <Text style={styles.topCityLabel}>Most Visited</Text>
            <View style={styles.topCityInfo}>
              <Text style={styles.topCityEmoji}>{getCityEmoji(topCity.visitCount)}</Text>
              <View>
                <Text style={styles.topCityName}>
                  {topCity.cityName}
                  {topCity.state && `, ${topCity.state}`}
                </Text>
                <Text style={styles.topCityCount}>
                  {topCity.visitCount} {topCity.visitCount === 1 ? 'visit' : 'visits'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {(trophyCities > 0 || starCities > 0 || frequentCities > 0) && (
          <View style={styles.badgesContainer}>
            <Text style={styles.badgesLabel}>Achievements</Text>
            <View style={styles.badgesGrid}>
              {trophyCities > 0 && (
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeEmoji}>🏆</Text>
                  <Text style={styles.badgeCount}>{trophyCities}</Text>
                  <Text style={styles.badgeText}>50+ visits</Text>
                </View>
              )}
              {starCities > 0 && (
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeEmoji}>⭐</Text>
                  <Text style={styles.badgeCount}>{starCities}</Text>
                  <Text style={styles.badgeText}>25+ visits</Text>
                </View>
              )}
              {frequentCities > 0 && (
                <View style={styles.badgeItem}>
                  <Text style={styles.badgeEmoji}>✈️</Text>
                  <Text style={styles.badgeCount}>{frequentCities}</Text>
                  <Text style={styles.badgeText}>10+ visits</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderEmptyState = () => {
    return (
      <View style={styles.emptyState}>
        <Ionicons name="earth-outline" size={64} color="#ccc" />
        <Text style={styles.emptyStateTitle}>
          {isOwnProfile ? 'No cities visited yet' : 'No cities to show'}
        </Text>
        <Text style={styles.emptyStateDescription}>
          {isOwnProfile
            ? 'Check in during layovers to start building your travel passport'
            : `${viewingUser?.name || 'This crew member'} hasn't checked in anywhere yet`}
        </Text>
        {isOwnProfile && (
          <TouchableOpacity
            style={styles.emptyStateButton}
            onPress={() => router.push('/(tabs)/')}
          >
            <Text style={styles.emptyStateButtonText}>Go to Home</Text>
          </TouchableOpacity>
        )}
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
          <Text style={styles.headerTitle}>Cities Visited</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e88e5" />
        </View>
      </ThemedView>
    );
  }

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
          {isOwnProfile ? 'My Cities' : `${viewingUser?.name || 'Cities'}`}
        </Text>
        <View style={styles.backButton} />
      </View>

      {cities.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          {/* Stats Section */}
          {renderStats()}

          {/* Cities List */}
          <View style={styles.citiesSection}>
            <Text style={styles.sectionTitle}>All Cities</Text>
            {cities.map(renderCityCard)}
          </View>
        </ScrollView>
      )}
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
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  statsContainer: {
    padding: 16,
    backgroundColor: '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e88e5',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  topCityContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    marginBottom: 16,
  },
  topCityLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  topCityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  topCityEmoji: {
    fontSize: 32,
  },
  topCityName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  topCityCount: {
    fontSize: 14,
    color: '#666',
  },
  badgesContainer: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  badgesLabel: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  badgesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  badgeItem: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
  },
  badgeEmoji: {
    fontSize: 24,
    marginBottom: 6,
  },
  badgeCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 2,
  },
  badgeText: {
    fontSize: 11,
    color: '#666',
    textAlign: 'center',
  },
  citiesSection: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  cityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cityContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  emojiBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emojiText: {
    fontSize: 24,
  },
  cityInfo: {
    flex: 1,
  },
  cityName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  stateName: {
    fontSize: 14,
    color: '#666',
  },
  visitInfoContainer: {
    alignItems: 'flex-end',
    gap: 4,
  },
  visitBadge: {
    alignItems: 'flex-end',
  },
  visitCount: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e88e5',
  },
  visitLabel: {
    fontSize: 12,
    color: '#666',
  },
  lastVisit: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyStateButton: {
    marginTop: 24,
    backgroundColor: '#1e88e5',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyStateButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
