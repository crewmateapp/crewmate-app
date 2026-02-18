// components/NotificationCenter.tsx
// ─────────────────────────────────────────────────────────────────────
// The in-app notification screen. Shows all notifications grouped by
// time (Today / Yesterday / This Week / Earlier), with icons and colors
// per notification type, unread indicators, and tap-to-navigate.
//
// Also exports useUnreadNotificationCount — a lightweight hook you can
// use anywhere to show an unread badge (e.g. on a bell icon in your nav).
//
// Usage:
//   import NotificationCenter from '@/components/NotificationCenter';
//   // ... render <NotificationCenter /> as a screen or modal
//
//   import { useUnreadNotificationCount } from '@/components/NotificationCenter';
//   const unreadCount = useUnreadNotificationCount(); // number
// ─────────────────────────────────────────────────────────────────────

import { ThemedText } from '@/components/themed-text';
import { Colors } from '@/constants/Colors';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  View,
  ActivityIndicator,
} from 'react-native';

// ─── Types ──────────────────────────────────────────────────────────

type Notification = {
  id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: any;
  [key: string]: any;
};

// Items in the FlatList are either section headers or notification rows
type ListItem =
  | { itemType: 'header'; title: string; key: string }
  | { itemType: 'notification'; notification: Notification; key: string };

// ─── Icon & Color Config ────────────────────────────────────────────
// Every notification type gets its own icon and accent color.
// The icon bg uses the color at 10% opacity for a subtle tint.

const NOTIFICATION_CONFIG: Record<
  string,
  { icon: keyof typeof Ionicons.glyphMap; color: string }
> = {
  // Social
  connection_request: { icon: 'person-add', color: '#4A90D9' },
  connection_accepted: { icon: 'checkmark-circle', color: '#34C759' },
  message: { icon: 'chatbubble', color: '#5856D6' },

  // Crewfies
  crewfie_like: { icon: 'heart', color: '#FF3B30' },
  crewfie_comment: { icon: 'chatbubble-sharp', color: '#FF9500' },

  // Spots & Cities
  spot_approved: { icon: 'checkmark-circle', color: '#34C759' },
  spot_rejected: { icon: 'close-circle', color: '#FF3B30' },
  city_approved: { icon: 'airplane', color: '#34C759' },
  city_rejected: { icon: 'airplane', color: '#FF3B30' },

  // Nearby
  nearby_crew: { icon: 'location', color: '#4A90D9' },

  // Badges
  badge_earned: { icon: 'trophy', color: '#F5A623' },

  // Plans
  plan_starting: { icon: 'rocket', color: '#8E44AD' },
  plan_join: { icon: 'person-add', color: '#8E44AD' },
  plan_message: { icon: 'chatbubble', color: '#8E44AD' },
  plan_cancel: { icon: 'close-circle', color: '#E74C3C' },

  // Admin
  admin_new_user: { icon: 'person', color: '#8E8E93' },
  admin_new_spot: { icon: 'location', color: '#8E8E93' },
  admin_new_city_request: { icon: 'globe', color: '#8E8E93' },
  admin_delete_request: { icon: 'trash', color: '#FF3B30' },
  admin_spot_reported: { icon: 'warning', color: '#FF9500' },
};

const DEFAULT_CONFIG: { icon: keyof typeof Ionicons.glyphMap; color: string } = {
  icon: 'ellipsis-horizontal-circle',
  color: Colors.text.secondary,
};

// ─── Deep Link on Tap ───────────────────────────────────────────────
// Mirrors the routing in notificationSetup.ts so tapping a notification
// in the center goes to the same place as tapping the push banner.

function navigateForNotification(notification: Notification) {
  switch (notification.type) {
    case 'connection_request':
    case 'connection_accepted':
      router.push('/(tabs)/connections' as any);
      break;
    case 'message':
      if (notification.conversationId) {
        router.push(`/chat/${notification.conversationId}` as any);
      } else {
        router.push('/(tabs)/connections' as any);
      }
      break;
    case 'crewfie_like':
    case 'crewfie_comment':
      router.push('/(tabs)/feed' as any);
      break;
    case 'spot_approved':
    case 'spot_rejected':
    case 'city_approved':
    case 'city_rejected':
      router.push('/(tabs)/explore' as any);
      break;
    case 'nearby_crew':
      router.push('/(tabs)/explore' as any);
      break;
    case 'badge_earned':
      router.push('/(tabs)/profile' as any);
      break;
    // Plans — all go straight into the plan if we have a planId
    case 'plan_starting':
    case 'plan_join':
    case 'plan_message':
    case 'plan_cancel':
      if (notification.planId) {
        router.push(`/plan/${notification.planId}` as any);
      } else {
        router.push('/(tabs)/plans' as any);
      }
      break;
    default:
      break;
  }
}

// ─── Time Grouping Helpers ──────────────────────────────────────────

function getTimeGroup(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return 'This Week';
  return 'Earlier';
}

