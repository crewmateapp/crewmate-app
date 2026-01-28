// components/TestBadgeUnlock.tsx
// TEMPORARY TEST COMPONENT - Remove before production!

import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { BadgeUnlockedModal } from './BadgeUnlockedModal';
import { getBadgeById } from '@/constants/BadgeDefinitions';
import { Colors } from '@/constants/Colors';

/**
 * Test component to manually trigger badge unlock modals
 * Add this temporarily to any screen to test badge animations
 * 
 * USAGE:
 * 1. Import in any screen: import { TestBadgeUnlock } from '@/components/TestBadgeUnlock';
 * 2. Add to render: <TestBadgeUnlock />
 * 3. Tap buttons to test different badges
 * 4. REMOVE before production!
 */
export function TestBadgeUnlock() {
  const [selectedBadge, setSelectedBadge] = useState<any>(null);

  const testBadges = [
    'first_layover',
    'globe_trotter_10',
    'social_butterfly_10',
    'plan_master_5',
    'streak_master_7',
    'coffee_connoisseur',
    'foodie',
  ];

  const handleTestBadge = (badgeId: string) => {
    const badge = getBadgeById(badgeId);
    if (badge) {
      setSelectedBadge(badge);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 Badge Testing</Text>
      <Text style={styles.subtitle}>(Remove before production!)</Text>
      
      <View style={styles.buttonGrid}>
        {testBadges.map(badgeId => {
          const badge = getBadgeById(badgeId);
          return (
            <TouchableOpacity
              key={badgeId}
              style={[styles.button, { backgroundColor: badge?.color || Colors.primary }]}
              onPress={() => handleTestBadge(badgeId)}
            >
              <Text style={styles.buttonText} numberOfLines={2}>
                {badge?.name || badgeId}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <BadgeUnlockedModal
        visible={!!selectedBadge}
        badge={selectedBadge}
        onClose={() => setSelectedBadge(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    margin: 20,
    borderWidth: 2,
    borderColor: '#FF9500',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  buttonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'center',
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 140,
    alignItems: 'center',
  },
  buttonText: {
    color: Colors.white,
    fontWeight: '600',
    fontSize: 13,
    textAlign: 'center',
  },
});
