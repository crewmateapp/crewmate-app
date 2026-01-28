// app/+link-handler.tsx
// This file handles incoming deep links to plans
import { useAuth } from '@/contexts/AuthContext';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { useEffect } from 'react';

export default function LinkHandler() {
  const { user, loading } = useAuth();

  useEffect(() => {
    // Handle initial URL (app opened via link)
    const handleInitialURL = async () => {
      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) {
        handleDeepLink(initialUrl);
      }
    };

    // Handle URL when app is already open
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    handleInitialURL();

    return () => {
      subscription.remove();
    };
  }, [user, loading]);

  const handleDeepLink = (url: string) => {
    // Don't process if still loading auth
    if (loading) {
      setTimeout(() => handleDeepLink(url), 500);
      return;
    }

    console.log('📱 Received deep link:', url);

    // Parse the URL
    const { hostname, path, queryParams } = Linking.parse(url);

    // Handle plan links: crewmateapp://plan/{id}
    if (hostname === 'plan' && path) {
      const planId = path.split('/')[0]; // Get first segment after /plan/
      
      if (planId) {
        console.log('🎯 Navigating to plan:', planId);
        
        // If user is logged in, go to plan
        if (user) {
          router.push({
            pathname: '/plan/[id]',
            params: { id: planId }
          });
        } else {
          // Store the plan ID and redirect after login
          // You could use AsyncStorage here to persist across app restarts
          console.log('⏳ User not logged in, storing plan ID for after auth');
          // For now, we'll just navigate to the plan - the plan page will handle auth redirects
          router.push({
            pathname: '/plan/[id]',
            params: { id: planId }
          });
        }
      }
    }
    
    // Handle other deep link types here in the future
    // e.g., crewmateapp://spot/{id}, crewmateapp://profile/{id}, etc.
  };

  // This component doesn't render anything
  return null;
}
