// app/referrals.tsx
// Enhanced referral hub with 3 tabs: My Referrals, Leaderboard, Crew Tree
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState, useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Image,
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
import {
  fetchLeaderboard,
  fetchReferralTree,
  countTreeNodes,
  getTreeDepth,
  getSharingNudge,
  type LeaderboardEntry,
  type TreeNode,
  type NudgeData,
} from '@/utils/referralData';

// ─── Types ───────────────────────────────────────────────────────────────────

type Tab = 'referrals' | 'leaderboard' | 'tree';

type ReferredUser = {
  uid: string;
  displayName: string;
  airline: string;
  base: string;
  photoURL?: string | null;
  hasPhoto: boolean;
  hasAirline: boolean;
  hasBase: boolean;
  createdAt: string;
};

type ReferralStatus = 'completed' | 'pending';

// ─── Constants ───────────────────────────────────────────────────────────────

const RECRUITER_TIERS = [
  { id: 'recruiter_1', label: 'The Connector', target: 1 },
  { id: 'recruiter_5', label: 'The Recruiter', target: 5 },
  { id: 'recruiter_15', label: 'Crew Builder', target: 15 },
  { id: 'recruiter_25', label: 'Legend of the Crew', target: 25 },
];

const RANK_MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getReferralStatus(user: ReferredUser): ReferralStatus {
  return user.hasPhoto && user.hasAirline && user.hasBase ? 'completed' : 'pending';
}

function getPendingReason(user: ReferredUser): string {
  const missing: string[] = [];
  if (!user.hasPhoto) missing.push('profile photo');
  if (!user.hasAirline) missing.push('airline');
  if (!user.hasBase) missing.push('base');
  return `Waiting on: ${missing.join(' + ')}`;
}

