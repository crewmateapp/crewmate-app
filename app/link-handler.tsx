// app/+link-handler.tsx
// Handles incoming deep links to plans, connections, and referrals.
//
// Supports TWO formats:
//   Custom scheme:  crewmateapp://refer/{id}   (app already installed)
//   Universal link: https://crewmateapp.dev/refer/{id}  (works even if app not installed)
//
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

  // ─── Parse any link format into { type, id } ──────────────────────────
  // Custom scheme:  crewmateapp://refer/abc123
  //   → Linking.parse → hostname="refer", path="abc123"
  //
  // Universal link:  https://crewmateapp.dev/refer/abc123
  //   → Linking.parse → hostname="crewmateapp.dev", path="/refer/abc123"
  //
  const parseLinkType = (url: string): { type: string; id: string } | null => {
    try {
      const parsed = Linking.parse(url);

      // Custom scheme: hostname is the type (refer, plan, connect)
      if (parsed.hostname && parsed.hostname !== 'crewmateapp.dev' && parsed.hostname !== 'www.crewmateapp.dev') {
        const type = parsed.hostname;
        const id = parsed.path?.split('/')[0] || '';
        if (type && id) return { type, id };
      }

      // Universal link: parse type from path
      const path = parsed.path || '';
      const segments = path.split('/').filter(Boolean);
      // segments for /refer/abc123 → ["refer", "abc123"]
      if (segments.length >= 2) {
        return { type: segments[0], id: segments[1] };
      }

      return null;
    } catch {
      console.error('📱 Failed to parse link:', url);
      return null;
    }
  };

  const handleDeepLink = (url: string) => {
    // Don't process if still loading auth
    if (loading) {
      setTimeout(() => handleDeepLink(url), 500);
      return;
    }

    console.log('📱 Received deep link:', url);

    const link = parseLinkType(url);
    if (!link) {
      console.log('📱 Could not parse link, ignoring');
      return;
    }

    console.log(`📱 Parsed: type=${link.type}, id=${link.id}`);

    // Handle plan links
    if (link.type === 'plan') {
      console.log('🎯 Navigating to plan:', link.id);
      
      if (user) {
        router.push({
          pathname: '/plan/[id]',
          params: { id: link.id }
        });
      } else {
        console.log('⏳ User not logged in, storing plan ID for after auth');
        router.push({
          pathname: '/plan/[id]',
          params: { id: link.id }
        });
      }
    }
    
    // Handle connection links
    if (link.type === 'connect') {
      console.log('👥 Navigating to connect screen:', link.id);
      
      if (user) {
        router.push({
          pathname: '/connect/[userID]',
          params: { userID: link.id }
        });
      } else {
        console.log('⏳ User not logged in, redirecting to sign in first');
        router.push('/auth/signin');
      }
    }

    // Handle referral links
    if (link.type === 'refer') {
      console.log('🎁 Referral link received, referrer:', link.id);

      // Store the referrer ID — survives through signup → create-profile
      setPendingReferrer(link.id);

      if (user) {
        // Already signed in — edge case (existing user tapping a referral link).
        console.log('📝 User already signed in, referral link ignored');
      } else {
        // Not signed in — send them to signup
        console.log('➡️ Redirecting to signup');
        router.push('/auth/signup');
      }
    }
  };

  // This component doesn't render anything
  return null;
}
