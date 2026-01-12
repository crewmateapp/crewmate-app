// utils/notifications.ts
// Helper functions for creating notifications

import { db } from '@/config/firebase';
import { addDoc, collection, getDocs, query, serverTimestamp, where } from 'firebase/firestore';
import { sendPushNotification } from './sendPushNotification';

// ==========================================
// USER NOTIFICATIONS (Spot/City Reviews)
// ==========================================

/**
 * Create a notification when a spot is approved
 */
export async function notifySpotApproved(
  userId: string,
  spotId: string,
  spotName: string
): Promise<void> {
  try {
    const message = `Your spot "${spotName}" has been approved and is now live! 🎉`;
    
    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'spot_approved',
      spotId,
      spotName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Send push notification
    await sendPushNotification(userId, {
      title: 'Spot Approved! 🎉',
      body: message,
      data: {
        type: 'spot_approved',
        spotId,
        spotName,
      },
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

    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'spot_rejected',
      spotId,
      spotName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Send push notification
    await sendPushNotification(userId, {
      title: 'Spot Not Approved',
      body: message,
      data: {
        type: 'spot_rejected',
        spotId,
        spotName,
      },
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
    const message = `${cityName} (${cityCode}) has been added to CrewMate! Thanks for the suggestion! ✈️`;
    
    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'city_approved',
      cityCode,
      cityName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Send push notification
    await sendPushNotification(userId, {
      title: 'City Added! ✈️',
      body: message,
      data: {
        type: 'city_approved',
        cityCode,
        cityName,
      },
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

    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'city_rejected',
      cityCode,
      cityName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Send push notification
    await sendPushNotification(userId, {
      title: 'City Request Not Approved',
      body: message,
      data: {
        type: 'city_rejected',
        cityCode,
        cityName,
      },
    });
  } catch (error) {
    console.error('Error creating city rejected notification:', error);
  }
}

// ==========================================
// SOCIAL NOTIFICATIONS (Connections/Messages)
// ==========================================

/**
 * Create a notification when someone sends a connection request
 */
export async function notifyConnectionRequest(
  userId: string,
  requesterId: string,
  requesterName: string,
  requesterPhoto?: string
): Promise<void> {
  try {
    const message = `${requesterName} sent you a connection request`;
    
    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'connection_request',
      requesterId,
      requesterName,
      requesterPhoto,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Send push notification
    await sendPushNotification(userId, {
      title: 'New Connection Request',
      body: message,
      data: {
        type: 'connection_request',
        requesterId,
        requesterName,
      },
    });
  } catch (error) {
    console.error('Error creating connection request notification:', error);
  }
}

/**
 * Create a notification when a connection request is accepted
 */
export async function notifyConnectionAccepted(
  userId: string,
  accepterId: string,
  accepterName: string,
  accepterPhoto?: string
): Promise<void> {
  try {
    const message = `${accepterName} accepted your connection request`;
    
    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'connection_accepted',
      accepterId,
      accepterName,
      accepterPhoto,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Send push notification
    await sendPushNotification(userId, {
      title: 'Connection Accepted! 🤝',
      body: message,
      data: {
        type: 'connection_accepted',
        accepterId,
        accepterName,
      },
    });
  } catch (error) {
    console.error('Error creating connection accepted notification:', error);
  }
}

/**
 * Create a notification when someone sends a message
 */
export async function notifyNewMessage(
  userId: string,
  senderId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<void> {
  try {
    const message = `${senderName}: ${messagePreview}`;
    
    // Create in-app notification
    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'message',
      senderId,
      senderName,
      messagePreview,
      conversationId,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });
    
    // Send push notification
    await sendPushNotification(userId, {
      title: senderName,
      body: messagePreview,
      data: {
        type: 'message',
        senderId,
        conversationId,
      },
    });
  } catch (error) {
    console.error('Error creating new message notification:', error);
  }
}

// ==========================================
// ADMIN NOTIFICATIONS
// ==========================================

/**
 * Get all admin user IDs from Firestore
 */
async function getAdminUserIds(): Promise<string[]> {
  try {
    const adminsQuery = query(
      collection(db, 'users'),
      where('adminRole', 'in', ['super', 'city'])
    );
    const adminsSnapshot = await getDocs(adminsQuery);
    return adminsSnapshot.docs.map(doc => doc.id);
  } catch (error) {
    console.error('Error fetching admin user IDs:', error);
    return [];
  }
}

/**
 * Create a notification for admins when a new user signs up
 */
export async function notifyAdminsNewUser(
  newUserId: string,
  newUserName: string,
  newUserEmail: string,
  newUserAirline: string
): Promise<void> {
  try {
    const adminIds = await getAdminUserIds();
    if (adminIds.length === 0) return;

    const message = `New user: ${newUserName} (${newUserAirline}) - ${newUserEmail}`;
    
    // Create notifications for all admins
    const promises = adminIds.map(async (adminId) => {
      await addDoc(collection(db, 'notifications'), {
        userId: adminId,
        type: 'admin_new_user',
        newUserId,
        newUserName,
        newUserEmail,
        newUserAirline,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });
      
      // Send push notification
      await sendPushNotification(adminId, {
        title: 'New User Signup 👤',
        body: message,
        data: {
          type: 'admin_new_user',
          newUserId,
        },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin new user notification:', error);
  }
}

/**
 * Create a notification for admins when a spot is submitted for review
 */
export async function notifyAdminsNewSpot(
  spotId: string,
  spotName: string,
  submitterId: string,
  submitterName: string,
  city: string
): Promise<void> {
  try {
    const adminIds = await getAdminUserIds();
    if (adminIds.length === 0) return;

    const message = `New spot pending review: "${spotName}" in ${city} by ${submitterName}`;
    
    // Create notifications for all admins
    const promises = adminIds.map(async (adminId) => {
      await addDoc(collection(db, 'notifications'), {
        userId: adminId,
        type: 'admin_new_spot',
        spotId,
        spotName,
        submitterId,
        submitterName,
        city,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });
      
      // Send push notification
      await sendPushNotification(adminId, {
        title: 'New Spot Submitted 📍',
        body: message,
        data: {
          type: 'admin_new_spot',
          spotId,
        },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin new spot notification:', error);
  }
}

/**
 * Create a notification for admins when a city is requested
 */
export async function notifyAdminsNewCityRequest(
  requestId: string,
  cityCode: string,
  requesterId: string,
  requesterName: string
): Promise<void> {
  try {
    const adminIds = await getAdminUserIds();
    if (adminIds.length === 0) return;

    const message = `New city request: ${cityCode} by ${requesterName}`;
    
    // Create notifications for all admins
    const promises = adminIds.map(async (adminId) => {
      await addDoc(collection(db, 'notifications'), {
        userId: adminId,
        type: 'admin_new_city_request',
        requestId,
        cityCode,
        requesterId,
        requesterName,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });
      
      // Send push notification
      await sendPushNotification(adminId, {
        title: 'New City Request ✈️',
        body: message,
        data: {
          type: 'admin_new_city_request',
          requestId,
        },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin new city request notification:', error);
  }
}

/**
 * Create a notification for admins when a spot deletion is requested
 */
export async function notifyAdminsDeleteRequest(
  requestId: string,
  spotId: string,
  spotName: string,
  requesterId: string,
  requesterName: string,
  reason: string
): Promise<void> {
  try {
    const adminIds = await getAdminUserIds();
    if (adminIds.length === 0) return;

    const message = `Delete request for "${spotName}" by ${requesterName}: ${reason}`;
    
    // Create notifications for all admins
    const promises = adminIds.map(async (adminId) => {
      await addDoc(collection(db, 'notifications'), {
        userId: adminId,
        type: 'admin_delete_request',
        requestId,
        spotId,
        spotName,
        requesterId,
        requesterName,
        reason,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });
      
      // Send push notification
      await sendPushNotification(adminId, {
        title: 'Spot Delete Request 🗑️',
        body: message,
        data: {
          type: 'admin_delete_request',
          requestId,
          spotId,
        },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin delete request notification:', error);
  }
}

/**
 * Create a notification for admins when a spot is reported
 */
export async function notifyAdminsSpotReported(
  reportId: string,
  spotId: string,
  spotName: string,
  reporterId: string,
  reporterName: string,
  reason: string
): Promise<void> {
  try {
    const adminIds = await getAdminUserIds();
    if (adminIds.length === 0) return;

    const message = `"${spotName}" reported by ${reporterName}: ${reason}`;
    
    // Create notifications for all admins
    const promises = adminIds.map(async (adminId) => {
      await addDoc(collection(db, 'notifications'), {
        userId: adminId,
        type: 'admin_spot_reported',
        reportId,
        spotId,
        spotName,
        reporterId,
        reporterName,
        reason,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });
      
      // Send push notification
      await sendPushNotification(adminId, {
        title: 'Spot Reported ⚠️',
        body: message,
        data: {
          type: 'admin_spot_reported',
          reportId,
          spotId,
        },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin spot reported notification:', error);
  }
}
