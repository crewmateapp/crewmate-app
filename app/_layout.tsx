import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { router, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return; // Wait for auth to initialize

    if (!user) {
      // Not logged in - go to sign in
      router.replace('/auth/signin');
    } else if (!user.emailVerified) {
      // Logged in but email not verified
      router.replace('/auth/verify-email');
    } else {
      // Logged in and verified - go to main app
      router.replace('/(tabs)');
    }
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