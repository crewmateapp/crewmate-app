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

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user } = useAuth();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Listen for incoming connection requests
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'connectionRequests'),
      where('toUserId', '==', user.uid),
      where('status', '==', 'pending')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [user]);

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
              unreadCount={unreadCount}
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
        {/* Hidden tabs - accessible via routes but not in tab bar */}
        <Tabs.Screen
          name="connections"
          options={{
            href: null, // Hides from tab bar
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            href: null, // Hides from tab bar - accessible via ProfileDropdown
          }}
        />
      </Tabs>
    </>
  );
}
