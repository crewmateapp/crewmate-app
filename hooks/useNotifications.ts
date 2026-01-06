// hooks/useNotifications.ts
import { db } from '@/config/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { useEffect, useState } from 'react';

export type NotificationType = 'plan' | 'connection' | 'message';

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
          read: false, // Connection requests are always "unread" until accepted/declined
          createdAt: data.createdAt,
          data: { requestId: doc.id, fromUserId: data.fromUserId }
        });
      });
      updateNotifications('connection', connectionNotifs);
    });
    unsubscribers.push(unsubscribeConnections);

    // 3. Message Notifications - Track unread messages from conversations collection
    const conversationsQuery = query(
      collection(db, 'conversations'),
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribeMessages = onSnapshot(conversationsQuery, async (conversationsSnapshot) => {
      const messageNotifs: Notification[] = [];
      
      // For each conversation, check for unread messages
      for (const conversationDoc of conversationsSnapshot.docs) {
        const data = conversationDoc.data();
        const unreadCount = data.unreadCount?.[user.uid] || 0;
        
        if (unreadCount > 0) {
          // Get the other user's ID
          const otherUserId = data.participantIds.find((id: string) => id !== user.uid);
          
          if (!otherUserId) continue;
          
          // Get sender name
          const senderDoc = await getDoc(doc(db, 'users', otherUserId));
          const senderName = senderDoc.data()?.displayName || 'Someone';
          
          // Create notification for this conversation
          messageNotifs.push({
            id: `message_${conversationDoc.id}`,
            type: 'message',
            title: `${senderName}`,
            message: data.lastMessage || 'New message',
            read: false,
            createdAt: data.lastMessageTime,
            data: { conversationId: conversationDoc.id, otherUserId, count: unreadCount }
          });
        }
      }
      
      updateNotifications('message', messageNotifs);
    });
    unsubscribers.push(unsubscribeMessages);

    setLoading(false);

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [user]);

  // Store notifications by type to avoid duplicates
  const notificationsByType = {
    plan: [] as Notification[],
    connection: [] as Notification[],
    message: [] as Notification[],
  };

  const updateNotifications = (type: NotificationType, newNotifs: Notification[]) => {
    notificationsByType[type] = newNotifs;
    
    // Combine all notifications
    const allNotifs = [
      ...notificationsByType.plan,
      ...notificationsByType.connection,
      ...notificationsByType.message,
    ];

    // Sort by created date (newest first)
    allNotifs.sort((a, b) => {
      if (!a.createdAt || !b.createdAt) return 0;
      return b.createdAt.toMillis() - a.createdAt.toMillis();
    });

    setNotifications(allNotifs);
    setUnreadCount(allNotifs.filter(n => !n.read).length);
  };

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
