// utils/migrateSkylinesCityNames.ts
// One-time migration to add cityName field to all baseSkylines documents

import { collection, doc, getDocs, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

/**
 * Mapping of airport codes to their full city names
 * This is used for the one-time migration only
 */
const AIRPORT_TO_CITY: Record<string, string> = {
  // American Airlines hubs
  'CLT': 'Charlotte, NC',
  'ORD': 'Chicago, IL',
  'DFW': 'Dallas, TX',
  'LAX': 'Los Angeles, CA',
  'MIA': 'Miami, FL',
  'JFK': 'New York, NY',
  'PHL': 'Philadelphia, PA',
  'PHX': 'Phoenix, AZ',
  'DCA': 'Washington, DC',
  
  // Delta hubs
  'ATL': 'Atlanta, GA',
  'BOS': 'Boston, MA',
  'DTW': 'Detroit, MI',
  'MSP': 'Minneapolis, MN',
  'SLC': 'Salt Lake City, UT',
  'SEA': 'Seattle, WA',
  
  // United hubs
  'DEN': 'Denver, CO',
  'IAH': 'Houston, TX',
  'EWR': 'Newark, NJ',
  'SFO': 'San Francisco, CA',
  
  // Southwest focus cities
  'LAS': 'Las Vegas, NV',
  'MCO': 'Orlando, FL',
  
  // Other major cities
  'PDX': 'Portland, OR',
  'SAN': 'San Diego, CA',
  'AUS': 'Austin, TX',
  'BNA': 'Nashville, TN',
  'TPA': 'Tampa, FL',
  'FLL': 'Fort Lauderdale, FL',
  'HNL': 'Honolulu, HI',
  'ANC': 'Anchorage, AK',
  
  // International
  'LHR': 'London, UK',
  'CDG': 'Paris, France',
  'NRT': 'Tokyo, Japan',
  'FRA': 'Frankfurt, Germany',
};

export async function migrateSkylinesCityNames(): Promise<{
  success: boolean;
  updated: number;
  skipped: number;
  errors: number;
  details: string[];
}> {
  const result = {
    success: true,
    updated: 0,
    skipped: 0,
    errors: 0,
    details: [] as string[],
  };
  
  try {
    const skylinesSnapshot = await getDocs(collection(db, 'baseSkylines'));
    
    for (const docSnapshot of skylinesSnapshot.docs) {
      const airportCode = docSnapshot.id; // e.g., "CLT"
      const data = docSnapshot.data();
      
      try {
        // Skip if cityName already exists
        if (data.cityName) {
          result.skipped++;
          result.details.push(`✓ ${airportCode}: Already has cityName "${data.cityName}"`);
          continue;
        }
        
        // Get the city name from our mapping
        const cityName = AIRPORT_TO_CITY[airportCode];
        
        if (!cityName) {
          result.skipped++;
          result.details.push(`⚠️ ${airportCode}: No city name mapping found`);
          continue;
        }
        
        // Update the document
        await updateDoc(doc(db, 'baseSkylines', airportCode), {
          cityName: cityName,
          updatedAt: new Date(),
        });
        
        result.updated++;
        result.details.push(`✅ ${airportCode}: Added cityName "${cityName}"`);
        
      } catch (error) {
        result.errors++;
        result.details.push(`❌ ${airportCode}: Error - ${error}`);
      }
    }
    
    result.success = result.errors === 0;
    
  } catch (error) {
    result.success = false;
    result.details.push(`❌ Fatal error: ${error}`);
  }
  
  return result;
}

/**
 * Helper to get the city name for a given airport code
 * Used when manually creating new skylines
 */
export function getCityNameForAirport(airportCode: string): string | null {
  return AIRPORT_TO_CITY[airportCode] || null;
}
