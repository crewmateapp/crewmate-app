// utils/checkBadges.ts
import { Badge, ALL_BADGES, getAutomatedBadges } from '@/constants/BadgeDefinitions';

/**
 * User stats structure for badge checking
 * This matches the stats object in Firestore user documents
 */
export interface UserStats {
  // Check-in stats
  totalCheckIns?: number;
  layoversCompleted?: number; // Actually completed check-ins
  citiesVisited?: string[]; // Array of city names
  citiesVisitedCount?: number;
  continentCheckIns?: Record<string, number>; // Continent -> count
  cityCheckInCounts?: Record<string, number>; // City -> count
  currentStreak?: number;
  longestStreak?: number;
  
  // Plan stats
  plansCreated?: number; // For tracking only (not used for badges)
  plansCompleted?: number; // Actually completed plans (used for badges)
  plansCompletedWithAttendees?: number; // Completed plans with 2+ attendees
  plansJoined?: number;
  
  // Old fields (deprecated but kept for migration)
  plansHosted?: number; // DEPRECATED
  plansHostedWithAttendees?: number; // DEPRECATED
  
  // Social stats
  connectionsCount?: number;
  reviewsWritten?: number;
  reviewHelpfulCount?: number; // Times reviews marked helpful
  photosUploaded?: number;
  
  // Spot type stats (for category-specific badges)
  spotTypeVisits?: Record<string, number>; // coffee, restaurant, bar, etc.
  
  // Time-based stats
  nightPlans?: number; // Plans after 10pm
  morningPlans?: number; // Plans before 9am
  weekendPlans?: number; // Plans on Sat/Sun

  // Referral stats
  successfulReferrals?: number; // Number of referred users who completed signup + photo upload
}

/**
 * Check which badges a user has newly earned
 * @param userStats Current user stats
 * @param currentBadges Array of badge IDs user already has
 * @returns Array of newly earned Badge objects
 */
export function checkNewBadges(
  userStats: UserStats,
  currentBadges: string[]
): Badge[] {
  const newlyEarned: Badge[] = [];
  const automatedBadges = getAutomatedBadges();
  
  for (const badge of automatedBadges) {
    // Skip if user already has this badge
    if (currentBadges.includes(badge.id)) {
      continue;
    }
    
    // Check if badge requirements are met
    if (checkBadgeRequirement(badge, userStats)) {
      newlyEarned.push(badge);
    }
  }
  
  return newlyEarned;
}

/**
 * Check if a specific badge's requirements are met
 */
