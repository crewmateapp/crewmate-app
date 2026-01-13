// utils/categoryHelpers.ts
// Shared category utilities for consistent category handling across the app

export const CATEGORY_OPTIONS = [
  // Food & Drink
  { id: 'coffee', label: 'Coffee Shop', emoji: '☕' },
  { id: 'food', label: 'Restaurant', emoji: '🍽️' },
  { id: 'breakfast', label: 'Breakfast', emoji: '🥞' },
  { id: 'lunch', label: 'Lunch Spot', emoji: '🥗' },
  { id: 'dinner', label: 'Dinner', emoji: '🍝' },
  { id: 'bakery', label: 'Bakery', emoji: '🥐' },
  { id: 'dessert', label: 'Dessert', emoji: '🍰' },
  { id: 'fastfood', label: 'Fast Food', emoji: '🍔' },
  
  // Bars & Nightlife
  { id: 'bar', label: 'Bar', emoji: '🍺' },
  { id: 'cocktail', label: 'Cocktail Bar', emoji: '🍸' },
  { id: 'wine', label: 'Wine Bar', emoji: '🍷' },
  { id: 'brewery', label: 'Brewery', emoji: '🍻' },
  { id: 'club', label: 'Nightclub', emoji: '🪩' },
  { id: 'lounge', label: 'Lounge', emoji: '🛋️' },
  { id: 'karaoke', label: 'Karaoke', emoji: '🎤' },
  
  // Wellness & Fitness
  { id: 'gym', label: 'Gym', emoji: '💪' },
  { id: 'yoga', label: 'Yoga Studio', emoji: '🧘' },
  { id: 'spa', label: 'Spa', emoji: '💆' },
  { id: 'massage', label: 'Massage', emoji: '💆‍♀️' },
  { id: 'salon', label: 'Salon', emoji: '💇' },
  
  // Activities & Entertainment
  { id: 'activity', label: 'Activity', emoji: '🎯' },
  { id: 'museum', label: 'Museum', emoji: '🏛️' },
  { id: 'park', label: 'Park', emoji: '🌳' },
  { id: 'beach', label: 'Beach', emoji: '🏖️' },
  { id: 'hiking', label: 'Hiking', emoji: '🥾' },
  { id: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { id: 'bookstore', label: 'Bookstore', emoji: '📚' },
  { id: 'arcade', label: 'Arcade', emoji: '🕹️' },
  { id: 'bowling', label: 'Bowling', emoji: '🎳' },
  { id: 'movies', label: 'Movie Theater', emoji: '🎬' },
  { id: 'music', label: 'Live Music', emoji: '🎵' },
  { id: 'sports', label: 'Sports Venue', emoji: '⚽' },
  
  // Other
  { id: 'landmark', label: 'Landmark', emoji: '📍' },
  { id: 'viewpoint', label: 'Viewpoint', emoji: '🌆' },
  { id: 'other', label: 'Other', emoji: '✨' },
];

/**
 * Get full category info by ID
 */
export function getCategoryInfo(categoryId: string) {
  return CATEGORY_OPTIONS.find(c => c.id === categoryId);
}

/**
 * Get category emoji by ID
 */
export function getCategoryEmoji(categoryId: string): string {
  return getCategoryInfo(categoryId)?.emoji || '✨';
}

/**
 * Get category label by ID
 */
export function getCategoryLabel(categoryId: string): string {
  return getCategoryInfo(categoryId)?.label || categoryId;
}

/**
 * Get categories for a spot, handling both old (single) and new (array) formats
 */
export function getSpotCategories(spot: any): string[] {
  if (Array.isArray(spot.categories)) {
    return spot.categories;
  }
  if (typeof spot.category === 'string' && spot.category) {
    return [spot.category];
  }
  return ['other'];
}

/**
 * Format categories for display (e.g., "Coffee Shop, Breakfast, Bookstore")
 */
export function formatCategories(categoryIds: string[]): string {
  return categoryIds
    .map(id => getCategoryLabel(id))
    .join(', ');
}

/**
 * Get categories grouped by type for filtering UI
 */
export function getCategoriesByType() {
  return {
    'Food & Drink': CATEGORY_OPTIONS.slice(0, 8),
    'Bars & Nightlife': CATEGORY_OPTIONS.slice(8, 15),
    'Wellness & Fitness': CATEGORY_OPTIONS.slice(15, 20),
    'Activities & Entertainment': CATEGORY_OPTIONS.slice(20, 32),
    'Other': CATEGORY_OPTIONS.slice(32),
  };
}

/**
 * Check if a spot matches a category filter
 */
export function spotMatchesCategory(spot: any, categoryId: string): boolean {
  const spotCategories = getSpotCategories(spot);
  return spotCategories.includes(categoryId);
}

/**
 * Filter spots by category
 */
export function filterSpotsByCategory(spots: any[], categoryId: string | null): any[] {
  if (!categoryId) return spots;
  return spots.filter(spot => spotMatchesCategory(spot, categoryId));
}
