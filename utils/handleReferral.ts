// utils/handleReferral.ts
import { db } from '@/config/firebase';
import { checkNewBadges } from '@/utils/checkBadges';
import {
  arrayUnion,
  doc,
  getDoc,
  increment,
  updateDoc,
} from 'firebase/firestore';

// ─── Called at signup ─────────────────────────────────────────────────────────
// If the user signed up via a referral link (crewmateapp://refer/{referrerId}),
// store the referrer's UID on the new user's doc. This is set once and never changes.
//
// Call this AFTER the user doc is created in Firestore during onboarding:
//   await storeReferral(newUser.uid, referrerId);
//
export async function storeReferral(newUserId: string, referrerId: string): Promise<void> {
  try {
    // Sanity check: don't let someone refer themselves
    if (newUserId === referrerId) {
      console.warn('storeReferral: user cannot refer themselves');
      return;
    }

    // Verify the referrer actually exists
    const referrerDoc = await getDoc(doc(db, 'users', referrerId));
    if (!referrerDoc.exists()) {
      console.warn('storeReferral: referrer does not exist', referrerId);
      return;
    }

    // Store referredBy on the new user's doc
    await updateDoc(doc(db, 'users', newUserId), {
      referredBy: referrerId,
    });

    console.log(`storeReferral: user ${newUserId} referred by ${referrerId}`);
  } catch (error) {
    console.error('storeReferral error:', error);
  }
}

// ─── Called when a user uploads their first profile photo ─────────────────────
// This is the "completion" trigger. Check if this user was referred,
// and if so, credit the referrer.
//
// Call this from wherever you handle profile photo upload, but ONLY
// when it's the user's first photo (i.e. they didn't have a photoURL before):
//   if (!previousPhotoURL && newPhotoURL) {
//     await creditReferrer(userId);
//   }
//
export async function creditReferrer(userId: string): Promise<void> {
  try {
    // Load the user who just uploaded a photo
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return;

    const userData = userDoc.data();
    const referrerId = userData.referredBy;

    // If they weren't referred by anyone, nothing to do
    if (!referrerId) return;

    // TEMP: Email verification check bypassed to match _layout.tsx test config.
    // Re-enable this when email verification is turned back on in production.
    // if (!userData.emailVerified) {
    //   console.log('creditReferrer: user not email verified yet, skipping', userId);
    //   return;
    // }

    // Increment the referrer's successfulReferrals stat
    await updateDoc(doc(db, 'users', referrerId), {
      'stats.successfulReferrals': increment(1),
    });

    console.log(`creditReferrer: credited referrer ${referrerId} for user ${userId}`);

    // Now check if the referrer earned any new badges
    await checkAndAwardRecruiterBadges(referrerId);
  } catch (error) {
    console.error('creditReferrer error:', error);
  }
}

// ─── Check and award recruiter badges for a user ────────────────────────────
// Loads the referrer's current stats + badges, runs checkNewBadges,
// and awards any newly earned recruiter badges (+ CMS).
//
// This is also exported so you can call it manually if needed (e.g. backfill).
//
export async function checkAndAwardRecruiterBadges(userId: string): Promise<string[]> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return [];

    const userData = userDoc.data();
    const currentBadges: string[] = userData.badges || [];
    const stats = userData.stats || {};

    // Run the badge checker — it will find any recruiter badges that are now earned
    const newBadges = checkNewBadges(stats, currentBadges);

    // Filter to only recruiter badges (in case other badges also triggered)
    const recruiterBadges = newBadges.filter(b => b.id.startsWith('recruiter_'));

    if (recruiterBadges.length === 0) return [];

    // Award each new badge
    const badgeIds = recruiterBadges.map(b => b.id);
    const totalCms = recruiterBadges.reduce((sum, b) => sum + (b.cmsValue || 0), 0);

    await updateDoc(doc(db, 'users', userId), {
      badges: arrayUnion(...badgeIds),
      cms: increment(totalCms),
    });

    console.log(`checkAndAwardRecruiterBadges: awarded ${badgeIds.join(', ')} to ${userId} (+${totalCms} CMS)`);

    // If recruiter_25 was just earned, trigger the gift card claim flow
    if (badgeIds.includes('recruiter_25')) {
      await sendGiftCardClaimEmail(userId);
    }

    return badgeIds;
  } catch (error) {
    console.error('checkAndAwardRecruiterBadges error:', error);
    return [];
  }
}

// ─── Gift card claim: send email to Zach ─────────────────────────────────────
// For now this is a simple mailto trigger. The user taps "Claim Reward" on
// the recruiter_25 badge detail screen, which calls this function.
// It sends an email to the CrewMate admin with the user's info so the
// gift card can be sent manually.
//
// This is intentionally simple — no payment processing, no gift card API.
// Just an email notification to the admin. Upgrade later if referrals take off.
//
export async function sendGiftCardClaimEmail(userId: string): Promise<void> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return;

    const userData = userDoc.data();

    // Mark that this user has claimed (or been notified about) the reward
    // so we don't send duplicate emails
    if (userData.giftCardClaimSent) {
      console.log('sendGiftCardClaimEmail: already sent for', userId);
      return;
    }

    // Store the claim request in Firestore for the admin to see
    await updateDoc(doc(db, 'users', userId), {
      giftCardClaimSent: true,
      giftCardClaimRequestedAt: new Date().toISOString(),
    });

    // Log for now — in production you'd send an actual email via
    // a Cloud Function or a service like SendGrid/Resend
    console.log('🎁 GIFT CARD CLAIM REQUEST:', {
      userId,
      displayName: userData.displayName,
      email: userData.email,
      airline: userData.airline,
      base: userData.base,
      successfulReferrals: userData.stats?.successfulReferrals,
    });

    // TODO: Replace with actual email sending when ready.
    // Options:
    //   1. Firebase Cloud Function that triggers on giftCardClaimSent field change
    //   2. Direct API call to SendGrid/Resend from the app
    //   3. Manual check in web admin panel

  } catch (error) {
    console.error('sendGiftCardClaimEmail error:', error);
  }
}

// ─── UI helper: check if user can claim the gift card reward ─────────────────
// Returns true if the user has earned recruiter_25 but hasn't claimed yet.
// Use this on the badge detail screen to show/hide the "Claim Reward" button.
//
export async function canClaimGiftCard(userId: string): Promise<boolean> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return false;

    const userData = userDoc.data();
    const hasBadge = (userData.badges || []).includes('recruiter_25');
    const alreadyClaimed = userData.giftCardClaimSent === true;

    return hasBadge && !alreadyClaimed;
  } catch (error) {
    console.error('canClaimGiftCard error:', error);
    return false;
  }
}
