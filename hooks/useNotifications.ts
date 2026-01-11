// hooks/useNotifications.ts
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export type NotificationType = 'plan' | 'connection' | 'message' | 'spot' | 'city';

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: any;
  data?: any;
};

/**
 * Unified notification hook that tracks all notification types
 * Returns total unread count and notifications array
 */
export function useNotifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Store notifications by type to avoid duplicates
  const [notificationsByType, setNotificationsByType] = useState<{
    plan: Notification[];
    connection: Notification[];
    message: Notification[];
    spot: Notification[];
    city: Notification[];
  }>({
    plan: [],
    connection: [],
    message: [],
    spot: [],
    city: [],
  });

  const updateNotifications = (type: NotificationType, newNotifs: Notification[]) => {
    setNotificationsByType(prev => {
      const updated = { ...prev, [type]: newNotifs };
      
      // Combine all notifications
      const allNotifs = [
        ...updated.plan,
        ...updated.connection,
        ...updated.message,
        ...updated.spot,
        ...updated.city,
      ];

      // Sort by created date (newest first)
      allNotifs.sort((a, b) => {
        if (!a.createdAt || !b.createdAt) return 0;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });

      setNotifications(allNotifs);
      setUnreadCount(allNotifs.filter(n => !n.read).length);

      return updated;
    });
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // Listen to all notification types
    const unsubscribers: (() => void)[] = [];

    // 1. Plan Notifications
    const planNotificationsQuery = query(
      collection(db, 'planNotifications'),
      where('userId', '==', user.uid)
    );

    const unsubscribePlans = onSnapshot(planNotificationsQuery, (snapshot) => {
      const planNotifs: Notification[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        planNotifs.push({
          id: doc.id,
          type: 'plan',
          title: getPlanNotificationTitle(data.type),
          message: data.message,
          read: data.read || false,
          createdAt: data.createdAt,
          data: { planId: data.planId, type: data.type }
        });
      });
      updateNotifications('plan', planNotifs);
    });
    unsubscribers.push(unsubscribePlans);

    // 2. Connection Requests (received, not sent)
    const connectionRequestsQuery = query(
      collection(db, 'connectionRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribeConnections = onSnapshot(connectionRequestsQuery, (snapshot) => {
      const connectionNotifs: Notification[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        connectionNotifs.push({
          id: doc.id,
          type: 'connection',
          title: 'New Connection Request',
          message: data.message 
            ? `${data.fromUserName}: ${data.message}`
            : `${data.fromUserName} wants to connect`,
          read: false,
          createdAt: data.createdAt,
          data: { requestId: doc.id, fromUserId: data.fromUserId }
        });
      });
      updateNotifications('connection', connectionNotifs);
    });
    unsubscribers.push(unsubscribeConnections);

    // 3. Message Notifications - Track unread messages from connections
    const connectionsQuery = query(
      collection(db, 'connections'),
      where('userIds', 'array-contains', user.uid)
    );

    const unsubscribeMessages = onSnapshot(connectionsQuery, async (snapshot) => {
      const messageNotifs: Notification[] = [];
      
      for (const connectionDoc of snapshot.docs) {
        const data = connectionDoc.data();
        const unreadCount = data.unreadCount?.[user.uid] || 0;
        
        if (unreadCount > 0) {
          const otherUserId = data.userIds.find((id: string) => id !== user.uid);
          if (!otherUserId) continue;
          
          const senderDoc = await getDoc(doc(db, 'users', otherUserId));
          const senderName = senderDoc.data()?.displayName || 'Someone';
          
          messageNotifs.push({
            id: `message_${connectionDoc.id}`,
            type: 'message',
            title: senderName,
            message: data.lastMessage || 'New message',
            read: false,
            createdAt: data.lastMessageTime,
            data: { connectionId: connectionDoc.id, otherUserId, count: unreadCount }
          });
        }
      }
      
      updateNotifications('message', messageNotifs);
    });
    unsubscribers.push(unsubscribeMessages);

    // 4. Spot Notifications (approved/rejected)
    const spotNotificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('type', 'in', ['spot_approved', 'spot_rejected'])
    );

    const unsubscribeSpots = onSnapshot(spotNotificationsQuery, (snapshot) => {
      const spotNotifs: Notification[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        spotNotifs.push({
          id: doc.id,
          type: 'spot',
          title: data.type === 'spot_approved' ? 'Spot Approved! ✅' : 'Spot Update',
          message: data.message,
          read: data.read || false,
          createdAt: data.createdAt,
          data: { spotId: data.spotId, spotName: data.spotName, status: data.type }
        });
      });
      updateNotifications('spot', spotNotifs);
    });
    unsubscribers.push(unsubscribeSpots);

    // 5. City Request Notifications (approved/rejected)
    const cityNotificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('type', 'in', ['city_approved', 'city_rejected'])
    );

    const unsubscribeCities = onSnapshot(cityNotificationsQuery, (snapshot) => {
      const cityNotifs: Notification[] = [];
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        cityNotifs.push({
          id: doc.id,
          type: 'city',
          title: data.type === 'city_approved' ? 'City Added! ✈️' : 'City Request Update',
          message: data.message,
          read: data.read || false,
          createdAt: data.createdAt,
          data: { cityCode: data.cityCode, cityName: data.cityName, status: data.type }
        });
      });
      updateNotifications('city', cityNotifs);
    });
    unsubscribers.push(unsubscribeCities);

    setLoading(false);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user]);

  return {
    notifications,
    unreadCount,
    loading,
  };
}

function getPlanNotificationTitle(type: string): string {
  switch (type) {
    case 'plan_invite':
      return 'Plan Invitation';
    case 'plan_update':
      return 'Plan Updated';
    case 'plan_cancelled':
      return 'Plan Cancelled';
    case 'new_joiner':
      return 'New Plan Member';
    default:
      return 'Plan Notification';
  }
}
