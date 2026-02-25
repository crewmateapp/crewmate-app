import { router, Tabs } from 'expo-router';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';

import AppDrawer from '@/components/AppDrawer';
import AppHeader from '@/components/AppHeader';
import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { db } from '@/config/firebase';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { Ionicons } from '@expo/vector-icons';
import { Text, View } from 'react-native';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [connectionRequestCount, setConnectionRequestCount] = useState(0);
  const [planNotificationCount, setPlanNotificationCount] = useState(0);
  const [messageCount, setMessageCount] = useState(0);

  // Listen for incoming connection requests
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'connectionRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setConnectionRequestCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for unread plan notifications
  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'planNotifications'),
      where('userId', '==', user.uid),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setPlanNotificationCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

  // Listen for unread messages — uses `conversations` collection (same as ProfileMenu)
  // FIX: Previously queried `connections` which was a different collection and caused
  // badge count mismatches between the tab bar and the profile menu.
  useEffect(() => {
    if (!user?.uid) return;

    const conversationsRef = collection(db, 'conversations');
    const q = query(
      conversationsRef,
      where('participantIds', 'array-contains', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      let totalUnread = 0;
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        totalUnread += data.unreadCount?.[user.uid] || 0;
      });
      setMessageCount(totalUnread);
    });

    return () => unsubscribe();
  }, [user]);

  // Total badge for Messages tab = unread messages + connection requests
  const messageBadgeCount = messageCount + connectionRequestCount;

  return (
    <>
      <AppDrawer 
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
      />
      
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.text.secondary,
          header: () => (
            <AppHeader
              onMenuPress={() => setDrawerVisible(true)}
            />
          ),
          tabBarButton: HapticTab,
          tabBarStyle: {
            backgroundColor: colorScheme === 'dark' ? '#000' : Colors.white,
            borderTopColor: Colors.border,
          },
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'My Layover',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="map.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Explore',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="magnifyingglass" color={color} />,
          }}
        />
        <Tabs.Screen
          name="feed"
          options={{
            title: 'Feed',
            tabBarIcon: ({ color }) => <IconSymbol size={28} name="square.grid.2x2.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: 'Messages',
            tabBarIcon: ({ color, focused }) => (
              <View style={{ position: 'relative' }}>
                <Ionicons 
                  name={focused ? "chatbubbles" : "chatbubbles-outline"} 
                  size={26} 
                  color={color} 
                />
                {messageBadgeCount > 0 && (
                  <View style={{
                    position: 'absolute',
                    top: -4,
                    right: -8,
                    backgroundColor: Colors.error,
                    borderRadius: 9,
                    minWidth: 18,
                    height: 18,
                    alignItems: 'center',
                    justifyContent: 'center',
                    paddingHorizontal: 4,
                    borderWidth: 2,
                    borderColor: Colors.white,
                  }}>
                    <Text style={{ 
                      fontSize: 10, 
                      fontWeight: '700', 
                      color: Colors.white,
                    }}>
                      {messageBadgeCount > 9 ? '9+' : messageBadgeCount}
                    </Text>
                  </View>
                )}
              </View>
            ),
          }}
        />
        {/* Hidden tabs - accessible via routes but not in tab bar */}
        <Tabs.Screen
          name="plans"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="connections"
          options={{
            href: null,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}
