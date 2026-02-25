// components/ProfileCompletionBanner.tsx
// Shows an in-app banner when the current user's profile is incomplete.
// "Incomplete" = missing photo, airline, or base (same criteria as referral completion).
//
// Dismissible once per day via AsyncStorage.
//
// Usage:
//   <ProfileCompletionBanner />           — full banner with progress bar
//   <ProfileCompletionBanner compact />   — compact single-line version
//
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { db } from '@/config/firebase';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { getProfileGaps, describeGaps, type ProfileGap } from '@/utils/sendProfileNudges';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Props ───────────────────────────────────────────────────────────────────

type ProfileCompletionBannerProps = {
  compact?: boolean;
};

const DISMISS_KEY = 'profile_completion_banner_dismissed_';

// ─── Component ───────────────────────────────────────────────────────────────

export function ProfileCompletionBanner({ compact = false }: ProfileCompletionBannerProps) {
  const { user } = useAuth();
  const [gaps, setGaps] = useState<ProfileGap[]>([]);
  const [visible, setVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    checkProfile();
  }, [user]);

  const checkProfile = async () => {
    if (!user) return;

    try {
      // Check daily dismiss
      const today = new Date().toISOString().split('T')[0];
      const wasDismissed = await AsyncStorage.getItem(`${DISMISS_KEY}${today}`);
      if (wasDismissed) return;

      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;

      const profileGaps = getProfileGaps(userDoc.data());
      if (profileGaps.length === 0) return;

      setGaps(profileGaps);
      setVisible(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } catch (error) {
      console.error('ProfileCompletionBanner error:', error);
    }
  };

  const handleDismiss = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
    });

    const today = new Date().toISOString().split('T')[0];
    await AsyncStorage.setItem(`${DISMISS_KEY}${today}`, 'true');
  };

  const handleAction = () => {
    router.push('/edit-profile-enhanced');
  };

  if (!visible || gaps.length === 0) return null;

  const completedCount = 3 - gaps.length;
  const progress = completedCount / 3;

  // ─── Compact variant ────────────────────────────────────────────────────

  if (compact) {
    return (
      <Animated.View style={[styles.compactContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.compactBanner} onPress={handleAction} activeOpacity={0.7}>
          <View style={styles.compactProgressCircle}>
            <ThemedText style={styles.compactProgressText}>
              {completedCount}/3
            </ThemedText>
          </View>
          <ThemedText style={styles.compactText} numberOfLines={1}>
            Complete your profile to connect with crew
          </ThemedText>
          <Ionicons name="chevron-forward" size={16} color={Colors.primary} />
          <TouchableOpacity
            onPress={handleDismiss}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="close" size={16} color={Colors.text.disabled} />
          </TouchableOpacity>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ─── Full variant ───────────────────────────────────────────────────────

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.banner}>
        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="person-circle" size={20} color={Colors.accent} />
          </View>
          <View style={styles.textContainer}>
            <ThemedText style={styles.title}>
              Almost there! Finish your profile
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Add {describeGaps(gaps)} so crew can find you on layovers
            </ThemedText>
          </View>
          <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
            <Ionicons name="close" size={18} color={Colors.text.disabled} />
          </TouchableOpacity>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
          </View>
          <ThemedText style={styles.progressLabel}>
            {completedCount} of 3 complete
          </ThemedText>
        </View>

        {/* Checklist */}
        <View style={styles.checklist}>
          {renderCheckItem('camera', 'Profile photo', !gaps.includes('photo'))}
          {renderCheckItem('airplane', 'Airline', !gaps.includes('airline'))}
          {renderCheckItem('location', 'Base (home airport)', !gaps.includes('base'))}
        </View>

        {/* CTA */}
        <TouchableOpacity style={styles.ctaButton} onPress={handleAction}>
          <ThemedText style={styles.ctaText}>Complete Profile</ThemedText>
          <Ionicons name="arrow-forward" size={16} color={Colors.white} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Checklist item helper ────────────────────────────────────────────────────

function renderCheckItem(icon: string, label: string, done: boolean) {
  return (
    <View style={styles.checkItem} key={label}>
      <Ionicons
        name={done ? 'checkmark-circle' : ('ellipse-outline' as any)}
        size={18}
        color={done ? Colors.success : Colors.text.disabled}
      />
      <ThemedText
        style={[
          styles.checkLabel,
          done && styles.checkLabelDone,
        ]}
      >
        {label}
      </ThemedText>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Full variant
  container: {
    marginBottom: 16,
  },
  banner: {
    backgroundColor: Colors.accent + '08',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.accent + '25',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.accent + '15',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
    marginTop: -2,
  },

  // Progress bar
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.accent,
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontWeight: '600',
  },

  // Checklist
  checklist: {
    gap: 8,
    marginBottom: 14,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkLabel: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  checkLabelDone: {
    color: Colors.text.secondary,
    textDecorationLine: 'line-through',
  },

  // CTA
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.accent,
    paddingVertical: 11,
    borderRadius: 10,
  },
  ctaText: {
    color: Colors.white,
    fontSize: 14,
    fontWeight: '600',
  },

  // Compact variant
  compactContainer: {
    marginBottom: 8,
  },
  compactBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent + '08',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.accent + '15',
    gap: 8,
  },
  compactProgressCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent + '20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactProgressText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.accent,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
  },
});
