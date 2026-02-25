import { DarkTheme, DefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { db } from '@/config/firebase';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { redirectToOnboardingIfNeeded } from '@/hooks/useOnboardingCheck';
import { useNotifications } from '@/utils/notificationSetup';
import AnimatedSplash from '@/components/AnimatedSplash';
import LinkHandler from './link-handler';

// Keep the native splash screen visible until we're ready
SplashScreen.preventAutoHideAsync().catch(() => {});

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const { isDark } = useTheme();
  const { user, loading } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);
  const [hasNavigated, setHasNavigated] = useState(false);
  
  // Splash screen state
  const [appReady, setAppReady] = useState(false);
  const [splashDone, setSplashDone] = useState(false);
  const [nativeSplashHidden, setNativeSplashHidden] = useState(false);
  
  // Initialize push notifications
  useNotifications(user?.uid ?? null);

  // Hide native splash once our animated one is mounted
  useEffect(() => {
    if (!nativeSplashHidden) {
      const timer = setTimeout(async () => {
        await SplashScreen.hideAsync().catch(() => {});
        setNativeSplashHidden(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [nativeSplashHidden]);

  useEffect(() => {
    const checkUserState = async () => {
      if (loading) return;
      if (hasNavigated) return;

      console.log('🔍 Checking user state...', { 
        userExists: !!user, 
        uid: user?.uid 
      });

      if (!user) {
        console.log('❌ No user, going to signin');
        setHasNavigated(true);
        router.replace('/auth/signin');
        setCheckingProfile(false);
        setAppReady(true);
        return;
      }

      // Check if user needs onboarding
      console.log('🎯 Checking onboarding...');
      const needsOnboarding = await redirectToOnboardingIfNeeded(user.uid);
      if (needsOnboarding) {
        console.log('📚 Needs onboarding, redirected');
        setHasNavigated(true);
        setCheckingProfile(false);
        setAppReady(true);
        return;
      }

      // Check Firestore user document
      try {
        console.log('📄 Fetching user profile...', { userId: user.uid });
        
        await new Promise(resolve => setTimeout(resolve, 500));
        
        let userDoc = await getDoc(doc(db, 'users', user.uid));
        
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
          // New social sign-in user — doc should have been created by AuthContext
          // but if it hasn't yet, send to verify-crew
          console.log('❌ No user doc, going to verify-crew');
          setHasNavigated(true);
          router.replace('/auth/verify-crew');
          setCheckingProfile(false);
          setAppReady(true);
          return;
        }

        const userData = userDoc.data();
        console.log('✅ Profile found:', { 
          profileComplete: userData?.profileComplete,
          verifiedCrew: userData?.verifiedCrew,
        });

        // ── NEW: Check crew verification status ──────────────────────
        if (userData?.verifiedCrew === false) {
          console.log('🛡️ Crew not verified, going to verify-crew');
          setHasNavigated(true);
          router.replace('/auth/verify-crew');
          setCheckingProfile(false);
          setAppReady(true);
          return;
        }

        // ── Existing flow: check profile completeness ────────────────
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
      setAppReady(true);
    };

    checkUserState();
  }, [user, loading]);

  return (
    <>
      <LinkHandler />
      <NavThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="auth/signin" />
          <Stack.Screen name="auth/signup" />
          <Stack.Screen name="auth/verify-email" />
          <Stack.Screen name="auth/verify-crew" />
          <Stack.Screen name="auth/create-profile" />
          <Stack.Screen name="onboarding" />
          <Stack.Screen name="setup-profile" />
          <Stack.Screen name="tutorial" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="plan-invite" />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style={isDark ? "light" : "dark"} />
      </NavThemeProvider>

      {!splashDone && (
        <AnimatedSplash
          isReady={appReady}
          onAnimationComplete={() => setSplashDone(true)}
        />
      )}
    </>
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
