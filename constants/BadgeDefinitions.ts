/**
 * CrewMate Badge System
 * Defines all 45 badges across 4 categories: Founder, Travel, Community, Experience
 */

export interface Badge {
  id: string;
  name: string;
  category: 'founder' | 'travel' | 'community' | 'experience';
  description: string;
  requirement: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'exclusive';
  icon: string; // Ionicons name
  color: string;
  cmsValue?: number; // CMS awarded when earned (if applicable)
  hidden?: boolean; // Hidden until earned
  automated?: boolean; // Can be automatically awarded
  special?: string; // Special notes about the badge
}

// ============================================================================
// FOUNDER BADGES (2)
// ============================================================================

const FOUNDER_BADGES: Badge[] = [
  {
    id: 'founding_crew',
    name: 'Founding Crew',
    category: 'founder',
    description: 'One of the original alpha testers who helped shape CrewMate',
    requirement: 'Be part of the alpha testing group (Jan 2026)',
    rarity: 'exclusive',
    icon: 'trophy',
    color: '#F4C430', // Gold
    cmsValue: 500,
    hidden: false,
    automated: false,
    special: 'Can never be earned after alpha period. Limited to ~10-15 people.',
  },
  {
    id: 'beta_pioneer',
    name: 'Beta Pioneer',
    category: 'founder',
    description: 'Joined during the beta period and helped test features',
    requirement: 'Join CrewMate during beta period (before June 2026)',
    rarity: 'legendary',
    icon: 'rocket',
    color: '#5856D6', // Purple
    cmsValue: 250,
    hidden: false,
    automated: true,
    special: 'Available only during beta period.',
  },
];

// ============================================================================
// TRAVEL BADGES (13)
// ============================================================================

const TRAVEL_BADGES: Badge[] = [
  // Globe Trotter Series (5 tiers)
  {
    id: 'globe_trotter_10',
    name: 'Globe Trotter I',
    category: 'travel',
    description: 'Checked into 10 unique cities',
    requirement: 'Check into 10 different cities',
    rarity: 'common',
    icon: 'airplane',
    color: '#8E8E93', // Gray
    cmsValue: 50,
    automated: true,
  },
  {
    id: 'globe_trotter_25',
    name: 'Globe Trotter II',
    category: 'travel',
    description: 'Checked into 25 unique cities',
    requirement: 'Check into 25 different cities',
    rarity: 'uncommon',
    icon: 'airplane',
    color: '#34C759', // Green
    cmsValue: 100,
    automated: true,
  },
  {
    id: 'globe_trotter_50',
    name: 'Globe Trotter III',
    category: 'travel',
    description: 'Checked into 50 unique cities',
    requirement: 'Check into 50 different cities',
    rarity: 'rare',
    icon: 'airplane',
    color: '#007AFF', // Blue
    cmsValue: 200,
    automated: true,
  },
  {
    id: 'globe_trotter_100',
    name: 'Globe Trotter IV',
    category: 'travel',
    description: 'Checked into 100 unique cities',
    requirement: 'Check into 100 different cities',
    rarity: 'epic',
    icon: 'airplane',
    color: '#AF52DE', // Bright Purple
    cmsValue: 500,
    automated: true,
  },
  {
    id: 'globe_trotter_250',
    name: 'Globe Trotter V',
    category: 'travel',
    description: 'Checked into 250 unique cities - true world traveler',
    requirement: 'Check into 250 different cities',
    rarity: 'legendary',
    icon: 'airplane',
    color: '#F4C430', // Gold
    cmsValue: 1000,
    automated: true,
  },
  
  // Continental Badges (7)
  {
    id: 'north_america_explorer',
    name: 'North America Explorer',
    category: 'travel',
    description: 'Explored 10+ cities in North America',
    requirement: 'Check into 10 cities in North America',
    rarity: 'uncommon',
    icon: 'flag',
    color: '#FF3B30', // Red
    automated: true,
  },
  {
    id: 'south_america_explorer',
    name: 'South America Explorer',
    category: 'travel',
    description: 'Explored 10+ cities in South America',
    requirement: 'Check into 10 cities in South America',
    rarity: 'rare',
    icon: 'flag',
    color: '#FF9500', // Orange
    automated: true,
  },
  {
    id: 'europe_explorer',
    name: 'Europe Explorer',
    category: 'travel',
    description: 'Explored 10+ cities in Europe',
    requirement: 'Check into 10 cities in Europe',
    rarity: 'uncommon',
    icon: 'flag',
    color: '#007AFF', // Blue
    automated: true,
  },
  {
    id: 'asia_explorer',
    name: 'Asia Explorer',
    category: 'travel',
    description: 'Explored 10+ cities in Asia',
    requirement: 'Check into 10 cities in Asia',
    rarity: 'rare',
    icon: 'flag',
    color: '#FF2D55', // Pink
    automated: true,
  },
  {
    id: 'africa_explorer',
    name: 'Africa Explorer',
    category: 'travel',
    description: 'Explored 10+ cities in Africa',
    requirement: 'Check into 10 cities in Africa',
    rarity: 'epic',
    icon: 'flag',
    color: '#FFD700', // Yellow
    automated: true,
  },
  {
    id: 'oceania_explorer',
    name: 'Oceania Explorer',
    category: 'travel',
    description: 'Explored 10+ cities in Oceania',
    requirement: 'Check into 10 cities in Oceania',
    rarity: 'epic',
    icon: 'flag',
    color: '#30D158', // Bright Green
    automated: true,
  },
  
  // City Expert (Dynamic)
  {
    id: 'city_expert',
    name: 'City Expert',
    category: 'travel',
    description: 'Checked into the same city 5+ times',
    requirement: 'Check into any city 5 times',
    rarity: 'uncommon',
    icon: 'location',
    color: '#5856D6', // Purple
    automated: true,
    special: 'One badge per city (e.g., "Charlotte Expert", "LAX Expert")',
  },
];

