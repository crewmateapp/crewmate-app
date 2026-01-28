/**
 * CrewMate Scoring (CMS) System
 * Defines point values, multipliers, and bonuses for all user actions
 */

export const CMS_POINTS = {
  // Check-ins
  LAYOVER_CHECK_IN: 10,
  SPOT_CHECK_IN: 5,

  // Plans
  PLAN_HOSTED: 25,
  PLAN_ATTENDED: 10,
  PLAN_MESSAGE: 2,

  // Reviews
  REVIEW_WRITTEN: 15,
  REVIEW_UPVOTE_RECEIVED: 3,
  PHOTO_ADDED: 5,

  // Community
  CONNECTION_ACCEPTED: 5,
  WELCOME_NEW_CREW: 20, // First to connect + message within 7 days

  // Streaks
  WEEKLY_BONUS: 50, // 7-day streak maintained
};

export const CMS_MULTIPLIERS = {
  // User status multipliers
  NEW_USER: 1.5, // First 30 days (1.5x all CMS)
  FOUNDING_CREW: 1.1, // Permanent 10% bonus
  BETA_PIONEER: 1.05, // Beta period 5% bonus

  // Activity multipliers (applied to base points)
  FIRST_TIME_CITY: 1.5, // First check-in to a new city
  FIRST_TIME_CONTINENT: 2.0, // First check-in to a new continent
};

export const CMS_BONUSES = {
  // Plan bonuses (added to base plan CMS)
  PLAN_5_PLUS_ATTENDEES: 50, // Plan reaches 5+ attendees
  PLAN_10_PLUS_ATTENDEES: 100, // Plan reaches 10+ attendees

  // Review bonuses (added to base review CMS)
  REVIEW_100_WORDS_PLUS: 10, // Review is 100+ words
  REVIEW_WITH_PHOTO: 10, // Review includes photo
  REVIEW_HELPFUL_VOTE: 5, // Review gets marked helpful (each vote)

  // Check-in bonuses
  INTERNATIONAL_CHECK_IN: 15, // Check-in outside home country
  REMOTE_DESTINATION: 20, // Check-in to city <100k population

  // Special achievements
  FIRST_REVIEW_IN_CITY: 25, // First review for a spot in that city
  MILESTONE_CITY: 50, // 10th, 25th, 50th, 100th unique city
};

/**
 * Calculate total CMS to award for an action
 * @param basePoints - The base CMS points (from CMS_POINTS)
 * @param multipliers - Object with multiplier values to apply
 * @param bonuses - Object with bonus values to add
 * @returns Total CMS to award
 */
export function calculateCMS(
  basePoints: number,
  multipliers: { [key: string]: number } = {},
  bonuses: { [key: string]: number } = {}
): number {
  // Start with base points
  let total = basePoints;

  // Apply multipliers (multiplicative)
  let totalMultiplier = 1.0;
  Object.values(multipliers).forEach(mult => {
    totalMultiplier *= mult;
  });
  total *= totalMultiplier;

  // Add bonuses (additive)
  const totalBonuses = Object.values(bonuses).reduce((sum, bonus) => sum + bonus, 0);
  total += totalBonuses;

  // Round to nearest integer
  return Math.round(total);
}

/**
 * Calculate CMS for a check-in action
 */
export function calculateCheckInCMS(
  isNewUser: boolean,
  isFirstTimeCity: boolean,
  isFirstTimeContinent: boolean,
  isInternational: boolean,
  isFoundingCrew: boolean = false
): number {
  const multipliers: { [key: string]: number } = {};
  const bonuses: { [key: string]: number } = {};

  // User status multipliers
  if (isNewUser) multipliers.newUser = CMS_MULTIPLIERS.NEW_USER;
  if (isFoundingCrew) multipliers.foundingCrew = CMS_MULTIPLIERS.FOUNDING_CREW;

  // Location multipliers
  if (isFirstTimeCity) multipliers.firstTimeCity = CMS_MULTIPLIERS.FIRST_TIME_CITY;
  if (isFirstTimeContinent) multipliers.firstTimeContinent = CMS_MULTIPLIERS.FIRST_TIME_CONTINENT;

  // Bonuses
  if (isInternational) bonuses.international = CMS_BONUSES.INTERNATIONAL_CHECK_IN;

  return calculateCMS(CMS_POINTS.LAYOVER_CHECK_IN, multipliers, bonuses);
}

/**
 * Calculate CMS for hosting a plan
 */
export function calculatePlanHostCMS(
  attendeeCount: number,
  isNewUser: boolean,
  isFoundingCrew: boolean = false
): number {
  const multipliers: { [key: string]: number } = {};
  const bonuses: { [key: string]: number } = {};

  // User status multipliers
  if (isNewUser) multipliers.newUser = CMS_MULTIPLIERS.NEW_USER;
  if (isFoundingCrew) multipliers.foundingCrew = CMS_MULTIPLIERS.FOUNDING_CREW;

  // Attendee bonuses
  if (attendeeCount >= 10) {
    bonuses.tenPlus = CMS_BONUSES.PLAN_10_PLUS_ATTENDEES;
  } else if (attendeeCount >= 5) {
    bonuses.fivePlus = CMS_BONUSES.PLAN_5_PLUS_ATTENDEES;
  }

  return calculateCMS(CMS_POINTS.PLAN_HOSTED, multipliers, bonuses);
}

/**
 * Calculate CMS for writing a review
 */
export function calculateReviewCMS(
  wordCount: number,
  hasPhoto: boolean,
  isFirstInCity: boolean,
  isNewUser: boolean,
  isFoundingCrew: boolean = false
): number {
  const multipliers: { [key: string]: number } = {};
  const bonuses: { [key: string]: number } = {};

  // User status multipliers
  if (isNewUser) multipliers.newUser = CMS_MULTIPLIERS.NEW_USER;
  if (isFoundingCrew) multipliers.foundingCrew = CMS_MULTIPLIERS.FOUNDING_CREW;

  // Content bonuses
  if (wordCount >= 100) bonuses.longReview = CMS_BONUSES.REVIEW_100_WORDS_PLUS;
  if (hasPhoto) bonuses.withPhoto = CMS_BONUSES.REVIEW_WITH_PHOTO;
  if (isFirstInCity) bonuses.firstInCity = CMS_BONUSES.FIRST_REVIEW_IN_CITY;

  return calculateCMS(CMS_POINTS.REVIEW_WRITTEN, multipliers, bonuses);
}
