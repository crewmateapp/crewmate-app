// utils/migrateUserStats.ts
// Backfill spotsAdded, reviewsWritten, and photosUploaded for all users

import { db } from '@/config/firebase';
import { collection, getDocs, doc, updateDoc, query, where } from 'firebase/firestore';

export async function migrateUserStats() {
  try {
    console.log('🔄 Starting user stats migration...\n');
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    console.log(`📊 Found ${usersSnapshot.size} total users\n`);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userName = userDoc.data()?.displayName || userDoc.data()?.email || userId;
      
      try {
        // ===== COUNT APPROVED SPOTS =====
        const spotsQuery = query(
          collection(db, 'spots'),
          where('addedBy', '==', userId),
          where('status', '==', 'approved')
        );
        const spotsSnap = await getDocs(spotsQuery);
        const spotsAdded = spotsSnap.size;
        
        // ===== COUNT REVIEWS =====
        const reviewsQuery = query(
          collection(db, 'reviews'),
          where('userId', '==', userId)
        );
        const reviewsSnap = await getDocs(reviewsQuery);
        const reviewsWritten = reviewsSnap.size;
        
        // ===== COUNT PHOTOS =====
        // Count photos from reviews
        let photosUploaded = 0;
        reviewsSnap.docs.forEach(doc => {
          const photos = doc.data().photos || [];
          photosUploaded += photos.length;
        });
        
        // Count photos from approved spots
        const approvedSpotsQuery = query(
          collection(db, 'spots'),
          where('addedBy', '==', userId),
          where('status', '==', 'approved')
        );
        const approvedSpotsSnap = await getDocs(approvedSpotsQuery);
        approvedSpotsSnap.docs.forEach(doc => {
          const photos = doc.data().photoURLs || doc.data().photos || [];
          photosUploaded += photos.length;
        });
        
        // ===== UPDATE USER STATS =====
        if (spotsAdded > 0 || reviewsWritten > 0 || photosUploaded > 0) {
          await updateDoc(doc(db, 'users', userId), {
            'stats.spotsAdded': spotsAdded,
            'stats.reviewsWritten': reviewsWritten,
            'stats.photosUploaded': photosUploaded
          });
          
          updatedCount++;
          console.log(`✅ ${userName}: ${spotsAdded} spots, ${reviewsWritten} reviews, ${photosUploaded} photos`);
        } else {
          console.log(`⏭️  ${userName}: No stats to update`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error processing ${userName}:`, error);
      }
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 Migration Complete!');
    console.log('='.repeat(60));
    console.log(`✅ Users updated: ${updatedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total users: ${usersSnapshot.size}`);
    console.log('='.repeat(60) + '\n');
    
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
