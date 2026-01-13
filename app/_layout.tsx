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
  const [hasNavigated, setHasNavigated] = useState(false);
  
  // Initialize push notifications
  const { expoPushToken } = usePushNotifications();

  useEffect(() => {
    const checkUserState = async () => {
      if (loading) return;
      if (hasNavigated) return; // Prevent re-navigation

      console.log('🔍 Checking user state...', { 
        userExists: !!user, 
        uid: user?.uid 
      });

      if (!user) {
        console.log('❌ No user, going to signin');
        setHasNavigated(true);
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
      console.log('🎯 Checking onboarding...');
      const needsOnboarding = await redirectToOnboardingIfNeeded(user.uid);
      if (needsOnboarding) {
        console.log('📚 Needs onboarding, redirected');
        setHasNavigated(true);
        setCheckingProfile(false);
        return; // User was redirected to onboarding
      }

      // Check if profile exists in Firestore (with retry for timing issues)
      try {
        console.log('📄 Fetching user profile...', { userId: user.uid });
        
        // Add small delay to ensure Firebase is fully initialized
        await new Promise(resolve => setTimeout(resolve, 500));
        
        let userDoc = await getDoc(doc(db, 'users', user.uid));
        
        // Retry once if first attempt fails
        if (!userDoc.exists()) {
          console.log('⚠️ First attempt failed, retrying in 1s...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          userDoc = await getDoc(doc(db, 'users', user.uid));
        }
        
        console.log('📦 Document result:', { 
          exists: userDoc.exists(),
          id: userDoc.id,
          hasData: !!userDoc.data()
        });
        
        if (!userDoc.exists()) {
          console.log('❌ Profile does not exist after retry, going to create-profile');
          setHasNavigated(true);
          router.replace('/auth/create-profile');
          setCheckingProfile(false);
          return;
        }

        const userData = userDoc.data();
        console.log('✅ Profile found:', { 
          profileComplete: userData?.profileComplete,
          hasData: !!userData 
        });

        if (userData?.profileComplete) {
          console.log('🎉 Profile complete, going to tabs');
          setHasNavigated(true);
          router.replace('/(tabs)');
        } else {
          console.log('⚠️ Profile incomplete, going to create-profile');
          setHasNavigated(true);
          router.replace('/auth/create-profile');
        }
      } catch (error) {
        console.error('❌ Error checking profile:', error);
        setHasNavigated(true);
        router.replace('/auth/create-profile');
      }
      
      setCheckingProfile(false);
    };

    checkUserState();
  }, [user, loading, hasNavigated]);

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