function getNextTier(completedCount: number, earnedBadges: string[]) {
  for (const tier of RECRUITER_TIERS) {
    if (!earnedBadges.includes(tier.id)) return tier;
  }
  return null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReferralsScreen() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('referrals');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // My Referrals data
  const [referredUsers, setReferredUsers] = useState<ReferredUser[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<string[]>([]);

  // Leaderboard data
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);
  const [myRank, setMyRank] = useState<number | null>(null);

  // Tree data
  const [treeRoot, setTreeRoot] = useState<TreeNode | null>(null);
  const [treeLoading, setTreeLoading] = useState(false);

  // Nudge
  const [nudge, setNudge] = useState<NudgeData | null>(null);

  const referralLink = `https://crewmateapp.dev/refer/${user?.uid}`;

  // ─── Load my referrals ───────────────────────────────────────────────────

  useEffect(() => {
    loadMyReferrals();
  }, [user]);

  const loadMyReferrals = async () => {
    if (!user) return;
    try {
      const myDoc = await getDoc(doc(db, 'users', user.uid));
      if (myDoc.exists()) {
        setEarnedBadges(myDoc.data().badges || []);
      }

      const referralsQuery = query(
        collection(db, 'users'),
        where('referredBy', '==', user.uid)
      );
      const snapshot = await getDocs(referralsQuery);

      const users: ReferredUser[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          uid: d.id,
          displayName: data.displayName || 'Unknown',
          airline: data.airline || '',
          base: data.base || '',
          photoURL: data.photoURL || null,
          hasPhoto: !!data.photoURL,
          hasAirline: !!data.airline && data.airline.trim() !== '',
          hasBase: !!data.base && data.base.trim() !== '',
          createdAt: data.createdAt || '',
        };
      });

      users.sort((a, b) => {
        const statusA = getReferralStatus(a);
        const statusB = getReferralStatus(b);
        if (statusA !== statusB) return statusA === 'completed' ? -1 : 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

      setReferredUsers(users);

      // Calculate nudge
      const completedCount = users.filter(u => getReferralStatus(u) === 'completed').length;
      const badges = myDoc.exists() ? myDoc.data().badges || [] : [];
      const nudgeData = getSharingNudge(completedCount, users.length, badges, 'referrals');
      setNudge(nudgeData);
    } catch (error) {
      console.error('Error loading referrals:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Load leaderboard (lazy on tab switch) ─────────────────────────────

  const loadLeaderboard = useCallback(async () => {
    if (leaderboard.length > 0) return; // Already loaded
    setLeaderboardLoading(true);
    try {
      const entries = await fetchLeaderboard(50);
      setLeaderboard(entries);

      // Find my rank
      if (user) {
        const myIndex = entries.findIndex(e => e.uid === user.uid);
        setMyRank(myIndex >= 0 ? myIndex + 1 : null);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLeaderboardLoading(false);
    }
  }, [user, leaderboard.length]);

  // ─── Load tree (lazy on tab switch) ────────────────────────────────────

  const loadTree = useCallback(async () => {
    if (treeRoot) return; // Already loaded
    if (!user) return;
    setTreeLoading(true);
    try {
      const tree = await fetchReferralTree(user.uid, 3);
      setTreeRoot(tree);
    } catch (error) {
      console.error('Error loading tree:', error);
    } finally {
      setTreeLoading(false);
    }
  }, [user, treeRoot]);

  // ─── Tab switch handler ────────────────────────────────────────────────

  const handleTabSwitch = (tab: Tab) => {
    setActiveTab(tab);
    if (tab === 'leaderboard') loadLeaderboard();
    if (tab === 'tree') loadTree();
  };

  // ─── Sharing ───────────────────────────────────────────────────────────

  const handleCopy = async () => {
    await Clipboard.setStringAsync(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Hey crew! I'm on CrewMate — the app built by and for airline crew. Join using my link and we can connect during layovers:\n\n${referralLink}\n\nAfter you download, make sure you add your profile photo, airline, and base so we can connect! ✈️`,
        title: 'Join CrewMate',
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  // ─── Computed values ───────────────────────────────────────────────────

  const completedCount = referredUsers.filter(u => getReferralStatus(u) === 'completed').length;
  const pendingCount = referredUsers.filter(u => getReferralStatus(u) === 'pending').length;
  const nextTier = getNextTier(completedCount, earnedBadges);

  // ─── Loading state ─────────────────────────────────────────────────────

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
        <ThemedText style={styles.headerTitle}>Referrals</ThemedText>
        <View style={{ width: 28 }} />
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {([
          { key: 'referrals' as Tab, label: 'My Referrals', icon: 'people' as const },
          { key: 'leaderboard' as Tab, label: 'Leaderboard', icon: 'trophy' as const },
          { key: 'tree' as Tab, label: 'My Tree', icon: 'git-network' as const },
        ]).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => handleTabSwitch(tab.key)}
          >
            <Ionicons
              name={tab.icon}
              size={16}
              color={activeTab === tab.key ? Colors.primary : Colors.text.secondary}
            />
            <ThemedText
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: MY REFERRALS                                               */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'referrals' && (
          <>
            {/* Nudge Banner */}
            {nudge && (
              <TouchableOpacity style={styles.nudgeBanner} onPress={handleShare}>
                <View style={styles.nudgeContent}>
                  <ThemedText style={styles.nudgeTitle}>{nudge.title}</ThemedText>
                  <ThemedText style={styles.nudgeMessage}>{nudge.message}</ThemedText>
                </View>
                <View style={styles.nudgeCta}>
                  <ThemedText style={styles.nudgeCtaText}>{nudge.cta}</ThemedText>
                  <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
                </View>
              </TouchableOpacity>
            )}

            {/* Stats Row */}
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
              <ThemedText style={styles.sectionLabel}>Your Referral Link</ThemedText>
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
              <View style={styles.completionTip}>
                <Ionicons name="information-circle-outline" size={14} color={Colors.text.secondary} />
                <ThemedText style={styles.completionTipText}>
                  A referral counts when they complete their profile — photo, airline, and base.
                </ThemedText>
              </View>
            </View>

            {/* Referred Users List */}
            {referredUsers.length > 0 && (
              <View style={styles.listSection}>
                <ThemedText style={styles.sectionLabel}>Your Referrals</ThemedText>
                {referredUsers.map((referred) => {
                  const status = getReferralStatus(referred);
                  return (
                    <TouchableOpacity
                      key={referred.uid}
                      style={styles.referralRow}
                      onPress={() => router.push(`/profile/${referred.uid}` as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.avatar, { backgroundColor: status === 'completed' ? Colors.success + '20' : Colors.border }]}>
                        {referred.photoURL ? (
                          <Image source={{ uri: referred.photoURL }} style={styles.avatarImage} />
                        ) : (
                          <ThemedText style={styles.avatarText}>
                            {referred.displayName?.charAt(0) || '?'}
                          </ThemedText>
                        )}
                      </View>
                      <View style={styles.referralInfo}>
                        <ThemedText style={styles.referralName}>{referred.displayName}</ThemedText>
                        <ThemedText style={styles.referralSub}>
                          {referred.airline}{referred.base ? ` • ${referred.base}` : ''}
                        </ThemedText>
                        {status === 'pending' && (
                          <ThemedText style={styles.referralPending}>{getPendingReason(referred)}</ThemedText>
                        )}
                      </View>
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
                    </TouchableOpacity>
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
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: LEADERBOARD                                                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'leaderboard' && (
          <>
            {leaderboardLoading ? (
              <View style={styles.tabLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <ThemedText style={styles.tabLoadingText}>Loading leaderboard...</ThemedText>
              </View>
            ) : (
              <>
                {/* My Rank Card */}
                {myRank && (
                  <View style={styles.myRankCard}>
                    <View style={styles.myRankLeft}>
                      <ThemedText style={styles.myRankLabel}>Your Rank</ThemedText>
                      <View style={styles.myRankRow}>
                        <ThemedText style={styles.myRankNumber}>
                          {RANK_MEDALS[myRank] || `#${myRank}`}
                        </ThemedText>
                        <ThemedText style={styles.myRankOf}>
                          of {leaderboard.length} referrers
                        </ThemedText>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.myRankShare} onPress={handleShare}>
                      <Ionicons name="arrow-up-circle" size={20} color={Colors.primary} />
                      <ThemedText style={styles.myRankShareText}>Move Up</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}

                {!myRank && completedCount === 0 && (
                  <View style={styles.myRankCard}>
                    <View style={styles.myRankLeft}>
                      <ThemedText style={styles.myRankLabel}>Not on the board yet</ThemedText>
                      <ThemedText style={styles.myRankHint}>
                        Get your first successful referral to appear here
                      </ThemedText>
                    </View>
                    <TouchableOpacity style={styles.myRankShare} onPress={handleShare}>
                      <Ionicons name="share-outline" size={20} color={Colors.primary} />
                      <ThemedText style={styles.myRankShareText}>Invite</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Leaderboard List */}
                {leaderboard.length > 0 ? (
                  <View style={styles.leaderboardList}>
                    {leaderboard.map((entry) => {
                      const isMe = entry.uid === user?.uid;
                      const medal = RANK_MEDALS[entry.rank];
                      const hasRecruiterBadge = entry.badges.some(b => b.startsWith('recruiter_'));

                      return (
                        <TouchableOpacity
                          key={entry.uid}
                          style={[
                            styles.leaderboardRow,
                            isMe && styles.leaderboardRowMe,
                            entry.rank <= 3 && styles.leaderboardRowTop3,
                          ]}
                          onPress={() => {
                            if (!isMe) {
                              router.push(`/profile/${entry.uid}` as any);
                            }
                          }}
                          activeOpacity={isMe ? 1 : 0.7}
                        >
                          {/* Rank */}
                          <View style={styles.leaderboardRank}>
                            {medal ? (
                              <ThemedText style={styles.leaderboardMedal}>{medal}</ThemedText>
                            ) : (
                              <ThemedText style={styles.leaderboardRankNum}>#{entry.rank}</ThemedText>
                            )}
                          </View>

                          {/* Avatar */}
                          <View style={[styles.avatar, { backgroundColor: Colors.primary + '15' }]}>
                            {entry.photoURL ? (
                              <Image source={{ uri: entry.photoURL }} style={styles.avatarImage} />
                            ) : (
                              <ThemedText style={[styles.avatarText, { color: Colors.primary }]}>
                                {entry.displayName?.charAt(0) || '?'}
                              </ThemedText>
                            )}
                          </View>

                          {/* Info */}
                          <View style={styles.leaderboardInfo}>
                            <View style={styles.leaderboardNameRow}>
                              <ThemedText style={[styles.referralName, isMe && { color: Colors.primary }]}>
                                {isMe ? 'You' : entry.displayName}
                              </ThemedText>
                              {hasRecruiterBadge && (
                                <Ionicons name="ribbon" size={14} color={Colors.primary} style={{ marginLeft: 4 }} />
                              )}
                            </View>
                            <ThemedText style={styles.referralSub}>
                              {entry.airline}{entry.base ? ` • ${entry.base}` : ''}
                            </ThemedText>
                          </View>

                          {/* Count */}
                          <View style={styles.leaderboardCount}>
                            <ThemedText style={[
                              styles.leaderboardCountNum,
                              entry.rank <= 3 && { color: Colors.primary },
                            ]}>
                              {entry.successfulReferrals}
                            </ThemedText>
                            <ThemedText style={styles.leaderboardCountLabel}>referred</ThemedText>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="trophy-outline" size={56} color={Colors.text.disabled} />
                    <ThemedText style={styles.emptyTitle}>No referrers yet</ThemedText>
                    <ThemedText style={styles.emptySubtitle}>
                      Be the first on the leaderboard — invite a crew member!
                    </ThemedText>
                  </View>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: CREW TREE                                                  */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {activeTab === 'tree' && (
          <>
            {treeLoading ? (
              <View style={styles.tabLoading}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <ThemedText style={styles.tabLoadingText}>Building your crew tree...</ThemedText>
              </View>
            ) : treeRoot ? (
              <>
                {/* Tree Stats */}
                <View style={styles.treeStatsRow}>
                  <View style={styles.treeStatCard}>
                    <ThemedText style={styles.treeStatNumber}>{countTreeNodes(treeRoot)}</ThemedText>
                    <ThemedText style={styles.treeStatLabel}>Total Crew</ThemedText>
                  </View>
                  <View style={styles.treeStatCard}>
                    <ThemedText style={styles.treeStatNumber}>{treeRoot.children.length}</ThemedText>
                    <ThemedText style={styles.treeStatLabel}>Direct</ThemedText>
                  </View>
                  <View style={styles.treeStatCard}>
                    <ThemedText style={styles.treeStatNumber}>{getTreeDepth(treeRoot)}</ThemedText>
                    <ThemedText style={styles.treeStatLabel}>Generations</ThemedText>
                  </View>
                </View>

                {/* Tree Visualization */}
                {treeRoot.children.length > 0 ? (
                  <View style={styles.treeContainer}>
                    <ThemedText style={styles.sectionLabel}>Your Crew Network</ThemedText>

                    {/* Root (You) */}
                    <View style={styles.treeRootNode}>
                      <View style={[styles.treeNodeAvatar, styles.treeNodeAvatarRoot]}>
                        {treeRoot.photoURL ? (
                          <Image source={{ uri: treeRoot.photoURL }} style={styles.treeAvatarImage} />
                        ) : (
                          <Ionicons name="person" size={20} color={Colors.white} />
                        )}
                      </View>
                      <ThemedText style={styles.treeRootLabel}>You</ThemedText>
                    </View>

                    {/* Connector line from root */}
                    <View style={styles.treeRootLine} />

                    {/* Direct referrals (Level 1) */}
                    {treeRoot.children.map((child, index) => (
                      <TreeBranch
                        key={child.uid}
                        node={child}
                        depth={1}
                        isLast={index === treeRoot.children.length - 1}
                      />
                    ))}
                  </View>
                ) : (
                  <View style={styles.emptyState}>
                    <Ionicons name="git-network-outline" size={56} color={Colors.text.disabled} />
                    <ThemedText style={styles.emptyTitle}>Your tree starts here</ThemedText>
                    <ThemedText style={styles.emptySubtitle}>
                      When you invite crew and they join, your network tree will grow here. Invite someone to plant the first branch!
                    </ThemedText>
                    <TouchableOpacity style={[styles.shareButton, { marginTop: 20, alignSelf: 'center', paddingHorizontal: 24 }]} onPress={handleShare}>
                      <Ionicons name="share-outline" size={18} color={Colors.white} />
                      <ThemedText style={styles.shareButtonText}>Invite Crew</ThemedText>
                    </TouchableOpacity>
                  </View>
                )}
              </>
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="git-network-outline" size={56} color={Colors.text.disabled} />
                <ThemedText style={styles.emptyTitle}>Couldn't load tree</ThemedText>
                <ThemedText style={styles.emptySubtitle}>
                  Try again later.
                </ThemedText>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

// ─── Tree Branch Component ──────────────────────────────────────────────────

function TreeBranch({ node, depth, isLast }: { node: TreeNode; depth: number; isLast: boolean }) {
  const [expanded, setExpanded] = useState(depth <= 1);
  const hasChildren = node.children.length > 0;

  const depthColors = ['#2A4E9D', '#4CAF50', '#FF9800', '#9C27B0'];
  const branchColor = depthColors[Math.min(depth - 1, depthColors.length - 1)];

  return (
    <View style={styles.treeBranch}>
      {/* Horizontal connector + Node */}
      <View style={styles.treeBranchRow}>
        {/* Vertical + horizontal lines */}
        <View style={styles.treeConnectors}>
          {/* Vertical line (continues down if not last) */}
          <View style={[
            styles.treeVerticalLine,
            { backgroundColor: branchColor + '40' },
            isLast && styles.treeVerticalLineHalf,
          ]} />
          {/* Horizontal line to node */}
          <View style={[styles.treeHorizontalLine, { backgroundColor: branchColor + '40' }]} />
        </View>

        {/* Node */}
        <TouchableOpacity
          style={[styles.treeNode, { borderLeftColor: branchColor, borderLeftWidth: 3 }]}
          onPress={() => {
            if (hasChildren) setExpanded(!expanded);
            else router.push(`/profile/${node.uid}` as any);
          }}
          activeOpacity={0.7}
        >
          <View style={[styles.treeNodeAvatar, { backgroundColor: branchColor + '20' }]}>
            {node.photoURL ? (
              <Image source={{ uri: node.photoURL }} style={styles.treeAvatarImage} />
            ) : (
              <ThemedText style={[styles.treeNodeInitial, { color: branchColor }]}>
                {node.displayName?.charAt(0) || '?'}
              </ThemedText>
            )}
          </View>
          <View style={styles.treeNodeInfo}>
            <ThemedText style={styles.treeNodeName}>{node.displayName}</ThemedText>
            <ThemedText style={styles.treeNodeSub}>
              {node.airline}{node.base ? ` • ${node.base}` : ''}
            </ThemedText>
          </View>
          {hasChildren && (
            <View style={styles.treeNodeExpand}>
              <ThemedText style={[styles.treeNodeChildCount, { color: branchColor }]}>
                +{node.children.length}
              </ThemedText>
              <Ionicons
                name={expanded ? 'chevron-up' : 'chevron-down'}
                size={14}
                color={branchColor}
              />
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Children (indented) */}
      {expanded && hasChildren && (
        <View style={[styles.treeChildren, !isLast && { borderLeftColor: branchColor + '40', borderLeftWidth: 1, marginLeft: 15 }]}>
          {node.children.map((child, index) => (
            <TreeBranch
              key={child.uid}
              node={child}
              depth={depth + 1}
              isLast={index === node.children.length - 1}
            />
          ))}
        </View>
      )}
    </View>
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
    paddingBottom: 12,
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

  // ── Tab Bar ────────────────────────────────────────────────────────────
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginBottom: 16,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: Colors.primary + '12',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.secondary,
  },
  tabLabelActive: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // ── Nudge Banner ───────────────────────────────────────────────────────
  nudgeBanner: {
    backgroundColor: Colors.primary + '08',
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    flexDirection: 'row',
    alignItems: 'center',
  },
  nudgeContent: {
    flex: 1,
  },
  nudgeTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  nudgeMessage: {
    fontSize: 13,
    color: Colors.text.secondary,
    lineHeight: 18,
  },
  nudgeCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 12,
  },
  nudgeCtaText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  // ── Stats Row ──────────────────────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    fontWeight: '500',
  },

  // ── Progress Card ──────────────────────────────────────────────────────
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

  // ── Section Label ──────────────────────────────────────────────────────
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
  },

  // ── Link Card ──────────────────────────────────────────────────────────
  linkCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
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
  completionTip: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  completionTipText: {
    flex: 1,
    fontSize: 12,
    color: Colors.text.secondary,
    lineHeight: 17,
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

  // ── Referral List ──────────────────────────────────────────────────────
  listSection: {
    marginBottom: 16,
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
    overflow: 'hidden',
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
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

  // ── Empty State ────────────────────────────────────────────────────────
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

  // ── Tab Loading ────────────────────────────────────────────────────────
  tabLoading: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  tabLoadingText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 12,
  },

  // ═══════════════════════════════════════════════════════════════════════
  // LEADERBOARD STYLES
  // ═══════════════════════════════════════════════════════════════════════

  myRankCard: {
    backgroundColor: Colors.primary + '08',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  myRankLeft: {
    flex: 1,
  },
  myRankLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  myRankRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  myRankNumber: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.primary,
  },
  myRankOf: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  myRankHint: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  myRankShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.primary + '15',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  myRankShareText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  leaderboardList: {
    gap: 6,
  },
  leaderboardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  leaderboardRowMe: {
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '05',
  },
  leaderboardRowTop3: {
    borderColor: Colors.primary + '25',
  },
  leaderboardRank: {
    width: 32,
    alignItems: 'center',
  },
  leaderboardMedal: {
    fontSize: 22,
  },
  leaderboardRankNum: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.text.secondary,
  },
  leaderboardInfo: {
    flex: 1,
    minWidth: 0,
  },
  leaderboardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaderboardCount: {
    alignItems: 'center',
    paddingLeft: 8,
  },
  leaderboardCountNum: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  leaderboardCountLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    fontWeight: '500',
  },

  // ═══════════════════════════════════════════════════════════════════════
  // TREE STYLES
  // ═══════════════════════════════════════════════════════════════════════

  treeStatsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  treeStatCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  treeStatNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.primary,
  },
  treeStatLabel: {
    fontSize: 11,
    color: Colors.text.secondary,
    marginTop: 2,
    fontWeight: '500',
  },

  treeContainer: {
    marginBottom: 16,
  },

  // Root node
  treeRootNode: {
    alignItems: 'center',
    marginBottom: 4,
  },
  treeNodeAvatarRoot: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  treeRootLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    marginTop: 4,
  },
  treeRootLine: {
    width: 2,
    height: 20,
    backgroundColor: Colors.primary + '30',
    alignSelf: 'center',
    marginBottom: 4,
  },

  // Branch structure
  treeBranch: {
    marginLeft: 0,
  },
  treeBranchRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  treeConnectors: {
    width: 30,
    alignItems: 'flex-end',
    position: 'relative',
  },
  treeVerticalLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 15,
    width: 1,
  },
  treeVerticalLineHalf: {
    bottom: '50%',
  },
  treeHorizontalLine: {
    position: 'absolute',
    top: '50%',
    left: 15,
    right: 0,
    height: 1,
  },

  // Node card
  treeNode: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 10,
    marginVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  treeNodeAvatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  treeAvatarImage: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  treeNodeInitial: {
    fontSize: 14,
    fontWeight: '700',
  },
  treeNodeInfo: {
    flex: 1,
    minWidth: 0,
  },
  treeNodeName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  treeNodeSub: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  treeNodeExpand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  treeNodeChildCount: {
    fontSize: 12,
    fontWeight: '700',
  },
  treeChildren: {
    marginLeft: 30,
  },
});
