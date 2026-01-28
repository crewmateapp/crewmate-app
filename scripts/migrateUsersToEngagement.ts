// scripts/migrateUsersToEngagement.ts
/**
 * Migration Script: Add Engagement System Fields to Existing Users
 * 
 * This script adds the new engagement fields (cms, badges, stats, etc.) 
 * to all existing user documents in Firestore.
 * 
 * Run this ONCE when deploying the engagement system.
 */

import { db } from '@/config/firebase';
import { collection, getDocs, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
import { DEFAULT_ENGAGEMENT_FIELDS, DEFAULT_USER_STATS } from '@/types/user';
import { getLevelForCMS } from '@/constants/Levels';
import { CMS_POINTS } from '@/constants/ScoringRules';

interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;
  errors: number;
  errorDetails: Array<{ uid: string; displayName: string; error: string }>;
}

/**
 * Calculate retroactive CMS for existing user activity
 * This rewards users for what they've already done!
 */
function calculateRetroactiveCMS(userData: any): number {
  let cms = 0;
  
  // Check-ins from layoverHistory
  const layoverHistory = userData.layoverHistory || [];
  cms += layoverHistory.length * CMS_POINTS.LAYOVER_CHECK_IN;
  
  // Plans hosted (if you track this separately)
  const plansHosted = userData.plansHosted || 0;
  cms += plansHosted * CMS_POINTS.PLAN_HOSTED;
  
  // Plans attended (if you track this separately)
  const plansAttended = userData.plansAttended || 0;
  cms += plansAttended * CMS_POINTS.PLAN_ATTENDED;
  
  // Reviews written (if you track this)
  const reviews = userData.reviewsWritten || 0;
  cms += reviews * CMS_POINTS.REVIEW_WRITTEN;
  
  // Connections (if you track this)
  const connections = userData.connections?.length || 0;
  cms += connections * CMS_POINTS.CONNECTION_ACCEPTED;
  
  return Math.round(cms);
}

/**
 * Calculate retroactive stats from existing user data
 */
function calculateRetroactiveStats(userData: any): any {
  const layoverHistory = userData.layoverHistory || [];
  const uniqueCities = [...new Set(layoverHistory)];
  
  const stats = {
    ...DEFAULT_USER_STATS,
    totalCheckIns: layoverHistory.length,
    citiesVisited: uniqueCities.length,
    connectionsCount: userData.connections?.length || 0,
  };
  
  // Build cityCheckIns map from layoverHistory
  const cityCheckIns: { [key: string]: number } = {};
  layoverHistory.forEach((city: string) => {
    cityCheckIns[city] = (cityCheckIns[city] || 0) + 1;
  });
  stats.cityCheckIns = cityCheckIns;
  
  return stats;
}

/**
 * Check if user is a demo account
 */
function isDemoAccount(userData: any, userId: string): boolean {
  // Check if email contains "demo"
  if (userData.email?.toLowerCase().includes('demo')) return true;
  
  // Check if UID starts with "demo-"
  if (userId.startsWith('demo-')) return true;
  
  // Check if display name contains "Demo"
  if (userData.displayName?.includes('Demo')) return true;
  
  return false;
}

/**
 * Main migration function
 */
