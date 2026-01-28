// components/BadgeDetailModal.tsx
import { Colors } from '@/constants/Colors';
import { Badge } from '@/constants/BadgeDefinitions';
import { getBadgeProgress } from '@/utils/checkBadges';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';

interface BadgeDetailModalProps {
  visible: boolean;
  badge: Badge | null;
  isEarned: boolean;
  userStats?: any;
  earnedDate?: Date;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export function BadgeDetailModal({
  visible,
  badge,
  isEarned,
  userStats,
  earnedDate,
  onClose,
}: BadgeDetailModalProps) {
  if (!badge) return null;

  const progress = !isEarned && userStats ? getBadgeProgress(badge, userStats) : '';

  const getRarityInfo = () => {
    switch (badge.rarity) {
      case 'legendary':
        return { emoji: '🌟', label: 'Legendary', color: '#FFD700' };
      case 'epic':
        return { emoji: '⚡', label: 'Epic', color: '#9B59B6' };
      case 'rare':
        return { emoji: '💎', label: 'Rare', color: '#3498DB' };
      case 'common':
      default:
        return { emoji: '⭐', label: 'Common', color: Colors.primary };
    }
  };

  const rarity = getRarityInfo();

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity 
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity 
          style={styles.modalContainer}
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={28} color={Colors.text.primary} />
          </TouchableOpacity>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            {/* Badge Icon */}
            <View 
              style={[
                styles.badgeIconLarge,
                { 
                  backgroundColor: isEarned ? badge.color : Colors.border,
                  opacity: isEarned ? 1 : 0.6 
                }
              ]}
            >
              <Ionicons 
                name={badge.icon as any} 
                size={80} 
                color={isEarned ? Colors.white : Colors.text.disabled} 
              />
              
              {/* Lock overlay for locked badges */}
              {!isEarned && (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={32} color={Colors.text.disabled} />
                </View>
              )}
            </View>

            {/* Badge Name */}
            <Text style={styles.badgeName}>{badge.name}</Text>

            {/* Rarity */}
            <View style={[styles.rarityBadge, { backgroundColor: rarity.color + '20' }]}>
              <Text style={styles.rarityEmoji}>{rarity.emoji}</Text>
              <Text style={[styles.rarityText, { color: rarity.color }]}>
                {rarity.label}
              </Text>
            </View>

            {/* Status */}
            {isEarned ? (
              <View style={styles.statusSection}>
                <View style={styles.statusBadge}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                  <Text style={styles.statusTextEarned}>Earned!</Text>
                </View>
                {earnedDate && (
                  <Text style={styles.earnedDate}>
                    {earnedDate.toLocaleDateString('en-US', { 
                      month: 'short', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </Text>
                )}
              </View>
            ) : (
              <View style={styles.statusSection}>
                <View style={[styles.statusBadge, styles.statusBadgeLocked]}>
                  <Ionicons name="lock-closed" size={20} color={Colors.text.secondary} />
                  <Text style={styles.statusTextLocked}>Locked</Text>
                </View>
              </View>
            )}

            {/* Description */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>About</Text>
              <Text style={styles.description}>{badge.description}</Text>
            </View>

            {/* Requirements */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>How to Earn</Text>
              <View style={styles.requirementBox}>
                <Ionicons name="flag" size={18} color={Colors.primary} />
                <Text style={styles.requirement}>{badge.requirement}</Text>
              </View>
              
              {/* Progress for locked badges */}
              {!isEarned && progress && (
                <View style={styles.progressBox}>
                  <Ionicons name="trending-up" size={18} color={Colors.accent} />
                  <Text style={styles.progressText}>{progress}</Text>
                </View>
              )}
            </View>

            {/* Category */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Category</Text>
              <View style={styles.categoryTag}>
                {badge.category === 'travel' && <Text>🌍 Travel</Text>}
                {badge.category === 'community' && <Text>👥 Community</Text>}
                {badge.category === 'experience' && <Text>⭐ Experience</Text>}
                {badge.category === 'founder' && <Text>🏆 Founder</Text>}
              </View>
            </View>

            {/* Tip for locked badges */}
            {!isEarned && (
              <View style={styles.tipBox}>
                <Ionicons name="bulb" size={20} color={Colors.accent} />
                <Text style={styles.tipText}>
                  Keep using CrewMate to unlock this badge!
                </Text>
              </View>
            )}
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: width - 40,
    maxHeight: '85%',
    backgroundColor: Colors.background,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    padding: 4,
  },
  scrollContent: {
    alignItems: 'center',
    paddingTop: 8,
  },
  badgeIconLarge: {
    width: 160,
    height: 160,
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeName: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
    textAlign: 'center',
    marginBottom: 12,
  },
  rarityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 20,
  },
  rarityEmoji: {
    fontSize: 18,
    marginRight: 6,
  },
  rarityText: {
    fontSize: 14,
    fontWeight: '700',
  },
  statusSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.success + '20',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 8,
  },
  statusBadgeLocked: {
    backgroundColor: Colors.border,
  },
  statusTextEarned: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.success,
    marginLeft: 8,
  },
  statusTextLocked: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  earnedDate: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  section: {
    width: '100%',
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 24,
  },
  requirementBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  requirement: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  progressBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent + '15',
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  progressText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accent,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tipBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent + '15',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    width: '100%',
  },
  tipText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
});
