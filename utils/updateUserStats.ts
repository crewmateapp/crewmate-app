/**
 * User Statistics & CMS Tracking Utilities - UPDATED
 * NOW TRACKS: Plans/Layovers CREATED vs COMPLETED
 * Only COMPLETED actions count toward badges and CMS
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
 * Track when layover is CREATED (no CMS/badges)
 * This is for tracking purposes only
 */
export async function trackLayoverCreated(
  userId: string,
  layoverId: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'stats.layoversCreated': increment(1),
      'stats.lastLayoverCreatedDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`[Stats] Layover created tracked for user ${userId}`);
  } catch (error) {
    console.error('[Stats] Error tracking layover creation:', error);
  }
}

/**
 * Track stats and award CMS for layover check-in COMPLETION
 * This is called when user actually checks in with GPS verification
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
    const continentCheckIns = userData.stats?.continentCheckIns || {};
    const isFirstTimeContinent = !continentCheckIns[continent] || continentCheckIns[continent] === 0;
    
    // Calculate CMS to award
    const cmsAmount = calculateCheckInCMS(
      isNewUser,
      isNewCity,
      isFirstTimeContinent,
      continent !== 'North America', // International if not North America
      userData.isFoundingCrew || false
    );
    
    // Build update data
    const updateData: any = {
      'stats.totalCheckIns': increment(1),
      'stats.layoversCompleted': increment(1), // ← NEW: Track completed check-ins
      'stats.lastCheckInDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Track continent-specific check-ins
    if (continent) {
      updateData[`stats.continentCheckIns.${continent}`] = increment(1);
    }
    
    // Track unique cities visited
    if (isNewCity) {
      const citiesVisited = userData.stats?.citiesVisited || [];
      if (!citiesVisited.includes(cityName)) {
        updateData['stats.citiesVisited'] = [...citiesVisited, cityName];
        updateData['stats.citiesVisitedCount'] = increment(1);
      }
    }
    
    // Track city-specific check-ins (for City Expert badge)
    updateData[`stats.cityCheckIns.${cityName}`] = increment(1);
    
    // Update stats
    await updateDoc(userRef, updateData);
    
    // Award CMS
    const result = await awardCMS(userId, cmsAmount, `Check-in: ${cityName}`);
    
    return {
      cmsAwarded: cmsAmount,
      leveledUp: result.leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error tracking layover check-in:', error);
    return { cmsAwarded: 0, leveledUp: false };
  }
}

/**
 * Update and track check-in streak
 * Awards bonus CMS for maintaining consecutive daily check-ins
 */
export async function updateCheckInStreak(
  userId: string
): Promise<{ streakDays: number; bonusCMS: number; leveledUp: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    if (!userData) {
      throw new Error('User not found');
    }
    
    const stats = userData.stats || {};
    const lastCheckInDate = stats.lastCheckInDate?.toDate();
    const currentStreak = stats.checkInStreak || 0;
    const longestStreak = stats.longestCheckInStreak || 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize to start of day

    let newStreak = 1;

    if (lastCheckInDate) {
      const lastDate = new Date(lastCheckInDate);
      lastDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - lastDate.getTime();
      const diffDays = diffTime / (1000 * 60 * 60 * 24);

      if (diffDays === 0) {
        // Same day check-in - maintain streak
        newStreak = currentStreak;
      } else if (diffDays === 1) {
        // Consecutive day - increment streak
        newStreak = currentStreak + 1;
      } else {
        // Streak broken - reset to 1
        newStreak = 1;
      }
    }

    // Update longest streak if current is higher
    const newLongestStreak = Math.max(longestStreak, newStreak);

    // Update streak stats
    await updateDoc(userRef, {
      'stats.checkInStreak': newStreak,
      'stats.longestCheckInStreak': newLongestStreak,
    });

    // Award bonus CMS for streaks (5 points per day in streak, minimum 2 days)
    let bonusCMS = 0;
    let leveledUp = false;
    
    if (newStreak >= 2) {
      bonusCMS = newStreak * 5;
      const result = await awardCMS(userId, bonusCMS, `${newStreak}-day check-in streak`);
      leveledUp = result.leveledUp;
    }

    console.log(`[Stats] Check-in streak updated: ${newStreak} days (longest: ${newLongestStreak})`);

    return {
      streakDays: newStreak,
      bonusCMS,
      leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error updating check-in streak:', error);
    return { streakDays: 0, bonusCMS: 0, leveledUp: false };
  }
}

