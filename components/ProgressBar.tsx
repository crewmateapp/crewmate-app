// components/ProgressBar.tsx
import { Colors } from '@/constants/Colors';
import { 
  getLevelForCMS, 
  getNextLevel, 
  getProgressToNextLevel,
  formatCMS 
} from '@/constants/Levels';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface ProgressBarProps {
  currentCMS: number;
  showLabel?: boolean;
  height?: number;
  animated?: boolean;
}

/**
 * Animated progress bar showing CMS progress to next level
 */
export function ProgressBar({ 
  currentCMS, 
  showLabel = true,
  height = 8,
  animated = true
}: ProgressBarProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;
  
  const currentLevel = getLevelForCMS(currentCMS);
  const nextLevel = getNextLevel(currentLevel);
  const progressPercent = getProgressToNextLevel(currentCMS);

  useEffect(() => {
    if (animated) {
      Animated.spring(progressAnim, {
        toValue: progressPercent,
        friction: 8,
        tension: 40,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnim.setValue(progressPercent);
    }
  }, [progressPercent]);

  if (!nextLevel) {
    // Max level reached
    return (
      <View style={styles.container}>
        {showLabel && (
          <View style={styles.labelContainer}>
            <Text style={styles.label}>Max Level Reached!</Text>
            <Text style={[styles.cms, { color: currentLevel.color }]}>
              {formatCMS(currentCMS)} CMS
            </Text>
          </View>
        )}
        <View style={[styles.progressTrack, { height }]}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: '100%',
                backgroundColor: currentLevel.color,
                height 
              }
            ]} 
          />
        </View>
      </View>
    );
  }

  const cmsNeeded = nextLevel.minCMS - currentCMS;

  return (
    <View style={styles.container}>
      {showLabel && (
        <View style={styles.labelContainer}>
          <Text style={styles.label}>
            {formatCMS(currentCMS)} / {formatCMS(nextLevel.minCMS)}
          </Text>
          <Text style={[styles.nextLevel, { color: nextLevel.color }]}>
            {cmsNeeded} to {nextLevel.name}
          </Text>
        </View>
      )}
      
      <View style={[styles.progressTrack, { height }]}>
        <Animated.View
          style={[
            styles.progressFill,
            {
              width: progressAnim.interpolate({
                inputRange: [0, 100],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: currentLevel.color,
              height,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  labelContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  cms: {
    fontSize: 15,
    fontWeight: '700',
  },
  nextLevel: {
    fontSize: 12,
    fontWeight: '600',
  },
  progressTrack: {
    width: '100%',
    backgroundColor: Colors.background,
    borderRadius: 100,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 100,
  },
});
