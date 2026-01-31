/**
 * User Base Normalization Migration
 * 
 * Fixes inconsistent user base data by converting full city names to airport codes
 * 
 * Problem: Some users have "CHARLOTTE" while others have "CLT"
 * Solution: Normalize all to airport codes (CLT, ORD, etc.)
 */

import { db } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

// Comprehensive city name to airport code mapping
const CITY_NAME_TO_CODE: Record<string, string> = {
  // Format: 'CITY NAME': 'CODE'
  'CHARLOTTE': 'CLT',
  'PHILADELPHIA': 'PHL',
  'DALLAS': 'DFW',
  'DALLAS-FORT WORTH': 'DFW',
  'DALLAS—FORT WORTH': 'DFW', // Em dash version
  'CHICAGO': 'ORD',
  'MIAMI': 'MIA',
  'PHOENIX': 'PHX',
  'LOS ANGELES': 'LAX',
  'ATLANTA': 'ATL',
  'MINNEAPOLIS': 'MSP',
  'DETROIT': 'DTW',
  'SEATTLE': 'SEA',
  'SALT LAKE CITY': 'SLC',
  'HOUSTON': 'IAH',
  'NEWARK': 'EWR',
  'DENVER': 'DEN',
  'SAN FRANCISCO': 'SFO',
  'BALTIMORE': 'BWI',
  'NEW YORK': 'JFK',
  'BOSTON': 'BOS',
  'PORTLAND': 'PDX',
  'FORT LAUDERDALE': 'FLL',
  'SAN DIEGO': 'SAN',
  'LAS VEGAS': 'LAS',
  'ORLANDO': 'MCO',
  'AUSTIN': 'AUS',
  'NEW ORLEANS': 'MSY',
  'NASHVILLE': 'BNA',
  'MEMPHIS': 'MEM',
  'LOUISVILLE': 'SDF',
  'TAMPA': 'TPA',
  'KANSAS CITY': 'MCI',
  'CINCINNATI': 'CVG',
  'CLEVELAND': 'CLE',
  'COLUMBUS': 'CMH',
  'INDIANAPOLIS': 'IND',
  'PITTSBURGH': 'PIT',
  'ST LOUIS': 'STL',
  'ST. LOUIS': 'STL',
  'WASHINGTON DC': 'DCA',
  'WASHINGTON': 'DCA',
  'WASHINGTON DULLES': 'IAD',
  'RALEIGH-DURHAM': 'RDU',
  'RALEIGH': 'RDU',
  'CHARLESTON': 'CHS',
  'CHARLESTON SC': 'CHS',
  'SAVANNAH': 'SAV',
  'JACKSONVILLE': 'JAX',
  'RICHMOND': 'RIC',
  'NORFOLK': 'ORF',
  'GRAND RAPIDS': 'GRR',
  'SACRAMENTO': 'SMF',
  'SAN JOSE': 'SJC',
  'OAKLAND': 'OAK',
  'ORANGE COUNTY': 'SNA',
  'BURBANK': 'BUR',
  'SAN ANTONIO': 'SAT',
  'ALBUQUERQUE': 'ABQ',
  'TUCSON': 'TUS',
  'EL PASO': 'ELP',
  'HONOLULU': 'HNL',
  'MAUI': 'OGG',
  'KAUAI': 'LIH',
  'ANCHORAGE': 'ANC',
  'PORTLAND ME': 'PWM',
  'PORTLAND MAINE': 'PWM',
  'MANCHESTER': 'MHT',
  'PROVIDENCE': 'PVD',
  'HARTFORD': 'BDL',
  'BUFFALO': 'BUF',
  'ROCHESTER': 'ROC',
  'SYRACUSE': 'SYR',
  'ALBANY': 'ALB',
  'FORT MYERS': 'RSW',
  'WEST PALM BEACH': 'PBI',
  'SARASOTA': 'SRQ',
  'PENSACOLA': 'PNS',
  'DESTIN': 'VPS',
  'BIRMINGHAM': 'BHM',
  'MADISON': 'MSN',
  'MILWAUKEE': 'MKE',
  'OMAHA': 'OMA',
  'DES MOINES': 'DSM',
  'SPOKANE': 'GEG',
  'BOISE': 'BOI',
  'SALT LAKE': 'SLC',
  'WILMINGTON': 'ILM',
  'MYRTLE BEACH': 'MYR',
  
  // International
  'LONDON': 'LHR',
  'BOGOTA': 'BOG',
  'BOGOTÁ': 'BOG',
  'BUENOS AIRES': 'EZE',
  'SAO PAULO': 'GRU',
  'SÃO PAULO': 'GRU',
  'SANTO DOMINGO': 'SDQ',
  'LIMA': 'LIM',
  'CALGARY': 'YYC',
  'TORONTO': 'YYZ',
  'VANCOUVER': 'YVR',
  'MONTREAL': 'YUL',
  'MEXICO CITY': 'MEX',
  'CANCUN': 'CUN',
  'CANCÚN': 'CUN',
  'PARIS': 'CDG',
  'FRANKFURT': 'FRA',
  'AMSTERDAM': 'AMS',
  'MADRID': 'MAD',
  'BARCELONA': 'BCN',
  'ROME': 'FCO',
  'DUBLIN': 'DUB',
  'TOKYO': 'NRT',
  'SEOUL': 'ICN',
  'HONG KONG': 'HKG',
  'SINGAPORE': 'SIN',
  'SYDNEY': 'SYD',
  'MELBOURNE': 'MEL',
};

export interface UserBaseMigrationResult {
  totalUsers: number;
  usersScanned: number;
  usersNormalized: number;
  usersAlreadyCorrect: number;
  usersUnmapped: number;
  errors: number;
  details: {
    normalized: Array<{ userId: string; name: string; oldBase: string; newBase: string }>;
    unmapped: Array<{ userId: string; name: string; base: string }>;
    errors: Array<{ userId: string; name: string; error: string }>;
  };
}

