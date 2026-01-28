// components/StatsGrid.tsx
import { Colors } from '@/constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

interface StatItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: number | string;
  color?: string;
  onPress?: () => void; // NEW: Make stats tappable
}

interface StatsGridProps {
  stats: StatItem[];
}

/**
 * Displays user statistics in a clean 2x2 or 2x3 grid
 * Shows icons, labels, and values for quick overview
 */
export function StatsGrid({ stats }: StatsGridProps) {
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {stats.map((stat, index) => {
          const StatCard = stat.onPress ? TouchableOpacity : View;
          
          return (
            <StatCard 
              key={index} 
              style={styles.statCard}
              onPress={stat.onPress}
              activeOpacity={stat.onPress ? 0.7 : 1}
            >
              <View 
                style={[
                  styles.iconContainer, 
                  { backgroundColor: stat.color || Colors.primary }
                ]}
              >
                <Ionicons 
                  name={stat.icon} 
                  size={20} 
                  color={Colors.white} 
                />
              </View>
              <Text style={styles.value}>{stat.value}</Text>
              <Text style={styles.label}>{stat.label}</Text>
              
              {/* Show chevron if interactive */}
              {stat.onPress && (
                <Ionicons 
                  name="chevron-forward" 
                  size={14} 
                  color={Colors.text.disabled}
                  style={styles.chevron}
                />
              )}
            </StatCard>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    flex: 1,
    minWidth: '30%',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  chevron: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
});
