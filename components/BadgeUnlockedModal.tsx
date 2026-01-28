// components/BadgeUnlockedModal.tsx
import { Colors } from '@/constants/Colors';
import { Badge } from '@/constants/BadgeDefinitions';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

interface BadgeUnlockedModalProps {
  visible: boolean;
  badge: Badge | null;
  onClose: () => void;
}

/**
 * Full-screen celebration modal when user unlocks a new badge
 * Shows badge details, bonus CMS (if any), and confetti
 */
export function BadgeUnlockedModal({ 
  visible, 
  badge, 
  onClose 
}: BadgeUnlockedModalProps) {
  const confettiRef = useRef<any>(null);
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const badgeScale = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (visible && badge) {
      // Trigger confetti
      setTimeout(() => {
        confettiRef.current?.start();
      }, 200);

      // Animate modal entrance
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Animate badge icon with a slight delay
      setTimeout(() => {
        Animated.spring(badgeScale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }, 200);
    } else {
      // Reset animations
      scaleAnim.setValue(0.3);
      fadeAnim.setValue(0);
      badgeScale.setValue(0.5);
    }
  }, [visible, badge]);

  if (!visible || !badge) return null;

  // Determine rarity text and styling
  const getRarityStyle = () => {
    switch (badge.rarity) {
      case 'legendary':
        return { text: '🌟 LEGENDARY', color: '#F4C430' }; // Gold
      case 'epic':
        return { text: '⚡ EPIC', color: '#AF52DE' }; // Purple
      case 'rare':
        return { text: '💎 RARE', color: '#007AFF' }; // Blue
      case 'uncommon':
        return { text: '✨ UNCOMMON', color: '#34C759' }; // Green
      case 'exclusive':
        return { text: '👑 EXCLUSIVE', color: '#FF2D55' }; // Red
      default:
        return { text: '⭐ COMMON', color: '#8E8E93' }; // Gray
    }
  };

  const rarityStyle = getRarityStyle();

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <ConfettiCannon
          ref={confettiRef}
          count={150}
          origin={{ x: -10, y: 0 }}
          fadeOut={true}
          autoStart={false}
          explosionSpeed={300}
          fallSpeed={2500}
          colors={[
            badge.color,
            Colors.accent,
            Colors.primary,
            '#34C759',
            '#FF9500',
          ]}
        />

        <Animated.View
          style={[
            styles.content,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Badge Unlocked Text */}
          <Text style={styles.unlockText}>Badge Unlocked!</Text>

          {/* Badge Icon */}
          <Animated.View
            style={[
              styles.badgeContainer,
              {
                backgroundColor: badge.color,
                transform: [{ scale: badgeScale }],
              },
            ]}
          >
            <Ionicons 
              name={badge.icon as any} 
              size={80} 
              color={Colors.white} 
            />
          </Animated.View>

          {/* Badge Name */}
          <Text style={styles.badgeName}>{badge.name}</Text>

          {/* Rarity Badge */}
          <View style={[styles.rarityBadge, { backgroundColor: rarityStyle.color }]}>
            <Text style={styles.rarityText}>{rarityStyle.text}</Text>
          </View>

          {/* Description */}
          <Text style={styles.description}>{badge.description}</Text>

          {/* Bonus CMS (if applicable) */}
          {badge.cmsValue && (
            <View style={styles.bonusSection}>
              <Ionicons name="star" size={20} color={Colors.accent} />
              <Text style={styles.bonusText}>
                +{badge.cmsValue} CMS Bonus!
              </Text>
            </View>
          )}

          {/* Category Tag */}
          <View style={styles.categoryContainer}>
            <Text style={styles.categoryLabel}>
              {badge.category.charAt(0).toUpperCase() + badge.category.slice(1)}
            </Text>
          </View>

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: badge.color }]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.closeButtonText}>Awesome!</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: Colors.white,
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  unlockText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 20,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  badgeContainer: {
    width: 140,
    height: 140,
    borderRadius: 70,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  badgeName: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  rarityBadge: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  rarityText: {
    fontSize: 12,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: 1,
  },
  description: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
    paddingHorizontal: 8,
  },
  bonusSection: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    marginBottom: 20,
    gap: 8,
  },
  bonusText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.accent,
    letterSpacing: 0.3,
  },
  categoryContainer: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: Colors.background,
    marginBottom: 24,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  closeButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3.84,
    elevation: 5,
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.5,
  },
});
