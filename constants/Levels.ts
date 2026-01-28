/**
 * CrewMate Level System
 * Defines the 8-tier progression system with CMS thresholds and benefits
 */

export interface LevelTier {
  id: string;
  name: string;
  minCMS: number;
  maxCMS: number | null; // null for highest tier
  color: string;
  iconColor: string;
  benefits: string[];
  description: string;
}

export const LEVEL_TIERS: LevelTier[] = [
  {
    id: 'rookie',
    name: 'Rookie Crew',
    minCMS: 0,
    maxCMS: 99,
    color: '#8E8E93', // Gray
    iconColor: '#8E8E93',
    description: 'Just getting started on your CrewMate journey',
    benefits: [
      'Access to all basic features',
      'Create and join plans',
      'Connect with other crew',
      'Check into layovers',
    ],
  },
  {
    id: 'junior',
    name: 'Junior Crew',
    minCMS: 100,
    maxCMS: 249,
    color: '#34C759', // Green
    iconColor: '#34C759',
    description: 'Building your crew network',
    benefits: [
      'All Rookie benefits',
      'Priority plan visibility',
      'Early access to new features',
      'CrewMate supporter badge',
    ],
  },
  {
    id: 'seasoned',
    name: 'Seasoned Crew',
    minCMS: 250,
    maxCMS: 499,
    color: '#007AFF', // Blue
    iconColor: '#007AFF',
    description: 'An active community member',
    benefits: [
      'All Junior benefits',
      'Verified checkmark on profile',
      'Featured in "Active Crew" section',
      'Boost plan visibility',
    ],
  },
  {
    id: 'veteran',
    name: 'Veteran Crew',
    minCMS: 500,
    maxCMS: 999,
    color: '#5856D6', // Purple
    iconColor: '#5856D6',
    description: 'A trusted member of the community',
    benefits: [
      'All Seasoned benefits',
      'Create premium plans (larger groups)',
      'Priority customer support',
      'Early beta access to features',
    ],
  },
  {
    id: 'elite',
    name: 'Elite Crew',
    minCMS: 1000,
    maxCMS: 2499,
    color: '#AF52DE', // Bright Purple
    iconColor: '#AF52DE',
    description: 'A pillar of the CrewMate community',
    benefits: [
      'All Veteran benefits',
      'Exclusive Elite Crew badge',
      'Access to private Elite lounge',
      'Voting power on new features',
      'Premium profile customization',
    ],
  },
  {
    id: 'master',
    name: 'Master Crew',
    minCMS: 2500,
    maxCMS: 4999,
    color: '#FF9500', // Orange
    iconColor: '#FF9500',
    description: 'A leader and innovator',
    benefits: [
      'All Elite benefits',
      'Direct input on product roadmap',
      'Beta test coordinator',
      'Lifetime premium features',
      'Special Master Crew badge',
    ],
  },
  {
    id: 'legend',
    name: 'Legend Crew',
    minCMS: 5000,
    maxCMS: 9999,
    color: '#FF2D55', // Red
    iconColor: '#FF2D55',
    description: 'An icon of the community',
    benefits: [
      'All Master benefits',
      'Permanent premium status',
      'Exclusive Legend events',
      'CrewMate ambassador',
      'Profile badge: "Legend"',
    ],
  },
  {
    id: 'icon',
    name: 'Icon Crew',
    minCMS: 10000,
    maxCMS: null,
    color: '#F4C430', // Gold
    iconColor: '#F4C430',
    description: 'The ultimate CrewMate achievement',
    benefits: [
      'All Legend benefits',
      'Hall of Fame recognition',
      'Lifetime VIP status',
      'Special Icon Crew badge (animated)',
      'Exclusive Icon-only features',
      'Direct line to founders',
    ],
  },
];

/**
 * Get the level tier for a given CMS score
 */
export function getLevelForCMS(cms: number): LevelTier {
  // Find the tier where cms falls within min/max range
  for (const tier of LEVEL_TIERS) {
    if (cms >= tier.minCMS && (tier.maxCMS === null || cms <= tier.maxCMS)) {
      return tier;
    }
  }
  
  // Should never reach here, but default to Rookie if something goes wrong
  return LEVEL_TIERS[0];
}

/**
 * Get the next level tier after the current one
 */
export function getNextLevel(currentLevel: LevelTier): LevelTier | null {
  const currentIndex = LEVEL_TIERS.findIndex(tier => tier.id === currentLevel.id);
  
  // If already at max level, return null
  if (currentIndex === LEVEL_TIERS.length - 1) {
    return null;
  }
  
  return LEVEL_TIERS[currentIndex + 1];
}

/**
 * Get CMS needed to reach next level
 */
export function getCMSNeededForNextLevel(currentCMS: number): number | null {
  const currentLevel = getLevelForCMS(currentCMS);
  const nextLevel = getNextLevel(currentLevel);
  
  if (!nextLevel) {
    return null; // Already at max level
  }
  
  return nextLevel.minCMS - currentCMS;
}

/**
 * Get progress percentage to next level (0-100)
 */
export function getProgressToNextLevel(currentCMS: number): number {
  const currentLevel = getLevelForCMS(currentCMS);
  const nextLevel = getNextLevel(currentLevel);
  
  // If at max level, return 100%
  if (!nextLevel) {
    return 100;
  }
  
  const levelStart = currentLevel.minCMS;
  const levelEnd = nextLevel.minCMS;
  const levelRange = levelEnd - levelStart;
  const cmsInLevel = currentCMS - levelStart;
  
  return Math.min(100, Math.max(0, (cmsInLevel / levelRange) * 100));
}

/**
 * Get the color for a given level
 */
export function getLevelColor(levelId: string): string {
  const tier = LEVEL_TIERS.find(t => t.id === levelId);
  return tier?.color || LEVEL_TIERS[0].color;
}

/**
 * Get level tier by ID
 */
export function getLevelById(levelId: string): LevelTier | null {
  return LEVEL_TIERS.find(tier => tier.id === levelId) || null;
}

/**
 * Check if user leveled up
 */
export function checkLevelUp(oldCMS: number, newCMS: number): {
  leveledUp: boolean;
  oldLevel: LevelTier;
  newLevel: LevelTier;
} | null {
  const oldLevel = getLevelForCMS(oldCMS);
  const newLevel = getLevelForCMS(newCMS);
  
  if (oldLevel.id !== newLevel.id) {
    return {
      leveledUp: true,
      oldLevel,
      newLevel,
    };
  }
  
  return null;
}

/**
 * Get all level tiers
 */
export function getAllLevels(): LevelTier[] {
  return LEVEL_TIERS;
}

/**
 * Format CMS number with commas
 */
export function formatCMS(cms: number): string {
  return cms.toLocaleString();
}