/**
 * Track when plan is CREATED (no CMS/badges)
 * This is for tracking purposes only
 */
export async function trackPlanCreated(
  userId: string,
  planId: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      'stats.plansCreated': increment(1),
      'stats.lastPlanCreatedDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    console.log(`[Stats] Plan creation tracked for user ${userId}`);
  } catch (error) {
    console.error('[Stats] Error tracking plan creation:', error);
  }
}

/**
 * Track stats and award CMS for plan COMPLETION
 * This is called when host checks into the plan location with GPS verification
 */
export async function updateStatsForPlanCompleted(
  userId: string,
  planId: string
): Promise<{ cmsAwarded: number; leveledUp: boolean; alreadyCompleted: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Get plan data to check if already completed
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);
    const planData = planSnap.data();
    
    if (!planData) {
      throw new Error('Plan not found');
    }
    
    // Check if plan already completed (prevent double-counting)
    if (planData.hostCompletedAt) {
      console.log('[Stats] Plan already completed, skipping');
      return { cmsAwarded: 0, leveledUp: false, alreadyCompleted: true };
    }
    
    const attendeeCount = planData?.attendeeCount || 1;
    const spotType = planData?.spot?.type;
    
    // Check if user is new
    const accountAge = userData.createdAt?.toMillis ? Date.now() - userData.createdAt.toMillis() : Infinity;
    const isNewUser = accountAge < 30 * 24 * 60 * 60 * 1000;
    
    // Calculate CMS to award
    const cmsAmount = calculatePlanHostCMS(
      attendeeCount,
      isNewUser,
      userData.isFoundingCrew || false
    );
    
    // Build update data
    const updateData: any = {
      'stats.plansCompleted': increment(1), // ← NEW: Only count completed plans
      'stats.lastPlanCompletedDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Track plans with attendees (for Plan Master badge)
    if (attendeeCount >= 2) {
      updateData['stats.plansCompletedWithAttendees'] = increment(1);
    }
    
    // Track spot type visits (for category badges like Foodie, Coffee Connoisseur)
    if (spotType) {
      updateData[`stats.spotTypeVisits.${spotType}`] = increment(1);
    }
    
    // Update user stats
    await updateDoc(userRef, updateData);
    
    // Mark plan as completed by host
    await updateDoc(planRef, {
      hostCompletedAt: serverTimestamp(),
      hostCompletedBy: userId,
    });
    
    // Award CMS
    const result = await awardCMS(userId, cmsAmount, 'Plan completed');
    
    console.log(`[Stats] Plan ${planId} completed by user ${userId}, awarded ${cmsAmount} CMS`);
    
    return {
      cmsAwarded: cmsAmount,
      leveledUp: result.leveledUp,
      alreadyCompleted: false,
    };
  } catch (error) {
    console.error('[Stats] Error tracking plan completion:', error);
    return { cmsAwarded: 0, leveledUp: false, alreadyCompleted: false };
  }
}

/**
 * Track stats and award CMS for joining a plan
 * Called when user RSVPs to a plan
 */