/**
 * Normalize a base value to airport code
 */
function normalizeBase(base: string): string | null {
  if (!base) return null;
  
  const upper = base.toUpperCase().trim();
  
  // Already an airport code (3 letters)
  if (/^[A-Z]{3}$/.test(upper)) {
    return upper;
  }
  
  // Look up in mapping
  return CITY_NAME_TO_CODE[upper] || null;
}

/**
 * Check if a base is already normalized (3-letter code)
 */
function isAlreadyNormalized(base: string): boolean {
  if (!base) return false;
  return /^[A-Z]{3}$/.test(base.toUpperCase().trim());
}

/**
 * Run the user base normalization migration
 */
export async function migrateUserBases(): Promise<UserBaseMigrationResult> {
  console.log('🔄 Starting user base normalization migration...');
  
  const result: UserBaseMigrationResult = {
    totalUsers: 0,
    usersScanned: 0,
    usersNormalized: 0,
    usersAlreadyCorrect: 0,
    usersUnmapped: 0,
    errors: 0,
    details: {
      normalized: [],
      unmapped: [],
      errors: []
    }
  };
  
  try {
    // Fetch all users
    console.log('👥 Fetching users...');
    const usersSnapshot = await getDocs(collection(db, 'users'));
    result.totalUsers = usersSnapshot.size;
    console.log(`Found ${result.totalUsers} users`);
    
    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      result.usersScanned++;
      
      const userData = userDoc.data();
      const userId = userDoc.id;
      const userName = userData.displayName || 'Unknown';
      const currentBase = userData.base as string | undefined;
      
      // Skip users without a base
      if (!currentBase) {
        continue;
      }
      
      // Check if already normalized
      if (isAlreadyNormalized(currentBase)) {
        result.usersAlreadyCorrect++;
        console.log(`✅ ${userName} - Already normalized: ${currentBase}`);
        continue;
      }
      
      // Try to normalize
      const normalizedBase = normalizeBase(currentBase);
      
      if (normalizedBase) {
        // Update user document
        try {
          await updateDoc(doc(db, 'users', userId), {
            base: normalizedBase
          });
          
          result.usersNormalized++;
          result.details.normalized.push({
            userId,
            name: userName,
            oldBase: currentBase,
            newBase: normalizedBase
          });
          
          console.log(`🔄 ${userName} - Normalized: ${currentBase} → ${normalizedBase}`);
        } catch (error: any) {
          result.errors++;
          result.details.errors.push({
            userId,
            name: userName,
            error: error.message
          });
          
          console.error(`❌ ${userName} - Update failed:`, error);
        }
      } else {
        // Could not map to a code
        result.usersUnmapped++;
        result.details.unmapped.push({
          userId,
          name: userName,
          base: currentBase
        });
        
        console.warn(`⚠️ ${userName} - Could not map base: ${currentBase}`);
      }
    }
    
    console.log('\n✅ Migration complete!');
    console.log(`📊 Results:`);
    console.log(`   Total users: ${result.totalUsers}`);
    console.log(`   Scanned: ${result.usersScanned}`);
    console.log(`   ✅ Already correct: ${result.usersAlreadyCorrect}`);
    console.log(`   🔄 Normalized: ${result.usersNormalized}`);
    console.log(`   ⚠️ Unmapped: ${result.usersUnmapped}`);
    console.log(`   ❌ Errors: ${result.errors}`);
    
    return result;
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

/**
 * Preview what the migration would do (dry run)
 */
export async function previewUserBaseMigration(): Promise<UserBaseMigrationResult> {
  console.log('👀 Preview mode: No changes will be made');
  
  const result: UserBaseMigrationResult = {
    totalUsers: 0,
    usersScanned: 0,
    usersNormalized: 0,
    usersAlreadyCorrect: 0,
    usersUnmapped: 0,
    errors: 0,
    details: {
      normalized: [],
      unmapped: [],
      errors: []
    }
  };
  
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    result.totalUsers = usersSnapshot.size;
    
    for (const userDoc of usersSnapshot.docs) {
      result.usersScanned++;
      
      const userData = userDoc.data();
      const userId = userDoc.id;
      const userName = userData.displayName || 'Unknown';
      const currentBase = userData.base as string | undefined;
      
      if (!currentBase) continue;
      
      if (isAlreadyNormalized(currentBase)) {
        result.usersAlreadyCorrect++;
        console.log(`✅ ${userName} - Already normalized: ${currentBase}`);
        continue;
      }
      
      const normalizedBase = normalizeBase(currentBase);
      
      if (normalizedBase) {
        result.usersNormalized++;
        result.details.normalized.push({
          userId,
          name: userName,
          oldBase: currentBase,
          newBase: normalizedBase
        });
        
        console.log(`🔄 ${userName} - Would normalize: ${currentBase} → ${normalizedBase}`);
      } else {
        result.usersUnmapped++;
        result.details.unmapped.push({
          userId,
          name: userName,
          base: currentBase
        });
        
        console.warn(`⚠️ ${userName} - Cannot map base: ${currentBase}`);
      }
    }
    
    console.log('\n👀 Preview complete (no changes made)');
    console.log(`📊 Results:`);
    console.log(`   Total users: ${result.totalUsers}`);
    console.log(`   ✅ Already correct: ${result.usersAlreadyCorrect}`);
    console.log(`   🔄 Would normalize: ${result.usersNormalized}`);
    console.log(`   ⚠️ Cannot map: ${result.usersUnmapped}`);
    
    return result;
    
  } catch (error: any) {
    console.error('❌ Preview failed:', error);
    throw error;
  }
}
