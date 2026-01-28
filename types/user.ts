// types/user.ts - UPDATED with Engagement System
import { Timestamp } from 'firebase/firestore';

/**
 * User Engagement Stats
 * Tracks all metrics needed for badge checking and CMS calculations
 */
export interface UserStats {
  // Travel stats
  citiesVisited: number;
  totalCheckIns: number;
  continentCounts: {
    'North America': number;
    'South America': number;
    'Europe': number;
    'Asia': number;
    'Africa': number;
    'Oceania': number;
    'Antarctica': number;
  };
  cityCheckIns: {
    [cityName: string]: number; // e.g. "Charlotte": 5
  };
  
  // Plan stats
  plansHosted: number;
  plansAttended: number;
  plansAttendedVerified: number; // Actually showed up
  plansWith5PlusAttendees: number; // Bonus metric
  avgPlanRating: number; // 0-5
  planAttendanceRate: number; // 0-1 (80% = 0.8)
  
  // Review stats
  spotsReviewed: number;
  totalReviewUpvotes: number;
  reviewsOver100Words: number;
  firstReviewsOfSpot: number;
  
  // Community stats
  connectionsCount: number;
  newCrewWelcomed: number; // First to connect with new users
  messagesInPlanChats: number;
  
  // Content stats
  photosAdded: number;
  photosFeatured: number;
  
  // Spot type check-ins
  spotTypeCheckIns: {
    restaurant: number;
    bar: number;
    cafe: number;
    activity: number; // Gyms, parks, etc.
    culture: number; // Museums, theaters, etc.
  };
  
  // Time-based stats
  plansAfter10pm: number;
  plansBefore8am: number;
  
  // Streak stats
  currentStreak: number; // Days
  longestStreak: number; // Days
  lastCheckInDate?: Timestamp;
  
  // Moderation stats
  badContentReportsConfirmed: number;
  
  // Weekly activity (for bonus)
  lastWeeklyBonusAwarded?: Timestamp;
}

/**
 * Badge Achievement
 * Records when a badge was earned and tracks progress
 */
export interface BadgeAchievement {
  earnedAt: Timestamp;
  progress?: number; // For tiered badges (0-1)
  notified?: boolean; // Has user been notified?
}

/**
 * User Profile Customization
 */
export interface UserProfileCustomization {
  coverPhoto?: string; // URL or city name for default
  bio?: string;
  basedIn?: string; // Home city
  favoriteCity?: string;
  travelStyle?: string[]; // ['Foodie', 'Coffee', 'Museums']
  languages?: string[];
  theme?: string; // Profile theme based on level
}

/**
 * UPDATED User Document
 * Includes all engagement system fields
 */
export interface User {
  // Existing auth fields
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  
  // Airline info
  airline?: string;
  airlineEmail?: string;
  airlineVerified?: boolean;
  position?: 'flight_attendant' | 'pilot' | 'captain';
  basedAirport?: string;
  flyingSince?: string; // Year
  
  // Current layover
  currentLayover?: {
    city: string;
    area: string;
    discoverable: boolean;
    isLive: boolean;
    lastVerified?: Timestamp;
    updatedAt?: Timestamp;
    expiresAt?: Timestamp;
  };
  
  // Upcoming layovers
  upcomingLayovers?: Array<{
    id: string;
    city: string;
    area: string;
    startDate: Timestamp;
    endDate: Timestamp;
    status: 'upcoming' | 'active' | 'past';
    preDiscoverable?: boolean;
    createdAt: Timestamp;
  }>;
  
  // Connections
  connections?: string[]; // Array of user IDs
  blockedUsers?: string[];
  
  // Settings
  settings?: {
    notifications?: {
      plans?: boolean;
      messages?: boolean;
      connections?: boolean;
      badges?: boolean; // NEW
      levelUp?: boolean; // NEW
    };
    privacy?: {
      profileVisibility?: 'public' | 'connections' | 'private';
      showLocation?: boolean;
      showStats?: boolean; // NEW
    };
  };
  
  // Timestamps
  createdAt: Timestamp;
  updatedAt: Timestamp;
  lastActive?: Timestamp;
  
  // ==========================================
  // NEW: ENGAGEMENT SYSTEM FIELDS
  // ==========================================
  
  // Core engagement
  cms: number; // CrewMate Score (0+)
  level: string; // "Rookie Crew", "Elite Crew", etc.
  
  // Badges
  badges: string[]; // Array of earned badge IDs
  featuredBadges: string[]; // Top 3 badges to display (user chooses)
  
  // Stats for badge checking
  stats: UserStats;
  
  // Badge achievements (detailed tracking)
  achievements: {
    [badgeId: string]: BadgeAchievement;
  };
  
  // Profile customization
  profile: UserProfileCustomization;
  
  // Special flags
  isFoundingCrew?: boolean; // Alpha tester
  isBetaPioneer?: boolean; // Beta tester
  joinedBetaDate?: Timestamp;
}

/**
 * Helper type for creating new users
 */
export type NewUser = Omit<User, 'uid' | 'createdAt' | 'updatedAt'> & {
  uid?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

/**
 * Default stats object for new users
 */
export const DEFAULT_USER_STATS: UserStats = {
  citiesVisited: 0,
  totalCheckIns: 0,
  continentCounts: {
    'North America': 0,
    'South America': 0,
    'Europe': 0,
    'Asia': 0,
    'Africa': 0,
    'Oceania': 0,
    'Antarctica': 0,
  },
  cityCheckIns: {},
  plansHosted: 0,
  plansAttended: 0,
  plansAttendedVerified: 0,
  plansWith5PlusAttendees: 0,
  avgPlanRating: 0,
  planAttendanceRate: 0,
  spotsReviewed: 0,
  totalReviewUpvotes: 0,
  reviewsOver100Words: 0,
  firstReviewsOfSpot: 0,
  connectionsCount: 0,
  newCrewWelcomed: 0,
  messagesInPlanChats: 0,
  photosAdded: 0,
  photosFeatured: 0,
  spotTypeCheckIns: {
    restaurant: 0,
    bar: 0,
    cafe: 0,
    activity: 0,
    culture: 0,
  },
  plansAfter10pm: 0,
  plansBefore8am: 0,
  currentStreak: 0,
  longestStreak: 0,
  badContentReportsConfirmed: 0,
};

/**
 * Default engagement fields for new users
 */
export const DEFAULT_ENGAGEMENT_FIELDS = {
  cms: 0,
  level: 'Rookie Crew',
  badges: [],
  featuredBadges: [],
  stats: DEFAULT_USER_STATS,
  achievements: {},
  profile: {
    travelStyle: [],
    languages: [],
  },
};
