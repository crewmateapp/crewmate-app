// utils/cleanExpiredLayovers.ts
// Removes expired upcoming layovers from the user's document in Firestore.
// This prevents stale layovers from accumulating when no current layover
// triggers the existing cleanup logic.

import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

/**
 * Checks the user's upcomingLayovers array and removes any
 * whose endDate has passed. Runs silently on mount.
 * Returns the number of layovers cleaned up.
 */
export async function cleanExpiredLayovers(userId: string): Promise<number> {
  if (!userId) return 0;

  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return 0;

    const data = userDoc.data();
    const upcomingLayovers = data.upcomingLayovers || [];

    if (upcomingLayovers.length === 0) return 0;

    const now = new Date();
    const validLayovers = upcomingLayovers.filter((layover: any) => {
      if (!layover.endDate) return true; // Keep if no endDate (safety)
      const endDate = layover.endDate.toDate ? layover.endDate.toDate() : new Date(layover.endDate);
      // Give until end of day
      endDate.setHours(23, 59, 59, 999);
      return endDate >= now;
    });

    const removedCount = upcomingLayovers.length - validLayovers.length;

    if (removedCount > 0) {
      await updateDoc(doc(db, 'users', userId), {
        upcomingLayovers: validLayovers,
      });
      console.log(`✅ Cleaned ${removedCount} expired upcoming layover(s)`);
    }

    return removedCount;
  } catch (error) {
    console.error('❌ Error cleaning expired layovers:', error);
    return 0;
  }
}
