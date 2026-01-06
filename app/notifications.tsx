// app/notifications.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import {
    deleteDoc,
    doc,
    getDocs,
    query,
    updateDoc,
    where,
    collection,
} from 'firebase/firestore';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { notifications, unreadCount, loading } = useNotifications();

  const handleMarkAllAsRead = async () => {
    if (!user) return;

    try {
      // Mark all plan notifications as read
      const unreadPlanNotifs = notifications.filter(n => n.type === 'plan' && !n.read);
      const promises = unreadPlanNotifs.map(notification =>
        updateDoc(doc(db, 'planNotifications', notification.id), { read: true })
      );
      await Promise.all(promises);
      
      Alert.alert('Success', 'All notifications marked as read');
    } catch (error) {
      console.error('Error marking all as read:', error);
      Alert.alert('Error', 'Failed to mark notifications as read');
    }
  };

  const handleNotificationPress = async (notification: any) => {
    // Mark as read if it's a plan notification
    if (notification.type === 'plan' && !notification.read) {
      try {
        await updateDoc(doc(db, 'planNotifications', notification.id), { read: true });
      } catch (error) {
        console.error('Error marking as read:', error);
      }
    }

    // Navigate based on notification type
    if (notification.type === 'plan' && notification.data?.planId) {
      router.push({ pathname: '/plan/[id]', params: { id: notification.data.planId } });
    } else if (notification.type === 'connection' && notification.data?.requestId) {
      router.push('/connection-requests');
    }
    // Add more navigation cases as needed
  };

  const handleDeleteNotification = async (notification: any) => {
    try {
      if (notification.type === 'plan') {
        await deleteDoc(doc(db, 'planNotifications', notification.id));
      } else if (notification.type === 'connection') {
        // Don't delete connection requests, just decline them
        Alert.alert(
          'Decline Request?',
          'Do you want to decline this connection request?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Decline',
              style: 'destructive',
              onPress: async () => {
                await updateDoc(doc(db, 'connectionRequests', notification.id), {
                  status: 'declined'
                });
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
      Alert.alert('Error', 'Failed to delete notification');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'plan':
        return 'calendar';
      case 'connection':
        return 'people';
      case 'message':
        return 'chatbubble';
      default:
        return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case 'plan':
        return colors.primary;
      case 'connection':
        return colors.success;
      case 'message':
        return colors.accent;
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
        {unreadCount > 0 && (
          <TouchableOpacity onPress={handleMarkAllAsRead}>
            <ThemedText style={[styles.markAllRead, { color: colors.primary }]}>
              Mark All Read
            </ThemedText>
          </TouchableOpacity>
        )}
        {unreadCount === 0 && <View style={{ width: 24 }} />}
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
                onPress={() => handleNotificationPress(notification)}
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
                    <ThemedText style={styles.notificationTitle}>
                      {notification.title}
                    </ThemedText>
                    <ThemedText style={[styles.notificationMessage, { color: colors.text.secondary }]}>
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
                      handleDeleteNotification(notification);
                    }}
                    style={styles.deleteButton}
                  >
                    <Ionicons name="close" size={20} color={colors.text.secondary} />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color={colors.text.secondary} />
            <ThemedText style={styles.emptyTitle}>No Notifications</ThemedText>
            <ThemedText style={[styles.emptyText, { color: colors.text.secondary }]}>
              You're all caught up! Notifications about plans, connections, and messages will appear here.
            </ThemedText>
          </View>
        )}

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
    alignItems: 'flex-start',
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
  notificationTitle: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
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
    marginLeft: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  deleteButton: {
    padding: 4,
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
});
