// components/LevelUpModal.tsx
import { Colors } from '@/constants/Colors';
import { LevelTier } from '@/constants/Levels';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

interface LevelUpModalProps {
  visible: boolean;
  oldLevel: LevelTier;
  newLevel: LevelTier;
  onClose: () => void;
}

/**
 * Full-screen celebration modal when user levels up
 * Shows confetti, new level details, and unlocked benefits
 */
export function LevelUpModal({ 
  visible, 
  oldLevel, 
  newLevel, 
  onClose 
}: LevelUpModalProps) {
  const confettiRef = useRef<any>(null);
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      // Trigger confetti
      setTimeout(() => {
        confettiRef.current?.start();
      }, 300);

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
    } else {
      // Reset animations
      scaleAnim.setValue(0.3);
      fadeAnim.setValue(0);
    }
  }, [visible]);

  if (!visible) return null;

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
          count={200}
          origin={{ x: -10, y: 0 }}
          fadeOut={true}
          autoStart={false}
          explosionSpeed={350}
          fallSpeed={2500}
          colors={[
            newLevel.color,
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
          {/* Level Up Icon */}
          <View style={[styles.iconContainer, { backgroundColor: newLevel.color }]}>
            <Ionicons name="trophy" size={64} color={Colors.white} />
          </View>

          {/* Title */}
          <Text style={styles.title}>Level Up!</Text>
          
          {/* Level Transition */}
          <View style={styles.levelTransition}>
            <View style={styles.levelBadge}>
              <Text style={[styles.levelName, { color: oldLevel.color }]}>
                {oldLevel.name}
              </Text>
            </View>
            <Ionicons 
              name="arrow-forward" 
              size={24} 
              color={Colors.text.secondary} 
              style={styles.arrow}
            />
            <View style={[styles.levelBadge, { borderColor: newLevel.color }]}>
              <Text style={[styles.levelName, { color: newLevel.color }]}>
                {newLevel.name}
              </Text>
            </View>
          </View>

          {/* New Level Description */}
          <Text style={styles.description}>{newLevel.description}</Text>

          {/* New Benefits */}
          <View style={styles.benefitsSection}>
            <Text style={styles.benefitsTitle}>🎉 New Benefits Unlocked</Text>
            <View style={styles.benefitsList}>
              {newLevel.benefits.slice(0, 3).map((benefit, index) => (
                <View key={index} style={styles.benefitItem}>
                  <Ionicons 
                    name="checkmark-circle" 
                    size={20} 
                    color={newLevel.color} 
                  />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Close Button */}
          <TouchableOpacity
            style={[styles.closeButton, { backgroundColor: newLevel.color }]}
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
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text.primary,
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  levelTransition: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  levelBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  levelName: {
    fontSize: 16,
    fontWeight: '700',
  },
  arrow: {
    marginHorizontal: 4,
  },
  description: {
    fontSize: 15,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  benefitsSection: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
    textAlign: 'center',
  },
  benefitsList: {
    gap: 12,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  benefitText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
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
