// app/badges.tsx
import { Colors } from '@/constants/Colors';
import { ALL_BADGES, Badge, getBadgesByCategory } from '@/constants/BadgeDefinitions';
import { getBadgeProgress } from '@/utils/checkBadges';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity,
  ActivityIndicator 
} from 'react-native';
import { BadgeDetailModal } from '@/components/BadgeDetailModal';

type BadgeCategory = 'all' | 'founder' | 'travel' | 'community' | 'experience';

export default function BadgesScreen() {
  const { user } = useAuth();
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [userStats, setUserStats] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<BadgeCategory>('all');
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [modalVisible, setModalVisible] = useState(false);

  useEffect(() => {
    const fetchBadgeData = async () => {
      if (!user?.uid) return;
      
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setEarnedBadges(data.badges || []);
          setUserStats(data.stats || {});
        }
      } catch (error) {
        console.error('Error fetching badges:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchBadgeData();
  }, [user]);

  const getFilteredBadges = () => {
    if (selectedCategory === 'all') {
      return ALL_BADGES.filter(b => b.automated !== false);
    }
    return getBadgesByCategory(selectedCategory);
  };

  const filteredBadges = getFilteredBadges();
  const earnedCount = earnedBadges.length;
  const totalCount = ALL_BADGES.filter(b => b.automated !== false).length;

  const renderBadge = (badge: Badge) => {
    const isEarned = earnedBadges.includes(badge.id);
    const progress = !isEarned && userStats ? getBadgeProgress(badge, userStats) : '';

    return (
      <TouchableOpacity 
        key={badge.id} 
        style={[
          styles.badgeCard,
          !isEarned && styles.badgeCardLocked
        ]}
        onPress={() => {
          setSelectedBadge(badge);
          setModalVisible(true);
        }}
        activeOpacity={0.7}
      >
        {/* Badge Icon */}
        <View 
          style={[
            styles.badgeIcon,
            { backgroundColor: isEarned ? badge.color : Colors.border }
          ]}
        >
          <Ionicons 
            name={badge.icon as any} 
            size={24} 
            color={isEarned ? Colors.white : Colors.text.disabled} 
          />
        </View>

        {/* Badge Name */}
        <Text 
          style={[
            styles.badgeName,
            !isEarned && styles.badgeNameLocked
          ]} 
          numberOfLines={2}
        >
          {badge.name}
        </Text>

        {/* Rarity for earned badges */}
        {isEarned && badge.rarity === 'legendary' && (
          <View style={styles.rarityBadge}>
            <Text style={styles.rarityEmoji}>🌟</Text>
          </View>
        )}
        {isEarned && badge.rarity === 'epic' && (
          <View style={styles.rarityBadge}>
            <Text style={styles.rarityEmoji}>⚡</Text>
          </View>
        )}
        {isEarned && badge.rarity === 'rare' && (
          <View style={styles.rarityBadge}>
            <Text style={styles.rarityEmoji}>💎</Text>
          </View>
        )}

        {/* Progress for locked badges */}
        {!isEarned && progress && (
          <Text style={styles.progressText}>{progress}</Text>
        )}

        {/* Lock icon */}
        {!isEarned && (
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={10} color={Colors.text.disabled} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Badges</Text>
          <Text style={styles.subtitle}>
            {earnedCount}/{totalCount} earned
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Category Filter */}
      <View style={styles.filterContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === 'all' && styles.filterChipActive
            ]}
            onPress={() => setSelectedCategory('all')}
          >
            <Text style={[
              styles.filterText,
              selectedCategory === 'all' && styles.filterTextActive
            ]}>
              All ({totalCount})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === 'travel' && styles.filterChipActive
            ]}
            onPress={() => setSelectedCategory('travel')}
          >
            <Text style={[
              styles.filterText,
              selectedCategory === 'travel' && styles.filterTextActive
            ]}>
              🌍 Travel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === 'community' && styles.filterChipActive
            ]}
            onPress={() => setSelectedCategory('community')}
          >
            <Text style={[
              styles.filterText,
              selectedCategory === 'community' && styles.filterTextActive
            ]}>
              👥 Community
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === 'experience' && styles.filterChipActive
            ]}
            onPress={() => setSelectedCategory('experience')}
          >
            <Text style={[
              styles.filterText,
              selectedCategory === 'experience' && styles.filterTextActive
            ]}>
              ⭐ Experience
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.filterChip,
              selectedCategory === 'founder' && styles.filterChipActive
            ]}
            onPress={() => setSelectedCategory('founder')}
          >
            <Text style={[
              styles.filterText,
              selectedCategory === 'founder' && styles.filterTextActive
            ]}>
              🏆 Founder
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* Badge Grid */}
      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badgeGrid}>
          {filteredBadges.map(badge => renderBadge(badge))}
        </View>

        {/* Empty State */}
        {filteredBadges.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={64} color={Colors.text.disabled} />
            <Text style={styles.emptyText}>No badges in this category</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Badge Detail Modal */}
      <BadgeDetailModal
        visible={modalVisible}
        badge={selectedBadge}
        isEarned={selectedBadge ? earnedBadges.includes(selectedBadge.id) : false}
        userStats={userStats}
        onClose={() => {
          setModalVisible(false);
          setSelectedBadge(null);
        }}
      />
    </View>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 2,
  },
  filterContainer: {
    height: 44,
    backgroundColor: Colors.background,
  },
  filterScroll: {
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    flexDirection: 'row',
    height: 44,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    height: 28,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  filterTextActive: {
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  badgeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 10,
    justifyContent: 'space-between', // Better distribution
  },
  badgeCard: {
    width: '30%', // Reduced from 31%
    aspectRatio: 0.95, // Slightly shorter than square
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  badgeCardLocked: {
    opacity: 0.6,
  },
  badgeIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
    marginBottom: 4,
  },
  badgeName: {
    fontSize: 9.5,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 12,
    height: 24,
  },
  badgeNameLocked: {
    color: Colors.text.secondary,
  },
  rarityBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  rarityEmoji: {
    fontSize: 12,
  },
  lockIcon: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 2,
  },
  progressText: {
    fontSize: 8,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: 2,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginTop: 12,
  },
});
