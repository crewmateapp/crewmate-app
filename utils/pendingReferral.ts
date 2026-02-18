// utils/pendingReferral.ts
//
// Singleton store for the pending referrer ID.
//
// When someone taps a referral link (crewmateapp://refer/{uid}) before they
// have an account, we can't do anything with it immediately. This module holds
// the referrer's UID in memory so create-profile.tsx can read it after the
// user doc is created and call storeReferral().
//
// Flow:
//   1. link-handler catches crewmateapp://refer/{uid} → calls setPendingReferrer(uid)
//   2. User signs up, verifies email, lands on create-profile
//   3. create-profile creates the Firestore doc → calls getPendingReferrer()
//   4. If a referrer exists, calls storeReferral() then clearPendingReferrer()
//
// This survives the signup flow because the app process stays alive.
// If the app is killed between steps, getInitialURL will re-deliver the link
// on next open, so link-handler will set it again.

let _pendingReferrerId: string | null = null;

export function setPendingReferrer(uid: string): void {
  console.log('📦 pendingReferral: stored referrer', uid);
  _pendingReferrerId = uid;
}

export function getPendingReferrer(): string | null {
  return _pendingReferrerId;
}

export function clearPendingReferrer(): void {
  console.log('📦 pendingReferral: cleared');
  _pendingReferrerId = null;
}
