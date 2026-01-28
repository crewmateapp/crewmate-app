// components/BadgeShowcase.tsx
import { Colors } from '@/constants/Colors';
import { ALL_BADGES, Badge } from '@/constants/BadgeDefinitions';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { BadgeDetailModal } from './BadgeDetailModal';

interface BadgeShowcaseProps {
  earnedBadges: string[]; // Array of badge IDs
  userStats?: any; // For calculating progress on locked badges
}

/**
 * Displays a showcase of earned badges and progress on locked badges
 * Shows 4-6 featured badges with a "View All" button
 */
export function BadgeShowcase({ earnedBadges, userStats }: BadgeShowcaseProps) {
  const [selectedBadge, setSelectedBadge] = useState<Badge | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // Get earned badge objects
  const earned = ALL_BADGES.filter(badge => earnedBadges.includes(badge.id));
  
  // Get some locked badges to show (first 3 that aren't earned)
  const locked = ALL_BADGES
    .filter(badge => !earnedBadges.includes(badge.id) && badge.automated)
    .slice(0, 3);
  
  // Featured badges to display (up to 6: earned + locked)
  const featuredBadges = [...earned.slice(0, 3), ...locked];

  const handleBadgeTap = (badge: Badge) => {
    setSelectedBadge(badge);
    setModalVisible(true);
  };

  const renderBadge = (badge: Badge, isEarned: boolean) => {
    return (
      <TouchableOpacity 
        key={badge.id} 
        style={[
          styles.badgeCard,
          !isEarned && styles.badgeCardLocked
        ]}
        onPress={() => handleBadgeTap(badge)}
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
            size={28} 
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

        {/* Rarity indicator for earned badges */}
        {isEarned && (
          <View style={styles.rarityDot}>
            {badge.rarity === 'legendary' && <Text style={styles.rarityEmoji}>🌟</Text>}
            {badge.rarity === 'epic' && <Text style={styles.rarityEmoji}>⚡</Text>}
            {badge.rarity === 'rare' && <Text style={styles.rarityEmoji}>💎</Text>}
          </View>
        )}

        {/* Lock icon for locked badges */}
        {!isEarned && (
          <View style={styles.lockIcon}>
            <Ionicons name="lock-closed" size={14} color={Colors.text.disabled} />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="trophy" size={20} color={Colors.primary} />
          <Text style={styles.title}>Badges</Text>
          <View style={styles.countBadge}>
            <Text style={styles.countText}>
              {earnedBadges.length}/{ALL_BADGES.filter(b => b.automated).length}
            </Text>
          </View>
        </View>
        
        <TouchableOpacity 
          style={styles.viewAllButton}
          onPress={() => {
            router.push('/badges');
          }}
        >
          <Text style={styles.viewAllText}>View All</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Badge Grid */}
      {featuredBadges.length > 0 ? (
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.badgeScroll}
        >
          {featuredBadges.map(badge => 
            renderBadge(badge, earnedBadges.includes(badge.id))
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={48} color={Colors.text.disabled} />
          <Text style={styles.emptyText}>Start earning badges!</Text>
          <Text style={styles.emptySubtext}>
            Check into cities, create plans, and connect with crew
          </Text>
        </View>
      )}

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
    marginTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  countBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 8,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    marginRight: 4,
  },
  badgeScroll: {
    paddingHorizontal: 20,
    gap: 12,
  },
  badgeCard: {
    width: 100,
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  badgeCardLocked: {
    opacity: 0.6,
  },
  badgeIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.primary,
    textAlign: 'center',
    lineHeight: 16,
  },
  badgeNameLocked: {
    color: Colors.text.secondary,
  },
  rarityDot: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  rarityEmoji: {
    fontSize: 16,
  },
  lockIcon: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 40,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: Colors.text.disabled,
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 18,
  },
});
