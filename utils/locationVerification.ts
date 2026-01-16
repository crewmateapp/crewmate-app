// utils/locationVerification.ts
import { searchAirports, AirportData } from './airportData';

/**
 * Verifies if given coordinates are within a reasonable distance of a city
 * Uses airport data as reference points for cities
 */
export async function verifyCityLocation(
  userLat: number,
  userLon: number,
  cityName: string
): Promise<{ verified: boolean; distance?: number; message: string }> {
  try {
    // Search for airports in/near the city
    const airports = searchAirports(userLat, userLon, cityName);
    
    if (airports.length === 0) {
      // No airports found for this city - try broader search
      const allAirports = searchAirports(0, 0, cityName);
      
      if (allAirports.length === 0) {
        return {
          verified: false,
          message: `Unable to verify location for ${cityName}. Please contact support.`
        };
      }
      
      // Check distance to the first matching airport
      const airport = allAirports[0];
      const distance = calculateDistance(
        userLat,
        userLon,
        airport.lat,
        airport.lon
      );
      
      // Allow check-in within 50 miles (80km) of airport
      const MAX_DISTANCE_KM = 80;
      
      if (distance <= MAX_DISTANCE_KM) {
        return {
          verified: true,
          distance: distance,
          message: `Verified! You're in ${cityName}.`
        };
      } else {
        return {
          verified: false,
          distance: distance,
          message: `You're ${Math.round(distance)}km from ${cityName}. You need to be within ${MAX_DISTANCE_KM}km to check in.`
        };
      }
    }
    
    // Found airports in the search results - user is nearby
    const closestAirport = airports[0];
    const distance = closestAirport.distance;
    
    return {
      verified: true,
      distance: distance,
      message: `Verified! You're in ${cityName}.`
    };
    
  } catch (error) {
    console.error('Error verifying location:', error);
    return {
      verified: false,
      message: 'Unable to verify your location. Please check your GPS settings and try again.'
    };
  }
}

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Request location permission and get current position
 */
export async function getCurrentLocation(): Promise<{
  success: boolean;
  latitude?: number;
  longitude?: number;
  error?: string;
}> {
  try {
    const Location = require('expo-location');
    
    // Request permission
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      return {
        success: false,
        error: 'Location permission denied. Please enable location access in Settings to check in.'
      };
    }
    
    // Get current position
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    
    return {
      success: true,
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
    
  } catch (error) {
    console.error('Error getting location:', error);
    return {
      success: false,
      error: 'Unable to get your location. Please check that GPS is enabled and try again.'
    };
  }
}
