// utils/backfillActivities.ts
// Call this once from the admin panel to create missing activity records

import { db } from '@/config/firebase';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';

export async function backfillSpotActivities(): Promise<{
  created: number;
  alreadyExists: number;
  errors: number;
}> {
  console.log('🔄 Starting backfill of spot activities...');

  let created = 0;
  let alreadyExists = 0;
  let errors = 0;

  try {
    // Get all spots
    const spotsSnapshot = await getDocs(collection(db, 'spots'));
    console.log(`📍 Found ${spotsSnapshot.size} total spots`);

    for (const spotDoc of spotsSnapshot.docs) {
      const spotData = spotDoc.data();
      const spotId = spotDoc.id;
      const addedBy = spotData.addedBy;

      if (!addedBy) {
        console.log(`⚠️  Spot ${spotId} has no addedBy field, skipping...`);
        errors++;
        continue;
      }

      // Get user's photo
      const userQuery = query(
        collection(db, 'users'),
        where('__name__', '==', addedBy)
      );
      const userSnapshot = await getDocs(userQuery);
      const userPhoto = userSnapshot.empty ? null : userSnapshot.docs[0].data().photoURL || null;

      // Check if activity already exists for this spot
      const activitiesQuery = query(
        collection(db, 'activities'),
        where('userId', '==', addedBy),
        where('spotId', '==', spotId),
        where('type', '==', 'spot_added')
      );
      const existingActivities = await getDocs(activitiesQuery);

      if (existingActivities.size > 0) {
        console.log(`✓ Activity already exists for spot: ${spotData.name}`);
        alreadyExists++;
        continue;
      }

      // Create missing spot_added activity
      await addDoc(collection(db, 'activities'), {
        userId: addedBy,
        userName: spotData.addedByName || 'Unknown',
        userPhoto: userPhoto,
        type: 'spot_added',
        spotId: spotId,
        spotName: spotData.name,
        city: spotData.city,
        createdAt: spotData.createdAt || serverTimestamp(),
      });

      console.log(`✅ Created spot_added activity for: ${spotData.name}`);
      created++;

      // If spot has photos, create photo_posted activity
      const photoURLs = spotData.photoURLs || spotData.photos || [];
      if (photoURLs.length > 0) {
        // Check if photo activity exists
        const photoActivitiesQuery = query(
          collection(db, 'activities'),
          where('userId', '==', addedBy),
          where('spotId', '==', spotId),
          where('type', '==', 'photo_posted')
        );
        const existingPhotoActivities = await getDocs(photoActivitiesQuery);

        if (existingPhotoActivities.size === 0) {
          await addDoc(collection(db, 'activities'), {
            userId: addedBy,
            userName: spotData.addedByName || 'Unknown',
            userPhoto: userPhoto,
            type: 'photo_posted',
            spotId: spotId,
            spotName: spotData.name,
            city: spotData.city,
            createdAt: spotData.createdAt || serverTimestamp(),
          });

          console.log(`✅ Created photo_posted activity for: ${spotData.name}`);
          created++;
        }
      }
    }

    // Backfill review activities from votes
    console.log('⭐ Checking for reviews/votes...');

    const votesSnapshot = await getDocs(collection(db, 'votes'));
    console.log(`Found ${votesSnapshot.size} total votes`);

    for (const voteDoc of votesSnapshot.docs) {
      const voteData = voteDoc.data();
      const userId = voteData.userId;
      const spotId = voteData.spotId;

      if (!userId || !spotId) {
        errors++;
        continue;
      }

      // Check if review activity exists
      const reviewActivitiesQuery = query(
        collection(db, 'activities'),
        where('userId', '==', userId),
        where('spotId', '==', spotId),
        where('type', '==', 'review_left')
      );
      const existingReviewActivities = await getDocs(reviewActivitiesQuery);

      if (existingReviewActivities.size === 0) {
        // Get spot name
        const spotQuery = query(
          collection(db, 'spots'),
          where('__name__', '==', spotId)
        );
        const spotSnapshot = await getDocs(spotQuery);
        
        if (spotSnapshot.empty) {
          errors++;
          continue;
        }

        const spotData = spotSnapshot.docs[0].data();

        // Get user name and photo
        const userQuery = query(
          collection(db, 'users'),
          where('__name__', '==', userId)
        );
        const userSnapshot = await getDocs(userQuery);
        const userData = userSnapshot.empty ? null : userSnapshot.docs[0].data();
        const userName = userData?.displayName || 'Unknown';
        const userPhoto = userData?.photoURL || null;

        await addDoc(collection(db, 'activities'), {
          userId: userId,
          userName: userName,
          userPhoto: userPhoto,
          type: 'review_left',
          spotId: spotId,
          spotName: spotData.name,
          city: spotData.city,
          rating: voteData.rating || 5,
          createdAt: voteData.createdAt || serverTimestamp(),
        });

        console.log(`✅ Created review_left activity for: ${spotData.name}`);
        created++;
      }
    }

    console.log('✨ BACKFILL COMPLETE!');
    console.log(`✅ Created: ${created} new activities`);
    console.log(`ℹ️  Already existed: ${alreadyExists} activities`);
    console.log(`⚠️  Errors: ${errors}`);

    return { created, alreadyExists, errors };
  } catch (error) {
    console.error('❌ Error during backfill:', error);
    throw error;
  }
}
