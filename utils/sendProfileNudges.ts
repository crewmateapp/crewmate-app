// utils/sendProfileNudges.ts
// Admin utility to send push notifications to users with incomplete profiles.
// "Incomplete" = missing photo, airline, or base (same criteria as referral completion).
//
// Also used by the in-app ProfileCompletionBanner to check the current user.

import { db } from '@/config/firebase';
import {
  collection,
  getDocs,
} from 'firebase/firestore';
import { sendPushNotification } from './sendPushNotification';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ProfileGap = 'photo' | 'airline' | 'base';

export type IncompleteUser = {
  uid: string;
  displayName: string;
  email?: string;
  missing: ProfileGap[];
  hasPushToken: boolean;
};

export type NudgeCampaignResult = {
  totalUsers: number;
  incompleteUsers: number;
  notificationsSent: number;
  notificationsFailed: number;
  noPushToken: number;
  details: IncompleteUser[];
};

// ─── Check a single user's profile gaps ─────────────────────────────────────

export function getProfileGaps(userData: any): ProfileGap[] {
  const gaps: ProfileGap[] = [];
  if (!userData.photoURL) gaps.push('photo');
  if (!userData.airline || userData.airline.trim() === '') gaps.push('airline');
  if (!userData.base || userData.base.trim() === '') gaps.push('base');
  return gaps;
}

export function isProfileComplete(userData: any): boolean {
  return getProfileGaps(userData).length === 0;
}

// ─── Human-friendly gap description ─────────────────────────────────────────

export function describeGaps(gaps: ProfileGap[]): string {
  const labels: Record<ProfileGap, string> = {
    photo: 'a profile photo',
    airline: 'your airline',
    base: 'your base',
  };

  const items = gaps.map(g => labels[g]);

  if (items.length === 1) return items[0];
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items[0]}, ${items[1]}, and ${items[2]}`;
}

// ─── Scan all users for incomplete profiles ─────────────────────────────────

export async function scanIncompleteProfiles(): Promise<IncompleteUser[]> {
  const snapshot = await getDocs(collection(db, 'users'));
  const incomplete: IncompleteUser[] = [];

  for (const userDoc of snapshot.docs) {
    const data = userDoc.data();
    const gaps = getProfileGaps(data);

    if (gaps.length > 0) {
      incomplete.push({
        uid: userDoc.id,
        displayName: data.displayName || 'Unknown',
        email: data.email,
        missing: gaps,
        hasPushToken: !!data.pushToken,
      });
    }
  }

  return incomplete;
}

// ─── Send nudge push notifications ──────────────────────────────────────────

export async function sendProfileNudgeCampaign(): Promise<NudgeCampaignResult> {
  const result: NudgeCampaignResult = {
    totalUsers: 0,
    incompleteUsers: 0,
    notificationsSent: 0,
    notificationsFailed: 0,
    noPushToken: 0,
    details: [],
  };

  try {
    const snapshot = await getDocs(collection(db, 'users'));
    result.totalUsers = snapshot.size;

    const incomplete = await scanIncompleteProfiles();
    result.incompleteUsers = incomplete.length;
    result.details = incomplete;

    for (const user of incomplete) {
      if (!user.hasPushToken) {
        result.noPushToken++;
        continue;
      }

      const gapText = describeGaps(user.missing);

      const success = await sendPushNotification(user.uid, {
        title: '✈️ Complete Your Crew Profile',
        body: `Add ${gapText} so other crew can find and connect with you on layovers!`,
        data: {
          type: 'profile_nudge',
          screen: 'edit-profile',
        },
      });

      if (success) {
        result.notificationsSent++;
      } else {
        result.notificationsFailed++;
      }
    }

    console.log('✅ Profile nudge campaign complete:', {
      incomplete: result.incompleteUsers,
      sent: result.notificationsSent,
      failed: result.notificationsFailed,
      noPushToken: result.noPushToken,
    });

    return result;
  } catch (error) {
    console.error('sendProfileNudgeCampaign error:', error);
    throw error;
  }
}
