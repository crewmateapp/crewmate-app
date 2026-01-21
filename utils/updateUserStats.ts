/**
 * User Statistics & CMS Tracking Utilities
 * Functions to track user actions, award CMS, and update engagement stats
 */

import { doc, updateDoc, increment, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { CMS_POINTS, calculateCheckInCMS, calculatePlanHostCMS, calculateReviewCMS } from '@/constants/ScoringRules';
import { getContinentForCity } from './continentMapping';
import { getLevelForCMS, checkLevelUp } from '@/constants/Levels';

/**
 * Core function to award CMS points to a user
 * Handles atomic increment and level checking
 */
export async function awardCMS(
  userId: string,
  cmsAmount: number,
  reason?: string
): Promise<{
  newCMS: number;
  leveledUp: boolean;
  oldLevel?: string;
  newLevel?: string;
}> {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Get current CMS before update
    const userSnap = await getDoc(userRef);
    const oldCMS = userSnap.data()?.cms || 0;
    const newCMS = oldCMS + cmsAmount;
    
    // Check for level up
    const levelUpInfo = checkLevelUp(oldCMS, newCMS);
    
    // Prepare update data
    const updateData: any = {
      cms: increment(cmsAmount),
      updatedAt: serverTimestamp(),
    };
    
    // If leveled up, update level field
    if (levelUpInfo) {
      updateData.level = levelUpInfo.newLevel.id;
    }
    
    // Update user document
    await updateDoc(userRef, updateData);
    
    console.log(`[CMS] Awarded ${cmsAmount} CMS to user ${userId}${reason ? `: ${reason}` : ''}`);
    
    return {
      newCMS,
      leveledUp: !!levelUpInfo,
      oldLevel: levelUpInfo?.oldLevel.id,
      newLevel: levelUpInfo?.newLevel.id,
    };
  } catch (error) {
    console.error('[CMS] Error awarding CMS:', error);
    throw error;
  }
}

/**
 * Track stats and award CMS for layover check-in
 */
export async function updateStatsForLayoverCheckIn(
  userId: string,
  cityName: string,
  isNewCity: boolean = false
): Promise<{ cmsAwarded: number; leveledUp: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Get continent for this city
    const continent = getContinentForCity(cityName);
    
    // Check if user is new (account created < 30 days ago)
    const accountAge = userData.createdAt?.toMillis ? Date.now() - userData.createdAt.toMillis() : Infinity;
    const isNewUser = accountAge < 30 * 24 * 60 * 60 * 1000; // 30 days in ms
    
    // Check if first time in this continent
    const continentCounts = userData.stats?.continentCounts || {};
    const isFirstTimeContinent = !continentCounts[continent] || continentCounts[continent] === 0;
    
    // Calculate CMS to award
    const cmsAmount = calculateCheckInCMS(
      isNewUser,
      isNewCity,
      isFirstTimeContinent,
      continent !== 'North America', // International if not North America
      userData.isFoundingCrew || false
    );
    
    // Update stats
    const updateData: any = {
      'stats.totalCheckIns': increment(1),
      'stats.lastCheckInDate': serverTimestamp(),
      [`stats.continentCounts.${continent}`]: increment(1),
      [`stats.cityCheckIns.${cityName}`]: increment(1),
      updatedAt: serverTimestamp(),
    };
    
    // If new city, increment cities visited
    if (isNewCity) {
      updateData['stats.citiesVisited'] = increment(1);
    }
    
    await updateDoc(userRef, updateData);
    
    // Award CMS
    const result = await awardCMS(userId, cmsAmount, 'Layover check-in');
    
    return {
      cmsAwarded: cmsAmount,
      leveledUp: result.leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error tracking check-in:', error);
    // Don't throw - we don't want to break the check-in flow
    return { cmsAwarded: 0, leveledUp: false };
  }
}

/**
 * Track stats and award CMS for hosting a plan
 */
