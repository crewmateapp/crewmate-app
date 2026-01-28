// hooks/useCMSTracking.ts
import { checkLevelUp, getLevelForCMS, LevelTier } from '@/constants/Levels';
import { Badge } from '@/constants/BadgeDefinitions';
import { checkNewBadges, UserStats } from '@/utils/checkBadges';
import { 
  updateStatsForLayoverCheckIn,
  trackPlanCreated as trackPlanCreatedStats,
  updateStatsForPlanCompleted,
  updateStatsForPlanJoined,
  updateStatsForReviewWritten,
  updateStatsForConnectionAccepted,
  updateStatsForPhotoAdded,
} from '@/utils/updateUserStats';
import { useState, useCallback } from 'react';
import { ToastData } from '@/components/CMSToast';

export interface CMSEvent {
  amount: number;
  message: string;
  icon?: string;
  position?: { x: number; y: number };
}

export interface LevelUpEvent {
  oldLevel: LevelTier;
  newLevel: LevelTier;
}

interface UseCMSTrackingReturn {
  // State
  floatingAnimation: CMSEvent | null;
  toastQueue: ToastData[];
  levelUpData: LevelUpEvent | null;
  badgeUnlocked: Badge | null; // NEW: For badge unlock modal
  isTracking: boolean;
  error: string | null;

  // Tracking functions (wrapped with animations)
  trackCheckIn: (userId: string, city: string, area: string) => Promise<void>;
  trackPlanCreated: (userId: string, planId: string) => Promise<void>; // NEW: Just track creation (no CMS)
  trackPlanCompleted: (userId: string, planId: string) => Promise<void>; // NEW: Track completion (awards CMS)
  trackPlanJoined: (userId: string, planId: string) => Promise<void>;
  trackReviewWritten: (userId: string, reviewId: string, spotId: string) => Promise<void>;
  trackConnectionAccepted: (userId: string, connectionId: string) => Promise<void>;
  trackPhotoAdded: (userId: string, photoId: string, spotId: string) => Promise<void>;

  // UI handlers
  clearFloatingAnimation: () => void;
  dismissToast: (id: string) => void;
  closeLevelUp: () => void;
  closeBadgeUnlock: () => void; // NEW: Close badge modal
}

/**
 * Hook to track CMS actions with automatic animations and badge checking
 * Wraps the updateUserStats functions and triggers UI feedback
 */
