import 'dotenv/config';

// scripts/migrate-google-photo-urls.ts
// ==========================================================================
// Replaces dead Google Places photo URLs with fresh Firebase Storage URLs
// Uses each spot's placeId + your NEW API key to re-fetch photos
// ==========================================================================

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const GOOGLE_PLACES_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

function isGooglePlacesPhotoUrl(url: string): boolean {
  return url.includes('maps.googleapis.com/maps/api/place/photo');
}

// Fetch fresh photos using placeId + new API key, upload to Firebase Storage
async function fetchFreshPhotos(
  placeId: string,
  spotId: string,
  maxPhotos: number = 3
): Promise<string[]> {
  const firebaseUrls: string[] = [];

  try {
    // Step 1: Get fresh photo references using NEW API key
    const detailsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`
    );
    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK' || !detailsData.result?.photos?.length) {
      console.log('    No photos available from Google');
      return [];
    }

    const photos = detailsData.result.photos.slice(0, maxPhotos);

    // Step 2: Download each photo and upload to Firebase Storage
    for (let i = 0; i < photos.length; i++) {
      try {
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photos[i].photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
        const photoResponse = await fetch(photoUrl);

        if (!photoResponse.ok) {
          console.log(`    Photo ${i + 1}: fetch failed (HTTP ${photoResponse.status})`);
          continue;
        }

        const blob = await photoResponse.blob();
        const timestamp = Date.now();
        const storageRef = ref(storage, `spots/migrated/${spotId}_${i}_${timestamp}.jpg`);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        firebaseUrls.push(downloadUrl);
        console.log(`    ✅ Photo ${i + 1}: uploaded to Firebase Storage`);
      } catch (err) {
        console.log(`    ❌ Photo ${i + 1}: upload error`);
      }

      // Small delay between photo fetches
      await new Promise(r => setTimeout(r, 300));
    }
  } catch (error) {
    console.error('    Error fetching place details:', error);
  }

  return firebaseUrls;
}

async function main() {
  console.log('🔄 Google Places Photo URL Migration (Fresh Fetch)');
  console.log('===================================================\n');

  if (!GOOGLE_PLACES_API_KEY) {
    console.error('❌ EXPO_PUBLIC_GOOGLE_PLACES_API_KEY not found in .env');
    process.exit(1);
  }

  console.log('✅ Using API key:', GOOGLE_PLACES_API_KEY.slice(0, 10) + '...\n');

  const snapshot = await getDocs(collection(db, 'spots'));
  console.log(`📦 Found ${snapshot.size} total spots\n`);

  let spotsWithGoogleUrls = 0;
  let spotsFixed = 0;
  let spotsFailed = 0;
  let spotsNoPlaceId = 0;
  let totalPhotosUploaded = 0;

  for (const spotDoc of snapshot.docs) {
    const data = spotDoc.data();
    const photoURLs: string[] = data.photoURLs || [];

    const hasGoogleUrls = photoURLs.some(isGooglePlacesPhotoUrl);
    if (!hasGoogleUrls) continue;

    spotsWithGoogleUrls++;
    console.log(`🔍 ${data.name} (${data.city || 'no city'})`);

    if (!data.placeId) {
      spotsNoPlaceId++;
      console.log('   ⚠️  No placeId — clearing dead photo URLs');
      await updateDoc(doc(db, 'spots', spotDoc.id), { photoURLs: [] });
      continue;
    }

    // Fetch fresh photos using new API key
    const freshUrls = await fetchFreshPhotos(data.placeId, spotDoc.id);

    if (freshUrls.length > 0) {
      await updateDoc(doc(db, 'spots', spotDoc.id), { photoURLs: freshUrls });
      spotsFixed++;
      totalPhotosUploaded += freshUrls.length;
      console.log(`   💾 Saved ${freshUrls.length} Firebase photos\n`);
    } else {
      // Clear the dead Google URLs so they don't cause 403 errors in the app
      await updateDoc(doc(db, 'spots', spotDoc.id), { photoURLs: [] });
      spotsFailed++;
      console.log('   🗑️  Cleared dead URLs (no photos available)\n');
    }

    // Rate limit: 500ms between spots
    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n📊 MIGRATION SUMMARY');
  console.log('====================');
  console.log(`Total spots scanned:       ${snapshot.size}`);
  console.log(`Spots with Google URLs:    ${spotsWithGoogleUrls}`);
  console.log(`Spots fixed (new photos):  ${spotsFixed}`);
  console.log(`Total photos uploaded:     ${totalPhotosUploaded}`);
  console.log(`Spots cleared (no photos): ${spotsFailed}`);
  console.log(`Spots without placeId:     ${spotsNoPlaceId}`);

  if (spotsFixed > 0) {
    console.log(`\n🎉 ${spotsFixed} spots now use Firebase Storage URLs!`);
    console.log('   No more Google Places API charges on photo renders.');
  }
}

main()
  .then(() => {
    console.log('\n✅ Migration complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('\n💥 Migration failed:', err);
    process.exit(1);
  });
