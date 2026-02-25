// utils/referralData.ts
// Shared data fetching for referral leaderboard, tree, and nudge logic
import { db } from '@/config/firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LeaderboardEntry = {
  uid: string;
  displayName: string;
  airline: string;
  base: string;
  photoURL?: string | null;
  successfulReferrals: number;
  rank: number;
  badges: string[];
};

export type TreeNode = {
  uid: string;
  displayName: string;
  airline: string;
  base: string;
  photoURL?: string | null;
  createdAt: string;
  children: TreeNode[];
};

export type NudgeType =
  | 'post_layover'      // After checking out of a layover
  | 'milestone'         // After hitting a referral milestone
  | 'first_referral'    // Encouragement when they have 0 referrals
  | 'close_to_badge'    // 1 away from a badge tier
  | 'streak'            // They've been active but haven't shared recently
  | null;

export type NudgeData = {
  type: NudgeType;
  title: string;
  message: string;
  cta: string;
};

// ─── Badge tier thresholds ────────────────────────────────────────────────────
const BADGE_TIERS = [1, 5, 15, 25];

// ─── Leaderboard ──────────────────────────────────────────────────────────────
// Fetches top referrers across all users, ranked by successfulReferrals.
// Returns up to `count` entries (default 25).
//
export async function fetchLeaderboard(count: number = 25): Promise<LeaderboardEntry[]> {
  try {
    // Query users who have at least 1 successful referral, ordered descending
    const q = query(
      collection(db, 'users'),
      where('stats.successfulReferrals', '>', 0),
      orderBy('stats.successfulReferrals', 'desc'),
      limit(count)
    );

    console.log('📊 Leaderboard: fetching...');
    const snapshot = await getDocs(q);
    console.log(`📊 Leaderboard: found ${snapshot.size} entries`);

    const entries: LeaderboardEntry[] = snapshot.docs.map((docSnap, index) => {
      const data = docSnap.data();
      return {
        uid: docSnap.id,
        displayName: data.displayName || 'Unknown',
        airline: data.airline || '',
        base: data.base || '',
        photoURL: data.photoURL || null,
        successfulReferrals: data.stats?.successfulReferrals || 0,
        rank: index + 1,
        badges: data.badges || [],
      };
    });

    return entries;
  } catch (error: any) {
    // Firebase index errors contain a URL to create the missing index
    const errorMsg = error?.message || String(error);
    console.error('📊 Leaderboard error:', errorMsg);

    if (errorMsg.includes('index') || errorMsg.includes('requires an index')) {
      console.error('📊 ⚠️ MISSING FIRESTORE INDEX — Check the error above for a link to create it');
    }

    return [];
  }
}

// ─── Referral Tree ────────────────────────────────────────────────────────────
// Builds a tree starting from `rootUserId`, showing who they referred,
// and who those people referred, recursively (up to `maxDepth` levels).
//
export async function fetchReferralTree(
  rootUserId: string,
  maxDepth: number = 3
): Promise<TreeNode | null> {
  try {
    const rootDoc = await getDoc(doc(db, 'users', rootUserId));
    if (!rootDoc.exists()) return null;

    const rootData = rootDoc.data();
    const rootNode: TreeNode = {
      uid: rootUserId,
      displayName: rootData.displayName || 'You',
      airline: rootData.airline || '',
      base: rootData.base || '',
      photoURL: rootData.photoURL || null,
      createdAt: rootData.createdAt || '',
      children: [],
    };

    // Recursively build the tree
    await buildTreeChildren(rootNode, 1, maxDepth);

    return rootNode;
  } catch (error) {
    console.error('fetchReferralTree error:', error);
    return null;
  }
}

