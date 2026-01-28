// components/LevelProgressCard.tsx
import { Colors } from '@/constants/Colors';
import { getLevelForCMS, getProgressToNextLevel, getCMSNeededForNextLevel } from '@/constants/Levels';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface LevelProgressCardProps {
  cms: number;
  level: string;
}

/**
 * Displays user's current level, CMS score, and progress to next level
 * Shows as a prominent card with gradient background
 */
export function LevelProgressCard({ cms, level }: LevelProgressCardProps) {
  const currentLevel = getLevelForCMS(cms);
  const progress = getProgressToNextLevel(cms);
  const cmsNeeded = getCMSNeededForNextLevel(cms);
  
  return (
    <View style={[styles.container, { backgroundColor: currentLevel.color }]}>
      {/* Level Badge */}
      <View style={styles.levelBadge}>
        <Ionicons name="trophy" size={24} color={Colors.white} />
        <View style={styles.levelInfo}>
          <Text style={styles.levelName}>{currentLevel.name}</Text>
          <Text style={styles.levelSubtext}>Level {currentLevel.id === 'rookie' ? '1' : currentLevel.id === 'junior' ? '2' : currentLevel.id === 'seasoned' ? '3' : currentLevel.id === 'veteran' ? '4' : currentLevel.id === 'elite' ? '5' : currentLevel.id === 'master' ? '6' : currentLevel.id === 'legend' ? '7' : '8'}</Text>
        </View>
      </View>

      {/* CMS Score */}
      <View style={styles.cmsSection}>
        <Text style={styles.cmsLabel}>CrewMate Score</Text>
        <Text style={styles.cmsValue}>{cms.toLocaleString()}</Text>
      </View>

      {/* Progress Bar */}
      {cmsNeeded !== null && (
        <View style={styles.progressSection}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill, 
                { width: `${progress}%` }
              ]} 
            />
          </View>
          <Text style={styles.progressText}>
            {cmsNeeded} CMS to {currentLevel.id === 'rookie' ? 'Junior' : currentLevel.id === 'junior' ? 'Seasoned' : currentLevel.id === 'seasoned' ? 'Veteran' : currentLevel.id === 'veteran' ? 'Elite' : currentLevel.id === 'elite' ? 'Master' : currentLevel.id === 'master' ? 'Legend' : 'Icon'} Crew
          </Text>
        </View>
      )}

      {/* At max level */}
      {cmsNeeded === null && (
        <View style={styles.maxLevelSection}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.white} />
          <Text style={styles.maxLevelText}>Maximum Level Reached!</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginTop: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  levelBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  levelInfo: {
    marginLeft: 12,
  },
  levelName: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.white,
    letterSpacing: 0.3,
  },
  levelSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: 2,
  },
  cmsSection: {
    marginBottom: 16,
  },
  cmsLabel: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.85)',
    marginBottom: 4,
    fontWeight: '600',
  },
  cmsValue: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.white,
    letterSpacing: -0.5,
  },
  progressSection: {
    marginTop: 4,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  maxLevelSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  maxLevelText: {
    fontSize: 14,
    color: Colors.white,
    fontWeight: '600',
    marginLeft: 8,
  },
});
