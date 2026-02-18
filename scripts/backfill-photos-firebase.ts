import 'dotenv/config';

// scripts/backfill-photos-firebase.ts
// Fetches Google Places photos and uploads to Firebase Storage
// for all spots that have a placeId but no photos

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

async function fetchAndUploadPhotos(
  placeId: string,
  spotId: string
): Promise<string[]> {
  const firebaseUrls: string[] = [];

  try {
    const detailsResponse = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_PLACES_API_KEY}`
    );
    const detailsData = await detailsResponse.json();

    if (detailsData.status !== 'OK' || !detailsData.result?.photos?.length) {
      return [];
    }

    const photos = detailsData.result.photos.slice(0, 3);

    for (let i = 0; i < photos.length; i++) {
      try {
        const photoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photos[i].photo_reference}&key=${GOOGLE_PLACES_API_KEY}`;
        const photoResponse = await fetch(photoUrl);

        if (!photoResponse.ok) continue;

        const blob = await photoResponse.blob();
        const storageRef = ref(storage, `spots/backfill/${spotId}_${i}_${Date.now()}.jpg`);
        await uploadBytes(storageRef, blob);
        const downloadUrl = await getDownloadURL(storageRef);
        firebaseUrls.push(downloadUrl);
        console.log(`    ✅ Photo ${i + 1} uploaded`);
      } catch (err) {
        console.log(`    ❌ Photo ${i + 1} failed`);
      }

      await new Promise(r => setTimeout(r, 300));
    }
  } catch (error) {
    console.error('    Error:', error);
  }

  return firebaseUrls;
}

async function main() {
  console.log('📸 Backfill Spot Photos → Firebase Storage');
  console.log('==========================================\n');

  if (!GOOGLE_PLACES_API_KEY) {
    console.error('❌ No API key found');
    process.exit(1);
  }

  const snapshot = await getDocs(collection(db, 'spots'));
  console.log(`📦 Found ${snapshot.size} total spots\n`);

  // Find spots with placeId but no photos
  const needPhotos = snapshot.docs.filter(d => {
    const data = d.data();
    return data.placeId && (!data.photoURLs || data.photoURLs.length === 0);
  });

  console.log(`📷 ${needPhotos.length} spots need photos\n`);

  if (needPhotos.length === 0) {
    console.log('✨ All spots already have photos!');
    return;
  }

  let success = 0;
  let noPhotos = 0;
  let failed = 0;

  for (let i = 0; i < needPhotos.length; i++) {
    const spotDoc = needPhotos[i];
    const data = spotDoc.data();

    console.log(`[${i + 1}/${needPhotos.length}] ${data.name} (${data.city || '?'})`);

    const urls = await fetchAndUploadPhotos(data.placeId, spotDoc.id);

    if (urls.length > 0) {
      await updateDoc(doc(db, 'spots', spotDoc.id), { photoURLs: urls });
      success++;
      console.log(`   💾 ${urls.length} photos saved\n`);
    } else {
      noPhotos++;
      console.log(`   ⚠️  No photos available\n`);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n📊 SUMMARY');
  console.log('==========');
  console.log(`Spots processed:     ${needPhotos.length}`);
  console.log(`Photos added:        ${success}`);
  console.log(`No photos available: ${noPhotos}`);
  console.log(`\n🎉 Done! All photos stored in Firebase Storage (no ongoing API costs).`);
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('💥 Failed:', err);
    process.exit(1);
  });
