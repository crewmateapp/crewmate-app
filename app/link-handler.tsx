// app/+link-handler.tsx
// This file handles incoming deep links to plans, connections, and referrals
import { useAuth } from '@/contexts/AuthContext';
import { setPendingReferrer } from '@/utils/pendingReferral';
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
          console.log('⏳ User not logged in, storing plan ID for after auth');
          router.push({
            pathname: '/plan/[id]',
            params: { id: planId }
          });
        }
      }
    }
    
    // Handle connection links: crewmateapp://connect/{userId}
    if (hostname === 'connect' && path) {
      const userId = path.split('/')[0]; // Get user ID from path
      
      if (userId) {
        console.log('👥 Navigating to user profile:', userId);
        
        // Navigate to friend profile
        if (user) {
          router.push({
            pathname: '/profile/friend/[userId]',
            params: { userId: userId }
          });
        } else {
          // Not logged in - redirect to sign in, then to profile
          console.log('⏳ User not logged in, redirecting to sign in first');
          // For now, navigate to sign in - they can try the link again after auth
          router.push('/auth/signin');
        }
      }
    }

    // Handle referral links: crewmateapp://refer/{referrerId}
    // This is tapped by someone who doesn't have an account yet.
    // We store the referrer ID so create-profile can pick it up after signup.
    if (hostname === 'refer' && path) {
      const referrerId = path.split('/')[0];

      if (referrerId) {
        console.log('🎁 Referral link received, referrer:', referrerId);

        // Store the referrer ID — survives through signup → create-profile
        setPendingReferrer(referrerId);

        if (user) {
          // Already signed in — edge case (existing user tapping a referral link).
          // Nothing to do, they're already on the app.
          console.log('📝 User already signed in, referral link ignored');
        } else {
          // Not signed in — send them to signup
          console.log('➡️ Redirecting to signup');
          router.push('/auth/signup');
        }
      }
    }
    
    // Add more deep link handlers here as needed
    // e.g., crewmateapp://spot/{id}, crewmateapp://layover/{id}, etc.
  };

  // This component doesn't render anything
  return null;
}
