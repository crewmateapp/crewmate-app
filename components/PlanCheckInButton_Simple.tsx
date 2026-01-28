// components/PlanCheckInButton_Simple.tsx
// Simplified version - no time restrictions, always shows button if not completed
import { Colors } from '@/constants/Colors';
import { useCMSTracking } from '@/hooks/useCMSTracking';
import { verifyCheckInLocation, CHECK_IN_RADIUS } from '@/utils/locationVerification';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';

interface PlanCheckInButtonProps {
  plan: {
    id: string;
    hostId: string;
    hostCompletedAt?: any;
    spot: {
      name: string;
      latitude: number;
      longitude: number;
    };
  };
  userId: string;
  onCheckInComplete?: () => void;
}

export function PlanCheckInButton({ plan, userId, onCheckInComplete }: PlanCheckInButtonProps) {
  const { trackPlanCompleted } = useCMSTracking();
  const [checking, setChecking] = useState(false);

  // Only show for host and if not already completed
  if (plan.hostId !== userId || plan.hostCompletedAt) {
    return null;
  }

  const handleCheckIn = async () => {
    setChecking(true);

    try {
      // 1. Verify GPS location
      const verification = await verifyCheckInLocation(
        {
          latitude: plan.spot.latitude,
          longitude: plan.spot.longitude,
        },
        plan.spot.name,
        CHECK_IN_RADIUS.PLAN // 150m radius
      );

      if (!verification.allowed) {
        Alert.alert('Not at Location', verification.message);
        setChecking(false);
        return;
      }

      // 2. Complete plan and award stats
      await trackPlanCompleted(userId, plan.id);

      // 3. Show success
      Alert.alert(
        'Checked In! 🎉',
        'Plan completed! CMS awarded and stats updated.',
        [
          {
            text: 'Awesome!',
            onPress: () => onCheckInComplete?.(),
          },
        ]
      );
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Check-In Failed', 'Please try again.');
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.button, checking && styles.buttonDisabled]}
        onPress={handleCheckIn}
        disabled={checking}
        activeOpacity={0.8}
      >
        {checking ? (
          <>
            <ActivityIndicator color={Colors.white} size="small" />
            <Text style={styles.buttonText}>Verifying...</Text>
          </>
        ) : (
          <>
            <Ionicons name="location" size={24} color={Colors.white} />
            <Text style={styles.buttonText}>Check In at Spot</Text>
          </>
        )}
      </TouchableOpacity>
      <Text style={styles.hint}>Must be at the location to check in</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
  },
  button: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.white,
  },
  hint: {
    fontSize: 13,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    fontStyle: 'italic',
  },
});
