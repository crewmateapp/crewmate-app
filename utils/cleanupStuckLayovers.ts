// utils/cleanupStuckLayovers.ts
// Fix layovers that are marked as active but have expired
// SIMPLIFIED: Only looks at layover data, doesn't read user documents

import { db } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc, query, where, Timestamp } from 'firebase/firestore';

export async function cleanupStuckLayovers() {
  try {
    console.log('🧹 Starting stuck layover cleanup...\n');
    
    // Get all active layovers
    const layoversQuery = query(
      collection(db, 'layovers'),
      where('isActive', '==', true)
    );
    
    const layoversSnapshot = await getDocs(layoversQuery);
    console.log(`📊 Found ${layoversSnapshot.size} active layovers\n`);
    
    const now = new Date();
    let expiredCount = 0;
    let stillActiveCount = 0;
    let errorCount = 0;
    
    for (const layoverDoc of layoversSnapshot.docs) {
      const layoverData = layoverDoc.data();
      const city = layoverData.city;
      
      try {
        // Check if layover has a checkedInAt timestamp
        const checkedInAt = layoverData.checkedInAt?.toDate();
        
        if (!checkedInAt) {
          // No checkedInAt means it's old/malformed - mark inactive
          await updateDoc(doc(db, 'layovers', layoverDoc.id), {
            isActive: false
          });
          expiredCount++;
          console.log(`✅ Fixed layover without timestamp: ${city}`);
          continue;
        }
        
        // Calculate when this layover should expire (24 hours after check-in)
        const expiryTime = new Date(checkedInAt);
        expiryTime.setHours(expiryTime.getHours() + 24);
        
        // If it's been more than 24 hours, mark as inactive
        if (now > expiryTime) {
          await updateDoc(doc(db, 'layovers', layoverDoc.id), {
            isActive: false
          });
          expiredCount++;
          
          const hoursAgo = Math.floor((now.getTime() - expiryTime.getTime()) / (1000 * 60 * 60));
          console.log(`✅ Fixed expired layover: ${city} (expired ${hoursAgo}h ago)`);
        } else {
          stillActiveCount++;
          const hoursRemaining = Math.floor((expiryTime.getTime() - now.getTime()) / (1000 * 60 * 60));
          console.log(`⏭️  Still active: ${city} (${hoursRemaining}h remaining)`);
        }
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing layover in ${city}:`, error);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Cleanup Complete!');
    console.log('='.repeat(60));
    console.log(`✅ Expired layovers fixed: ${expiredCount}`);
    console.log(`⏭️  Still active (valid): ${stillActiveCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total checked: ${layoversSnapshot.size}`);
    console.log('='.repeat(60) + '\n');
    
    return {
      success: true,
      fixedCount: expiredCount,
      stillActiveCount,
      errorCount,
      totalChecked: layoversSnapshot.size
    };
    
  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    return {
      success: false,
      error: error
    };
  }
}
