// utils/notifications.ts
// Helper functions for creating notifications

import { db } from '@/config/firebase';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';

/**
 * Create a notification when a spot is approved
 */
export async function notifySpotApproved(
  userId: string,
  spotId: string,
  spotName: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'spot_approved',
      spotId,
      spotName,
      message: `Your spot "${spotName}" has been approved and is now live! 🎉`,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating spot approved notification:', error);
  }
}

/**
 * Create a notification when a spot is rejected
 */
export async function notifySpotRejected(
  userId: string,
  spotId: string,
  spotName: string,
  reason?: string
): Promise<void> {
  try {
    const message = reason
      ? `Your spot "${spotName}" was not approved. Reason: ${reason}`
      : `Your spot "${spotName}" was not approved.`;

    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'spot_rejected',
      spotId,
      spotName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating spot rejected notification:', error);
  }
}

/**
 * Create a notification when a city request is approved
 */
export async function notifyCityApproved(
  userId: string,
  cityCode: string,
  cityName: string
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'city_approved',
      cityCode,
      cityName,
      message: `${cityName} (${cityCode}) has been added to CrewMate! Thanks for the suggestion! ✈️`,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating city approved notification:', error);
  }
}

/**
 * Create a notification when a city request is rejected
 */
export async function notifyCityRejected(
  userId: string,
  cityCode: string,
  cityName: string,
  reason?: string
): Promise<void> {
  try {
    const message = reason
      ? `Your city request for ${cityName} (${cityCode}) was not approved. Reason: ${reason}`
      : `Your city request for ${cityName} (${cityCode}) was not approved.`;

    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'city_rejected',
      cityCode,
      cityName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('Error creating city rejected notification:', error);
  }
}
