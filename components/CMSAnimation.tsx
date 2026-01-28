// components/CMSAnimation.tsx
import { Colors } from '@/constants/Colors';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface CMSAnimationProps {
  amount: number;
  onComplete?: () => void;
  startPosition?: { x: number; y: number };
}

/**
 * Animated floating "+X CMS" display
 * Shows when user earns CMS points
 */
export function CMSAnimation({ 
  amount, 
  onComplete,
  startPosition
}: CMSAnimationProps) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.5)).current;

  // Center on screen if no position provided
  const position = startPosition || { 
    x: 0,  // Will be centered with alignItems in container
    y: 400  // Bottom third of screen
  };

  useEffect(() => {
    // Animation sequence - SLOWED DOWN for readability
    Animated.sequence([
      // Fade in and scale up (unchanged - this is good)
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 40,
          useNativeDriver: true,
        }),
      ]),
      // Wait longer so user can read the amount (1000ms instead of 500ms)
      Animated.delay(1000),
      // Float up and fade out - MUCH SLOWER
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -150,
          duration: 2500, // Slower float (was 1500ms)
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 1500, // Slower fade (was 1000ms)
          delay: 1000, // Start fading later (was 500ms)
          useNativeDriver: true,
        }),
      ]),
    ]).start(() => {
      onComplete?.();
    });
  }, []);

  // Color based on amount (green for small, gold for large)
  const getColor = () => {
    if (amount >= 50) return Colors.accent; // Gold for 50+
    if (amount >= 25) return '#FF9500'; // Orange for 25+
    if (amount >= 15) return '#34C759'; // Green for 15+
    return Colors.primary; // Blue for <15
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            { translateY },
            { scale },
          ],
          opacity,
          top: position.y,
        },
      ]}
    >
      <View style={[styles.bubble, { borderColor: getColor() }]}>
        <Text style={[styles.text, { color: getColor() }]}>
          +{amount} CMS
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 9999,
  },
  bubble: {
    backgroundColor: Colors.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  text: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
