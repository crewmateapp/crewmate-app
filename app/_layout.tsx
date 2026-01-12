import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import * as Notifications from 'expo-notifications';

import { db } from '@/config/firebase';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { redirectToOnboardingIfNeeded } from '@/hooks/useOnboardingCheck';
import { usePushNotifications } from '@/hooks/usePushNotifications';

// Configure how notifications are handled when app is in foreground
// Only set if notifications are available (not in Expo Go)
if (Notifications.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { isDark } = useTheme();
  const { user, loading } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);
  
  // Initialize push notifications
  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    const checkUserState = async () => {
      if (loading) return;

      if (!user) {
        router.replace('/auth/signin');
        setCheckingProfile(false);
        return;
      }

      // TODO: RE-ENABLE EMAIL VERIFICATION BEFORE PRODUCTION!
      // TEMPORARILY BYPASSED FOR TESTING
      // if (!user.emailVerified) {
      //   router.replace('/auth/verify-email');
      //   setCheckingProfile(false);
      //   return;
      // }

      // Check if user needs onboarding
      const needsOnboarding = await redirectToOnboardingIfNeeded(user.uid);
      if (needsOnboarding) {
        setCheckingProfile(false);
        return; // User was redirected to onboarding
      }

      // Check if profile exists in Firestore
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().profileComplete) {
          router.replace('/(tabs)');
        } else {
          router.replace('/auth/create-profile');
        }
      } catch (error) {
        console.error('Error checking profile:', error);
        router.replace('/auth/create-profile');
      }
      
      setCheckingProfile(false);
    };

    checkUserState();
  }, [user, loading]);

  return (
    <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/signin" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/verify-email" />
        <Stack.Screen name="auth/create-profile" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="setup-profile" />
        <Stack.Screen name="tutorial" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style={isDark ? "light" : "dark"} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeProvider>
  );
}
