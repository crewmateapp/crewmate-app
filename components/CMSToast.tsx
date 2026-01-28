// components/CMSToast.tsx
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';

export interface ToastData {
  id: string;
  message: string;
  amount: number;
  icon?: keyof typeof Ionicons.glyphMap;
}

interface CMSToastProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

/**
 * Top banner toast notification for CMS awards
 * Auto-dismisses after 3.5 seconds (increased from 2.5s for readability)
 */
export function CMSToast({ toast, onDismiss }: CMSToastProps) {
  const translateY = useRef(new Animated.Value(-100)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Slide in from top
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: 0,
        friction: 10,
        tension: 35,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto-dismiss after 3.5 seconds (increased from 2.5s)
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: -100,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => {
        onDismiss(toast.id);
      });
    }, 3500); // Increased from 2500ms

    return () => clearTimeout(timer);
  }, []);

  // Color based on amount
  const getAccentColor = () => {
    if (toast.amount >= 50) return Colors.accent; // Gold
    if (toast.amount >= 25) return '#FF9500'; // Orange
    if (toast.amount >= 15) return '#34C759'; // Green
    return Colors.primary; // Blue
  };

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.toast, { borderLeftColor: getAccentColor() }]}>
        <View style={[styles.iconContainer, { backgroundColor: getAccentColor() }]}>
          <Ionicons 
            name={toast.icon || 'star'} 
            size={20} 
            color={Colors.white} 
          />
        </View>
        
        <View style={styles.content}>
          <Text style={styles.message}>{toast.message}</Text>
          <Text style={[styles.amount, { color: getAccentColor() }]}>
            +{toast.amount} CMS
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 20,
    left: 16,
    right: 16,
    zIndex: 10000,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 12,
    paddingLeft: 8,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
    elevation: 8,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