// ============================================================================
// COMMUNITY BADGES (14)
// ============================================================================

const COMMUNITY_BADGES: Badge[] = [
  // Social Butterfly Series (3 tiers)
  {
    id: 'social_butterfly_10',
    name: 'Social Butterfly I',
    category: 'community',
    description: 'Made 10 crew connections',
    requirement: 'Connect with 10 crew members',
    rarity: 'common',
    icon: 'people',
    color: '#34C759', // Green
    automated: true,
  },
  {
    id: 'social_butterfly_50',
    name: 'Social Butterfly II',
    category: 'community',
    description: 'Made 50 crew connections',
    requirement: 'Connect with 50 crew members',
    rarity: 'rare',
    icon: 'people',
    color: '#007AFF', // Blue
    cmsValue: 100,
    automated: true,
  },
  {
    id: 'social_butterfly_100',
    name: 'Social Butterfly III',
    category: 'community',
    description: 'Made 100 crew connections',
    requirement: 'Connect with 100 crew members',
    rarity: 'epic',
    icon: 'people',
    color: '#AF52DE', // Purple
    cmsValue: 250,
    automated: true,
  },
  
  // Plan Master Series (3 tiers)
  {
    id: 'plan_master_5',
    name: 'Plan Master I',
    category: 'community',
    description: 'Hosted 5 successful plans',
    requirement: 'Host 5 plans with at least 2 attendees',
    rarity: 'common',
    icon: 'calendar',
    color: '#FF9500', // Orange
    automated: true,
  },
  {
    id: 'plan_master_25',
    name: 'Plan Master II',
    category: 'community',
    description: 'Hosted 25 successful plans',
    requirement: 'Host 25 plans with at least 2 attendees',
    rarity: 'rare',
    icon: 'calendar',
    color: '#5856D6', // Purple
    cmsValue: 150,
    automated: true,
  },
  {
    id: 'plan_master_100',
    name: 'Plan Master III',
    category: 'community',
    description: 'Hosted 100 successful plans',
    requirement: 'Host 100 plans with at least 2 attendees',
    rarity: 'legendary',
    icon: 'calendar',
    color: '#F4C430', // Gold
    cmsValue: 500,
    automated: true,
  },
  
  // Review Guru Series (3 tiers)
  {
    id: 'review_guru_10',
    name: 'Review Guru I',
    category: 'community',
    description: 'Written 10 helpful reviews',
    requirement: 'Write 10 reviews',
    rarity: 'common',
    icon: 'star',
    color: '#FFD700', // Gold
    automated: true,
  },
  {
    id: 'review_guru_50',
    name: 'Review Guru II',
    category: 'community',
    description: 'Written 50 helpful reviews',
    requirement: 'Write 50 reviews',
    rarity: 'rare',
    icon: 'star',
    color: '#FF9500', // Orange
    cmsValue: 100,
    automated: true,
  },
  {
    id: 'review_guru_100',
    name: 'Review Guru III',
    category: 'community',
    description: 'Written 100 helpful reviews',
    requirement: 'Write 100 reviews',
    rarity: 'epic',
    icon: 'star',
    color: '#F4C430', // Gold
    cmsValue: 300,
    automated: true,
  },
  
  // Special Community Badges
  {
    id: 'welcomer',
    name: 'The Welcomer',
    category: 'community',
    description: 'First crew member to connect with and message 10 new users within their first 7 days',
    requirement: 'Be the first to connect + message 10 new crew members (within 7 days of signup)',
    rarity: 'rare',
    icon: 'hand-right',
    color: '#FF2D55', // Pink
    cmsValue: 200,
    automated: true,
    special: 'Must be first connection AND first message',
  },
  {
    id: 'party_planner',
    name: 'Party Planner',
    category: 'community',
    description: 'Hosted a plan with 10+ attendees',
    requirement: 'Host one plan that reaches 10+ RSVPs',
    rarity: 'rare',
    icon: 'beer',
    color: '#FF9500', // Orange
    cmsValue: 100,
    automated: true,
  },
  {
    id: 'trend_setter',
    name: 'Trend Setter',
    category: 'community',
    description: 'Created a plan that was copied by 5+ other crew',
    requirement: 'Host a plan that 5+ crew use as template',
    rarity: 'epic',
    icon: 'trending-up',
    color: '#5856D6', // Purple
    cmsValue: 150,
    automated: false,
    special: 'Requires plan template feature',
  },
  {
    id: 'conversation_starter',
    name: 'Conversation Starter',
    category: 'community',
    description: 'Sent 100 messages in plan chats',
    requirement: 'Send 100+ messages across all plan chats',
    rarity: 'uncommon',
    icon: 'chatbubbles',
    color: '#007AFF', // Blue
    automated: true,
  },
  {
    id: 'photographer',
    name: 'Photographer',
    category: 'community',
    description: 'Uploaded 50 photos to reviews',
    requirement: 'Upload 50 photos across all reviews',
    rarity: 'rare',
    icon: 'camera',
    color: '#FF3B30', // Red
    cmsValue: 100,
    automated: true,
  },
];

