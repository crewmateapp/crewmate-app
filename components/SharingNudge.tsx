// components/SharingNudge.tsx
// Contextual sharing nudge that appears in different screens
// to encourage referrals at the right moments.
//
// Usage:
//   <SharingNudge context="post_layover" />
//   <SharingNudge context="home" />
//   <SharingNudge context="profile" dismissible />
//
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getSharingNudge, type NudgeData } from '@/utils/referralData';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Props ───────────────────────────────────────────────────────────────────

type SharingNudgeProps = {
  context: 'post_layover' | 'home' | 'profile' | 'referrals';
  dismissible?: boolean;
  compact?: boolean;
  onDismiss?: () => void;
};

// Key for tracking dismissed nudges (reset daily)
const DISMISS_KEY_PREFIX = 'nudge_dismissed_';

// ─── Component ───────────────────────────────────────────────────────────────

export function SharingNudge({
  context,
  dismissible = true,
  compact = false,
  onDismiss,
}: SharingNudgeProps) {
  const { user } = useAuth();
  const [nudge, setNudge] = useState<NudgeData | null>(null);
  const [visible, setVisible] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    checkAndLoadNudge();
  }, [user]);

  const checkAndLoadNudge = async () => {
    if (!user) return;

    try {
      // Check if this nudge was already dismissed today
      const today = new Date().toISOString().split('T')[0];
      const dismissKey = `${DISMISS_KEY_PREFIX}${context}_${today}`;
      const wasDismissed = await AsyncStorage.getItem(dismissKey);
      if (wasDismissed) return;

      // Load user data to determine nudge
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      if (!userDoc.exists()) return;

      const userData = userDoc.data();
      const successfulReferrals = userData.stats?.successfulReferrals || 0;
      const badges = userData.badges || [];

      // Count total referred users
      // (We use the stat already on the doc instead of querying again)
      const totalReferred = successfulReferrals; // Close enough for nudge logic

      const nudgeData = getSharingNudge(successfulReferrals, totalReferred, badges, context);

      if (nudgeData) {
        setNudge(nudgeData);
        setVisible(true);
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    } catch (error) {
      console.error('SharingNudge error:', error);
    }
  };

  const handleDismiss = async () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setVisible(false);
      setNudge(null);
    });

    // Mark as dismissed for today
    const today = new Date().toISOString().split('T')[0];
    const dismissKey = `${DISMISS_KEY_PREFIX}${context}_${today}`;
    await AsyncStorage.setItem(dismissKey, 'true');

    onDismiss?.();
  };

  const handleAction = () => {
    // Navigate to the referrals screen — sharing happens from there
    handleDismiss();
    router.push('/referrals');
  };

  if (!visible || !nudge) return null;

  if (compact) {
    return (
      <Animated.View style={[styles.compactContainer, { opacity: fadeAnim }]}>
        <TouchableOpacity style={styles.compactBanner} onPress={handleAction} activeOpacity={0.7}>
          <Ionicons name="paper-plane" size={16} color={Colors.primary} />
          <ThemedText style={styles.compactText} numberOfLines={1}>
            {nudge.message}
          </ThemedText>
          <ThemedText style={styles.compactCta}>{nudge.cta}</ThemedText>
          {dismissible && (
            <TouchableOpacity onPress={handleDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color={Colors.text.disabled} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  }

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.banner}>
        <View style={styles.contentRow}>
          <View style={styles.iconContainer}>
            <Ionicons name="paper-plane" size={20} color={Colors.primary} />
          </View>
          <View style={styles.textContainer}>
            <ThemedText style={styles.title}>{nudge.title}</ThemedText>
            <ThemedText style={styles.message}>{nudge.message}</ThemedText>
          </View>
          {dismissible && (
            <TouchableOpacity onPress={handleDismiss} style={styles.dismissButton}>
              <Ionicons name="close" size={18} color={Colors.text.disabled} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity style={styles.ctaButton} onPress={handleAction}>
          <Ionicons name="arrow-forward" size={16} color={Colors.white} />
          <ThemedText style={styles.ctaText}>{nudge.cta}</ThemedText>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  banner: {
    backgroundColor: Colors.primary + '08',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
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
  message: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  dismissButton: {
    padding: 4,
    marginTop: -2,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
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
    backgroundColor: Colors.primary + '08',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.primary + '15',
    gap: 8,
  },
  compactText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text.secondary,
  },
  compactCta: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
});