function formatTime(timestamp: any): string {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Main Component ─────────────────────────────────────────────────

export default function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // ── Live listener on user's notifications ───────────────────────
  useEffect(() => {
    if (!user) return;

    const notifQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notifQuery, (snapshot) => {
      setNotifications(
        snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        } as Notification))
      );
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ── Actions ──────────────────────────────────────────────────────

  const markAsRead = useCallback(async (notificationId: string) => {
    await updateDoc(doc(db, 'notifications', notificationId), { read: true });
  }, []);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });
    await batch.commit();
  }, [notifications, user]);

  const deleteAll = useCallback(async () => {
    if (!user || notifications.length === 0) return;

    const batch = writeBatch(db);
    notifications.forEach((n) => {
      batch.delete(doc(db, 'notifications', n.id));
    });
    await batch.commit();
  }, [notifications, user]);

  const handleTap = useCallback(
    (notification: Notification) => {
      if (!notification.read) {
        markAsRead(notification.id);
      }
      navigateForNotification(notification);
    },
    [markAsRead]
  );

  // ── Build grouped list ───────────────────────────────────────────
  // Inserts header items between time groups so the FlatList can render
  // them inline without nested lists.

  const groupedItems: ListItem[] = useMemo(() => {
    const groups: Record<string, Notification[]> = {};
    const groupOrder: string[] = [];

    notifications.forEach((n) => {
      const date = n.createdAt?.toDate
        ? n.createdAt.toDate()
        : new Date(n.createdAt);
      const group = getTimeGroup(date);

      if (!groups[group]) {
        groups[group] = [];
        groupOrder.push(group);
      }
      groups[group].push(n);
    });

    const items: ListItem[] = [];
    groupOrder.forEach((group) => {
      items.push({ itemType: 'header', title: group, key: `header-${group}` });
      groups[group].forEach((n) => {
        items.push({ itemType: 'notification', notification: n, key: n.id });
      });
    });

    return items;
  }, [notifications]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // ── Render ───────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.itemType === 'header') {
      return <ThemedText style={styles.groupHeader}>{item.title}</ThemedText>;
    }

    const { notification } = item;
    const config = NOTIFICATION_CONFIG[notification.type] || DEFAULT_CONFIG;

    return (
      <TouchableOpacity
        style={[
          styles.notificationRow,
          !notification.read && styles.notificationRowUnread,
        ]}
        onPress={() => handleTap(notification)}
        activeOpacity={0.7}
      >
        {/* Icon with tinted background */}
        <View
          style={[
            styles.iconBg,
            { backgroundColor: `${config.color}1A` },
          ]}
        >
          <Ionicons name={config.icon} size={22} color={config.color} />
        </View>

        {/* Message + timestamp */}
        <View style={styles.notificationContent}>
          <ThemedText
            style={[
              styles.notificationMessage,
              !notification.read && styles.notificationMessageUnread,
            ]}
            numberOfLines={2}
          >
            {notification.message}
          </ThemedText>
          <ThemedText style={styles.notificationTime}>
            {formatTime(notification.createdAt)}
          </ThemedText>
        </View>

        {/* Unread dot */}
        {!notification.read && <View style={styles.unreadDot} />}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.fullCenter}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header bar */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={Colors.primary} />
        </TouchableOpacity>
        <View style={styles.headerLeft}>
          <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
          {unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <ThemedText style={styles.unreadBadgeText}>
                {unreadCount}
              </ThemedText>
            </View>
          )}
        </View>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={markAllAsRead} style={styles.headerAction}>
              <ThemedText style={styles.headerActionText}>Mark all read</ThemedText>
            </TouchableOpacity>
          )}
          {notifications.length > 0 && (
            <TouchableOpacity onPress={deleteAll} style={styles.headerAction}>
              <Ionicons
                name="trash-outline"
                size={20}
                color={Colors.text.secondary}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Content */}
      {notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons
            name="notifications-outline"
            size={64}
            color={Colors.text.secondary}
          />
          <ThemedText style={styles.emptyTitle}>
            You're all caught up!
          </ThemedText>
          <ThemedText style={styles.emptyText}>
            We'll let you know when something happens.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={groupedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.key}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

// ─── Exported Hook: useUnreadNotificationCount ──────────────────────
// Lightweight real-time listener. Use it anywhere you need an unread
// count, e.g. to show a badge number on a bell icon in your nav header.
//
//   const unread = useUnreadNotificationCount();

export function useUnreadNotificationCount(): number {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }

    const unreadQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(unreadQuery, (snapshot) => {
      setCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  return count;
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  fullCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.card,
  },
  backButton: {
    paddingRight: 4,
    paddingVertical: 4,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.text.primary,
  },
  unreadBadge: {
    backgroundColor: Colors.primary,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 22,
    alignItems: 'center',
  },
  unreadBadgeText: {
    color: Colors.white,
    fontSize: 12,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerAction: {
    padding: 4,
  },
  headerActionText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },

  // ── Group Headers ──
  groupHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },

  // ── Notification Rows ──
  listContent: {
    paddingBottom: 40,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: Colors.background,
  },
  notificationRowUnread: {
    backgroundColor: `${Colors.primary}0A`,
  },
  iconBg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  notificationContent: {
    flex: 1,
    paddingTop: 2,
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.text.primary,
    lineHeight: 20,
  },
  notificationMessageUnread: {
    fontWeight: '600',
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
    marginTop: 6,
    flexShrink: 0,
  },

  // ── Empty State ──
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 20,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: Colors.text.secondary,
    marginTop: 8,
    textAlign: 'center',
    lineHeight: 22,
  },
});
