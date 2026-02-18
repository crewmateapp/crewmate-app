// utils/notificationPreferences.ts
// ─────────────────────────────────────────────────────────────────────
// Manages per-user notification preferences.
//
// Each notification type belongs to a category. Users toggle categories
// on/off via NotificationSettingsPanel.tsx. Before every push send,
// sendPushNotification calls isNotificationEnabled() to check whether
// the user has that category enabled.
//
// Admin notification types (admin_*) always bypass the preference check —
// admins need those no matter what.
//
// Preferences are stored on the user's Firestore doc under the key
// `notificationPreferences` so they persist across devices.
// ─────────────────────────────────────────────────────────────────────

import { db } from '@/config/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

// ─── Types ───────────────────────────────────────────────────────────

export type NotificationCategory =
  | 'social'    // Connections & Messages
  | 'crewfies'  // Likes & Comments on posts
  | 'spots'     // Spot & City approval/rejection
  | 'nearby'    // Crew on layover where you are
  | 'badges'    // Badge earned
  | 'plans';    // Plan activity (joins, messages, cancels, starting)

export type NotificationPreferences = {
  pushEnabled: boolean; // Master on/off toggle
  categories: Record<NotificationCategory, boolean>;
};

// ─── Category Mapping ────────────────────────────────────────────────
// Every notification type → its category. Used by isNotificationEnabled
// to look up which toggle controls a given notification.

export const NOTIFICATION_TYPE_TO_CATEGORY: Record<string, NotificationCategory> = {
  // Social
  connection_request: 'social',
  connection_accepted: 'social',
  message: 'social',

  // Crewfies
  crewfie_like: 'crewfies',
  crewfie_comment: 'crewfies',

  // Spots & Cities
  spot_approved: 'spots',
  spot_rejected: 'spots',
  city_approved: 'spots',
  city_rejected: 'spots',

  // Nearby
  nearby_crew: 'nearby',

  // Badges
  badge_earned: 'badges',

  // Plans
  plan_starting: 'plans',
  plan_join: 'plans',
  plan_message: 'plans',
  plan_cancel: 'plans',
};

// Admin types are never gated — they always send.
export const ADMIN_NOTIFICATION_TYPES = [
  'admin_new_user',
  'admin_new_spot',
  'admin_new_city_request',
  'admin_delete_request',
  'admin_spot_reported',
];

// ─── Defaults ────────────────────────────────────────────────────────
// Everything on by default. New users get a great first experience;
// they can dial back later if they want.
// The merge logic in getNotificationPreferences means existing users
// who don't have `plans` saved yet will automatically get it as true.

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  pushEnabled: true,
  categories: {
    social: true,
    crewfies: true,
    spots: true,
    nearby: true,
    badges: true,
    plans: true,
  },
};

// ─── Firestore: Read ─────────────────────────────────────────────────

export async function getNotificationPreferences(
  userId: string
): Promise<NotificationPreferences> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    const prefs = userDoc.data()?.notificationPreferences;

    if (!prefs) return DEFAULT_PREFERENCES;

    // Merge with defaults so any new categories added later
    // automatically default to true for existing users
    return {
      pushEnabled: prefs.pushEnabled ?? true,
      categories: {
        ...DEFAULT_PREFERENCES.categories,
        ...prefs.categories,
      },
    };
  } catch (error) {
    console.error('[CrewMate] Failed to load notification preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

// ─── Firestore: Write ────────────────────────────────────────────────

export async function saveNotificationPreferences(
  userId: string,
  preferences: NotificationPreferences
): Promise<void> {
  try {
    await updateDoc(doc(db, 'users', userId), {
      notificationPreferences: preferences,
    });
  } catch (error) {
    console.error('[CrewMate] Failed to save notification preferences:', error);
  }
}

// ─── Permission Gate ─────────────────────────────────────────────────
// Called by sendPushNotification before every send.
// Returns true if the push should go through, false if the user has
// opted out of that notification type.

export async function isNotificationEnabled(
  userId: string,
  notificationType: string
): Promise<boolean> {
  // Admin notifications always go through
  if (ADMIN_NOTIFICATION_TYPES.includes(notificationType)) return true;

  const prefs = await getNotificationPreferences(userId);

  // Master toggle is off → block everything
  if (!prefs.pushEnabled) return false;

  // Look up which category this type belongs to
  const category = NOTIFICATION_TYPE_TO_CATEGORY[notificationType];

  // Unknown type (e.g. a future type not yet mapped) → allow by default
  if (!category) return true;

  return prefs.categories[category] ?? true;
}
