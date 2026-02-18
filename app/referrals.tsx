// app/referrals.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import * as Clipboard from 'expo-clipboard';

// ─── Types ───────────────────────────────────────────────────────────────────

type ReferredUser = {
  uid: string;
  displayName: string;
  airline: string;
  base: string;
  photoURL?: string | null;
  emailVerified: boolean;
  hasPhoto: boolean;
  createdAt: string;
};

type ReferralStatus = 'completed' | 'pending';

// ─── Badge tier thresholds for progress display ─────────────────────────────
const RECRUITER_TIERS = [
  { id: 'recruiter_1', label: 'The Connector', target: 1 },
  { id: 'recruiter_5', label: 'The Recruiter', target: 5 },
  { id: 'recruiter_15', label: 'Crew Builder', target: 15 },
  { id: 'recruiter_25', label: 'Legend of the Crew', target: 25 },
];

// ─── Helper: determine next badge tier ───────────────────────────────────────
function getNextTier(completedCount: number, earnedBadges: string[]) {
  for (const tier of RECRUITER_TIERS) {
    if (!earnedBadges.includes(tier.id)) {
      return tier;
    }
  }
  return null; // All tiers earned
}

// ─── Helper: get status of a referred user ───────────────────────────────────
function getReferralStatus(user: ReferredUser): ReferralStatus {
  return user.emailVerified && user.hasPhoto ? 'completed' : 'pending';
}

