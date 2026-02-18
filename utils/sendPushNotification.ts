// utils/sendPushNotification.ts
import { db } from '@/config/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface PushNotificationData {
  title: string;
  body: string;
  data?: {
    type: string;
    spotId?: string;
    spotName?: string;
    cityCode?: string;
    cityName?: string;
    [key: string]: any;
  };
}

/**
 * Send a push notification to a specific user
 * @param userId - The user ID to send notification to
 * @param notification - Notification title, body, and data
 */
export async function sendPushNotification(
  userId: string,
  notification: PushNotificationData
): Promise<boolean> {
  try {
    // Get user's push token from Firestore
    const userDoc = await getDoc(doc(db, 'users', userId));
    
    if (!userDoc.exists()) {
      console.log('User not found:', userId);
      return false;
    }

    const pushToken = userDoc.data()?.pushToken;
    
    if (!pushToken) {
      console.log('No push token for user:', userId);
      return false;
    }

    // Send push notification via Expo's API
    const message = {
      to: pushToken,
      sound: 'default',
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      priority: 'high',
      channelId: 'default',
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();
    
    // Expo can return either { data: { status: 'ok' } } or { data: [{ status: 'ok' }] }
    // Handle both formats
    const status = Array.isArray(result.data)
      ? result.data[0]?.status
      : result.data?.status;

    if (status === 'ok') {
      console.log('[CrewMate] Push notification sent successfully');
      return true;
    } else {
      console.error('[CrewMate] Push send failed:', result);
      return false;
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
    return false;
  }
}

/**
 * Send push notifications to multiple users
 * @param userIds - Array of user IDs
 * @param notification - Notification data
 */
export async function sendPushNotificationToMultipleUsers(
  userIds: string[],
  notification: PushNotificationData
): Promise<void> {
  const promises = userIds.map(userId => sendPushNotification(userId, notification));
  await Promise.all(promises);
}