export async function updateStatsForPlanHosted(
  userId: string,
  planId: string,
  attendeeCount: number = 1
): Promise<{ cmsAwarded: number; leveledUp: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Check if user is new
    const accountAge = userData.createdAt?.toMillis ? Date.now() - userData.createdAt.toMillis() : Infinity;
    const isNewUser = accountAge < 30 * 24 * 60 * 60 * 1000;
    
    // Calculate CMS to award
    const cmsAmount = calculatePlanHostCMS(
      attendeeCount,
      isNewUser,
      userData.isFoundingCrew || false
    );
    
    // Update stats
    await updateDoc(userRef, {
      'stats.plansHosted': increment(1),
      'stats.lastPlanHostedDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Award CMS
    const result = await awardCMS(userId, cmsAmount, 'Plan hosted');
    
    return {
      cmsAwarded: cmsAmount,
      leveledUp: result.leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error tracking plan hosted:', error);
    return { cmsAwarded: 0, leveledUp: false };
  }
}

/**
 * Track stats and award CMS for joining a plan
 */
export async function updateStatsForPlanJoined(
  userId: string,
  planId: string,
  planStartTime: Date
): Promise<{ cmsAwarded: number; leveledUp: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Check time-based stats
    const hour = planStartTime.getHours();
    const dayOfWeek = planStartTime.getDay(); // 0 = Sunday, 6 = Saturday
    
    const updateData: any = {
      'stats.plansAttended': increment(1),
      'stats.lastPlanAttendedDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Night Owl (10pm - 5am)
    if (hour >= 22 || hour < 5) {
      updateData['stats.nightOwlPlans'] = increment(1);
    }
    
    // Early Bird (5am - 9am)
    if (hour >= 5 && hour < 9) {
      updateData['stats.earlyBirdPlans'] = increment(1);
    }
    
    // Weekend Warrior (Saturday or Sunday)
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      updateData['stats.weekendPlans'] = increment(1);
    }
    
    await updateDoc(userRef, updateData);
    
    // Award CMS (base points, no bonuses for joining)
    const result = await awardCMS(userId, CMS_POINTS.PLAN_ATTENDED, 'Plan joined');
    
    return {
      cmsAwarded: CMS_POINTS.PLAN_ATTENDED,
      leveledUp: result.leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error tracking plan joined:', error);
    return { cmsAwarded: 0, leveledUp: false };
  }
}

/**
 * Track stats and award CMS for writing a review
 */
export async function updateStatsForReviewWritten(
  userId: string,
  reviewId: string,
  wordCount: number,
  hasPhoto: boolean,
  isFirstInCity: boolean = false
): Promise<{ cmsAwarded: number; leveledUp: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Check if user is new
    const accountAge = userData.createdAt?.toMillis ? Date.now() - userData.createdAt.toMillis() : Infinity;
    const isNewUser = accountAge < 30 * 24 * 60 * 60 * 1000;
    
    // Calculate CMS to award
    const cmsAmount = calculateReviewCMS(
      wordCount,
      hasPhoto,
      isFirstInCity,
      isNewUser,
      userData.isFoundingCrew || false
    );
    
    // Update stats
    await updateDoc(userRef, {
      'stats.reviewsWritten': increment(1),
      'stats.lastReviewDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Award CMS
    const result = await awardCMS(userId, cmsAmount, 'Review written');
    
    return {
      cmsAwarded: cmsAmount,
      leveledUp: result.leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error tracking review:', error);
    return { cmsAwarded: 0, leveledUp: false };
  }
}

/**
 * Track when user's review gets an upvote
 */
export async function updateStatsForReviewUpvote(
  userId: string,
  reviewId: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      'stats.helpfulVotesReceived': increment(1),
      updatedAt: serverTimestamp(),
    });
    
    // Award small CMS bonus
    await awardCMS(userId, CMS_POINTS.REVIEW_UPVOTE_RECEIVED, 'Review upvoted');
  } catch (error) {
    console.error('[Stats] Error tracking review upvote:', error);
  }
}

/**
 * Track stats for adding a photo
 */
export async function updateStatsForPhotoAdded(
  userId: string,
  photoId: string
): Promise<{ cmsAwarded: number }> {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      'stats.photosUploaded': increment(1),
      updatedAt: serverTimestamp(),
    });
    
    // Award CMS
    await awardCMS(userId, CMS_POINTS.PHOTO_ADDED, 'Photo uploaded');
    
    return { cmsAwarded: CMS_POINTS.PHOTO_ADDED };
  } catch (error) {
    console.error('[Stats] Error tracking photo:', error);
    return { cmsAwarded: 0 };
  }
}