// ============================================================================
// EXPERIENCE BADGES (16)
// ============================================================================

const EXPERIENCE_BADGES: Badge[] = [
  // Streak Badges
  {
    id: 'streak_master_7',
    name: 'Streak Master I',
    category: 'experience',
    description: 'Maintained a 7-day check-in streak',
    requirement: 'Check in on 7 consecutive days',
    rarity: 'uncommon',
    icon: 'flame',
    color: '#FF9500', // Orange
    automated: true,
  },
  {
    id: 'streak_master_30',
    name: 'Streak Master II',
    category: 'experience',
    description: 'Maintained a 30-day check-in streak',
    requirement: 'Check in on 30 consecutive days',
    rarity: 'rare',
    icon: 'flame',
    color: '#FF3B30', // Red
    cmsValue: 150,
    automated: true,
  },
  {
    id: 'streak_master_100',
    name: 'Streak Master III',
    category: 'experience',
    description: 'Maintained a 100-day check-in streak',
    requirement: 'Check in on 100 consecutive days',
    rarity: 'legendary',
    icon: 'flame',
    color: '#F4C430', // Gold
    cmsValue: 500,
    automated: true,
  },
  
  // Time-Based Badges
  {
    id: 'night_owl',
    name: 'Night Owl',
    category: 'experience',
    description: 'Attended 10 plans after 10pm',
    requirement: 'RSVP to 10 plans starting after 10pm',
    rarity: 'uncommon',
    icon: 'moon',
    color: '#5856D6', // Purple
    automated: true,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    category: 'experience',
    description: 'Attended 10 plans before 9am',
    requirement: 'RSVP to 10 plans starting before 9am',
    rarity: 'uncommon',
    icon: 'sunny',
    color: '#FFD700', // Yellow
    automated: true,
  },
  {
    id: 'weekend_warrior',
    name: 'Weekend Warrior',
    category: 'experience',
    description: 'Attended 25 plans on weekends',
    requirement: 'RSVP to 25 plans on Saturday or Sunday',
    rarity: 'rare',
    icon: 'beer',
    color: '#FF9500', // Orange
    automated: true,
  },
  
  // Activity-Specific Badges
  {
    id: 'foodie',
    name: 'Foodie',
    category: 'experience',
    description: 'Checked into 25 restaurants',
    requirement: 'Check into 25 restaurant spots',
    rarity: 'uncommon',
    icon: 'restaurant',
    color: '#FF3B30', // Red
    automated: true,
  },
  {
    id: 'coffee_connoisseur',
    name: 'Coffee Connoisseur',
    category: 'experience',
    description: 'Checked into 15 coffee shops',
    requirement: 'Check into 15 coffee shop spots',
    rarity: 'uncommon',
    icon: 'cafe',
    color: '#8E8E93', // Brown-ish Gray
    automated: true,
  },
  {
    id: 'bar_hopper',
    name: 'Bar Hopper',
    category: 'experience',
    description: 'Checked into 20 bars',
    requirement: 'Check into 20 bar/nightlife spots',
    rarity: 'uncommon',
    icon: 'beer',
    color: '#FFD700', // Gold
    automated: true,
  },
  {
    id: 'museum_buff',
    name: 'Museum Buff',
    category: 'experience',
    description: 'Checked into 10 museums',
    requirement: 'Check into 10 museum spots',
    rarity: 'rare',
    icon: 'business',
    color: '#5856D6', // Purple
    automated: true,
  },
  {
    id: 'outdoor_explorer',
    name: 'Outdoor Explorer',
    category: 'experience',
    description: 'Checked into 15 parks or outdoor spots',
    requirement: 'Check into 15 park/outdoor spots',
    rarity: 'uncommon',
    icon: 'leaf',
    color: '#34C759', // Green
    automated: true,
  },
  {
    id: 'gym_rat',
    name: 'Gym Rat',
    category: 'experience',
    description: 'Checked into 10 gyms',
    requirement: 'Check into 10 gym/fitness spots',
    rarity: 'uncommon',
    icon: 'fitness',
    color: '#FF3B30', // Red
    automated: true,
  },
  
  // Milestone Badges
  {
    id: 'first_layover',
    name: 'First Layover',
    category: 'experience',
    description: 'Your very first check-in on CrewMate',
    requirement: 'Complete your first layover check-in',
    rarity: 'common',
    icon: 'checkmark-circle',
    color: '#34C759', // Green
    automated: true,
    special: 'Everyone gets this',
  },
  {
    id: 'century_club',
    name: 'Century Club',
    category: 'experience',
    description: 'Completed 100 layover check-ins',
    requirement: 'Check into 100 layovers',
    rarity: 'epic',
    icon: 'trophy',
    color: '#F4C430', // Gold
    cmsValue: 300,
    automated: true,
  },
  {
    id: 'veteran_traveler',
    name: 'Veteran Traveler',
    category: 'experience',
    description: 'Completed 500 layover check-ins',
    requirement: 'Check into 500 layovers',
    rarity: 'legendary',
    icon: 'trophy',
    color: '#FF2D55', // Pink
    cmsValue: 1000,
    automated: true,
  },
  {
    id: 'helpful_reviewer',
    name: 'Helpful Reviewer',
    category: 'experience',
    description: 'Your reviews have been marked helpful 50+ times',
    requirement: 'Get 50 "helpful" votes on your reviews',
    rarity: 'rare',
    icon: 'thumbs-up',
    color: '#007AFF', // Blue
    cmsValue: 100,
    automated: true,
  },
];

