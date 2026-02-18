// utils/notifications.ts
// ─────────────────────────────────────────────────────────────────────
// Every notification type CrewMate can send.
//
// Each function does two things:
//   1. Creates an in-app notification doc in Firestore (for the
//      NotificationCenter to read)
//   2. Sends a push notification via sendPushNotification (which
//      handles the preference check internally)
//
// Sections:
//   • Spot & City (approvals/rejections)
//   • Social (connections, messages, crewfie likes & comments)
//   • Nearby (crew on layover)
//   • Badges
//   • Plans (starting, join, message, cancel)
//   • Admin (new users, spot submissions, city requests, reports)
// ─────────────────────────────────────────────────────────────────────

import { db } from '@/config/firebase';
import {
  addDoc,
  collection,
  getDocs,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { sendPushNotification } from './sendPushNotification';

// ==========================================
// SPOT & CITY NOTIFICATIONS
// ==========================================

export async function notifySpotApproved(
  userId: string,
  spotId: string,
  spotName: string
): Promise<void> {
  try {
    const message = `Your spot "${spotName}" has been approved and is now live! 🎉`;

    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'spot_approved',
      spotId,
      spotName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

    await sendPushNotification(userId, {
      title: 'Spot Approved! 🎉',
      body: message,
      data: { type: 'spot_approved', spotId, spotName },
    });
  } catch (error) {
    console.error('Error creating spot approved notification:', error);
  }
}

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

    await sendPushNotification(userId, {
      title: 'Spot Not Approved',
      body: message,
      data: { type: 'spot_rejected', spotId, spotName },
    });
  } catch (error) {
    console.error('Error creating spot rejected notification:', error);
  }
}

export async function notifyCityApproved(
  userId: string,
  cityCode: string,
  cityName: string
): Promise<void> {
  try {
    const message = `${cityName} (${cityCode}) has been added to CrewMate! Thanks for the suggestion! ✈️`;

    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'city_approved',
      cityCode,
      cityName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

    await sendPushNotification(userId, {
      title: 'City Added! ✈️',
      body: message,
      data: { type: 'city_approved', cityCode, cityName },
    });
  } catch (error) {
    console.error('Error creating city approved notification:', error);
  }
}

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

    await sendPushNotification(userId, {
      title: 'City Request Not Approved',
      body: message,
      data: { type: 'city_rejected', cityCode, cityName },
    });
  } catch (error) {
    console.error('Error creating city rejected notification:', error);
  }
}

// ==========================================
// SOCIAL NOTIFICATIONS
// ==========================================

export async function notifyConnectionRequest(
  userId: string,
  requesterId: string,
  requesterName: string,
  requesterPhoto?: string
): Promise<void> {
  try {
    const message = `${requesterName} sent you a connection request`;

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

    await sendPushNotification(userId, {
      title: 'New Connection Request',
      body: message,
      data: { type: 'connection_request', requesterId, requesterName },
    });
  } catch (error) {
    console.error('Error creating connection request notification:', error);
  }
}

export async function notifyConnectionAccepted(
  userId: string,
  accepterId: string,
  accepterName: string,
  accepterPhoto?: string
): Promise<void> {
  try {
    const message = `${accepterName} accepted your connection request`;

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

    await sendPushNotification(userId, {
      title: 'Connection Accepted! 🤝',
      body: message,
      data: { type: 'connection_accepted', accepterId, accepterName },
    });
  } catch (error) {
    console.error('Error creating connection accepted notification:', error);
  }
}

export async function notifyNewMessage(
  userId: string,
  senderId: string,
  senderName: string,
  messagePreview: string,
  conversationId: string
): Promise<void> {
  try {
    const message = `${senderName}: ${messagePreview}`;

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

    await sendPushNotification(userId, {
      title: senderName,
      body: messagePreview,
      data: { type: 'message', senderId, conversationId },
    });
  } catch (error) {
    console.error('Error creating new message notification:', error);
  }
}

// ─── Crewfie Likes ───────────────────────────────────────────────────
// Call this inside crewfies-feed.tsx after the arrayUnion succeeds in handleLike.
// Pass the post owner's userId (not the liker's).
// postPreview is optional — a truncated version of the post caption if it has one.

