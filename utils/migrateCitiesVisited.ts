// utils/migrateCitiesVisited.ts
// Migration to backfill citiesVisitedCount for existing users

import { db } from '@/config/firebase';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  where 
} from 'firebase/firestore';

export async function migrateCitiesVisited() {
  try {
    console.log('🔄 Starting cities visited migration...');
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      
      try {
        // Get all layovers for this user
        const layoversQuery = query(
          collection(db, 'layovers'),
          where('userId', '==', userId)
        );
        const layoversSnap = await getDocs(layoversQuery);
        
        // Extract unique cities from all their layovers
        const uniqueCities = new Set<string>();
        layoversSnap.docs.forEach(doc => {
          const city = doc.data().city;
          if (city) {
            uniqueCities.add(city);
          }
        });
        
        const visitedCities = Array.from(uniqueCities);
        const citiesVisitedCount = visitedCities.length;
        
        // Update user document
        if (citiesVisitedCount > 0) {
          await updateDoc(doc(db, 'users', userId), {
            visitedCities: visitedCities,
            'stats.citiesVisitedCount': citiesVisitedCount
          });
          
          updatedCount++;
          console.log(`✅ Updated ${userId}: ${citiesVisitedCount} cities`);
        }
      } catch (error) {
        console.error(`❌ Error processing user ${userId}:`, error);
        errorCount++;
      }
    }
    
    console.log('\n🎉 Migration complete!');
    console.log(`   Users updated: ${updatedCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`   Total users: ${usersSnapshot.size}`);
    
    return {
      success: true,
      updatedCount,
      errorCount,
      totalUsers: usersSnapshot.size
    };
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    return {
      success: false,
      error: error
    };
  }
}
