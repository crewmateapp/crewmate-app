// utils/archiveExpiredPlans.ts
// Checks for plans the user is involved in that have passed their scheduled time
// and marks them as 'completed' so they move to the archive/history.

import { db } from '@/config/firebase';
import {
  collection,
  getDocs,
  query,
  Timestamp,
  updateDoc,
  where,
  doc,
} from 'firebase/firestore';

/**
 * Finds all active plans where the user is host or attendee
 * whose scheduledTime has passed, and updates their status to 'completed'.
 *
 * Uses a 2-hour grace period so plans aren't archived while still in progress.
 * Returns the number of plans archived.
 */
export async function archiveExpiredPlans(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    // 2-hour grace period (matches the home screen cutoff)
    const twoHoursAgo = new Date();
    twoHoursAgo.setHours(twoHoursAgo.getHours() - 2);
    const cutoff = Timestamp.fromDate(twoHoursAgo);

    // Query 1: Plans the user is hosting that have expired
    const hostedQuery = query(
      collection(db, 'plans'),
      where('hostUserId', '==', userId),
      where('status', '==', 'active'),
      where('scheduledTime', '<', cutoff)
    );

    // Query 2: Plans the user is attending that have expired
    const attendingQuery = query(
      collection(db, 'plans'),
      where('attendeeIds', 'array-contains', userId),
      where('status', '==', 'active'),
      where('scheduledTime', '<', cutoff)
    );

    const [hostedSnap, attendingSnap] = await Promise.all([
      getDocs(hostedQuery),
      getDocs(attendingQuery),
    ]);

    // Deduplicate (user could be both host and attendee)
    const planIds = new Set<string>();
    const docsToUpdate: string[] = [];

    hostedSnap.docs.forEach((d) => {
      if (!planIds.has(d.id)) {
        planIds.add(d.id);
        docsToUpdate.push(d.id);
      }
    });

    attendingSnap.docs.forEach((d) => {
      if (!planIds.has(d.id)) {
        planIds.add(d.id);
        docsToUpdate.push(d.id);
      }
    });

    // Batch update status to 'completed'
    const updates = docsToUpdate.map((planId) =>
      updateDoc(doc(db, 'plans', planId), {
        status: 'completed',
        completedAt: Timestamp.now(),
      })
    );

    await Promise.all(updates);

    if (docsToUpdate.length > 0) {
      console.log(`✅ Auto-archived ${docsToUpdate.length} expired plan(s)`);
    }

    return docsToUpdate.length;
  } catch (error) {
    console.error('❌ Error archiving expired plans:', error);
    return 0;
  }
}
