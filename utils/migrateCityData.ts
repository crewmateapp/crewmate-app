// utils/migrateCityData.ts
// Migration script to fix incomplete city data using local airport database

import { collection, getDocs, updateDoc, doc } from 'firebase/firestore';
import { db } from '@/config/firebase';
import { getAirportByCode } from '@/utils/airportData';

export type CityMigrationResult = {
  success: boolean;
  totalCities: number;
  citiesUpdated: number;
  citiesSkipped: number;
  errors: string[];
  details: {
    code: string;
    action: 'updated' | 'skipped' | 'error';
    reason: string;
  }[];
};

/**
 * Migrate cities to add missing lat/lng and other data from airport database
 */
export async function migrateCityData(): Promise<CityMigrationResult> {
  const result: CityMigrationResult = {
    success: true,
    totalCities: 0,
    citiesUpdated: 0,
    citiesSkipped: 0,
    errors: [],
    details: [],
  };

  try {
    console.log('🔄 Starting city data migration...');

    // Get all cities
    const citiesSnapshot = await getDocs(collection(db, 'cities'));
    result.totalCities = citiesSnapshot.docs.length;

    console.log(`📊 Found ${result.totalCities} cities to check`);

    // Process each city
    for (const cityDoc of citiesSnapshot.docs) {
      const cityData = cityDoc.data();
      const cityCode = cityDoc.id;

      try {
        // Check if city needs updating
        // Also check if lat/lng are strings instead of numbers (common issue)
        const latIsInvalid = !cityData.lat || 
                             cityData.lat === 0 || 
                             typeof cityData.lat !== 'number';
        const lngIsInvalid = !cityData.lng || 
                             cityData.lng === 0 || 
                             typeof cityData.lng !== 'number';
        
        const needsUpdate = 
          latIsInvalid ||
          lngIsInvalid ||
          !cityData.name ||
          cityData.name === cityCode; // Name is just the code

        if (!needsUpdate) {
          result.citiesSkipped++;
          result.details.push({
            code: cityCode,
            action: 'skipped',
            reason: 'Already has complete data'
          });
          console.log(`✅ ${cityCode} - Already complete`);
          continue;
        }

        // Look up in airport database
        const airportData = getAirportByCode(cityCode);

        if (!airportData) {
          result.citiesSkipped++;
          result.details.push({
            code: cityCode,
            action: 'skipped',
            reason: 'Not found in airport database - needs manual entry'
          });
          console.log(`⚠️ ${cityCode} - Not in database, skipping`);
          continue;
        }

        // Prepare update data
        const updateData: any = {};

        // Update lat/lng if missing, zero, or wrong type (string instead of number)
        if (latIsInvalid) {
          updateData.lat = airportData.lat;
        }
        if (lngIsInvalid) {
          updateData.lng = airportData.lng;
        }

        // Update name if missing or just the code
        if (!cityData.name || cityData.name === cityCode) {
          updateData.name = airportData.name;
        }

        // Update areas if missing or default
        if (!cityData.areas || cityData.areas.length === 0 || 
            (cityData.areas.length === 2 && cityData.areas[0].includes('Airport Area'))) {
          updateData.areas = airportData.areas;
        }

        // Add cityName if missing (for dual format support)
        if (!cityData.cityName) {
          updateData.cityName = airportData.cityName || airportData.name;
        }

        // Mark as no longer needing review if it was flagged
        if (cityData.needsReview) {
          updateData.needsReview = false;
        }

        // Ensure status is active
        if (!cityData.status) {
          updateData.status = 'active';
        }

        // Update the city
        await updateDoc(doc(db, 'cities', cityCode), updateData);

        result.citiesUpdated++;
        
        // Build detailed reason message
        const fixes: string[] = [];
        if (latIsInvalid && lngIsInvalid) {
          const wasString = typeof cityData.lat === 'string' || typeof cityData.lng === 'string';
          fixes.push(wasString ? 'Fixed string coordinates' : 'Added coordinates');
        }
        if (!cityData.name || cityData.name === cityCode) {
          fixes.push('Updated name');
        }
        const fixDetails = fixes.length > 0 ? ` (${fixes.join(', ')})` : '';
        
        result.details.push({
          code: cityCode,
          action: 'updated',
          reason: `Updated to: ${airportData.name} (${airportData.lat}, ${airportData.lng})${fixDetails}`
        });
        console.log(`✅ ${cityCode} - Updated with data from ${airportData.name}${fixDetails}`);

      } catch (error) {
        console.error(`❌ Error processing ${cityCode}:`, error);
        result.errors.push(`${cityCode}: ${error}`);
        result.details.push({
          code: cityCode,
          action: 'error',
          reason: `Error: ${error}`
        });
      }
    }

    console.log('✅ City data migration complete!');
    console.log(`📊 Results: ${result.citiesUpdated} updated, ${result.citiesSkipped} skipped, ${result.errors.length} errors`);

  } catch (error) {
    console.error('❌ Migration failed:', error);
    result.success = false;
    result.errors.push(`Migration failed: ${error}`);
  }

  return result;
}