export async function updateStatsForPlanJoined(
  userId: string,
  planId: string
): Promise<{ cmsAwarded: number; leveledUp: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();
    
    if (!userData) {
      throw new Error('User not found');
    }
    
    // Get plan data to check start time and spot type
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);
    const planData = planSnap.data();
    
    if (!planData) {
      throw new Error('Plan not found');
    }
    
    const planStartTime = planData.scheduledTime?.toDate() || new Date();
    const spotType = planData.spot?.type;
    
    // Check time-based categories
    const hour = planStartTime.getHours();
    const dayOfWeek = planStartTime.getDay(); // 0 = Sunday, 6 = Saturday
    
    const updateData: any = {
      'stats.plansAttended': increment(1),
      'stats.lastPlanAttendedDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Track time-based attendance (for badges)
    if (hour >= 22 || hour < 2) {
      // Night Owl: 10pm - 2am
      updateData['stats.nightPlansAttended'] = increment(1);
    }
    
    if (hour < 9) {
      // Early Bird: before 9am
      updateData['stats.morningPlansAttended'] = increment(1);
    }
    
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      // Weekend Warrior: Saturday or Sunday
      updateData['stats.weekendPlansAttended'] = increment(1);
    }
    
    // Track spot type visits (if attendee actually goes)
    // Note: This might need to be moved to a separate "attendee checked in" function
    if (spotType) {
      updateData[`stats.spotTypeVisits.${spotType}`] = increment(1);
    }
    
    // Update stats (small CMS for joining)
    await updateDoc(userRef, updateData);
    
    // Award small CMS for committing to attend
    const cmsAmount = CMS_POINTS.ACTIONS.PLAN_JOIN;
    const result = await awardCMS(userId, cmsAmount, 'Plan joined');
    
    return {
      cmsAwarded: cmsAmount,
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
  spotId: string,
  rating: number,
  hasPhotos: boolean = false,
  photoCount: number = 0
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
      hasPhotos,
      isNewUser,
      userData.isFoundingCrew || false
    );
    
    // Build update data
    const updateData: any = {
      'stats.reviewsWritten': increment(1),
      'stats.lastReviewDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    
    // Track photos if included
    if (hasPhotos && photoCount > 0) {
      updateData['stats.photosUploaded'] = increment(photoCount);
    }
    
    // Update stats
    await updateDoc(userRef, updateData);
    
    // Award CMS
    const result = await awardCMS(userId, cmsAmount, 'Review written');
    
    return {
      cmsAwarded: cmsAmount,
      leveledUp: result.leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error tracking review written:', error);
    return { cmsAwarded: 0, leveledUp: false };
  }
}

/**
 * Track stats and award CMS for accepting a connection
 */
export async function updateStatsForConnectionAccepted(
  userId: string,
  connectionId: string
): Promise<{ cmsAwarded: number; leveledUp: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Update stats
    await updateDoc(userRef, {
      'stats.totalConnections': increment(1),
      'stats.lastConnectionDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Award CMS
    const cmsAmount = CMS_POINTS.ACTIONS.CONNECTION_ACCEPTED;
    const result = await awardCMS(userId, cmsAmount, 'Connection accepted');
    
    return {
      cmsAwarded: cmsAmount,
      leveledUp: result.leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error tracking connection accepted:', error);
    return { cmsAwarded: 0, leveledUp: false };
  }
}

/**
 * Track stats for adding photos to reviews
 */
export async function updateStatsForPhotoAdded(
  userId: string,
  photoCount: number = 1
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      'stats.photosUploaded': increment(photoCount),
      updatedAt: serverTimestamp(),
    });
    
    console.log(`[Stats] ${photoCount} photo(s) tracked for user ${userId}`);
  } catch (error) {
    console.error('[Stats] Error tracking photo added:', error);
  }
}

/**
 * Track messages sent in plan chats
 */
export async function updateStatsForMessageSent(
  userId: string,
  planId: string
): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    
    await updateDoc(userRef, {
      'stats.messagesSent': increment(1),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error('[Stats] Error tracking message sent:', error);
  }
}

/**
 * Track spot added to the database
 */
export async function updateStatsForSpotAdded(
  userId: string,
  spotId: string
): Promise<{ cmsAwarded: number; leveledUp: boolean }> {
  try {
    const userRef = doc(db, 'users', userId);
    
    // Update stats
    await updateDoc(userRef, {
      'stats.spotsAdded': increment(1),
      'stats.lastSpotAddedDate': serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    
    // Award CMS
    const cmsAmount = CMS_POINTS.ACTIONS.SPOT_ADDED;
    const result = await awardCMS(userId, cmsAmount, 'Spot added');
    
    return {
      cmsAwarded: cmsAmount,
      leveledUp: result.leveledUp,
    };
  } catch (error) {
    console.error('[Stats] Error tracking spot added:', error);
    return { cmsAwarded: 0, leveledUp: false };
  }
}
