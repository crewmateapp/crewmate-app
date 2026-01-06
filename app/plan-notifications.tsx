// app/plan-notifications.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    collection,
    deleteDoc,
    doc,
    onSnapshot,
    orderBy,
    query,
    updateDoc,
    where,
} from 'firebase/firestore';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    TouchableOpacity,
    View,
} from 'react-native';

type Notification = {
  id: string;
  type: 'plan_invite' | 'plan_update' | 'plan_cancelled' | 'new_joiner';
  planId: string;
  planName: string;
  message: string;
  read: boolean;
  createdAt: any;
};

type NotificationPreferences = {
  planInvites: boolean;
  planUpdates: boolean;
  newJoiners: boolean;
  planCancellations: boolean;
};

export default function PlanNotificationsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    planInvites: true,
    planUpdates: true,
    newJoiners: true,
    planCancellations: true,
  });

  useEffect(() => {
    if (!user) return;

    // Listen to notifications
    const notificationsQuery = query(
      collection(db, 'planNotifications'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.docs.forEach(doc => {
        notifs.push({ id: doc.id, ...doc.data() } as Notification);
      });
      setNotifications(notifs);
      setLoading(false);
    });

    // Load preferences
    loadPreferences();

    return () => unsubscribe();
  }, [user]);

  const loadPreferences = async () => {
    if (!user) return;

    try {
      const userDoc = await getDocs(doc(db, 'users', user.uid));
      if (userDoc.exists() && userDoc.data().notificationPreferences) {
        setPreferences(userDoc.data().notificationPreferences);
      }
    } catch (error) {
      console.error('Error loading preferences:', error);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'planNotifications', notificationId), {
        read: true,
      });
    } catch (error) {
      console.error('Error marking as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const promises = unreadNotifications.map(notification =>
        updateDoc(doc(db, 'planNotifications', notification.id), { read: true })
      );
      await Promise.all(promises);
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  const handleDeleteNotification = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'planNotifications', notificationId));
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications?',
      'This will permanently delete all notifications.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            try {
              const promises = notifications.map(notification =>
                deleteDoc(doc(db, 'planNotifications', notification.id))
              );
              await Promise.all(promises);
              Alert.alert('Success', 'All notifications cleared');
            } catch (error) {
              console.error('Error clearing notifications:', error);
              Alert.alert('Error', 'Failed to clear notifications');
            }
          },
        },
      ]
    );
  };

  const handleTogglePreference = async (key: keyof NotificationPreferences) => {
    if (!user) return;

    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };

    setPreferences(newPreferences);

    try {
      await updateDoc(doc(db, 'users', user.uid), {
        notificationPreferences: newPreferences,
      });
    } catch (error) {
      console.error('Error updating preferences:', error);
      Alert.alert('Error', 'Failed to update notification preferences');
      // Revert on error
      setPreferences(preferences);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'plan_invite':
        return 'mail';
      case 'plan_update':
        return 'information-circle';
      case 'plan_cancelled':
        return 'close-circle';
      case 'new_joiner':
        return 'person-add';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'plan_invite':
        return colors.primary;
      case 'plan_update':
        return colors.accent;
      case 'plan_cancelled':
        return colors.error;
      case 'new_joiner':
        return colors.success;
      default:
        return colors.text.secondary;
    }
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
          </TouchableOpacity>
          <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
          <View style={{ width: 24 }} />
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 100 }} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text.primary} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Notifications</ThemedText>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <ThemedText style={[styles.markAllRead, { color: colors.primary }]}>
              Mark All Read
            </ThemedText>
          </TouchableOpacity>
        )}
        {notifications.length === 0 && <View style={{ width: 24 }} />}
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Unread Count */}
        {unreadCount > 0 && (
          <View style={styles.unreadBanner}>
            <ThemedText style={[styles.unreadText, { color: colors.text.secondary }]}>
              {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
            </ThemedText>
          </View>
        )}

        {/* Notifications List */}
        {notifications.length > 0 ? (
          <>
            {notifications.map((notification) => (
              <TouchableOpacity
                key={notification.id}
                style={[
                  styles.notificationCard,
                  {
                    backgroundColor: notification.read ? colors.card : colors.primary + '10',
                    borderColor: notification.read ? colors.border : colors.primary + '30',
                  }
                ]}
                onPress={() => {
                  if (!notification.read) {
                    handleMarkAsRead(notification.id);
                  }
                  router.push({ pathname: '/plan/[id]', params: { id: notification.planId } });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.notificationLeft}>
                  <View
                    style={[
                      styles.iconCircle,
                      { backgroundColor: getNotificationColor(notification.type) + '20' }
                    ]}
                  >
                    <Ionicons
                      name={getNotificationIcon(notification.type) as any}
                      size={20}
                      color={getNotificationColor(notification.type)}
                    />
                  </View>
                  <View style={styles.notificationContent}>
                    <ThemedText style={styles.notificationMessage}>
                      {notification.message}
                    </ThemedText>
                    <ThemedText style={[styles.notificationTime, { color: colors.text.secondary }]}>
                      {formatTime(notification.createdAt)}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.notificationRight}>
                  {!notification.read && (
                    <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />
                  )}
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      handleDeleteNotification(notification.id);
                    }}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="close" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            {/* Clear All Button */}
            <TouchableOpacity
              style={[styles.clearAllButton, { borderColor: colors.border }]}
              onPress={handleClearAll}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
              <ThemedText style={[styles.clearAllText, { color: colors.error }]}>
                Clear All Notifications
              </ThemedText>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>No Notifications</ThemedText>
            <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
              You're all caught up! Notifications about plans will appear here.
            </ThemedText>
          </View>
        )}

        {/* Notification Preferences */}
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: colors.text.secondary }]}>
            NOTIFICATION PREFERENCES
          </ThemedText>

          <View style={[styles.preferenceCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Ionicons name="mail" size={20} color={colors.text.primary} />
                <View style={styles.preferenceText}>
                  <ThemedText style={styles.preferenceLabel}>Plan Invites</ThemedText>
                  <ThemedText style={[styles.preferenceDescription, { color: colors.text.secondary }]}>
                    When someone invites you to a plan
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={preferences.planInvites}
                onValueChange={() => handleTogglePreference('planInvites')}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Ionicons name="information-circle" size={20} color={colors.text.primary} />
                <View style={styles.preferenceText}>
                  <ThemedText style={styles.preferenceLabel}>Plan Updates</ThemedText>
                  <ThemedText style={[styles.preferenceDescription, { color: colors.text.secondary }]}>
                    When details of your plans change
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={preferences.planUpdates}
                onValueChange={() => handleTogglePreference('planUpdates')}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Ionicons name="person-add" size={20} color={colors.text.primary} />
                <View style={styles.preferenceText}>
                  <ThemedText style={styles.preferenceLabel}>New Joiners</ThemedText>
                  <ThemedText style={[styles.preferenceDescription, { color: colors.text.secondary }]}>
                    When someone joins your plan
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={preferences.newJoiners}
                onValueChange={() => handleTogglePreference('newJoiners')}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.preferenceItem}>
              <View style={styles.preferenceInfo}>
                <Ionicons name="close-circle" size={20} color={colors.text.primary} />
                <View style={styles.preferenceText}>
                  <ThemedText style={styles.preferenceLabel}>Plan Cancellations</ThemedText>
                  <ThemedText style={[styles.preferenceDescription, { color: colors.text.secondary }]}>
                    When a plan you joined is cancelled
                  </ThemedText>
                </View>
              </View>
              <Switch
                value={preferences.planCancellations}
                onValueChange={() => handleTogglePreference('planCancellations')}
                trackColor={{ false: colors.border, true: colors.primary }}
              />
            </View>
          </View>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  markAllRead: {
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  unreadBanner: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  unreadText: {
    fontSize: 14,
    fontWeight: '600',
  },
  notificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  notificationLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
  },
  notificationMessage: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 13,
  },
  notificationRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deleteButton: {
    padding: 4,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  clearAllText: {
    fontSize: 16,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  section: {
    marginTop: 32,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  preferenceCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  preferenceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  preferenceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  preferenceText: {
    flex: 1,
  },
  preferenceLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  preferenceDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    marginLeft: 48,
  },
});
