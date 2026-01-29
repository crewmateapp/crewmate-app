/**
 * GPS Location Verification Utility
 * Verifies user is physically at a location before allowing check-in
 * Uses Expo Location API for React Native
 */

import * as Location from 'expo-location';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

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

    // Get current location using new signature
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

/**
 * Verify if user's location is within a specific city
 * Uses a generous radius to account for large metropolitan areas
 * @param latitude User's current latitude
 * @param longitude User's current longitude
 * @param cityName Name of the city to verify
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
    // For now, we'll use a generous radius approach
    // TODO: Could integrate with city boundaries API for more accuracy
    
    // Major city approximate coordinates (can be expanded)
    const cityCoordinates: { [key: string]: { lat: number; lon: number; radius: number } } = {
      'Charlotte': { lat: 35.2271, lon: -80.8431, radius: 25000 }, // 25km radius
      'New York': { lat: 40.7128, lon: -74.0060, radius: 30000 },
      'Los Angeles': { lat: 34.0522, lon: -118.2437, radius: 35000 },
      'San Francisco': { lat: 37.7749, lon: -122.4194, radius: 25000 },
      'Miami': { lat: 25.7617, lon: -80.1918, radius: 20000 },
      'Chicago': { lat: 41.8781, lon: -87.6298, radius: 30000 },
      'Dallas': { lat: 32.7767, lon: -96.7970, radius: 30000 },
      'Philadelphia': { lat: 39.9526, lon: -75.1652, radius: 25000 },
      'Atlanta': { lat: 33.7490, lon: -84.3880, radius: 25000 },
      'Phoenix': { lat: 33.4484, lon: -112.0740, radius: 30000 },
      'Seattle': { lat: 47.6062, lon: -122.3321, radius: 25000 },
      'Las Vegas': { lat: 36.1699, lon: -115.1398, radius: 20000 },
      'Orlando': { lat: 28.5383, lon: -81.3792, radius: 20000 },
      'Boston': { lat: 42.3601, lon: -71.0589, radius: 20000 },
      'Denver': { lat: 39.7392, lon: -104.9903, radius: 25000 },
    };

    const cityData = cityCoordinates[cityName];
    
    if (!cityData) {
      // If city not in our list, allow check-in (benefit of the doubt)
      // TODO: Integrate with a proper city boundaries API
      console.warn(`City ${cityName} not in verification database - allowing check-in`);
      return {
        verified: true,
        message: `Checked in to ${cityName}`,
      };
    }

    // Calculate distance from city center
    const distance = calculateDistance(
      { latitude, longitude },
      { latitude: cityData.lat, longitude: cityData.lon }
    );

    if (distance <= cityData.radius) {
      return {
        verified: true,
        message: `You're in ${cityName}!`,
        distance,
      };
    }

    const distanceKm = (distance / 1000).toFixed(1);
    return {
      verified: false,
      message: `You appear to be ${distanceKm}km from ${cityName}. Please check in when you arrive.`,
      distance,
    };
  } catch (error) {
    console.error('Error verifying city location:', error);
    return {
      verified: false,
      message: 'Unable to verify your location. Please try again.',
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
