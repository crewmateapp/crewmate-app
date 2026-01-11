// app/notifications.tsx
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useNotifications } from '@/hooks/useNotifications';
import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useEffect } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';

export default function NotificationsScreen() {
  const { notifications, loading } = useNotifications();
  const { user } = useAuth();

  // Filter to only show spot and city notifications
  const submissionNotifications = notifications.filter(
    n => n.type === 'spot' || n.type === 'city'
  );

  // Mark all as read when screen is viewed
  useEffect(() => {
    const unreadNotifs = submissionNotifications.filter(n => !n.read);
    
    if (unreadNotifs.length > 0 && user) {
      // Mark as read after a short delay
      const timer = setTimeout(() => {
        unreadNotifs.forEach(async (notif) => {
          try {
            await updateDoc(doc(db, 'notifications', notif.id), {
              read: true,
            });
          } catch (error) {
            console.error('Error marking notification as read:', error);
          }
        });
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [submissionNotifications.length, user]);

  const getNotificationIcon = (type: string, status: string) => {
    if (type === 'spot') {
      return status.includes('approved') ? 'checkmark-circle' : 'close-circle';
    } else {
      return status.includes('approved') ? 'airplane' : 'close-circle';
    }
  };

  const getNotificationColor = (status: string) => {
    return status.includes('approved') ? Colors.success : Colors.error;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleNotificationPress = async (notification: any) => {
    // Only navigate if approved
    if (!notification.data?.status.includes('approved')) {
      return; // Don't navigate for rejections
    }

    if (notification.type === 'spot') {
      // Navigate to spot detail
      const spotId = notification.data?.spotId;
      
      if (spotId) {
        try {
          // Check if spot still exists
          const spotDoc = await getDoc(doc(db, 'spots', spotId));
          
          if (spotDoc.exists()) {
            // Navigate to spot detail
            router.push(`/spot/${spotId}`);
          } else {
            Alert.alert('Spot Not Found', 'This spot may have been removed.');
          }
        } catch (error) {
          console.error('Error checking spot:', error);
        }
      }
    } else if (notification.type === 'city') {
      // Navigate to layover screen (index)
      const cityCode = notification.data?.cityCode;
      
      if (cityCode) {
        // Navigate to layover screen - user can then select the city
        router.push('/(tabs)/index');
        
        // Optional: Show a toast or hint about the new city
        setTimeout(() => {
          Alert.alert(
            'City Added! ✈️',
            `${notification.data.cityName} is now available in the city picker!`,
            [{ text: 'OK' }]
          );
        }, 500);
      }
    }
  };

  const renderNotification = ({ item }: { item: any }) => {
    const isApproved = item.data?.status.includes('approved');
    
    return (
      <TouchableOpacity
        style={[
          styles.notificationCard,
          !item.read && styles.unreadCard,
        ]}
        onPress={() => handleNotificationPress(item)}
        activeOpacity={isApproved ? 0.7 : 1}
        disabled={!isApproved}
      >
        <View style={styles.notificationContent}>
          {/* Icon */}
          <View style={[
            styles.iconContainer,
            { backgroundColor: getNotificationColor(item.data?.status) + '20' }
          ]}>
            <Ionicons
              name={getNotificationIcon(item.type, item.data?.status)}
              size={24}
              color={getNotificationColor(item.data?.status)}
            />
          </View>

          {/* Content */}
          <View style={styles.textContainer}>
            <ThemedText style={styles.notificationTitle}>
              {item.title}
            </ThemedText>
            <ThemedText style={styles.notificationMessage}>
              {item.message}
            </ThemedText>
            {isApproved && (
              <ThemedText style={styles.tapHint}>
                Tap to view →
              </ThemedText>
            )}
            <ThemedText style={styles.notificationTime}>
              {formatDate(item.createdAt)}
            </ThemedText>
          </View>

          {/* Unread indicator */}
          {!item.read && (
            <View style={styles.unreadDot} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="notifications-off-outline" size={64} color={Colors.text.disabled} />
      <ThemedText style={styles.emptyTitle}>No Notifications</ThemedText>
      <ThemedText style={styles.emptyText}>
        You'll see updates about your spot and city submissions here
      </ThemedText>
    </View>
  );

  return (
    <>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerShown: true,
          headerStyle: {
            backgroundColor: Colors.primary,
          },
          headerTintColor: Colors.white,
          headerTitleStyle: {
            fontWeight: '700',
          },
          headerShadowVisible: false,
        }}
      />
      <ThemedView style={styles.container}>
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={submissionNotifications}
            renderItem={renderNotification}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.listContent,
              submissionNotifications.length === 0 && styles.emptyList,
            ]}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
          />
        )}
      </ThemedView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  notificationCard: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
      },
      android: {
        elevation: 1,
      },
    }),
  },
  unreadCard: {
    backgroundColor: Colors.primary + '08',
    borderColor: Colors.primary + '30',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  notificationMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
    lineHeight: 20,
  },
  tapHint: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 12,
    color: Colors.text.disabled,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
    marginLeft: 8,
    marginTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
