// components/LevelProgressBar.tsx
import { Colors } from '@/constants/Colors';
import { getLevelForCMS, getProgressToNextLevel, getCMSNeededForNextLevel } from '@/constants/Levels';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LevelProgressBarProps {
  cms: number;
  level: string;
}

/**
 * Compact horizontal level and CMS display
 * Shows level name, CMS score, and progress to next level
 */
export function LevelProgressBar({ cms, level }: LevelProgressBarProps) {
  const currentLevel = getLevelForCMS(cms);
  const progress = getProgressToNextLevel(cms);
  const cmsNeeded = getCMSNeededForNextLevel(cms);
  
  return (
    <View style={styles.container}>
      {/* Level Badge */}
      <View style={styles.levelSection}>
        <View style={[styles.levelDot, { backgroundColor: currentLevel.color }]} />
        <Text style={styles.levelText}>{currentLevel.name}</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* CMS Score */}
      <View style={styles.cmsSection}>
        <Text style={styles.cmsValue}>{cms.toLocaleString()}</Text>
        <Text style={styles.cmsLabel}>CMS</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Progress */}
      {cmsNeeded !== null ? (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progress}%`, backgroundColor: currentLevel.color }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}% to next</Text>
        </View>
      ) : (
        <View style={styles.maxLevelSection}>
          <Ionicons name="checkmark-circle" size={16} color={Colors.success} />
          <Text style={styles.maxLevelText}>Max Level!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 20,
    marginTop: -10, // Slight overlap, not too much
    marginBottom: 20, // Add bottom margin
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  levelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  levelDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  levelText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  divider: {
    width: 1,
    height: 20,
    backgroundColor: Colors.border,
    marginHorizontal: 12,
  },
  cmsSection: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flex: 0.8,
  },
  cmsValue: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginRight: 4,
  },
  cmsLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  progressSection: {
    flex: 1.2,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.text.secondary,
  },
  maxLevelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  maxLevelText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
    marginLeft: 4,
  },
});