/**
 * Track stats for accepting a connection
 */
export async function updateStatsForConnectionAccepted(
  userId: string,
  connectionUserId: string
): Promise<{ cmsAwarded: number }> {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      'stats.connectionsCount': increment(1),
      'stats.lastConnectionDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Award CMS
    await awardCMS(userId, CMS_POINTS.CONNECTION_ACCEPTED, 'Connection made');
    
    return { cmsAwarded: CMS_POINTS.CONNECTION_ACCEPTED };
  } catch (error) {
    console.error('[Stats] Error tracking connection:', error);
    return { cmsAwarded: 0 };
  }
}

/**
 * Track when user welcomes a new crew member
 * (First to connect + message within 7 days)
 */
export async function updateStatsForWelcomingNewCrew(
  userId: string,
  newCrewUserId: string
): Promise<{ cmsAwarded: number }> {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      'stats.newCrewWelcomed': increment(1),
      updatedAt: serverTimestamp(),
    });
    
    // Award bonus CMS for being welcoming
    await awardCMS(userId, CMS_POINTS.WELCOME_NEW_CREW, 'Welcomed new crew');
    
    return { cmsAwarded: CMS_POINTS.WELCOME_NEW_CREW };
  } catch (error) {
    console.error('[Stats] Error tracking welcome:', error);
    return { cmsAwarded: 0 };
  }
}

/**
 * Track spot check-ins by type (restaurant, bar, coffee, etc.)
 */
export async function updateStatsForSpotCheckIn(
  userId: string,
  spotType: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    const fieldName = `stats.spotTypeCheckIns.${spotType}`;
    
    await updateDoc(userRef, {
      [fieldName]: increment(1),
      updatedAt: serverTimestamp(),
    });
    
    // Award small CMS for spot check-in
    await awardCMS(userId, CMS_POINTS.SPOT_CHECK_IN, `${spotType} check-in`);
  } catch (error) {
    console.error('[Stats] Error tracking spot check-in:', error);
  }
}

/**
 * Track messages sent in plan chats
 */
export async function updateStatsForPlanMessage(
  userId: string,
  planId: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      'stats.messagesSent': increment(1),
      updatedAt: serverTimestamp(),
    });
    
    // Award small CMS for engagement
    await awardCMS(userId, CMS_POINTS.PLAN_MESSAGE, 'Plan message');
  } catch (error) {
    console.error('[Stats] Error tracking message:', error);
  }
}

/**
 * Update check-in streak
 * Called after each layover check-in
 */
export async function updateCheckInStreak(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  earnedWeeklyBonus: boolean;
}> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    if (!userData) {
      throw new Error('User not found');
    }
    
    const now = new Date();
    const lastCheckIn = userData.stats?.lastCheckInDate?.toDate();
    
    let currentStreak = userData.stats?.currentStreak || 0;
    let longestStreak = userData.stats?.longestStreak || 0;
    let earnedWeeklyBonus = false;
    
    if (lastCheckIn) {
      const hoursSinceLastCheckIn = (now.getTime() - lastCheckIn.getTime()) / (1000 * 60 * 60);
      
      // If checked in within 48 hours, increment streak
      if (hoursSinceLastCheckIn <= 48) {
        currentStreak++;
      } else {
        // Streak broken, reset to 1
        currentStreak = 1;
      }
    } else {
      // First check-in
      currentStreak = 1;
    }
    
    // Update longest streak if current is higher
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    
    // Award weekly bonus if hit 7-day streak
    if (currentStreak === 7) {
      await awardCMS(userId, CMS_POINTS.WEEKLY_BONUS, '7-day streak bonus');
      earnedWeeklyBonus = true;
    }
    
    // Update streak stats
    await updateDoc(userRef, {
      'stats.currentStreak': currentStreak,
      'stats.longestStreak': longestStreak,
      updatedAt: serverTimestamp(),
    });
    
    return {
      currentStreak,
      longestStreak,
      earnedWeeklyBonus,
    };
  } catch (error) {
    console.error('[Stats] Error updating streak:', error);
    return {
      currentStreak: 0,
      longestStreak: 0,
      earnedWeeklyBonus: false,
    };
  }
}