async function buildTreeChildren(
  parentNode: TreeNode,
  currentDepth: number,
  maxDepth: number
): Promise<void> {
  if (currentDepth > maxDepth) return;

  try {
    const childrenQuery = query(
      collection(db, 'users'),
      where('referredBy', '==', parentNode.uid)
    );
    const snapshot = await getDocs(childrenQuery);

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const childNode: TreeNode = {
        uid: docSnap.id,
        displayName: data.displayName || 'Unknown',
        airline: data.airline || '',
        base: data.base || '',
        photoURL: data.photoURL || null,
        createdAt: data.createdAt || '',
        children: [],
      };

      // Recurse into this child's referrals
      await buildTreeChildren(childNode, currentDepth + 1, maxDepth);
      parentNode.children.push(childNode);
    }

    // Sort children by createdAt descending (newest first)
    parentNode.children.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch (error) {
    console.error('buildTreeChildren error:', error);
  }
}

// ─── Tree stats helper ────────────────────────────────────────────────────────
// Count total nodes in a tree (excluding root)
export function countTreeNodes(node: TreeNode): number {
  let count = node.children.length;
  for (const child of node.children) {
    count += countTreeNodes(child);
  }
  return count;
}

// Count depth levels that have at least one node
export function getTreeDepth(node: TreeNode): number {
  if (node.children.length === 0) return 0;
  let maxChildDepth = 0;
  for (const child of node.children) {
    maxChildDepth = Math.max(maxChildDepth, getTreeDepth(child));
  }
  return 1 + maxChildDepth;
}

// ─── Sharing Nudge Logic ──────────────────────────────────────────────────────
// Determines what type of sharing nudge to show (if any) based on user state.
//
export function getSharingNudge(
  successfulReferrals: number,
  totalReferred: number,
  earnedBadges: string[],
  context: 'post_layover' | 'home' | 'profile' | 'referrals'
): NudgeData | null {

  // After a layover — great moment to share
  if (context === 'post_layover') {
    return {
      type: 'post_layover',
      title: 'Great layover? 🛫',
      message: 'Invite crew so there are more people to connect with next time.',
      cta: 'Invite Crew',
    };
  }

  // Close to a badge tier — 1 away
  const nextTier = BADGE_TIERS.find(t => successfulReferrals === t - 1);
  if (nextTier) {
    const tierNames: Record<number, string> = {
      1: 'The Connector',
      5: 'The Recruiter',
      15: 'Crew Builder',
      25: 'Legend of the Crew',
    };
    return {
      type: 'close_to_badge',
      title: `Almost there! 🎖`,
      message: `You're 1 referral away from earning "${tierNames[nextTier]}"`,
      cta: 'Share Your Link',
    };
  }

  // Just hit a milestone (badge was just earned)
  const justEarnedTier = BADGE_TIERS.find(
    t => successfulReferrals === t && earnedBadges.includes(`recruiter_${t}`)
  );
  if (justEarnedTier && context === 'referrals') {
    return {
      type: 'milestone',
      title: 'You did it! 🏆',
      message: `${successfulReferrals} crew members joined because of you. Keep the momentum going!`,
      cta: 'Keep Sharing',
    };
  }

  // Zero referrals — encourage first share
  if (totalReferred === 0 && (context === 'home' || context === 'profile')) {
    return {
      type: 'first_referral',
      title: 'Grow your crew ✈️',
      message: 'Invite a fellow crew member and earn your first referral badge.',
      cta: 'Invite Crew',
    };
  }

  return null;
}

// ─── Get user's rank on leaderboard ───────────────────────────────────────────
// Quick check: where does this user rank? Returns null if not on board.
//
export async function getUserRank(userId: string): Promise<number | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;

    const myReferrals = userDoc.data().stats?.successfulReferrals || 0;
    if (myReferrals === 0) return null;

    // Count how many users have MORE referrals than this user
    const q = query(
      collection(db, 'users'),
      where('stats.successfulReferrals', '>', myReferrals)
    );
    const snapshot = await getDocs(q);

    return snapshot.size + 1; // Their rank
  } catch (error) {
    console.error('getUserRank error:', error);
    return null;
  }
}
