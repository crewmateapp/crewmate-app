/**
 * GPS Location Verification Utility
 * Verifies user is physically at a location before allowing check-in
 * Uses Expo Location API for React Native
 * 
 * UPDATED: Now queries Firestore cities collection for coordinates
 * instead of using a hardcoded city list. Unknown cities are BLOCKED.
 */

import * as Location from 'expo-location';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

// ─── City Coordinates Cache ─────────────────────────────────────────────────
// Caches city coordinates from Firestore to avoid repeated reads

type CityCoordEntry = {
  lat: number;
  lng: number;
  name: string;
};

let cityCoordCache: Record<string, CityCoordEntry> = {};
let cacheLoadedAt = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Load all city coordinates from Firestore into cache
 */
async function loadCityCoordinates(): Promise<void> {
  try {
    const snapshot = await getDocs(collection(db, 'cities'));
    const newCache: Record<string, CityCoordEntry> = {};

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.name && data.lat && data.lng) {
        // Key by city name (e.g., "Tampa, FL")
        newCache[data.name] = {
          lat: data.lat,
          lng: data.lng,
          name: data.name,
        };
      }
    });

    cityCoordCache = newCache;
    cacheLoadedAt = Date.now();
    console.log(`📍 Loaded ${Object.keys(newCache).length} city coordinates for GPS verification`);
  } catch (error) {
    console.error('Error loading city coordinates:', error);
    // Don't clear existing cache on error — stale data is better than none
  }
}

/**
 * Get coordinates for a city, loading from Firestore if needed
 */
async function getCityCoords(cityName: string): Promise<CityCoordEntry | null> {
  // Refresh cache if stale or empty
  if (Date.now() - cacheLoadedAt > CACHE_TTL || Object.keys(cityCoordCache).length === 0) {
    await loadCityCoordinates();
  }

  // Exact match first
  if (cityCoordCache[cityName]) {
    return cityCoordCache[cityName];
  }

  // Try matching by prefix (e.g., "Tampa" matches "Tampa, FL")
  const normalizedSearch = cityName.trim().toLowerCase();
  for (const [key, value] of Object.entries(cityCoordCache)) {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === normalizedSearch) return value;
    if (normalizedKey.startsWith(normalizedSearch + ',')) return value;
    if (normalizedSearch.startsWith(normalizedKey.split(',')[0].toLowerCase())) return value;
  }

  return null;
}

// ─── Distance Calculation ───────────────────────────────────────────────────

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  coord1: Coordinates,
  coord2: Coordinates
): number {
  const R = 6371000; // Earth's radius in meters
  
  const lat1Rad = (coord1.latitude * Math.PI) / 180;
  const lat2Rad = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

/**
 * Verify user is at a location within specified radius
 * @param userCoords Current user GPS coordinates
 * @param targetCoords Target location coordinates
 * @param radiusMeters Allowed radius in meters (default: 100m)
 * @returns true if user is within radius, false otherwise
 */
export function verifyUserAtLocation(
  userCoords: Coordinates,
  targetCoords: Coordinates,
  radiusMeters: number = 100
): boolean {
  const distance = calculateDistance(userCoords, targetCoords);
  return distance <= radiusMeters;
}

// ─── Location Access ────────────────────────────────────────────────────────

/**
 * Get user's current GPS location using Expo Location
 * Returns object with success flag and coordinates or error message
 */
export async function getCurrentLocation(): Promise<{
  success: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}> {
  try {
    // Request permission first
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      return {
        success: false,
        error: 'Location permission denied. Please enable location services in your device settings.',
      };
    }

    // Get current position
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      success: true,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Location error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get current location. Please ensure location services are enabled.',
    };
  }
}

/**
 * Check if user has location permissions enabled
 */
export async function checkLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Request location permissions if not already granted
 */
export async function requestLocationPermission(): Promise<boolean> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// ─── Check-In Verification ──────────────────────────────────────────────────

/**
 * Check-in verification with user-friendly error messages
 */
