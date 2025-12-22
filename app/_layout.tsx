import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { doc, getDoc } from 'firebase/firestore';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';

import { db } from '@/config/firebase';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading } = useAuth();
  const [checkingProfile, setCheckingProfile] = useState(true);

  useEffect(() => {
    const checkUserState = async () => {
      if (loading) return;

      if (!user) {
        router.replace('/auth/signin');
        setCheckingProfile(false);
        return;
      }

      if (!user.emailVerified) {
        router.replace('/auth/verify-email');
        setCheckingProfile(false);
        return;
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
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth/signin" />
        <Stack.Screen name="auth/signup" />
        <Stack.Screen name="auth/verify-email" />
        <Stack.Screen name="auth/create-profile" />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}