export async function notifyCrewfikeLike(
  postOwnerUserId: string,
  likerId: string,
  likerName: string,
  postId: string,
  postPreview?: string
): Promise<void> {
  try {
    // Don't notify if the user liked their own post
    if (postOwnerUserId === likerId) return;

    const message = postPreview
      ? `${likerName} liked your post: "${postPreview}"`
      : `${likerName} liked your crewfie`;

    await addDoc(collection(db, 'notifications'), {
      userId: postOwnerUserId,
      type: 'crewfie_like',
      likerId,
      likerName,
      postId,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

    await sendPushNotification(postOwnerUserId, {
      title: '❤️ New Like',
      body: message,
      data: { type: 'crewfie_like', postId, likerId },
    });
  } catch (error) {
    console.error('Error creating crewfie like notification:', error);
  }
}

// ─── Crewfie Comments ────────────────────────────────────────────────
// Call this inside crewfies-feed.tsx after the comment addDoc succeeds
// in handleAddComment.
// commentPreview should be the comment text — this function truncates it.

export async function notifyCrewfieComment(
  postOwnerUserId: string,
  commenterId: string,
  commenterName: string,
  postId: string,
  commentPreview: string
): Promise<void> {
  try {
    // Don't notify if commenting on your own post
    if (postOwnerUserId === commenterId) return;

    // Truncate long comments for the notification
    const truncated =
      commentPreview.length > 60
        ? commentPreview.slice(0, 57) + '...'
        : commentPreview;

    const message = `${commenterName} commented: "${truncated}"`;

    await addDoc(collection(db, 'notifications'), {
      userId: postOwnerUserId,
      type: 'crewfie_comment',
      commenterId,
      commenterName,
      postId,
      commentPreview: truncated,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

    await sendPushNotification(postOwnerUserId, {
      title: '💬 New Comment',
      body: message,
      data: { type: 'crewfie_comment', postId, commenterId },
    });
  } catch (error) {
    console.error('Error creating crewfie comment notification:', error);
  }
}

// ==========================================
// NEARBY / LAYOVER NOTIFICATIONS
// ==========================================
// Call this when you detect that another crew member has set their
// layover to the same city as the current user.

export async function notifyNearbyCrewOnLayover(
  userId: string,
  nearbyCrewId: string,
  nearbyCrewName: string,
  nearbyCrewAirline: string,
  city: string
): Promise<void> {
  try {
    const message = `${nearbyCrewName} (${nearbyCrewAirline}) is also in ${city} right now!`;

    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'nearby_crew',
      nearbyCrewId,
      nearbyCrewName,
      nearbyCrewAirline,
      city,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

    await sendPushNotification(userId, {
      title: `✈️ Crew in ${city}`,
      body: message,
      data: { type: 'nearby_crew', nearbyCrewId, city },
    });
  } catch (error) {
    console.error('Error creating nearby crew notification:', error);
  }
}

// ==========================================
// BADGE NOTIFICATIONS
// ==========================================

export async function notifyBadgeEarned(
  userId: string,
  badgeId: string,
  badgeName: string,
  badgeDescription: string
): Promise<void> {
  try {
    const message = `You earned the "${badgeName}" badge! ${badgeDescription}`;

    await addDoc(collection(db, 'notifications'), {
      userId,
      type: 'badge_earned',
      badgeId,
      badgeName,
      badgeDescription,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

    await sendPushNotification(userId, {
      title: '🏆 Badge Earned!',
      body: message,
      data: { type: 'badge_earned', badgeId, badgeName },
    });
  } catch (error) {
    console.error('Error creating badge earned notification:', error);
  }
}

// ==========================================
// PLAN NOTIFICATIONS
// ==========================================

// ─── Plan Starting ───────────────────────────────────────────────────
// Notify every crew member who RSVPed that a plan is about to happen.
// Call this from a scheduled check (e.g. a background task or a cron-like
// setup) that runs before plan start times.
//
// rsvpedUserIds should be the array of user IDs who have RSVPed "yes" —
// excludes the plan creator so they don't get notified about their own plan.

export async function notifyPlanStarting(
  planId: string,
  planTitle: string,
  planCity: string,
  creatorId: string,
  rsvpedUserIds: string[]
): Promise<void> {
  try {
    // Filter out the creator — they don't need to be told their own plan is starting
    const recipientIds = rsvpedUserIds.filter((id) => id !== creatorId);
    if (recipientIds.length === 0) return;

    const message = `"${planTitle}" in ${planCity} is happening now! 🚀`;

    const promises = recipientIds.map(async (userId) => {
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: 'plan_starting',
        planId,
        planTitle,
        planCity,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });

      await sendPushNotification(userId, {
        title: '🚀 Plan Starting!',
        body: message,
        data: { type: 'plan_starting', planId, planTitle, planCity },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating plan starting notifications:', error);
  }
}

// ─── Someone Joined / RSVPed ─────────────────────────────────────────
// Notify the plan creator that someone joined or RSVPed yes.

export async function notifyPlanJoin(
  planCreatorId: string,
  planId: string,
  planTitle: string,
  joinerId: string,
  joinerName: string
): Promise<void> {
  try {
    // Safety check — don't notify if somehow the creator joined their own plan
    if (planCreatorId === joinerId) return;

    const message = `${joinerName} is joining "${planTitle}"!`;

    await addDoc(collection(db, 'notifications'), {
      userId: planCreatorId,
      type: 'plan_join',
      planId,
      planTitle,
      joinerId,
      joinerName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

    await sendPushNotification(planCreatorId, {
      title: '👋 New RSVP',
      body: message,
      data: { type: 'plan_join', planId, joinerId, joinerName },
    });
  } catch (error) {
    console.error('Error creating plan join notification:', error);
  }
}

// ─── Message in a Plan ───────────────────────────────────────────────
// Notify all other RSVPed crew (and the creator) when someone posts
// a message in the plan's chat. The sender is excluded from the list.
//
// recipientIds should be everyone on the plan EXCEPT the person who
// just sent the message.
// messagePreview is the text of the message — this function truncates it.

export async function notifyPlanMessage(
  planId: string,
  planTitle: string,
  senderId: string,
  senderName: string,
  messagePreview: string,
  recipientIds: string[]
): Promise<void> {
  try {
    // Filter out the sender just in case
    const recipients = recipientIds.filter((id) => id !== senderId);
    if (recipients.length === 0) return;

    // Truncate long messages
    const truncated =
      messagePreview.length > 60
        ? messagePreview.slice(0, 57) + '...'
        : messagePreview;

    const message = `${senderName} in "${planTitle}": ${truncated}`;

    const promises = recipients.map(async (userId) => {
      await addDoc(collection(db, 'notifications'), {
        userId,
        type: 'plan_message',
        planId,
        planTitle,
        senderId,
        senderName,
        messagePreview: truncated,
        message,
        read: false,
        createdAt: serverTimestamp(),
      });

      await sendPushNotification(userId, {
        title: `💬 ${planTitle}`,
        body: message,
        data: { type: 'plan_message', planId, senderId, senderName },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating plan message notifications:', error);
  }
}

// ─── Someone Cancelled / Not Coming ──────────────────────────────────
// Notify the plan creator that someone dropped out.

export async function notifyPlanCancel(
  planCreatorId: string,
  planId: string,
  planTitle: string,
  cancelerId: string,
  cancelerName: string
): Promise<void> {
  try {
    // Safety check
    if (planCreatorId === cancelerId) return;

    const message = `${cancelerName} is no longer coming to "${planTitle}"`;

    await addDoc(collection(db, 'notifications'), {
      userId: planCreatorId,
      type: 'plan_cancel',
      planId,
      planTitle,
      cancelerId,
      cancelerName,
      message,
      read: false,
      createdAt: serverTimestamp(),
    });

    await sendPushNotification(planCreatorId, {
      title: '👋 RSVP Cancelled',
      body: message,
      data: { type: 'plan_cancel', planId, cancelerId, cancelerName },
    });
  } catch (error) {
    console.error('Error creating plan cancel notification:', error);
  }
}

// ==========================================
// ADMIN NOTIFICATIONS
// ==========================================
// These always send regardless of user preferences (handled by
// sendPushNotification recognizing admin_* types).

/** Get all admin user IDs */
async function getAdminUserIds(): Promise<string[]> {
  try {
    const adminsQuery = query(
      collection(db, 'users'),
      where('adminRole', 'in', ['super', 'city'])
    );
    const adminsSnapshot = await getDocs(adminsQuery);
    return adminsSnapshot.docs.map((doc) => doc.id);
  } catch (error) {
    console.error('Error fetching admin user IDs:', error);
    return [];
  }
}

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

      await sendPushNotification(adminId, {
        title: 'New User Signup 👤',
        body: message,
        data: { type: 'admin_new_user', newUserId },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin new user notification:', error);
  }
}

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

      await sendPushNotification(adminId, {
        title: 'New Spot Submitted 📍',
        body: message,
        data: { type: 'admin_new_spot', spotId },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin new spot notification:', error);
  }
}

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

      await sendPushNotification(adminId, {
        title: 'New City Request ✈️',
        body: message,
        data: { type: 'admin_new_city_request', requestId },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin new city request notification:', error);
  }
}

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

      await sendPushNotification(adminId, {
        title: 'Spot Delete Request 🗑️',
        body: message,
        data: { type: 'admin_delete_request', requestId, spotId },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin delete request notification:', error);
  }
}

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

      await sendPushNotification(adminId, {
        title: 'Spot Reported ⚠️',
        body: message,
        data: { type: 'admin_spot_reported', reportId, spotId },
      });
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('Error creating admin spot reported notification:', error);
  }
}