export function useCMSTracking(): UseCMSTrackingReturn {
  const [floatingAnimation, setFloatingAnimation] = useState<CMSEvent | null>(null);
  const [toastQueue, setToastQueue] = useState<ToastData[]>([]);
  const [levelUpData, setLevelUpData] = useState<LevelUpEvent | null>(null);
  const [badgeUnlocked, setBadgeUnlocked] = useState<Badge | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Check for newly earned badges and award them
   */
  const checkAndAwardBadges = useCallback(async (userId: string) => {
    try {
      const { db } = require('@/config/firebase');
      const { doc, getDoc, updateDoc, arrayUnion, increment } = require('firebase/firestore');
      
      // Get current user data
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userData = userDoc.data();
      
      if (!userData) {
        console.log('🏆 No user data found for badge checking');
        return;
      }
      
      const currentBadges = userData.badges || [];
      const userStats: UserStats = userData.stats || {};
      
      // Check for newly earned badges
      const newBadges = checkNewBadges(userStats, currentBadges);
      
      if (newBadges.length > 0) {
        console.log('🏆 New badges earned:', newBadges.map(b => b.name));
        
        // Award all new badges at once
        const badgeIds = newBadges.map(b => b.id);
        const totalBonusCMS = newBadges.reduce((sum, b) => sum + (b.cmsValue || 0), 0);
        
        // Update user document with new badges
        await updateDoc(doc(db, 'users', userId), {
          badges: arrayUnion(...badgeIds),
          ...(totalBonusCMS > 0 ? { cms: increment(totalBonusCMS) } : {}),
        });
        
        console.log(`🏆 Awarded ${newBadges.length} badge(s) with ${totalBonusCMS} bonus CMS`);
        
        // Show badge unlock modal for the first badge (if multiple, queue them)
        // For now, we'll just show the first one
        if (newBadges[0]) {
          setTimeout(() => {
            setBadgeUnlocked(newBadges[0]);
            console.log('🏆 Showing badge unlock modal:', newBadges[0].name);
          }, 1200); // Show after other animations
        }
        
        // If there's bonus CMS, show a toast
        if (totalBonusCMS > 0) {
          setTimeout(() => {
            const toastId = `badge-bonus-${Date.now()}`;
            setToastQueue(prev => [...prev, {
              id: toastId,
              message: 'Badge bonus!',
              amount: totalBonusCMS,
              icon: 'trophy',
            }]);
          }, 800);
        }
      }
    } catch (err) {
      console.error('🏆 Error checking badges:', err);
      // Don't throw - badge checking shouldn't break the flow
    }
  }, []);

  // Helper to trigger animations
  const triggerAnimations = useCallback((
    amount: number,
    message: string,
    icon: string,
    oldCMS: number,
    newCMS: number,
    position?: { x: number; y: number }
  ) => {
    console.log('🎨🎨 triggerAnimations called with:', { amount, message, oldCMS, newCMS });
    
    // Floating animation (shows immediately)
    setFloatingAnimation({
      amount,
      message,
      icon,
      position,
    });
    console.log('🎨🎨 setFloatingAnimation called');

    // Toast notification (shows after 400ms delay for better UX)
    setTimeout(() => {
      const toastId = `toast-${Date.now()}`;
      setToastQueue(prev => [...prev, {
        id: toastId,
        message,
        amount,
        icon: icon as any,
      }]);
      console.log('🎨🎨 setToastQueue called');
    }, 400);

    // Check for level up
    const levelUpCheck = checkLevelUp(oldCMS, newCMS);
    if (levelUpCheck?.leveledUp) {
      console.log('🎨🎨 Level up detected!', levelUpCheck);
      // Show level-up modal faster (800ms instead of 2000ms)
      setTimeout(() => {
        setLevelUpData({
          oldLevel: levelUpCheck.oldLevel,
          newLevel: levelUpCheck.newLevel,
        });
        console.log('🎨🎨 Level-up modal triggered!');
      }, 800);
    } else {
      console.log('🎨🎨 No level up');
    }
  }, []);

  // Wrapped tracking functions
  const trackCheckIn = useCallback(async (
    userId: string,
    city: string,
    area: string
  ) => {
    setIsTracking(true);
    setError(null);
    
    try {
      const { db } = require('@/config/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', userId));
      const oldCMS = userDoc.data()?.cms || 0;

      await updateStatsForLayoverCheckIn(userId, city, area);

      const updatedDoc = await getDoc(doc(db, 'users', userId));
      const newCMS = updatedDoc.data()?.cms || 0;
      const cmsEarned = newCMS - oldCMS;

      triggerAnimations(
        cmsEarned,
        `Checked into ${city}`,
        'location',
        oldCMS,
        newCMS
      );

      // Check for newly earned badges
      await checkAndAwardBadges(userId);
    } catch (err) {
      console.error('Error tracking check-in:', err);
      setError('Failed to track check-in');
    } finally {
      setIsTracking(false);
    }
  }, [triggerAnimations, checkAndAwardBadges]);

  // Track plan creation (NO CMS awarded - just tracking)
  const trackPlanCreated = useCallback(async (
    userId: string,
    planId: string
  ) => {
    console.log('📝 trackPlanCreated START (no CMS yet)');
    setIsTracking(true);
    setError(null);
    
    try {
      // Just track creation - no CMS, no animations
      await trackPlanCreatedStats(userId, planId);
      console.log('✅ Plan creation tracked (awaiting check-in for CMS)');
    } catch (err) {
      console.error('❌ Error tracking plan creation:', err);
      setError('Failed to track plan creation');
    } finally {
      setIsTracking(false);
      console.log('📝 trackPlanCreated END');
    }
  }, []);

  // Track plan completion (AWARDS CMS - when host checks in at location)
  const trackPlanCompleted = useCallback(async (
    userId: string,
    planId: string
  ) => {
    console.log('🎯 trackPlanCompleted START');
    setIsTracking(true);
    setError(null);
    
    try {
      const { db } = require('@/config/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', userId));
      const oldCMS = userDoc.data()?.cms || 0;
      console.log('🎯 oldCMS:', oldCMS);

      const result = await updateStatsForPlanCompleted(userId, planId);
      console.log('🎯 updateStatsForPlanCompleted result:', result);

      if (result.alreadyCompleted) {
        console.log('⚠️ Plan already completed, skipping animations');
        return;
      }

      if (result.cmsAwarded > 0) {
        const updatedDoc = await getDoc(doc(db, 'users', userId));
        const newCMS = updatedDoc.data()?.cms || 0;
        console.log('🎯 newCMS:', newCMS, 'cmsEarned:', result.cmsAwarded);

        console.log('🎯 Triggering animations for plan completion');
        triggerAnimations(
          result.cmsAwarded,
          'Plan completed! 🎉',
          'checkmark-circle',
          oldCMS,
          newCMS
        );
      }

      // Check for newly earned badges
      await checkAndAwardBadges(userId);
    } catch (err) {
      console.error('❌ Error tracking plan completion:', err);
      setError('Failed to track plan completion');
    } finally {
      setIsTracking(false);
      console.log('🎯 trackPlanCompleted END');
    }
  }, [triggerAnimations, checkAndAwardBadges]);

  const trackPlanJoined = useCallback(async (
    userId: string,
    planId: string
  ) => {
    setIsTracking(true);
    setError(null);
    
    try {
      const { db } = require('@/config/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', userId));
      const oldCMS = userDoc.data()?.cms || 0;

      await updateStatsForPlanJoined(userId, planId);

      const updatedDoc = await getDoc(doc(db, 'users', userId));
      const newCMS = updatedDoc.data()?.cms || 0;
      const cmsEarned = newCMS - oldCMS;

      triggerAnimations(
        cmsEarned,
        'Joined plan!',
        'checkmark-circle',
        oldCMS,
        newCMS
      );

      await checkAndAwardBadges(userId);
    } catch (err) {
      console.error('Error tracking plan joined:', err);
      setError('Failed to track plan join');
    } finally {
      setIsTracking(false);
    }
  }, [triggerAnimations, checkAndAwardBadges]);

  const trackReviewWritten = useCallback(async (
    userId: string,
    reviewId: string,
    spotId: string
  ) => {
    setIsTracking(true);
    setError(null);
    
    try {
      const { db } = require('@/config/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', userId));
      const oldCMS = userDoc.data()?.cms || 0;

      await updateStatsForReviewWritten(userId, reviewId, spotId);

      const updatedDoc = await getDoc(doc(db, 'users', userId));
      const newCMS = updatedDoc.data()?.cms || 0;
      const cmsEarned = newCMS - oldCMS;

      triggerAnimations(
        cmsEarned,
        'Review posted!',
        'star',
        oldCMS,
        newCMS
      );

      await checkAndAwardBadges(userId);
    } catch (err) {
      console.error('Error tracking review:', err);
      setError('Failed to track review');
    } finally {
      setIsTracking(false);
    }
  }, [triggerAnimations, checkAndAwardBadges]);

  const trackConnectionAccepted = useCallback(async (
    userId: string,
    connectionId: string
  ) => {
    setIsTracking(true);
    setError(null);
    
    try {
      const { db } = require('@/config/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', userId));
      const oldCMS = userDoc.data()?.cms || 0;

      await updateStatsForConnectionAccepted(userId, connectionId);

      const updatedDoc = await getDoc(doc(db, 'users', userId));
      const newCMS = updatedDoc.data()?.cms || 0;
      const cmsEarned = newCMS - oldCMS;

      triggerAnimations(
        cmsEarned,
        'New connection!',
        'people',
        oldCMS,
        newCMS
      );

      await checkAndAwardBadges(userId);
    } catch (err) {
      console.error('Error tracking connection:', err);
      setError('Failed to track connection');
    } finally {
      setIsTracking(false);
    }
  }, [triggerAnimations, checkAndAwardBadges]);

  const trackPhotoAdded = useCallback(async (
    userId: string,
    photoId: string,
    spotId: string
  ) => {
    setIsTracking(true);
    setError(null);
    
    try {
      const { db } = require('@/config/firebase');
      const { doc, getDoc } = require('firebase/firestore');
      const userDoc = await getDoc(doc(db, 'users', userId));
      const oldCMS = userDoc.data()?.cms || 0;

      await updateStatsForPhotoAdded(userId, photoId, spotId);

      const updatedDoc = await getDoc(doc(db, 'users', userId));
      const newCMS = updatedDoc.data()?.cms || 0;
      const cmsEarned = newCMS - oldCMS;

      triggerAnimations(
        cmsEarned,
        'Photo added!',
        'image',
        oldCMS,
        newCMS
      );

      await checkAndAwardBadges(userId);
    } catch (err) {
      console.error('Error tracking photo:', err);
      setError('Failed to track photo');
    } finally {
      setIsTracking(false);
    }
  }, [triggerAnimations, checkAndAwardBadges]);

  // UI handlers
  const clearFloatingAnimation = useCallback(() => {
    console.log('🎨 clearFloatingAnimation called');
    setFloatingAnimation(null);
  }, []);

  const dismissToast = useCallback((id: string) => {
    console.log('🎨 dismissToast called for:', id);
    setToastQueue(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const closeLevelUp = useCallback(() => {
    console.log('🎨 closeLevelUp called');
    setLevelUpData(null);
  }, []);

  const closeBadgeUnlock = useCallback(() => {
    console.log('🏆 closeBadgeUnlock called');
    setBadgeUnlocked(null);
  }, []);

  return {
    // State
    floatingAnimation,
    toastQueue,
    levelUpData,
    badgeUnlocked,
    isTracking,
    error,

    // Tracking functions
    trackCheckIn,
    trackPlanCreated,
    trackPlanCompleted,
    trackPlanJoined,
    trackReviewWritten,
    trackConnectionAccepted,
    trackPhotoAdded,

    // UI handlers
    clearFloatingAnimation,
    dismissToast,
    closeLevelUp,
    closeBadgeUnlock,
  };
}