// ============================================================================
// ALL BADGES
// ============================================================================

export const ALL_BADGES: Badge[] = [
  ...FOUNDER_BADGES,
  ...TRAVEL_BADGES,
  ...COMMUNITY_BADGES,
  ...EXPERIENCE_BADGES,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get a badge by its ID
 */
export function getBadgeById(badgeId: string): Badge | undefined {
  return ALL_BADGES.find(badge => badge.id === badgeId);
}

/**
 * Get all badges in a specific category
 */
export function getBadgesByCategory(category: Badge['category']): Badge[] {
  return ALL_BADGES.filter(badge => badge.category === category);
}

/**
 * Get all badges of a specific rarity
 */
export function getBadgesByRarity(rarity: Badge['rarity']): Badge[] {
  return ALL_BADGES.filter(badge => badge.rarity === rarity);
}

/**
 * Get all automated badges (can be auto-awarded)
 */
export function getAutomatedBadges(): Badge[] {
  return ALL_BADGES.filter(badge => badge.automated === true);
}

/**
 * Get all founder badges
 */
export function getFounderBadges(): Badge[] {
  return FOUNDER_BADGES;
}

/**
 * Get all travel badges
 */
export function getTravelBadges(): Badge[] {
  return TRAVEL_BADGES;
}

/**
 * Get all community badges
 */
export function getCommunityBadges(): Badge[] {
  return COMMUNITY_BADGES;
}

/**
 * Get all experience badges
 */
export function getExperienceBadges(): Badge[] {
  return EXPERIENCE_BADGES;
}

/**
 * Check if a badge is exclusive (can never be earned anymore)
 */
export function isBadgeExclusive(badgeId: string): boolean {
  const badge = getBadgeById(badgeId);
  return badge?.rarity === 'exclusive';
}

/**
 * Get badge count by category
 */
export function getBadgeCountByCategory(): Record<Badge['category'], number> {
  return {
    founder: FOUNDER_BADGES.length,
    travel: TRAVEL_BADGES.length,
    community: COMMUNITY_BADGES.length,
    experience: EXPERIENCE_BADGES.length,
  };
}

/**
 * Get total badge count
 */
export function getTotalBadgeCount(): number {
  return ALL_BADGES.length;
}
