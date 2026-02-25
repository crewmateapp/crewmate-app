// utils/backfillReferrals.ts
// Backfill + recount referral data for admin.
//
// backfillReferrals() — Sets referredBy on users who don't have it yet
// recountReferrals()  — Recounts completions for all users already referred by you

import { db } from '@/config/firebase';
import { checkAndAwardRecruiterBadges } from '@/utils/handleReferral';
import {
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';

export type BackfillResult = {
  totalUsers: number;
  updated: number;
  skipped: number;
  alreadyReferred: number;
  successfulReferrals: number;
  badgesAwarded: string[];
};

export type RecountResult = {
  totalReferred: number;
  completed: number;
  pending: number;
  pendingDetails: { name: string; missing: string[] }[];
  badgesAwarded: string[];
};

// ─── Backfill: set referredBy on users who don't have one ─────────────────────
export async function backfillReferrals(adminUid: string): Promise<BackfillResult> {
  const result: BackfillResult = {
    totalUsers: 0,
    updated: 0,
    skipped: 0,
    alreadyReferred: 0,
    successfulReferrals: 0,
    badgesAwarded: [],
  };

  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    result.totalUsers = usersSnapshot.size;

    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      const data = userDoc.data();

      if (uid === adminUid) {
        result.skipped++;
        continue;
      }

      if (data.referredBy) {
        result.alreadyReferred++;
        continue;
      }

      await updateDoc(doc(db, 'users', uid), {
        referredBy: adminUid,
      });

      const hasPhoto = !!data.photoURL;
      const hasAirline = !!data.airline && data.airline.trim() !== '';
      const hasBase = !!data.base && data.base.trim() !== '';

      if (hasPhoto && hasAirline && hasBase) {
        result.successfulReferrals++;
        await updateDoc(doc(db, 'users', uid), {
          referralCredited: true,
        });
      }

      result.updated++;
    }

    await updateDoc(doc(db, 'users', adminUid), {
      'stats.successfulReferrals': result.successfulReferrals,
    });

    const newBadges = await checkAndAwardRecruiterBadges(adminUid);
    result.badgesAwarded = newBadges;

    console.log('✅ Backfill complete:', result);
    return result;
  } catch (error) {
    console.error('backfillReferrals error:', error);
    throw error;
  }
}

// ─── Recount: recalculate completions for all users referred by you ───────────
// Use this after changing completion criteria, or if counts seem off.
// It scans every user with referredBy == adminUid, checks photo + airline + base,
// and sets the correct successfulReferrals count on the admin's doc.
//
export async function recountReferrals(adminUid: string): Promise<RecountResult> {
  const result: RecountResult = {
    totalReferred: 0,
    completed: 0,
    pending: 0,
    pendingDetails: [],
    badgesAwarded: [],
  };

  try {
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', adminUid)
    );
    const snapshot = await getDocs(q);
    result.totalReferred = snapshot.size;

    console.log(`🔄 Recount: scanning ${snapshot.size} referred users...`);

    for (const userDoc of snapshot.docs) {
      const uid = userDoc.id;
      const data = userDoc.data();

      const hasPhoto = !!data.photoURL;
      const hasAirline = !!data.airline && data.airline.trim() !== '';
      const hasBase = !!data.base && data.base.trim() !== '';

      if (hasPhoto && hasAirline && hasBase) {
        result.completed++;

        if (!data.referralCredited) {
          await updateDoc(doc(db, 'users', uid), {
            referralCredited: true,
          });
        }
      } else {
        result.pending++;
        const missing: string[] = [];
        if (!hasPhoto) missing.push('photo');
        if (!hasAirline) missing.push('airline');
        if (!hasBase) missing.push('base');
        result.pendingDetails.push({
          name: data.displayName || 'Unknown',
          missing,
        });
      }
    }

    // Set the correct count on admin's doc
    await updateDoc(doc(db, 'users', adminUid), {
      'stats.successfulReferrals': result.completed,
    });

    console.log(`🔄 Recount: ${result.completed} completed, ${result.pending} pending`);

    const newBadges = await checkAndAwardRecruiterBadges(adminUid);
    result.badgesAwarded = newBadges;

    if (result.pendingDetails.length > 0) {
      console.log('📋 Pending users:');
      result.pendingDetails.forEach(p => {
        console.log(`   ${p.name} — missing: ${p.missing.join(', ')}`);
      });
    }

    console.log('✅ Recount complete:', {
      totalReferred: result.totalReferred,
      completed: result.completed,
      pending: result.pending,
      badgesAwarded: result.badgesAwarded,
    });

    return result;
  } catch (error) {
    console.error('recountReferrals error:', error);
    throw error;
  }
}
