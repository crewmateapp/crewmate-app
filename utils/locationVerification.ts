/**
 * GPS Location Verification Utility
 * Verifies user is physically at a location before allowing check-in
 */

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
 * Get user's current GPS location
 * Returns promise with coordinates or throws error
 */
export async function getCurrentLocation(): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported by browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Location error: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

/**
 * Check if user has location permissions enabled
 */
export async function checkLocationPermission(): Promise<boolean> {
  if (!navigator.permissions) {
    // Fallback: try to get location and see if it works
    try {
      await getCurrentLocation();
      return true;
    } catch {
      return false;
    }
  }

  try {
    const result = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return result.state === 'granted';
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
      return {
        allowed: false,
        message: 'Location permission required. Please enable location services.',
      };
    }

    // Get current location
    const userCoords = await getCurrentLocation();
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
      message: error instanceof Error ? error.message : 'Location verification failed',
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