export async function migrateUsersToEngagement(): Promise<MigrationResult> {
  console.log('🚀 Starting user engagement migration...');
  
  const result: MigrationResult = {
    total: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [],
  };
  
  try {
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    result.total = usersSnapshot.size;
    
    console.log(`📊 Found ${result.total} users to migrate`);
    
    // Sort users by creation date and identify first 50 real users
    const allUsers = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      data: doc.data(),
    }));
    
    // Filter out demo accounts
    const realUsers = allUsers.filter(user => !isDemoAccount(user.data, user.id));
    
    // Sort by creation date (oldest first)
    realUsers.sort((a, b) => {
      const dateA = a.data.createdAt?.toMillis?.() || 0;
      const dateB = b.data.createdAt?.toMillis?.() || 0;
      return dateA - dateB;
    });
    
    // Get UIDs of first 50 real signups
    const foundingCrewUIDs = new Set(
      realUsers.slice(0, 50).map(user => user.id)
    );
    
    console.log(`👑 Marking ${foundingCrewUIDs.size} users as Founding Crew (first 50 real signups)`);
    
    // Process each user
    for (const userDoc of usersSnapshot.docs) {
      const uid = userDoc.id;
      const userData = userDoc.data();
      const displayName = userData.displayName || 'Unknown User';
      
      try {
        // Check if already migrated
        if (userData.cms !== undefined) {
          console.log(`⏭️  ${displayName} (${uid}): Already migrated, skipping`);
          result.skipped++;
          continue;
        }
        
        // Calculate retroactive CMS
        const retroactiveCMS = calculateRetroactiveCMS(userData);
        
        // Calculate retroactive stats
        const retroactiveStats = calculateRetroactiveStats(userData);
        
        // Determine level based on CMS
        const levelInfo = getLevelForCMS(retroactiveCMS);
        
        // Prepare update data
        const updateData: any = {
          cms: retroactiveCMS,
          level: levelInfo.id,
          badges: [],
          featuredBadges: [],
          stats: retroactiveStats,
          achievements: {},
          profile: {
            coverPhoto: null,
            bio: userData.bio || null,
            theme: 'default',
          },
          updatedAt: serverTimestamp(),
        };
        
        // Mark as Founding Crew if in first 50 real signups
        if (foundingCrewUIDs.has(uid)) {
          const foundingCrewIndex = realUsers.findIndex(u => u.id === uid);
          updateData.isFoundingCrew = true;
          console.log(`   👑 Founding Crew #${foundingCrewIndex + 1}`);
        }
        
        // Update user document
        await updateDoc(doc(db, 'users', uid), updateData);
        
        result.updated++;
        console.log(`✅ ${displayName} (${uid}):`);
        console.log(`   Awarded: ${retroactiveCMS} CMS`);
        console.log(`   Level: ${levelInfo.name}`);
        console.log(`   Check-ins: ${retroactiveStats.totalCheckIns}`);
        console.log(`   Cities: ${retroactiveStats.citiesVisited}`);
        console.log('');
        
      } catch (error: any) {
        result.errors++;
        result.errorDetails.push({
          uid,
          displayName,
          error: error.message,
        });
        console.error(`❌ Error updating ${displayName} (${uid}):`, error.message);
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   Total users: ${result.total}`);
    console.log(`   Updated: ${result.updated}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Errors: ${result.errors}`);
    
    if (result.errorDetails.length > 0) {
      console.log('\n⚠️  Errors:');
      result.errorDetails.forEach(({ displayName, uid, error }) => {
        console.log(`   ${displayName} (${uid}): ${error}`);
      });
    }
    
    console.log('\n✨ Migration complete!');
    
    return result;
    
  } catch (error: any) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

/**
 * Dry run - shows what would be updated without actually updating
 */
export async function dryRunMigration(): Promise<void> {
  console.log('🔍 Running DRY RUN (no changes will be made)...\n');
  
  const usersSnapshot = await getDocs(collection(db, 'users'));
  
  console.log(`Found ${usersSnapshot.size} users\n`);
  
  // Sort users by creation date and identify first 50 real users
  const allUsers = usersSnapshot.docs.map(doc => ({
    id: doc.id,
    data: doc.data(),
  }));
  
  // Filter out demo accounts
  const realUsers = allUsers.filter(user => !isDemoAccount(user.data, user.id));
  
  // Sort by creation date (oldest first)
  realUsers.sort((a, b) => {
    const dateA = a.data.createdAt?.toMillis?.() || 0;
    const dateB = b.data.createdAt?.toMillis?.() || 0;
    return dateA - dateB;
  });
  
  // Get UIDs of first 50 real signups
  const foundingCrewUIDs = new Set(
    realUsers.slice(0, 50).map(user => user.id)
  );
  
  console.log(`👥 ${realUsers.length} real users (${usersSnapshot.size - realUsers.length} demo accounts)`);
  console.log(`👑 First ${foundingCrewUIDs.size} will be marked as Founding Crew\n`);
  
  let alreadyMigrated = 0;
  let toMigrate = 0;
  
  for (const userDoc of usersSnapshot.docs) {
    const uid = userDoc.id;
    const userData = userDoc.data();
    const displayName = userData.displayName || 'Unknown User';
    
    if (userData.cms !== undefined) {
      console.log(`${displayName}: Already migrated (${userData.cms} CMS)`);
      alreadyMigrated++;
      continue;
    }
    
    toMigrate++;
    const retroactiveCMS = calculateRetroactiveCMS(userData);
    const retroactiveStats = calculateRetroactiveStats(userData);
    const levelInfo = getLevelForCMS(retroactiveCMS);
    
    console.log(`${displayName} (${uid}):`);
    console.log(`  Would award: ${retroactiveCMS} CMS`);
    console.log(`  Would set level: ${levelInfo.name}`);
    console.log(`  Check-ins: ${retroactiveStats.totalCheckIns}`);
    console.log(`  Cities: ${retroactiveStats.citiesVisited}`);
    if (foundingCrewUIDs.has(uid)) {
      const foundingCrewIndex = realUsers.findIndex(u => u.id === uid);
      console.log(`  👑 Would mark as Founding Crew #${foundingCrewIndex + 1}`);
    }
    console.log('');
  }
  
  console.log('\n📊 Summary:');
  console.log(`  Already migrated: ${alreadyMigrated}`);
  console.log(`  To migrate: ${toMigrate}`);
  console.log('\n✅ Dry run complete - no changes made');
}

// Export for use in admin panel or script
export default migrateUsersToEngagement;