function checkBadgeRequirement(badge: Badge, stats: UserStats): boolean {
  const {
    totalCheckIns = 0,
    layoversCompleted = 0,
    citiesVisitedCount = 0,
    continentCheckIns = {},
    cityCheckInCounts = {},
    currentStreak = 0,
    plansCompleted = 0,
    plansCompletedWithAttendees = 0,
    plansJoined = 0,
    connectionsCount = 0,
    reviewsWritten = 0,
    reviewHelpfulCount = 0,
    photosUploaded = 0,
    spotTypeVisits = {},
    nightPlans = 0,
    morningPlans = 0,
    weekendPlans = 0,
    successfulReferrals = 0,
  } = stats;
  
  switch (badge.id) {
    // ========================================================================
    // TRAVEL BADGES
    // ========================================================================
    
    // Globe Trotter Series
    case 'globe_trotter_10':
      return citiesVisitedCount >= 10;
    case 'globe_trotter_25':
      return citiesVisitedCount >= 25;
    case 'globe_trotter_50':
      return citiesVisitedCount >= 50;
    case 'globe_trotter_100':
      return citiesVisitedCount >= 100;
    case 'globe_trotter_250':
      return citiesVisitedCount >= 250;
    
    // Continental Explorer Badges
    case 'north_america_explorer':
      return (continentCheckIns['North America'] || 0) >= 10;
    case 'south_america_explorer':
      return (continentCheckIns['South America'] || 0) >= 10;
    case 'europe_explorer':
      return (continentCheckIns['Europe'] || 0) >= 10;
    case 'asia_explorer':
      return (continentCheckIns['Asia'] || 0) >= 10;
    case 'africa_explorer':
      return (continentCheckIns['Africa'] || 0) >= 10;
    case 'oceania_explorer':
      return (continentCheckIns['Oceania'] || 0) >= 10;
    case 'antarctica_explorer':
      return (continentCheckIns['Antarctica'] || 0) >= 1;
    
    // City Expert (any city with 5+ check-ins)
    case 'city_expert':
      return Object.values(cityCheckInCounts).some(count => count >= 5);
    
    // ========================================================================
    // COMMUNITY BADGES
    // ========================================================================
    
    // Social Butterfly Series
    case 'social_butterfly_10':
      return connectionsCount >= 10;
    case 'social_butterfly_50':
      return connectionsCount >= 50;
    case 'social_butterfly_100':
      return connectionsCount >= 100;
    
    // Plan Master Series
    case 'plan_master_5':
      return plansCompletedWithAttendees >= 5;
    case 'plan_master_25':
      return plansCompletedWithAttendees >= 25;
    case 'plan_master_100':
      return plansCompletedWithAttendees >= 100;
    
    // Review Guru Series
    case 'review_guru_10':
      return reviewsWritten >= 10;
    case 'review_guru_50':
      return reviewsWritten >= 50;
    case 'review_guru_100':
      return reviewsWritten >= 100;
    
    // Recruiter Series (Referral badges)
    case 'recruiter_1':
      return successfulReferrals >= 1;
    case 'recruiter_5':
      return successfulReferrals >= 5;
    case 'recruiter_15':
      return successfulReferrals >= 15;
    case 'recruiter_25':
      return successfulReferrals >= 25;

    // Spot Recommender Series
    case 'spot_recommender_5':
      return false;
    case 'spot_recommender_25':
      return false;
    case 'spot_recommender_100':
      return false;
    
    // Photo Enthusiast Series
    case 'photo_enthusiast_10':
      return photosUploaded >= 10;
    case 'photo_enthusiast_50':
      return photosUploaded >= 50;
    
    // ========================================================================
    // EXPERIENCE BADGES
    // ========================================================================
    
    // Streak Master Series
    case 'streak_master_7':
      return currentStreak >= 7;
    case 'streak_master_30':
      return currentStreak >= 30;
    case 'streak_master_100':
      return currentStreak >= 100;
    
    // Time-Based Badges
    case 'night_owl':
      return nightPlans >= 10;
    case 'early_bird':
      return morningPlans >= 10;
    case 'weekend_warrior':
      return weekendPlans >= 25;
    
    // Activity-Specific Badges
    case 'foodie':
      return (spotTypeVisits['restaurant'] || 0) + 
             (spotTypeVisits['food'] || 0) + 
             (spotTypeVisits['breakfast'] || 0) + 
             (spotTypeVisits['lunch'] || 0) + 
             (spotTypeVisits['dinner'] || 0) >= 25;
    case 'coffee_connoisseur':
      return (spotTypeVisits['coffee'] || 0) >= 15;
    case 'bar_hopper':
      return (spotTypeVisits['bar'] || 0) + 
             (spotTypeVisits['nightlife'] || 0) >= 20;
    case 'museum_buff':
      return (spotTypeVisits['museum'] || 0) >= 10;
    case 'outdoor_explorer':
      return (spotTypeVisits['park'] || 0) + 
             (spotTypeVisits['outdoor'] || 0) >= 15;
    case 'gym_rat':
      return (spotTypeVisits['gym'] || 0) + 
             (spotTypeVisits['fitness'] || 0) >= 10;
    
    // Milestone Badges
    case 'first_layover':
      return totalCheckIns >= 1;
    case 'century_club':
      return totalCheckIns >= 100;
    case 'veteran_traveler':
      return totalCheckIns >= 500;
    case 'helpful_reviewer':
      return reviewHelpfulCount >= 50;
    
    // ========================================================================
    // FOUNDER BADGES (not automated, awarded manually)
    // ========================================================================
    case 'founding_crew':
    case 'beta_pioneer':
      return false; // These are manually awarded
    
    default:
      return false;
  }
}