// ─── Helper: what's still needed for a pending referral ─────────────────────
function getPendingReason(user: ReferredUser): string {
  const missing: string[] = [];
  if (!user.emailVerified) missing.push('email verification');
  if (!user.hasPhoto) missing.push('profile photo');
  return `Waiting on: ${missing.join(' + ')}`;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReferralsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const referralLink = `crewmateapp://refer/${user?.uid}`;

  useEffect(() => {
    loadReferrals();
  }, [user]);

  const loadReferrals = async () => {
    if (!user) return;

    try {
      // Get current user's earned badges
      const myDoc = await getDoc(doc(db, 'users', user.uid));
      if (myDoc.exists()) {
        setEarnedBadges(myDoc.data().badges || []);
      }

      // Find all users who were referred by this user
      const referralsQuery = query(
        collection(db, 'users'),
        where('referredBy', '==', user.uid)
      );
      const snapshot = await getDocs(referralsQuery);

      const users: ReferredUser[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          uid: doc.id,
          displayName: data.displayName || 'Unknown',
          airline: data.airline || '',
          base: data.base || '',
          photoURL: data.photoURL || null,
          emailVerified: data.emailVerified === true,
          hasPhoto: !!data.photoURL,
          createdAt: data.createdAt || '',
        };
      });

      // Sort: completed first, then pending, then by createdAt descending
      users.sort((a, b) => {
        const statusA = getReferralStatus(a);
        const statusB = getReferralStatus(b);
        if (statusA !== statusB) return statusA === 'completed' ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setReferredUsers(users);
    } catch (error) {
      console.error('Error loading referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  const completedCount = referredUsers.filter(u => getReferralStatus(u) === 'completed').length;
  const pendingCount = referredUsers.filter(u => getReferralStatus(u) === 'pending').length;
  const nextTier = getNextTier(completedCount, earnedBadges);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Hey crew! I'm on CrewMate — the app built by and for airline crew. Join using my link and we can connect during layovers:\n\n${referralLink}`,
        title: 'Join CrewMate',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={28} color={Colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Refer Crew</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>

        {/* Summary Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <ThemedText style={styles.statNumber}>{referredUsers.length}</ThemedText>
            <ThemedText style={styles.statLabel}>Referred</ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText style={[styles.statNumber, { color: Colors.success }]}>{completedCount}</ThemedText>
            <ThemedText style={styles.statLabel}>Completed</ThemedText>
          </View>
          <View style={styles.statCard}>
            <ThemedText style={[styles.statNumber, { color: Colors.accent }]}>{pendingCount}</ThemedText>
            <ThemedText style={styles.statLabel}>Pending</ThemedText>
          </View>
        </View>

        {/* Next Badge Progress */}
        {nextTier && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Ionicons name="trophy" size={18} color={Colors.primary} />
              <ThemedText style={styles.progressTitle}>Next Badge</ThemedText>
            </View>
            <ThemedText style={styles.progressBadgeName}>{nextTier.label}</ThemedText>
            <View style={styles.progressBarTrack}>
              <View
                style={[
                  styles.progressBarFill,
                  { width: `${Math.min(100, (completedCount / nextTier.target) * 100)}%` },
                ]}
              />
            </View>
            <ThemedText style={styles.progressText}>
              {completedCount}/{nextTier.target} successful referrals
            </ThemedText>
          </View>
        )}

        {/* All tiers earned state */}
        {!nextTier && (
          <View style={styles.progressCard}>
            <View style={styles.progressHeader}>
              <Ionicons name="trophy" size={18} color="#F4C430" />
              <ThemedText style={[styles.progressTitle, { color: '#F4C430' }]}>All Recruiter Badges Earned!</ThemedText>
            </View>
            <ThemedText style={styles.progressText}>
              You've unlocked every referral badge. Keep spreading the word!
            </ThemedText>
          </View>
        )}

        {/* Referral Link Card */}
        <View style={styles.linkCard}>
          <ThemedText style={styles.linkLabel}>Your Referral Link</ThemedText>
          <View style={styles.linkRow}>
            <ThemedText style={styles.linkText} numberOfLines={1}>{referralLink}</ThemedText>
            <TouchableOpacity onPress={handleCopy} style={styles.copyButton}>
              <Ionicons
                name={copied ? 'checkmark' : 'copy'}
                size={20}
                color={copied ? Colors.success : Colors.primary}
              />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare}>
            <Ionicons name="share-outline" size={18} color={Colors.white} />
            <ThemedText style={styles.shareButtonText}>Share with Crew</ThemedText>
          </TouchableOpacity>
        </View>

        {/* How It Works */}
        <View style={styles.howItWorks}>
          <ThemedText style={styles.howTitle}>How It Works</ThemedText>
          <View style={styles.howStep}>
            <View style={styles.howStepNumber}>
              <ThemedText style={styles.howStepNumberText}>1</ThemedText>
            </View>
            <ThemedText style={styles.howStepText}>Share your referral link with a fellow crew member</ThemedText>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howStepNumber}>
              <ThemedText style={styles.howStepNumberText}>2</ThemedText>
            </View>
            <ThemedText style={styles.howStepText}>They sign up and verify their airline email</ThemedText>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howStepNumber}>
              <ThemedText style={styles.howStepNumberText}>3</ThemedText>
            </View>
            <ThemedText style={styles.howStepText}>They upload a profile photo — referral complete!</ThemedText>
          </View>
          <View style={styles.howStep}>
            <View style={styles.howStepNumber}>
              <ThemedText style={styles.howStepNumberText}>🎖</ThemedText>
            </View>
            <ThemedText style={styles.howStepText}>You earn badges and CMS points for each successful referral</ThemedText>
          </View>
        </View>

        {/* Referred Users List */}
        {referredUsers.length > 0 && (
          <View style={styles.listSection}>
            <ThemedText style={styles.listTitle}>Your Referrals</ThemedText>
            {referredUsers.map((referred) => {
              const status = getReferralStatus(referred);
              return (
                <View key={referred.uid} style={styles.referralRow}>
                  {/* Avatar placeholder — initials */}
                  <View style={[styles.avatar, { backgroundColor: status === 'completed' ? Colors.success + '20' : Colors.border }]}>
                    <ThemedText style={styles.avatarText}>
                      {referred.displayName?.charAt(0) || '?'}
                    </ThemedText>
                  </View>

                  {/* Info */}
                  <View style={styles.referralInfo}>
                    <ThemedText style={styles.referralName}>{referred.displayName}</ThemedText>
                    <ThemedText style={styles.referralSub}>
                      {referred.airline}{referred.base ? ` • ${referred.base}` : ''}
                    </ThemedText>
                    {status === 'pending' && (
                      <ThemedText style={styles.referralPending}>{getPendingReason(referred)}</ThemedText>
                    )}
                  </View>

                  {/* Status Chip */}
                  <View style={[
                    styles.statusChip,
                    status === 'completed' ? styles.statusChipCompleted : styles.statusChipPending,
                  ]}>
                    {status === 'completed' && (
                      <Ionicons name="checkmark" size={12} color={Colors.success} style={{ marginRight: 4 }} />
                    )}
                    <ThemedText style={[
                      styles.statusChipText,
                      status === 'completed' ? styles.statusChipTextCompleted : styles.statusChipTextPending,
                    ]}>
                      {status === 'completed' ? 'Done' : 'Pending'}
                    </ThemedText>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Empty state */}
        {referredUsers.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={56} color={Colors.text.disabled} />
            <ThemedText style={styles.emptyTitle}>No referrals yet</ThemedText>
            <ThemedText style={styles.emptySubtitle}>
              Share your link above and start earning badges when crew members join!
            </ThemedText>
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
  },
  closeButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },

  // ── Stats Row ────────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    fontWeight: '500',
  },

  // ── Progress Card ────────────────────────────────────────────────────────
  progressCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  progressTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressBadgeName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    color: Colors.text.secondary,
  },

  // ── Link Card ────────────────────────────────────────────────────────────
  linkCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  linkLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 10,
  },
  linkText: {
    flex: 1,
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '500',
  },
  copyButton: {
    padding: 4,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
  },
  shareButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontWeight: '600',
  },

  // ── How It Works ─────────────────────────────────────────────────────────
  howItWorks: {
    marginBottom: 20,
  },
  howTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  howStepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  howStepNumberText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  howStepText: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 22,
    paddingTop: 2,
  },

  // ── Referral List ────────────────────────────────────────────────────────
  listSection: {
    marginBottom: 16,
  },
  listTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  referralRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  referralInfo: {
    flex: 1,
    minWidth: 0,
  },
  referralName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  referralSub: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  referralPending: {
    fontSize: 12,
    color: Colors.accent,
    marginTop: 3,
    fontWeight: '500',
  },
  statusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    flexShrink: 0,
  },
  statusChipCompleted: {
    backgroundColor: Colors.success + '15',
  },
  statusChipPending: {
    backgroundColor: Colors.accent + '15',
  },
  statusChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusChipTextCompleted: {
    color: Colors.success,
  },
  statusChipTextPending: {
    color: Colors.accent,
  },

  // ── Empty State ──────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.disabled,
    textAlign: 'center',
    marginTop: 8,
    lineHeight: 20,
  },
});
