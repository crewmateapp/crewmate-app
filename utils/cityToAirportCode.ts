// utils/cityToAirportCode.ts
// Dynamic city-to-airport-code mapping that syncs with Firestore baseSkylines

import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/config/firebase';

// In-memory cache of city mappings
let cityMappingCache: Record<string, string> = {};
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Fetches all base skylines from Firestore and builds a city-to-code mapping
 */
async function fetchCityMappings(): Promise<Record<string, string>> {
  try {
    const skylinesSnapshot = await getDocs(collection(db, 'baseSkylines'));
    const mappings: Record<string, string> = {};
    
    skylinesSnapshot.forEach(doc => {
      const data = doc.data();
      // Use the cityName field if it exists, otherwise fall back to static mapping
      if (data.cityName) {
        mappings[data.cityName] = doc.id; // doc.id is the airport code (e.g., "CLT")
      }
    });
    
    return mappings;
  } catch (error) {
    console.error('Error fetching city mappings:', error);
    return {};
  }
}

/**
 * Static fallback mapping for common cities
 * This ensures the app works even if Firestore is slow or unavailable
 */
const FALLBACK_MAPPING: Record<string, string> = {
  // American Airlines hubs (with and without state codes)
  'Charlotte, NC': 'CLT',
  'Charlotte': 'CLT',  // For layovers stored without state
  'Chicago, IL': 'ORD',
  'Chicago': 'ORD',
  'Dallas, TX': 'DFW',
  'Dallas': 'DFW',
  'Los Angeles, CA': 'LAX',
  'Los Angeles': 'LAX',
  'Miami, FL': 'MIA',
  'Miami': 'MIA',
  'New York, NY': 'JFK',
  'New York': 'JFK',
  'Philadelphia, PA': 'PHL',
  'Philadelphia': 'PHL',
  'Phoenix, AZ': 'PHX',
  'Phoenix': 'PHX',
  'Washington, DC': 'DCA',
  'Washington': 'DCA',
  
  // Delta hubs
  'Atlanta, GA': 'ATL',
  'Atlanta': 'ATL',
  'Boston, MA': 'BOS',
  'Boston': 'BOS',
  'Detroit, MI': 'DTW',
  'Detroit': 'DTW',
  'Minneapolis, MN': 'MSP',
  'Minneapolis': 'MSP',
  'Salt Lake City, UT': 'SLC',
  'Salt Lake City': 'SLC',
  'Seattle, WA': 'SEA',
  'Seattle': 'SEA',
  
  // United hubs
  'Denver, CO': 'DEN',
  'Denver': 'DEN',
  'Houston, TX': 'IAH',
  'Houston': 'IAH',
  'Newark, NJ': 'EWR',
  'Newark': 'EWR',
  'San Francisco, CA': 'SFO',
  'San Francisco': 'SFO',
  
  // Southwest focus cities
  'Las Vegas, NV': 'LAS',
  'Las Vegas': 'LAS',
  'Orlando, FL': 'MCO',
  'Orlando': 'MCO',
  
  // Other major cities
  'Portland, OR': 'PDX',
  'Portland': 'PDX',
  'San Diego, CA': 'SAN',
  'San Diego': 'SAN',
  'Austin, TX': 'AUS',
  'Austin': 'AUS',
  'Nashville, TN': 'BNA',
  'Nashville': 'BNA',
  'Tampa, FL': 'TPA',
  'Tampa': 'TPA',
  'Fort Lauderdale, FL': 'FLL',
  'Fort Lauderdale': 'FLL',
  'Honolulu, HI': 'HNL',
  'Honolulu': 'HNL',
  'Anchorage, AK': 'ANC',
  'Anchorage': 'ANC',
};

/**
 * Gets the airport code for a city, using Firestore data when available
 * Falls back to static mapping for performance and reliability
 * 
 * @param cityName - City name as stored in layovers (e.g., "Charlotte, NC")
 * @returns Airport code (e.g., "CLT") or null if no mapping exists
 */
export async function cityToAirportCode(cityName: string): Promise<string | null> {
  const normalized = cityName.trim();
  
  // Check if we need to refresh cache
  const now = Date.now();
  if (now - lastFetchTime > CACHE_DURATION || Object.keys(cityMappingCache).length === 0) {
    cityMappingCache = await fetchCityMappings();
    lastFetchTime = now;
  }
  
  // Try Firestore mapping first (most up-to-date)
  if (cityMappingCache[normalized]) {
    return cityMappingCache[normalized];
  }
  
  // Fall back to static mapping
  return FALLBACK_MAPPING[normalized] || null;
}

/**
 * Synchronous version that only uses the cache/fallback
 * Use this for immediate lookups without async overhead
 */
export function cityToAirportCodeSync(cityName: string): string | null {
  const normalized = cityName.trim();
  
  // Try cache first
  if (cityMappingCache[normalized]) {
    return cityMappingCache[normalized];
  }
  
  // Fall back to static mapping
  return FALLBACK_MAPPING[normalized] || null;
}

/**
 * Pre-loads the city mappings cache on app start
 * Call this in your app initialization
 */
export async function preloadCityMappings(): Promise<void> {
  cityMappingCache = await fetchCityMappings();
  lastFetchTime = Date.now();
}

/**
 * Check if a city has an associated skyline image
 */
export async function cityHasSkyline(cityName: string): Promise<boolean> {
  const code = await cityToAirportCode(cityName);
  return code !== null;
}

/**
 * Synchronous check for skyline availability
 */
export function cityHasSkylineSync(cityName: string): boolean {
  return cityToAirportCodeSync(cityName) !== null;
}