/**
 * Get a human-readable progress message for a badge
 * Useful for showing "3/10 cities visited" type messages
 */
export function getBadgeProgress(badge: Badge, stats: UserStats): string {
  const {
    totalCheckIns = 0,
    layoversCompleted = 0,
    citiesVisitedCount = 0,
    continentCheckIns = {},
    currentStreak = 0,
    plansCompleted = 0,
    plansCompletedWithAttendees = 0,
    connectionsCount = 0,
    reviewsWritten = 0,
    photosUploaded = 0,
    spotTypeVisits = {},
    nightPlans = 0,
    morningPlans = 0,
    weekendPlans = 0,
    successfulReferrals = 0,
  } = stats;
  
  switch (badge.id) {
    // Globe Trotter
    case 'globe_trotter_10':
      return `${citiesVisitedCount}/10 cities`;
    case 'globe_trotter_25':
      return `${citiesVisitedCount}/25 cities`;
    case 'globe_trotter_50':
      return `${citiesVisitedCount}/50 cities`;
    case 'globe_trotter_100':
      return `${citiesVisitedCount}/100 cities`;
    case 'globe_trotter_250':
      return `${citiesVisitedCount}/250 cities`;
    
    // Continental
    case 'north_america_explorer':
      return `${continentCheckIns['North America'] || 0}/10 NA cities`;
    case 'europe_explorer':
      return `${continentCheckIns['Europe'] || 0}/10 EU cities`;
    // ... etc
    
    // Social
    case 'social_butterfly_10':
      return `${connectionsCount}/10 connections`;
    case 'social_butterfly_50':
      return `${connectionsCount}/50 connections`;
    case 'social_butterfly_100':
      return `${connectionsCount}/100 connections`;
    
    // Plans
    case 'plan_master_5':
      return `${plansCompletedWithAttendees}/5 plans`;
    case 'plan_master_25':
      return `${plansCompletedWithAttendees}/25 plans`;
    case 'plan_master_100':
      return `${plansCompletedWithAttendees}/100 plans`;

    // Recruiter Series
    case 'recruiter_1':
      return `${successfulReferrals}/1 referred`;
    case 'recruiter_5':
      return `${successfulReferrals}/5 referred`;
    case 'recruiter_15':
      return `${successfulReferrals}/15 referred`;
    case 'recruiter_25':
      return `${successfulReferrals}/25 referred`;
    
    default:
      return badge.requirement;
  }
}

/**
 * Calculate completion percentage for a badge (0-100)
 */
export function getBadgeCompletionPercent(badge: Badge, stats: UserStats): number {
  const {
    totalCheckIns = 0,
    citiesVisitedCount = 0,
    connectionsCount = 0,
    reviewsWritten = 0,
    successfulReferrals = 0,
  } = stats;
  
  // Extract target number from badge requirement
  // This is a simplified approach - you might want more robust parsing
  const match = badge.requirement.match(/(\d+)/);
  if (!match) return 0;
  
  const target = parseInt(match[0], 10);
  
  // Determine current progress based on badge type
  let current = 0;
  if (badge.id.includes('globe_trotter')) {
    current = citiesVisitedCount;
  } else if (badge.id.includes('social_butterfly')) {
    current = connectionsCount;
  } else if (badge.id.includes('review_guru')) {
    current = reviewsWritten;
  } else if (badge.id.includes('century') || badge.id.includes('veteran')) {
    current = totalCheckIns;
  } else if (badge.id.includes('recruiter')) {
    current = successfulReferrals;
  }
  
  return Math.min(100, Math.round((current / target) * 100));
}
