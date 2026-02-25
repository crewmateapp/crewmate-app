// utils/notificationSetup.ts
// ─────────────────────────────────────────────────────────────────────
// Handles everything the app needs to do on its end for push notifications:
//   1. Request permission from the OS
//   2. Get the Expo push token and save it to Firestore
//   3. Listen for notifications while the app is in the foreground
//   4. Listen for user taps (foreground, background, or cold launch)
//      and deep-link to the right screen
//
// Usage: call useNotifications(userId) at the top of your root _layout.tsx
// ─────────────────────────────────────────────────────────────────────

import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { db } from '@/config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { router } from 'expo-router';

// ─── Foreground Handler ──────────────────────────────────────────────
// Controls how a notification looks/sounds when the app is already open.
// Set this at module load so it's ready before any notification arrives.

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ─── Deep-Link Routing ───────────────────────────────────────────────
// Maps every notification type to the screen it should open.
// Each entry is a function so it can use fields from the notification data
// (e.g. conversationId for messages, planId for plans).
//
// ⚡ Update these paths if your expo-router file structure differs.

const NOTIFICATION_ROUTES: Record<string, (data: Record<string, any>) => string> = {
  // Social
  connection_request: () => '/(tabs)/connections',
  connection_accepted: () => '/(tabs)/connections',
  message: (data) =>
    data.conversationId ? `/chat/${data.conversationId}` : '/(tabs)/connections',

  // Crewfies — deep-link to the specific post when postId is available
  crewfie_like: (data) =>
    data.postId ? `/crewfie/${data.postId}` : '/(tabs)/feed',
  crewfie_comment: (data) =>
    data.postId ? `/crewfie/${data.postId}` : '/(tabs)/feed',

  // Spots & Cities — deep-link to the specific spot when spotId is available
  spot_approved: (data) =>
    data.spotId ? `/spot/${data.spotId}` : '/(tabs)/explore',
  spot_rejected: () => '/(tabs)/explore',
  city_approved: () => '/(tabs)/explore',
  city_rejected: () => '/(tabs)/explore',

  // Reviews — deep-link to the specific spot
  review_received: (data) =>
    data.spotId ? `/spot/${data.spotId}` : '/(tabs)/explore',
  spot_review_reply: (data) =>
    data.spotId ? `/spot/${data.spotId}` : '/(tabs)/explore',

  // Nearby
  nearby_crew: () => '/(tabs)/explore',

  // Badges — deep-link to the badges screen, not generic profile
  badge_earned: () => '/badges',

  // Plans — all plan notifications deep-link straight into that plan.
  // Falls back to the plans tab if somehow planId is missing.
  plan_starting: (data) => (data.planId ? `/plan/${data.planId}` : '/(tabs)/plans'),
  plan_join: (data) => (data.planId ? `/plan/${data.planId}` : '/(tabs)/plans'),
  plan_message: (data) => (data.planId ? `/plan/${data.planId}` : '/(tabs)/plans'),
  plan_cancel: (data) => (data.planId ? `/plan/${data.planId}` : '/(tabs)/plans'),
};

function getRouteForNotification(data: Record<string, any>): string | null {
  const routeFn = NOTIFICATION_ROUTES[data?.type];
  if (routeFn) return routeFn(data);

  // Fallback: if there's an unknown type but it has a recognizable ID field,
  // try to route intelligently rather than silently dropping the tap.
  if (data?.spotId) return `/spot/${data.spotId}`;
  if (data?.planId) return `/plan/${data.planId}`;
  if (data?.conversationId) return `/chat/${data.conversationId}`;

  console.warn('[CrewMate] Unknown notification type with no fallback route:', data?.type);
  return null;
}

// ─── Permission ──────────────────────────────────────────────────────

export async function requestNotificationPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();

  if (existingStatus === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync({
    ios: { alert: true, badge: true, sound: true },
  });

  if (status !== 'granted') {
    console.log('[CrewMate] Notification permission denied');
  }

  return status === 'granted';
}

// ─── Push Token Registration ─────────────────────────────────────────
// Gets the device's Expo push token and saves it to the user's Firestore doc.
// This is the token sendPushNotification.ts reads when sending.

export async function registerPushToken(userId: string): Promise<string | null> {
  try {
    // Android needs an explicit notification channel
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'CrewMate',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({
      projectId: '077aad83-fde5-4782-9b22-d67ff58f8b6f', // your EAS project ID
    });

    // Save to Firestore so sendPushNotification can find it
    await updateDoc(doc(db, 'users', userId), {
      pushToken: token,
      pushTokenUpdatedAt: new Date(),
    });

    console.log('[CrewMate] Push token registered:', token);
    return token;
  } catch (error) {
    console.error('[CrewMate] Failed to register push token:', error);
    return null;
  }
}

// ─── Hook: useNotifications ──────────────────────────────────────────
// Drop this into your root _layout.tsx:
//
//   import { useNotifications } from '@/utils/notificationSetup';
//
//   export default function RootLayout() {
//     const { user } = useAuth();
//     useNotifications(user?.uid ?? null);
//     // ... rest of your layout
//   }
//
// It does three things:
//   • Requests permission + registers the push token (once, on mount)
//   • Listens for notifications in the foreground (auto-shown by the handler above)
//   • Listens for taps and navigates to the correct screen

export function useNotifications(userId: string | null) {
  const foregroundRef = useRef<Notifications.EventSubscription | null>(null);
  const responseRef = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!userId) return;

    // 1. Permission + token (fire and forget — doesn't block the UI)
    (async () => {
      const granted = await requestNotificationPermission();
      if (granted) {
        await registerPushToken(userId);
      }
    })();

    // 2. Foreground listener — log and optionally reset badge count
    foregroundRef.current = Notifications.addNotificationReceivedListener(
      (notification) => {
        console.log(
          '[CrewMate] Notification received in foreground:',
          notification.request.content.title
        );
        // Reset the app badge count when a notification arrives while app is open
        Notifications.setBadgeCountAsync(0);
      }
    );

    // 3. Tap listener — covers taps in foreground, background, AND cold launch
    responseRef.current = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data;
        const route = getRouteForNotification(data);
        if (route) {
          // Small delay ensures the navigator is mounted before pushing
          setTimeout(() => router.push(route as any), 100);
        }
      }
    );

    // 4. Cold launch check — if the app was opened BY tapping a notification
    //    (i.e. it wasn't running at all), getLastNotificationResponseAsync
    //    returns that notification. Larger delay so the navigator is ready.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        const data = response.notification.request.content.data;
        const route = getRouteForNotification(data);
        if (route) {
          setTimeout(() => router.push(route as any), 600);
        }
      }
    });

    // Cleanup
    return () => {
      foregroundRef.current?.remove();
      responseRef.current?.remove();
    };
  }, [userId]);
}