export interface VerificationResult {
  allowed: boolean;
  distance?: number;
  message: string;
}

export async function verifyCheckInLocation(
  targetCoords: Coordinates,
  targetName: string,
  radiusMeters: number = 100
): Promise<VerificationResult> {
  try {
    // Check permission first
    const hasPermission = await checkLocationPermission();
    if (!hasPermission) {
      // Try to request permission
      const granted = await requestLocationPermission();
      if (!granted) {
        return {
          allowed: false,
          message: 'Location permission required. Please enable location services in your device settings.',
        };
      }
    }

    // Get current location
    const locationResult = await getCurrentLocation();
    
    if (!locationResult.success || !locationResult.latitude || !locationResult.longitude) {
      return {
        allowed: false,
        message: locationResult.error || 'Unable to get your current location.',
      };
    }

    const userCoords: Coordinates = {
      latitude: locationResult.latitude,
      longitude: locationResult.longitude,
    };
    
    const distance = calculateDistance(userCoords, targetCoords);

    if (distance <= radiusMeters) {
      return {
        allowed: true,
        distance,
        message: `You're at ${targetName}!`,
      };
    }

    return {
      allowed: false,
      distance,
      message: `You're ${formatDistance(distance)} away from ${targetName}. Get within ${formatDistance(radiusMeters)} to check in.`,
    };
  } catch (error) {
    return {
      allowed: false,
      message: error instanceof Error ? error.message : 'Location verification failed. Please ensure location services are enabled.',
    };
  }
}

// ─── City-Level Verification ────────────────────────────────────────────────

/**
 * Default radius for city verification (50km / ~31 miles)
 * Generous enough to cover major metro areas and surrounding airports,
 * but tight enough to prevent cross-city gaming.
 */
const DEFAULT_CITY_RADIUS = 50000; // 50km in meters

/**
 * Verify if user's location is within a specific city
 * Pulls coordinates from Firestore cities collection (cached).
 * 
 * SECURITY: Unknown cities are BLOCKED, not allowed.
 * 
 * @param latitude User's current latitude
 * @param longitude User's current longitude
 * @param cityName Name of the city to verify (as stored in layovers)
 * @returns Object with verified flag and message
 */
export async function verifyCityLocation(
  latitude: number,
  longitude: number,
  cityName: string
): Promise<{
  verified: boolean;
  message: string;
  distance?: number;
}> {
  try {
    // Look up city coordinates from Firestore (cached)
    const cityData = await getCityCoords(cityName);

    if (!cityData) {
      // City not found — BLOCK check-in (do NOT allow by default)
      console.warn(`⚠️ City "${cityName}" not found in cities collection — blocking check-in`);
      return {
        verified: false,
        message: `Unable to verify location for ${cityName}. This city may not be in our system yet. Please contact support at hello@crewmateapp.dev if this is an error.`,
      };
    }

    // Calculate distance from city center
    const distance = calculateDistance(
      { latitude, longitude },
      { latitude: cityData.lat, longitude: cityData.lng }
    );

    if (distance <= DEFAULT_CITY_RADIUS) {
      return {
        verified: true,
        message: `You're in ${cityName}!`,
        distance,
      };
    }

    const distanceMi = (distance / 1609.34).toFixed(0);
    return {
      verified: false,
      message: `You appear to be ${distanceMi} miles from ${cityName}. Please check in when you arrive.`,
      distance,
    };
  } catch (error) {
    console.error('Error verifying city location:', error);
    // On error, BLOCK check-in for safety
    return {
      verified: false,
      message: 'Unable to verify your location. Please check your connection and try again.',
    };
  }
}

/**
 * Constants for different check-in radius requirements
 */
export const CHECK_IN_RADIUS = {
  LAYOVER: 100, // 100m for layover check-ins (stricter)
  PLAN: 150, // 150m for plan check-ins (slightly more lenient)
  SPOT: 100, // 100m for spot check-ins
} as const;
