/**
 * Migration Script: Reset Plan Stats for Alpha Users
 * 
 * This script:
 * 1. Copies old plansHosted -> plansCreated (keep history)
 * 2. Sets plansCompleted = 0 (start fresh with new system)
 * 3. Sets plansCompletedWithAttendees = 0
 * 4. Sets layoversCompleted = totalCheckIns (assume old check-ins were completed)
 * 5. Adds layoversCreated = totalCheckIns
 * 
 * Run this ONCE before deploying the new system
 */

import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/config/firebase';

export async function migratePlanStats() {
  console.log('🔄 Starting stats migration...');
  
  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  try {
    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`📊 Found ${usersSnapshot.size} users to migrate`);

    for (const userDoc of usersSnapshot.docs) {
      try {
        const userData = userDoc.data();
        const stats = userData.stats || {};
        
        // Prepare migration data
        const migrationData: any = {
          // Plan stats migration
          'stats.plansCreated': stats.plansHosted || 0, // Copy old value for history
          'stats.plansCompleted': 0, // Reset to zero - start fresh
          'stats.plansCompletedWithAttendees': 0, // Reset to zero
          
          // Layover stats migration
          'stats.layoversCreated': stats.totalCheckIns || 0, // Copy for history
          'stats.layoversCompleted': stats.totalCheckIns || 0, // Assume old check-ins completed
          
          // Timestamp
          migratedAt: new Date(),
        };

        // Update user document
        await updateDoc(doc(db, 'users', userDoc.id), migrationData);
        
        successCount++;
        console.log(`✅ Migrated user ${userDoc.id} (${successCount}/${usersSnapshot.size})`);
        
      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`User ${userDoc.id}: ${errorMsg}`);
        console.error(`❌ Error migrating user ${userDoc.id}:`, errorMsg);
      }
    }

    // Summary
    console.log('\n📋 Migration Summary:');
    console.log(`✅ Successfully migrated: ${successCount} users`);
    console.log(`❌ Errors: ${errorCount} users`);
    
    if (errors.length > 0) {
      console.log('\n🔴 Error Details:');
      errors.forEach(err => console.log(`  - ${err}`));
    }

    return {
      success: errorCount === 0,
      successCount,
      errorCount,
      errors,
    };

  } catch (error) {
    console.error('💥 Migration failed:', error);
    throw error;
  }
}

/**
 * Reset ALL plan documents to mark as not completed
 * This allows hosts to check in again with the new system
 */
export async function resetPlanCompletionStatus() {
  console.log('🔄 Resetting plan completion status...');
  
  let count = 0;

  try {
    const plansSnapshot = await getDocs(collection(db, 'plans'));
    console.log(`📊 Found ${plansSnapshot.size} plans to reset`);

    for (const planDoc of plansSnapshot.docs) {
      await updateDoc(doc(db, 'plans', planDoc.id), {
        hostCompletedAt: null,
        hostCompletedBy: null,
      });
      
      count++;
      if (count % 10 === 0) {
        console.log(`✅ Reset ${count}/${plansSnapshot.size} plans`);
      }
    }

    console.log(`✅ Reset ${count} plans`);
    return { success: true, count };

  } catch (error) {
    console.error('💥 Plan reset failed:', error);
    throw error;
  }
}

/**
 * Full migration - runs both user stats and plan reset
 */
export async function runFullMigration() {
  console.log('🚀 Starting full migration...\n');
  
  try {
    // Step 1: Migrate user stats
    console.log('📝 Step 1: Migrating user stats...');
    const userResults = await migratePlanStats();
    
    // Step 2: Reset plan completion status
    console.log('\n📝 Step 2: Resetting plan completion status...');
    const planResults = await resetPlanCompletionStatus();
    
    console.log('\n🎉 Full migration complete!');
    console.log(`   - Users migrated: ${userResults.successCount}`);
    console.log(`   - Plans reset: ${planResults.count}`);
    
    return {
      success: userResults.success && planResults.success,
      userResults,
      planResults,
    };
    
  } catch (error) {
    console.error('💥 Full migration failed:', error);
    throw error;
  }
}

// ============================================================================
// USAGE INSTRUCTIONS
// ============================================================================

/*
To run this migration:

1. Create a temporary admin page or script
2. Import and call:

   import { runFullMigration } from '@/utils/migration_resetPlanStats';
   
   // In a button or on page load (with confirmation)
   const handleMigration = async () => {
     const confirmed = window.confirm(
       'This will reset all plan completion stats. Continue?'
     );
     
     if (confirmed) {
       try {
         const result = await runFullMigration();
         console.log('Migration result:', result);
         alert('Migration complete!');
       } catch (error) {
         console.error('Migration error:', error);
         alert('Migration failed! Check console.');
       }
     }
   };

3. Run ONCE before deploying new code
4. Announce to alpha users:
   "We've updated how plans are tracked! Plans now require check-in 
   at the location to count toward badges. Your plan history is preserved, 
   but you'll start fresh with the new system."

5. Remove the migration page after running
*/
