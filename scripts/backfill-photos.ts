// scripts/backfill-photos.ts
// Simple script to add Google Places photos to spots without photos

import { db, storage } from '../config/firebase';
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

async function fetchPhoto(placeId: string, spotId: string): Promise<string | null> {
  if (!placeId || !GOOGLE_PLACES_API_KEY) return null;

  try {
    // Get photo reference from Google Places
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`;
    const detailsRes = await fetch(detailsUrl);
    const detailsData: any = await detailsRes.json();

    if (detailsData.status !== 'OK' || !detailsData.result?.photos?.[0]) {
      console.log('   ⚠️  No photos available');
      return null;
    }

    // Fetch the actual photo
    const photoRef = detailsData.result.photos[0].photo_reference;
    const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1600&photo_reference=${photoRef}&key=${GOOGLE_PLACES_API_KEY}`;
    const photoRes = await fetch(photoUrl);
    
    if (!photoRes.ok) return null;

    // Upload to Firebase Storage
    const blob = await photoRes.blob();
    const storageRef = ref(storage, `spots/backfill/${spotId}_${Date.now()}.jpg`);
    await uploadBytes(storageRef, blob);
    
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('   ❌ Error:', error);
    return null;
  }
}

async function main() {
  console.log('🚀 Starting backfill...\n');

  // Get all approved spots
  const q = query(collection(db, 'spots'), where('status', '==', 'approved'));
  const snapshot = await getDocs(q);
  
  console.log(`📦 Found ${snapshot.size} approved spots`);

  // Filter for spots that need photos
  const needPhotos = snapshot.docs.filter(d => {
    const data = d.data();
    const hasPhotos = data.photoURLs?.length > 0;
    const hasPlaceId = !!data.placeId;
    return !hasPhotos && hasPlaceId;
  });

  console.log(`📊 ${needPhotos.length} spots need photos\n`);

  if (needPhotos.length === 0) {
    console.log('✨ All set! No spots need photos.');
    return;
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < needPhotos.length; i++) {
    const spotDoc = needPhotos[i];
    const data = spotDoc.data();
    
    console.log(`[${i + 1}/${needPhotos.length}] ${data.name} (${data.city})`);

    const photoURL = await fetchPhoto(data.placeId, spotDoc.id);

    if (photoURL) {
      await updateDoc(doc(db, 'spots', spotDoc.id), { photoURLs: [photoURL] });
      success++;
      console.log('   ✅ Added photo!');
    } else {
      failed++;
      console.log('   ❌ Failed');
    }

    await new Promise(r => setTimeout(r, 1000)); // Rate limit delay
  }

  console.log(`\n📈 Done! Success: ${success}, Failed: ${failed}`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Error:', err);
    process.exit(1);
  });
